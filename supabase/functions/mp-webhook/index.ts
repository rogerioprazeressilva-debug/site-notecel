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
    
    if (body.type === "payment" || body.action?.includes("payment")) {
      const paymentId = body.data?.id || body.resource?.split('/').pop();
      const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');

      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const paymentData = await mpResponse.json();

      if (paymentData.status === 'approved') {
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        // Busca o pedido e o login associado
        const { data: pedido } = await supabase.from('pedidos')
          .select('id, login_id, customer_whatsapp, logins_disponiveis(username, password)')
          .eq('pix_id', String(paymentId)).single();

        if (pedido && pedido.status !== 'PAGO') {
          // Atualiza status do pedido e do login
          await supabase.from('pedidos').update({ status: 'PAGO' }).eq('id', pedido.id);
          await supabase.from('logins_disponiveis').update({ status: 'vendido', sold_at: new Date() }).eq('id', pedido.login_id);

          // Envia WhatsApp (Exemplo usando uma API genérica)
          const message = `Seu acesso chegou!\nUser: ${pedido.logins_disponiveis.username}\nSenha: ${pedido.logins_disponiveis.password}`;
          await fetch(Deno.env.get('WHATSAPP_API_URL')!, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${Deno.env.get('WHATSAPP_API_TOKEN')}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: pedido.customer_whatsapp, message })
          });
        }
      }
    }
    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("❌ Erro na função send-whatsapp-credentials:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});