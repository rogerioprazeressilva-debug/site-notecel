<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Permite que o front-end acesse o PHP
header('Access-Control-Allow-Methods: POST');

$dados = json_decode(file_get_contents('php://input'), true);

if (!$dados) {
    echo json_encode(['error' => 'Dados não recebidos']);
    exit;
}

// Simulação de Integração com Mercado Pago
$total = $dados['total'];
$whatsapp = $dados['whatsapp'];

// No futuro, aqui entrará a SDK do Mercado Pago
$respostaSimulada = [
    'status' => 'pending',
    'id' => rand(100000, 999999),
    'copy_paste' => "00020101021226850014br.gov.bcb.pix0123NOTECELPAY" . time(), // Código PIX Fake
];

echo json_encode($respostaSimulada);
?>