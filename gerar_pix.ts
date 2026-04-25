import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS pre-flight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { valor, customer_whatsapp, cartItems, email } = body
    
    const mpToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!mpToken) throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurado.")

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // 0. Identificar Usuário via JWT (Segurança) para registrar o pedido no ID correto
    const authHeader = req.headers.get('Authorization')
    let userId = null
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id
    }

    if (!cartItems || cartItems.length === 0) {
      throw new Error('Carrinho vazio')
    }

    // 1. Criar Pagamento no Mercado Pago
    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpToken}`,
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

    const firstProductId = cartItems[0].id
    let loginId = null

    // 2. Lógica de Reserva de Login (Apenas para produtos digitais)
    const { data: product } = await supabase
      .from('produtos')
      .select('categoria')
      .eq('id', firstProductId)
      .single()

    if (product?.categoria !== 'Loja') {
      const { data: loginData } = await supabase
        .from('logins_disponiveis')
        .select('id')
        .eq('produto_id', firstProductId)
        .eq('status', 'disponivel')
        .limit(1)
        .maybeSingle()

      if (!loginData) {
        throw new Error('Estoque esgotado para este produto digital.')
      }
      loginId = loginData.id
    }

    // 3. Criar o Pedido
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .insert({
        pix_id: String(paymentData.id),
        total: valor,
        status: 'PENDENTE',
        customer_whatsapp: customer_whatsapp,
        user_id: userId,
        login_id: loginId
      })
      .select('id')
      .single()

    if (pedidoError) throw new Error("Erro ao criar pedido no banco.")

    // 4. Reservar Login
    if (loginId && pedido) {
      await supabase
        .from('logins_disponiveis')
        .update({ status: 'reservado', reserved_by_pedido_id: pedido.id })
        .eq('id', loginId)
    }

    return new Response(
      JSON.stringify({
        qr_code: paymentData.point_of_interaction.transaction_data.qr_code,
        qr_code_base64: paymentData.point_of_interaction.transaction_data.qr_code_base64,
        id_pagamento: paymentData.id,
        pedido_id: pedido.id
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