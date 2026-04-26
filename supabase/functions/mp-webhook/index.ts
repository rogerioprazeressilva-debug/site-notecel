import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function enviarNotificacaoTelegram(mensagem: string) {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
  
  if (!token || !chatId) {
    console.error("❌ Telegram: Erro - TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurados nos Secrets.");
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: mensagem,
        parse_mode: 'Markdown'
      })
    });
    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Telegram: Erro da API:", errorData);
    }
  } catch (e) {
    console.error("❌ Telegram: Falha na requisição fetch:", e.message);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })

  try {
    const body = await req.json()
    console.log("Webhook recebido:", body.action || body.type);

    // Captura o ID de forma mais resiliente
    const paymentId = body.data?.id || (body.resource ? body.resource.split('/').pop() : null);
    
    if (paymentId && (body.type === "payment" || body.action?.includes("payment"))) {
      const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
      if (!accessToken) throw new Error("AccessToken não configurado");

      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      const paymentData = await mpResponse.json();
      
      if (!paymentData || !paymentData.status) {
        console.error(`Erro ao buscar dados do pagamento ${paymentId} no Mercado Pago`);
        throw new Error("Dados do pagamento inválidos");
      }

      console.log(`Status do pagamento ${paymentId}: ${paymentData.status}`);

      if (paymentData.status === 'approved') {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!, 
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // BUSCA O PEDIDO com os dados do login/produto para processar
        const { data: pedido, error: errorBusca } = await supabase.from('pedidos')
          .select('id, total, login_id, produto_id, status, customer_whatsapp, produtos(nome, categoria, quantidade)')
          .eq('pix_id', String(paymentId))
          .single();

        if (errorBusca) {
          console.error("Pedido não encontrado no banco para o pix_id:", paymentId);
          return new Response(JSON.stringify({ error: "Pedido não localizado" }), { status: 404, headers: corsHeaders });
        }

        if (pedido && pedido.status === 'PENDENTE') {
          // 1. Atualiza o pedido para PAGO
          const { error: updateError } = await supabase.from('pedidos').update({ status: 'PAGO' }).eq('id', pedido.id);
          if (updateError) throw new Error(`Erro ao atualizar pedido: ${updateError.message}`);
          
          // 2. Se houver um login vinculado, marca como vendido
          if (pedido.login_id) {
            const { error: loginError } = await supabase.from('logins_disponiveis').update({ 
              status: 'vendido', 
              sold_at: new Date().toISOString()
            }).eq('id', pedido.login_id);
            if (loginError) console.error("Erro ao atualizar login:", loginError);
          }
          
          // 3. Se for produto físico, dá baixa no estoque
          if (pedido.produto_id && pedido.produtos?.categoria === 'Loja') {
            const novaQuantidade = Math.max(0, (pedido.produtos.quantidade || 1) - 1);
            const { error: stockError } = await supabase.from('produtos')
              .update({ quantidade: novaQuantidade })
              .eq('id', pedido.produto_id);
            if (stockError) console.error("Erro ao baixar estoque:", stockError);
          }

          console.log("Enviando notificação para o Telegram...");
          const msgTelegram = `💰 *VENDA APROVADA!* 🚀\n\n` +
                              `📦 *Produto:* ${pedido.produtos?.nome || 'Não identificado'}\n` +
                              `💵 *Valor:* R$ ${Number(pedido.total).toFixed(2)}\n` +
                              `📱 *WhatsApp:* ${pedido.customer_whatsapp || 'Não informado'}`;

          await enviarNotificacaoTelegram(msgTelegram);

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