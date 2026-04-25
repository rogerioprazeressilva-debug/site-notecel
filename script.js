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

    const paymentId = body.data?.id || (body.resource ? body.resource.split('/').pop() : null);
    
    if (paymentId && (body.type === "payment" || body.action?.includes("payment"))) {
      const accessToken = Deno.env.get('MP_ACCESS_TOKEN') || Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');

      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      const paymentData = await mpResponse.json();
      
      if (paymentData.status === 'approved') {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!, 
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // BUSCA O PEDIDO - Importante: Adicionei 'produto_id' aqui
        const { data: pedido, error: errorBusca } = await supabase.from('pedidos')
          .select('id, login_id, produto_id, status')
          .eq('pix_id', String(paymentId))
          .single();

        if (errorBusca || !pedido) {
          console.error("Pedido não encontrado para o pix_id:", paymentId);
          return new Response(JSON.stringify({ error: "Pedido não localizado" }), { status: 404 });
        }

        if (pedido.status === 'PENDENTE') {
          // 1. ATUALIZA O PEDIDO PARA PAGO
          await supabase.from('pedidos').update({ status: 'PAGO' }).eq('id', pedido.id);
          
          // 2. BAIXA DE ESTOQUE (NOVIDADE)
          // Se o pedido tiver um produto_id vinculado, diminuímos a quantidade
          if (pedido.produto_id) {
            console.log(`Baixando estoque do produto ${pedido.produto_id}...`);
            
            // Usamos uma técnica de RPC ou Update Relativo para evitar erros de concorrência
            // Se você não tiver RPC, o código abaixo faz o update simples:
            const { data: prod } = await supabase.from('produtos').select('quantidade').eq('id', pedido.produto_id).single();
            
            if (prod && prod.quantidade > 0) {
              await supabase.from('produtos')
                .update({ quantidade: prod.quantidade - 1 })
                .eq('id', pedido.produto_id);
              console.log(`✅ Estoque atualizado: ${prod.quantidade} -> ${prod.quantidade - 1}`);
            }
          }

          // 3. LOGINS DISPONÍVEIS (Se for produto digital com login)
          if (pedido.login_id) {
            await supabase.from('logins_disponiveis').update({ 
              status: 'vendido', 
              sold_at: new Date().toISOString() 
            }).eq('id', pedido.login_id);
          }

          console.log(`✅ Sucesso! Pedido ${pedido.id} processado e estoque baixado.`);
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