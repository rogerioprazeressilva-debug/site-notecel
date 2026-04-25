import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { valor, email, customer_whatsapp, cartItems } = body
    const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')

    // Validação extra para garantir que o ambiente está configurado
    if (!accessToken || accessToken.trim() === "") {
      throw new Error("Configuração ausente: MERCADO_PAGO_ACCESS_TOKEN não definido nas Secrets do Supabase.")
    }
    
    // 0. Identificar Usuário via JWT (Segurança)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    // Extrair ID do usuário do JWT (se houver)
    const authHeader = req.headers.get('Authorization');
    let userId = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id;
    }

    // 1. Criar pagamento no Mercado Pago
    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction_amount: parseFloat(Number(valor).toFixed(2)),
        description: `Pedido Notecell - ${customer_whatsapp}`,
        payment_method_id: 'pix',
        payer: { 
          email: email || 'cliente@email.com',
          first_name: 'Cliente',
          last_name: 'Notecel'
        }
      })
    })

    const paymentData = await mpResponse.json()

    if (!mpResponse.ok) throw new Error(paymentData.message || 'Erro no Mercado Pago')

    // Buscar o ID do produto no carrinho (assumindo que o carrinho tem apenas 1 item para simplificar)
    // Em um sistema real, você passaria o carrinho completo e faria um loop.
    // Por enquanto, vamos assumir que o "descricao" pode ser usado para buscar o produto_id
    // OU, o frontend deve enviar o produto_id junto.
    // Para este exemplo, vamos buscar um login aleatório para o primeiro item do carrinho.
    // O ideal seria que o frontend enviasse o `produto_id` do item que o cliente está comprando.
    // Identifica o produto para reservar o login (assumindo 1 item principal para este fluxo)
    const firstProductId = Array.isArray(cartItems) && cartItems.length > 0 ? cartItems[0].id : null;

    if (!firstProductId) throw new Error("Nenhum produto no carrinho para reservar login.");

    // 2. Verificar se o produto é digital ou físico (Loja)
    const { data: product } = await supabase
      .from('produtos')
      .select('categoria, quantidade')
      .eq('id', firstProductId)
      .single();

    let loginId = null;

    if (product?.categoria !== 'Loja') {
      // Reservar um login disponível apenas para Streaming/Acessórios Digitais
      const { data: loginData, error: loginError } = await supabase
        .from('logins_disponiveis')
        .select('id')
        .eq('produto_id', firstProductId)
        .eq('status', 'disponivel')
        .limit(1)
        .maybeSingle();
      
      if (loginError || !loginData) throw new Error("Estoque esgotado para este produto digital.");
      loginId = loginData.id;
    } else {
      // Para produtos físicos, verificar quantidade
      if (product.quantidade <= 0) {
        throw new Error("Este produto está sem estoque no momento.");
      }
    }

    // Criar o pedido no banco de dados
    const { data: pedidoData, error: pedidoError } = await supabase
      .from('pedidos')
      .insert({
        pix_id: String(paymentData.id),
        total: valor,
        status: 'PENDENTE',
        login_id: loginId,
        produto_id: firstProductId,
        customer_whatsapp: customer_whatsapp,
        user_id: userId
      })
      .select('id')
      .single();

    if (pedidoError || !pedidoData) throw new Error("Erro ao criar o pedido.");

    // 3. Marcar o login como reservado (se houver um)
    if (loginId) {
      const { error: updateLoginError } = await supabase
        .from('logins_disponiveis')
        .update({ status: 'reservado', reserved_by_pedido_id: pedidoData.id })
        .eq('id', loginId);

      if (updateLoginError) throw updateLoginError;
    }

    return new Response(
      JSON.stringify({
        qr_code: paymentData.point_of_interaction.transaction_data.qr_code,
        qr_code_base64: paymentData.point_of_interaction.transaction_data.qr_code_base64,
        id_pagamento: paymentData.id,
        pedido_id: pedidoData.id // Retorna o ID do pedido para o frontend
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})