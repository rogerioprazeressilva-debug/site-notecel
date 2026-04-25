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
    console.log("Recebido do Mercado Pago:", JSON.stringify(body));

    // Captura o ID de forma mais resiliente
    const paymentId = body.data?.id || (body.resource ? body.resource.split('/').pop() : null);
    
    if (paymentId && (body.type === "payment" || body.action?.includes("payment"))) {
      const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
      if (!accessToken) throw new Error("AccessToken não configurado");

      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      const paymentData = await mpResponse.json();
      console.log(`Status do pagamento ${paymentId}: ${paymentData.status}`);

      if (paymentData.status === 'approved') {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!, 
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // BUSCA O PEDIDO com os dados do login/produto para processar
        const { data: pedido, error: errorBusca } = await supabase.from('pedidos')
          .select('id, login_id, produto_id, status, customer_whatsapp, produtos(categoria, quantidade)')
          .eq('pix_id', String(paymentId))
          .single();

        if (errorBusca) {
          console.error("Pedido não encontrado no banco para o pix_id:", paymentId);
        }

        if (pedido && pedido.status === 'PENDENTE') {
          // 1. Atualiza o pedido para PAGO
          const { error: updateError } = await supabase.from('pedidos').update({ status: 'PAGO' }).eq('id', pedido.id);
          
          // 2. Se houver um login vinculado, marca como vendido
          if (pedido.login_id) {
            await supabase.from('logins_disponiveis').update({ 
              status: 'vendido', 
              sold_at: new Date().toISOString() 
            }).eq('id', pedido.login_id);
          }
          
          // 3. Se for produto físico, dá baixa no estoque
          if (pedido.produto_id && pedido.produtos?.categoria === 'Loja') {
            const novaQuantidade = Math.max(0, (pedido.produtos.quantidade || 1) - 1);
            await supabase.from('produtos')
              .update({ quantidade: novaQuantidade })
              .eq('id', pedido.produto_id);
          }

          console.log(`✅ Sucesso! Pedido ${pedido.id} processado.`);
        } else {
          console.log(`ℹ️ Ignorado: Pedido já processado ou inexistente.`);
        }
      }
    }
    
    return new Response(JSON.stringify({ received: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error("❌ Erro no processamento:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});