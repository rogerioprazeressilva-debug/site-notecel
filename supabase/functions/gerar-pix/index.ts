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
    const { valor, descricao, email, customer_whatsapp, cartItems } = body
    const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')

    // 1. Criar pagamento no Mercado Pago
    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction_amount: Number(valor),
        description: descricao,
        payment_method_id: 'pix',
        payer: { email: email }
      })
    })

    const paymentData = await mpResponse.json()

    if (!mpResponse.ok) throw new Error(paymentData.message || 'Erro no Mercado Pago')

    // 2. Salvar pedido e reservar login no Banco de Dados (Supabase)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar o ID do produto no carrinho (assumindo que o carrinho tem apenas 1 item para simplificar)
    // Em um sistema real, você passaria o carrinho completo e faria um loop.
    // Por enquanto, vamos assumir que o "descricao" pode ser usado para buscar o produto_id
    // OU, o frontend deve enviar o produto_id junto.
    // Para este exemplo, vamos buscar um login aleatório para o primeiro item do carrinho.
    // O ideal seria que o frontend enviasse o `produto_id` do item que o cliente está comprando.
    // Identifica o produto para reservar o login (assumindo 1 item principal para este fluxo)
    const firstProductId = cartItems && cartItems.length > 0 ? cartItems[0].id : null;

    if (!firstProductId) throw new Error("Nenhum produto no carrinho para reservar login.");

    // Reservar um login disponível
    const { data: loginData, error: loginError } = await supabase
      .from('logins_disponiveis')
      .select('id, username, password')
      .eq('produto_id', firstProductId) // Vincula ao produto que está sendo comprado
      .eq('status', 'disponivel')
      .limit(1)
      .single();

    if (loginError || !loginData) throw new Error("Nenhum login disponível para este produto.");

    // Criar o pedido no banco de dados
    const { data: pedidoData, error: pedidoError } = await supabase
      .from('pedidos')
      .insert({
        pix_id: String(paymentData.id),
        total: valor,
        status: 'PENDENTE',
        login_id: loginData.id, // Vincula o login reservado ao pedido
        customer_whatsapp: customer_whatsapp
      })
      .select('id')
      .single();

    if (pedidoError || !pedidoData) throw new Error("Erro ao criar o pedido.");

    // Marcar o login como reservado
    const { error: updateLoginError } = await supabase
      .from('logins_disponiveis')
      .update({ status: 'reservado', reserved_by_pedido_id: pedidoData.id })
      .eq('id', loginData.id);

    if (updateLoginError) throw updateLoginError;

    return new Response(
      JSON.stringify({
        qr_code: paymentData.point_of_interaction.transaction_data.qr_code,
        qr_code_base64: paymentData.point_of_interaction.transaction_data.qr_code_base64,
        id_pagamento: paymentData.id,
        pedido_id: pedidoData.id // Retorna o ID do pedido para o frontend
      })
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})