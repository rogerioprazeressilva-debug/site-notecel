<?php
// gerar_pix.php
require_once 'vendor/autoload.php';

// Configurações Mercado Pago
MercadoPago\SDK::setAccessToken(getenv("MERCADO_PAGO_TOKEN"));

// Configurações Supabase (Para integração com o banco)
$supabaseUrl = "https://uaaslrletscnlqxctnee.supabase.co";
$supabaseKey = getenv("SUPABASE_SERVICE_ROLE_KEY"); // Use a Service Role para permissões de escrita

$body = json_decode(file_get_contents('php://input'), true);
$total = $body['total'] ?? 0;
$whatsapp = $body['whatsapp'] ?? '';
$cartItems = $body['cartItems'] ?? [];
$userId = $body['user_id'] ?? null;
$email = $body['email'] ?? 'cliente@email.com';

if (empty($cartItems)) {
    die(json_encode(['error' => 'Carrinho vazio']));
}

// 1. Criar Pagamento no Mercado Pago
$payment = new MercadoPago\Payment();
$payment->transaction_amount = (float)$total;
$payment->description = "Pedido Notecel - " . $whatsapp;
$payment->payment_method_id = "pix";
$payment->payer = array(
    "email" => $email,
    "first_name" => "Cliente",
    "last_name" => "Notecel"
);

$payment->save();

if($payment->status == 'pending') {
    $pixId = (string)$payment->id;
    $firstProductId = $cartItems[0]['id'];

    // 2. Lógica de Banco de Dados via API do Supabase (cURL)
    // A. Reservar Login (Apenas se não for categoria 'Loja')
    $loginId = null;
    
    // Consulta se o produto é digital
    $ch = curl_init("$supabaseUrl/rest/v1/produtos?id=eq.$firstProductId&select=categoria");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ["apikey: $supabaseKey", "Authorization: Bearer $supabaseKey"]);
    $productRes = json_decode(curl_exec($ch), true);
    
    if ($productRes && $productRes[0]['categoria'] !== 'Loja') {
        // Busca um login disponível
        curl_setopt($ch, CURLOPT_URL, "$supabaseUrl/rest/v1/logins_disponiveis?produto_id=eq.$firstProductId&status=eq.disponivel&limit=1");
        $loginData = json_decode(curl_exec($ch), true);
        
        if (empty($loginData)) {
            die(json_encode(['error' => 'Estoque esgotado para este produto digital.']));
        }
        $loginId = $loginData[0]['id'];
    }

    // B. Criar o Pedido
    $pedidoData = [
        "pix_id" => $pixId,
        "total" => $total,
        "status" => "PENDENTE",
        "customer_whatsapp" => $whatsapp,
        "user_id" => $userId,
        "login_id" => $loginId
    ];

    curl_setopt($ch, CURLOPT_URL, "$supabaseUrl/rest/v1/pedidos?select=id");
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($pedidoData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "apikey: $supabaseKey",
        "Authorization: Bearer $supabaseKey",
        "Content-Type: application/json",
        "Prefer: return=representation"
    ]);
    
    $pedidoCreated = json_decode(curl_exec($ch), true);
    $pedidoUuid = $pedidoCreated[0]['id'];

    // C. Marcar Login como Reservado
    if ($loginId) {
        curl_setopt($ch, CURLOPT_URL, "$supabaseUrl/rest/v1/logins_disponiveis?id=eq.$loginId");
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "PATCH");
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(["status" => "reservado", "reserved_by_pedido_id" => $pedidoUuid]));
        curl_exec($ch);
    }

    curl_close($ch);

    // 3. Retornar dados para o Frontend
    echo json_encode([
        'qr_code' => $payment->point_of_interaction->transaction_data->qr_code,
        'qr_code_base64' => $payment->point_of_interaction->transaction_data->qr_code_base64,
        'id_pagamento' => $payment->id,
        'pedido_id' => $pedidoUuid
    ]);
} else {
    echo json_encode(['error' => 'Falha ao gerar pagamento', 'details' => $payment->error]);
}
?>