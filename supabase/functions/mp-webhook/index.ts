import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('data.id') || (await req.json()).data?.id;

    if (!id) throw new Error("ID do pagamento não fornecido.");

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Consultar status no Mercado Pago
    const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const payment = await mpRes.json();

    if (payment.status === 'approved') {
      // 2. Buscar pedido vinculado ao PIX
      const { data: pedido, error: pedError } = await supabase
        .from('pedidos')
        .select('*, produtos(nome, categoria), logins_disponiveis(username, password)')
        .eq('pix_id', String(id))
        .single();

      if (pedError || !pedido) throw new Error("Pedido não encontrado para este pagamento.");

      // Evita processar duas vezes se o webhook disparar novamente
      if (pedido.status === 'PAGO') {
        return new Response(JSON.stringify({ ok: true, info: 'already_processed' }), { headers: corsHeaders });
      }

      // 3. Marcar como pago e baixar estoque
      await supabase.from('pedidos').update({ status: 'PAGO' }).eq('id', pedido.id);

      if (pedido.login_id) {
        await supabase.from('logins_disponiveis')
          .update({ status: 'vendido', sold_at: new Date().toISOString() })
          .eq('id', pedido.login_id);
      } else if (pedido.produtos.categoria === 'Loja') {
        // Baixa manual de estoque físico
        const { data: prod } = await supabase.from('produtos').select('quantidade').eq('id', pedido.produto_id).single();
        await supabase.from('produtos').update({ quantidade: (prod?.quantidade || 1) - 1 }).eq('id', pedido.produto_id);
      }

      // 4. LÓGICA DE ENTREGA TELEGRAM vs WHATSAPP
      const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
      const adminChatId = Deno.env.get('TELEGRAM_CHAT_ID');
      const customerInfo = pedido.customer_whatsapp || '';

      let deliveryMsg = '';
      if (pedido.logins_disponiveis) {
        deliveryMsg = `✅ *PAGAMENTO APROVADO!* ✅\n\n` +
                      `🚀 *Produto:* ${pedido.produtos.nome}\n\n` +
                      `🔑 *SEUS DADOS DE ACESSO:* \n` +
                      `👤 *Usuário:* \`${pedido.logins_disponiveis.username}\`\n` +
                      `🔒 *Senha:* \`${pedido.logins_disponiveis.password}\`\n\n` +
                      `_Obrigado por comprar com a Notecel!_`;
      } else {
        deliveryMsg = `✅ *PAGAMENTO APROVADO!* ✅\n\n` +
                      `📦 *Produto:* ${pedido.produtos.nome}\n` +
                      `📍 *Status:* Em separação para envio.\n\n` +
                      `_Em breve você receberá o código de rastreio._`;
      }

      // Se veio do Telegram, entrega para o cliente via Bot
      if (customerInfo.startsWith('Telegram:')) {
        const clientChatId = customerInfo.replace('Telegram:', '');
        await enviarResposta(token!, clientChatId, deliveryMsg);
        
        // Notifica o Admin
        await enviarResposta(token!, adminChatId!, `💰 *VENDA NO BOT:* ${pedido.produtos.nome}\n💵 Valor: R$ ${pedido.total}\n👤 Cliente: Telegram ID ${clientChatId}`);
      } else {
        // Notifica apenas o Admin (Entrega via WhatsApp manual ou log)
        const adminMsg = `💰 *VENDA NO SITE:* ${pedido.produtos.nome}\n` +
                         `💵 Valor: R$ ${pedido.total}\n` +
                         `📱 WhatsApp: ${customerInfo}\n\n` +
                         `_O sistema processou o estoque digital._`;
        await enviarResposta(token!, adminChatId!, adminMsg);
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });

  } catch (error) {
    console.error("Erro no Webhook:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
  }
})

async function enviarResposta(token: string, chatId: string, texto: string) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: texto,
      parse_mode: 'HTML'
    })
  });
  if (!response.ok) console.error("Erro Telegram:", await response.json());
}