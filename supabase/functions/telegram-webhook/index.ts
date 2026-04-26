import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PAGE_SIZE = 5; // Quantidade de produtos por página

Deno.serve(async (req) => {
  // Handler para CORS
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })

  console.log("🚀 Webhook acionado! Método:", req.method);

  try {
    const body = await req.json().catch(() => null);
    if (!body) return new Response("No body", { status: 200 });

    const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!token) {
      console.error("❌ TELEGRAM_BOT_TOKEN não configurado.");
      return new Response("Missing token", { status: 500 });
    }
    
    // Suporte para novas mensagens ou mensagens editadas
    let message = body.message || body.edited_message
    let callbackData = null

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    console.log(`📩 Recebido de ${message?.chat?.id}: ${message?.text || 'Botão'}`)

    // Detectar se é um clique em botão (Callback Query)
    if (body.callback_query) {
      message = body.callback_query.message
      callbackData = body.callback_query.data

      // Handler para ações do Administrador
      if (callbackData.startsWith('admin_')) {
        if (callbackData.startsWith('admin_compras_')) {
          const targetId = callbackData.replace('admin_compras_', '')
          const { data: pedidos } = await supabase
            .from('pedidos')
            .select('total, status, produtos(nome)')
            .eq('customer_whatsapp', `Telegram:${targetId}`)
          
          const totalVendas = pedidos?.length || 0
          const soma = pedidos?.reduce((acc, p) => acc + Number(p.total), 0) || 0
          
          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              callback_query_id: body.callback_query.id,
              text: `📊 O usuário possui ${totalVendas} pedidos. Total: R$ ${soma.toFixed(2)}`,
              show_alert: true 
            })
          })
        }

        if (callbackData.startsWith('admin_block_')) {
          const targetId = callbackData.replace('admin_block_', '')
          const { error: blockError } = await supabase.from('bot_users').update({ is_blocked: true }).eq('chat_id', targetId)
          
          const adminId = Deno.env.get('TELEGRAM_CHAT_ID') || "";
          await enviarResposta(token, adminId, blockError ? `❌ Erro ao bloquear: ${blockError.message}` : `🚫 Usuário <code>${targetId}</code> foi bloqueado com sucesso.`)
        }
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
      }

      // Tratar clique em produto esgotado
      if (callbackData.startsWith('esgotado_')) {
        await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            callback_query_id: body.callback_query.id,
            text: "⚠️ Desculpe, este produto está temporariamente esgotado.",
            show_alert: true 
          })
        })
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
      }

      // Resposta padrão para outros botões
      await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: body.callback_query.id })
      })
    }

    // 1. Validações básicas
    if (!message || (!message.text && !callbackData)) {
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
    }

    const adminChatId = Deno.env.get('TELEGRAM_CHAT_ID') || ""
    const chatId = String(message.chat.id)
    
    // Normalização do texto
    let text = (callbackData || message.text || "").toLowerCase().trim()

    // --- REGISTRO AUTOMÁTICO DE USUÁRIO E AVISO AO ADMIN ---
    const from = message.from;
    if (from) {
      // Verifica se o usuário já existe antes de atualizar
      const { data: existingUser, error: checkError } = await supabase
        .from('bot_users')
        .select('chat_id, is_blocked')
        .eq('chat_id', String(from.id))
        .maybeSingle();

      // Se o usuário estiver bloqueado, ignoramos a mensagem
      if (existingUser?.is_blocked) {
        console.log(`🚫 Usuário bloqueado tentando interagir: ${from.id}`);
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      if (!existingUser && adminChatId) {
        const novoUsuarioMsg = `👤 <b>NOVO LEAD NO BOT!</b>\n\n` +
                               `📛 <b>Nome:</b> ${from.first_name}\n` +
                               `🆔 <b>ID:</b> <code>${from.id}</code>\n` +
                               `🏷 <b>Username:</b> @${from.username || 'N/A'}\n\n` +
                               `🚀 <i>O usuário acabou de interagir pela primeira vez.</i>`;
        
        const adminActionButtons = {
          inline_keyboard: [
            [
              { text: "🛒 Ver Compras", callback_data: `admin_compras_${from.id}` },
              { text: "🚫 Bloquear", callback_data: `admin_block_${from.id}` }
            ]
          ]
        };

        // Envia o aviso para você (admin)
        await enviarResposta(token, adminChatId, novoUsuarioMsg, adminActionButtons);
      }

      const { error: upsertError } = await supabase.from('bot_users').upsert({
        chat_id: String(from.id),
        first_name: from.first_name,
        username: from.username,
        last_interaction: new Date().toISOString()
      }, { onConflict: 'chat_id' });

      if (upsertError) {
        console.error("⚠️ Erro ao registrar usuário no banco:", upsertError.message);
      }
    }

    // Mapeamento de botões de texto para comandos internos
    if (text.includes("catálogo")) text = "/catalogo";
    if (text.includes("meus acessos") || text.includes("minhas compras") || text.includes("acessos")) text = "/meuslogins";
    if (text.includes("suporte")) text = "/suporte";
    if (text.includes("visitar site")) text = "/site";
    if (text.includes("resumo de vendas")) text = "/vendas";
    if (text.includes("faturamento total")) text = "/vendas_total";
    if (text.includes("limpar estoque antigo")) text = "/limpar_estoque";
    if (text.includes("enviar anúncio")) text = "/anuncio_ajuda";
    if (text.includes("estatísticas")) text = "/estatisticas";
    if (text.includes("alertas de estoque")) text = "/alertas";
    if (text.includes("ver como cliente")) text = "/start_cliente";
    if (text.startsWith("página_")) text = text.replace("página_", "/catalogo ");

    // Se o comando for apenas /start (pode vir com parâmetros de ref)
    if (text.startsWith('/start')) text = '/start';

    const isAdmin = chatId === adminChatId

    // --- FLUXO DO CLIENTE (QUALQUER USUÁRIO) ---

    if (text === '/start' || text === '/ajuda' || text === '/menu' || text === '/start_cliente') {
      // Se você for o admin e der /start, mostramos o Painel Admin. 
      // Se usar /start_cliente, forçamos a visão de cliente.
      if (isAdmin && text !== '/start_cliente') {
        const adminWelcome = `🦾 <b>PAINEL ADMINISTRATIVO NOTECEL</b>\n\nBem-vindo de volta, Comandante. O bot está operando em <b>Modo Admin</b>.\n\nEscolha uma função de gestão abaixo:`;
        const adminMarkup = {
          keyboard: [
            [{ text: "📊 Resumo de Vendas" }, { text: "💰 Faturamento Total" }],
            [{ text: "📦 Alertas de Estoque" }, { text: "📈 Estatísticas" }],
            [{ text: "📢 Enviar Anúncio" }, { text: "🧹 Limpar Estoque Antigo" }],
            [{ text: "🛍️ Ver como Cliente" }, { text: "🌐 Visitar Site" }]
          ],
          resize_keyboard: true
        };
        await enviarResposta(token, chatId, adminWelcome, adminMarkup);
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      const welcomeMsg = `👋 <b>Olá! Bem-vindo à Central de Vendas NOTECEL</b> 🚀\n\nA plataforma número #1 em contas premium e soluções digitais com <b>entrega instantânea</b>.\n\nComo posso ajudar você hoje? Escolha uma das opções no menu abaixo:`

      // Define o Teclado Persistente (Reply Keyboard)
      const replyMarkup = {
        keyboard: [
          [{ text: "🛒 Ver Catálogo" }, { text: "🔑 Meus Acessos" }],
          [{ text: "🌐 Visitar Site" }, { text: "💬 Suporte" }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      }

      const inlineBtnSite = {
        inline_keyboard: [[{ text: "🔗 Ir para o site Notecel", url: "https://www.notecel.shop" }]]
      };

      await enviarResposta(token, chatId, welcomeMsg, replyMarkup);
      // Envia uma segunda mensagem opcional com o botão de link direto
      await enviarResposta(token, chatId, "✨ <i>Confira nossas promoções exclusivas no site:</i>", inlineBtnSite);
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
    }

    if (text === '/suporte' || text === '💬 suporte') {
      const replyMarkup = {
        inline_keyboard: [[{ text: "💬 Falar com Atendente", url: "https://wa.me/5591985156039" }]]
      }
      await enviarResposta(token, chatId, "<b>Central de Suporte Notecel</b>\n\nNossa equipe está disponível para tirar suas dúvidas. Clique no botão abaixo para ser redirecionado ao nosso WhatsApp oficial:", replyMarkup)
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
    }

    if (text === '/site' || text === '🌐 visitar site') {
      const replyMarkup = {
        inline_keyboard: [[{ text: "📍 Acessar Loja Completa", url: "https://www.notecel.shop" }]]
      }
      await enviarResposta(token, chatId, "<b>Notecel Web</b>\n\nAcesse nossa plataforma completa para conferir novos produtos, gerenciar sua conta e aproveitar as melhores ofertas do mercado.", replyMarkup)
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
    }

    if (text.startsWith('/catalogo')) {
      const page = parseInt(text.split(' ')[1]) || 0;
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: produtos, count } = await supabase
        .from('produtos')
        .select('id, nome, preco, categoria, imagem_url, descricao, quantidade', { count: 'exact' })
        .order('id', { ascending: true })
        .range(from, to);
      
      if (!produtos || produtos.length === 0) {
        await enviarResposta(token, chatId, "📭 Nosso catálogo está vazio no momento.")
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
      }

      const totalPages = Math.ceil((count || 0) / PAGE_SIZE);
      await enviarResposta(token, chatId, `🛒 <b>VITRINE DIGITAL (Página ${page + 1}/${totalPages})</b>\n\n<i>Confira nossas ofertas disponíveis:</i>`)

      for (const p of produtos) {
        // Verifica disponibilidade
        let restantes = 0;
        if (p.categoria === 'Loja') {
          restantes = p.quantidade || 0;
        } else {
          const { count: loginsRestantes } = await supabase
            .from('logins_disponiveis')
            .select('*', { count: 'exact', head: true })
            .eq('produto_id', p.id)
            .eq('status', 'disponivel');
          restantes = loginsRestantes || 0;
        }
        
        const disponivel = restantes > 0;
        const btnText = disponivel 
          ? `🛒 Comprar ${p.nome} (Apenas ${restantes} restam)` 
          : `❌ ${p.nome} - ESGOTADO`;
        const btnAction = disponivel ? `/comprar ${p.id}` : `esgotado_${p.id}`;
        
        // Limpeza de HTML básica para evitar erro 400 do Telegram
        const descLimpa = (p.descricao || 'Sem descrição.').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        const legenda = `📦 <b>${p.nome}</b>\n💰 Investimento: <b>R$ ${Number(p.preco).toFixed(2)}</b>\n\n📖 <i>${descLimpa}</i>`;
        const replyMarkup = {
          inline_keyboard: [
            [{ text: btnText, callback_data: btnAction }]
          ]
        };

        if (p.imagem_url) {
          await enviarFoto(token, chatId, p.imagem_url, legenda, replyMarkup);
        } else {
          await enviarResposta(token, chatId, legenda, replyMarkup);
        }
      }

      // Botões de Navegação
      const navButtons = [];
      if (page > 0) navButtons.push({ text: "⬅️ Anterior", callback_data: `página_${page - 1}` });
      if (count && count > to + 1) navButtons.push({ text: "Próximo ➡️", callback_data: `página_${page + 1}` });
      
      // Botão do site fixo ao final de cada página do catálogo
      const siteBtn = [{ text: "🌐 Ver mais no site", url: "https://www.notecel.shop" }];

      const replyMarkup = {
        inline_keyboard: [
          navButtons.length > 0 ? navButtons : [],
          siteBtn,
          [{ text: "💬 Dúvidas? Fale Conosco", url: "https://wa.me/5591985156039" }]
        ]
      };
      
      await enviarResposta(token, chatId, `✨ <b>Fim da página ${page + 1} de ${totalPages}</b>`, replyMarkup);
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
    }

    if (text === '/meuslogins') {
      // Busca todos os pedidos pagos vinculados ao ChatID deste cliente no Telegram
      const { data: pedidos } = await supabase
        .from('pedidos')
        .select('*, produtos(nome), logins_disponiveis(username, password)')
        .eq('customer_whatsapp', `Telegram:${chatId}`)
        .eq('status', 'PAGO')
        .order('created_at', { ascending: false });

      if (!pedidos || pedidos.length === 0) {
        await enviarResposta(token, chatId, "🔍 Você ainda não possui pedidos pagos vinculados a este bot.\n\n<i>Dica: Suas compras feitas pelo site aparecem no histórico do site.</i>");
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      let msg = "🔑 <b>SUA ÁREA DE ACESSOS</b>\n\n<i>Aqui estão as credenciais dos seus pedidos pagos:</i>\n\n";
      pedidos.forEach(p => {
        msg += `📦 <b>${p.produtos?.nome}</b>\n🗓 Data: ${new Date(p.created_at).toLocaleDateString('pt-BR')}\n`;
        if (p.logins_disponiveis) {
          msg += `👤 Usuário: <code>${p.logins_disponiveis.username}</code>\n🔒 Senha: <code>${p.logins_disponiveis.password}</code>\n`;
        } else {
          msg += `📍 <i>Produto físico em envio.</i>\n`;
        }
        msg += `\n`;
      });

      await enviarResposta(token, chatId, msg);
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
    }

    // Lógica de Compra via Bot
    if (text.startsWith('/comprar')) {
      const produtoIdRaw = text.replace('/comprar', '').trim();

      if (!produtoIdRaw) {
        await enviarResposta(token, chatId, "⚠️ Informe o ID do produto. Ex: <code>/comprar 5</code>");
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      const produtoId = parseInt(produtoIdRaw);
      // Buscar produto e verificar estoque
      const { data: product } = await supabase.from('produtos').select('*').eq('id', produtoId).single()
      if (!product) {
        await enviarResposta(token, chatId, "❌ Produto não encontrado.")
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
      }

      let loginId = null;

      // Se for digital, verificar se há logins
      if (product.categoria !== 'Loja') {
        const { data: loginData } = await supabase.from('logins_disponiveis').select('id').eq('produto_id', produtoId).eq('status', 'disponivel').limit(1).maybeSingle()
        if (!loginData) {
          await enviarResposta(token, chatId, `😔 Desculpe, o produto <b>${product.nome}</b> está esgotado.`)
          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
        }
        loginId = loginData.id;
      } else if (product.quantidade <= 0) {
        await enviarResposta(token, chatId, `😔 Desculpe, o produto <b>${product.nome}</b> está sem estoque.`)
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
      }

      await enviarResposta(token, chatId, `⏳ Gerando seu PIX para <b>${product.nome}</b>...\nValor: <b>R$ ${Number(product.preco).toFixed(2)}</b>`)

      // Integrar com a sua lógica de PIX (Mercado Pago)
      // Para simplificar, vamos instruir o bot a chamar o Mercado Pago aqui
      try {
        const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')
        const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transaction_amount: Number(product.preco),
            description: `Bot Notecel: ${product.nome}`,
            payment_method_id: 'pix',
            payer: { email: 'cliente_bot@notecel.com' }
          })
        })
        const paymentData = await mpRes.json();
        
        // Criar o pedido no banco (Vínculo com ChatID do Telegram no customer_whatsapp para identificação)
        const { data: pedido } = await supabase.from('pedidos').insert({
          pix_id: String(paymentData.id),
          total: product.preco,
          status: 'PENDENTE',
          produto_id: product.id,
          login_id: loginId,
          customer_whatsapp: `Telegram:${chatId}` // Marcamos que veio do bot
        }).select().single();

        // Reservar o login no banco para ninguém mais comprar enquanto este PIX aguarda
        if (loginId && pedido) {
          await supabase
            .from('logins_disponiveis')
            .update({ 
              status: 'reservado', 
              reserved_by_pedido_id: pedido.id 
            })
            .eq('id', loginId);
        }

        const qrCode = paymentData.point_of_interaction.transaction_data.qr_code;
        const instructions = `✅ <b>PIX GERADO COM SUCESSO!</b>\n\nUtilize o código 'Copia e Cola' abaixo no aplicativo do seu banco:\n\n<code>${qrCode}</code>\n\n💰 <b>Total a pagar:</b> R$ ${Number(product.preco).toFixed(2)}\n\n🚀 <i>O acesso será liberado automaticamente após a confirmação.</i>`;
        await enviarResposta(token, chatId, instructions);

      } catch (e) {
        await enviarResposta(token, chatId, "❌ Erro ao processar pagamento. Tente novamente mais tarde.")
      }
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
    }

    // --- FLUXO DO ADMIN (RESTRITO) ---
    if (!isAdmin) {
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
    }

    // Comando Avançado de Alertas de Estoque
    if (text === '/alertas') {
      // Busca itens físicos com estoque < 5
      const { data: fisicos } = await supabase.from('produtos').select('nome, quantidade').eq('categoria', 'Loja').lt('quantidade', 5);
      
      // Busca logins digitais com contagem < 5
      const { data: prodsDigitais } = await supabase.from('produtos').select('id, nome').neq('categoria', 'Loja');
      let alertasDigitais = [];
      
      for (const p of (prodsDigitais || [])) {
        const { count } = await supabase.from('logins_disponiveis').select('*', { count: 'exact', head: true }).eq('produto_id', p.id).eq('status', 'disponivel');
        if (count !== null && count < 5) {
          alertasDigitais.push({ nome: p.nome, qtd: count });
        }
      }

      let alertMsg = `🚨 <b>ALERTA DE REPOSIÇÃO</b> 🚨\n\n`;
      
      if (fisicos?.length) {
        alertMsg += `<b>PRODUTOS LOJA:</b>\n`;
        fisicos.forEach(f => alertMsg += `• ${f.nome}: <b>${f.quantidade} un</b>\n`);
      }

      if (alertasDigitais.length) {
        alertMsg += `\n<b>PRODUTOS DIGITAIS:</b>\n`;
        alertasDigitais.forEach(d => alertMsg += `• ${d.nome}: <b>${d.qtd} logins</b>\n`);
      }

      if (!fisicos?.length && !alertasDigitais.length) {
        alertMsg = `✅ <b>ESTOQUE SAUDÁVEL</b>\n\nTodos os produtos estão com níveis acima do limite crítico.`;
      }

      await enviarResposta(token, adminChatId, alertMsg);
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    // 2. Processar o comando /estoque <nome>
    if (text.startsWith('/estoque')) {
      const searchQuery = text.replace('/estoque', '').trim()

      if (!searchQuery) {
        await enviarResposta(token, adminChatId, "⚠️ Por favor, digite o nome do produto.\nExemplo: `/estoque netflix`")
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
      }

      // 3. Buscar produto no banco (Busca aproximada)
      const { data: product, error: prodError } = await supabase
        .from('produtos')
        .select('id, nome, categoria, quantidade')
        .ilike('nome', `%${searchQuery}%`)
        .limit(1)
        .maybeSingle()

      if (prodError || !product) {
        await enviarResposta(token, adminChatId, `❌ <b>Erro:</b> Produto "${searchQuery}" não encontrado.`)
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
      }

      let estoqueMsg = ''

      if (product.categoria === 'Loja') {
        // Estoque Físico
        estoqueMsg = `📦 <b>Produto:</b> ${product.nome}\n` +
                     `🏷️ <b>Categoria:</b> Loja\n` +
                     `🔢 <b>Quantidade:</b> ${product.quantidade} unidades`
      } else {
        // Estoque Digital (Contagem de logins disponíveis)
        const { count, error: countError } = await supabase
          .from('logins_disponiveis')
          .select('*', { count: 'exact', head: true })
          .eq('produto_id', product.id)
          .eq('status', 'disponivel')

        estoqueMsg = `💠 <b>Produto:</b> ${product.nome}\n` +
                     `🏷️ <b>Categoria:</b> ${product.categoria}\n` +
                     `🔑 <b>Logins Disponíveis:</b> ${countError ? 'Erro ao contar' : count}`
      }

      await enviarResposta(token, adminChatId, `📊 *RESULTADO DA CONSULTA*\n\n${estoqueMsg}`)
    } else if (text === '/vendas_total') {
      // Consulta de faturamento histórico (total de todos os tempos, incluindo arquivados)
      const { data: sales, error: salesError } = await supabase
        .from('pedidos')
        .select('total')
        .eq('status', 'PAGO');

      if (salesError) {
        console.error("Erro ao consultar vendas totais:", salesError);
        await enviarResposta(token, adminChatId, "❌ <b>Erro:</b> Falha ao consultar faturamento histórico.");
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      const totalSales = sales.reduce((sum, sale) => sum + Number(sale.total), 0);

      const salesMsg = `💰 <b>FATURAMENTO HISTÓRICO TOTAL</b> 💰\n\n` +
                       `📈 <b>Total Acumulado:</b> R$ ${totalSales.toFixed(2).replace('.', ',')}\n` +
                       `📦 <b>Total de Pedidos:</b> ${sales.length}\n\n` +
                       `<i>Este relatório consolida todas as vendas pagas desde o início, incluindo itens ativos e arquivados.</i>`;

      await enviarResposta(token, adminChatId, salesMsg);
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    } else if (text === '/limpar_estoque') {
      // Lógica para deletar logins vendidos há mais de 90 dias
      const noventaDiasAtras = new Date();
      noventaDiasAtras.setDate(noventaDiasAtras.getDate() - 90);

      const { error, count } = await supabase
        .from('logins_disponiveis')
        .delete({ count: 'exact' })
        .eq('status', 'vendido')
        .lt('sold_at', noventaDiasAtras.toISOString());

      if (error) {
        console.error("Erro ao limpar estoque antigo:", error);
        await enviarResposta(token, adminChatId, "❌ <b>Erro:</b> Falha ao realizar a limpeza do estoque.");
      } else {
        const msg = `🧹 <b>LIMPEZA DE ESTOQUE CONCLUÍDA</b>\n\n` +
                   `✅ Foram removidos <b>${count || 0}</b> registros de logins vendidos há mais de 90 dias.\n\n` +
                   `<i>O banco de dados foi otimizado com sucesso!</i>`;
        
        await enviarResposta(token, adminChatId, msg);
      }

      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    } else if (text === '/anuncio_ajuda') {
      const helpMsg = `📢 <b>COMO ENVIAR UM ANÚNCIO</b>\n\nPara enviar uma mensagem para todos os seus clientes, utilize o comando abaixo:\n\n<code>/anuncio Sua mensagem aqui</code>\n\n<i>Obs: Você pode usar emojis e a mensagem será enviada com um cabeçalho oficial da Notecel.</i>`;
      await enviarResposta(token, adminChatId, helpMsg);
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    } else if (text.startsWith('/anuncio')) {
      const mensagemAnuncio = text.replace('/anuncio', '').trim();
      
      if (!mensagemAnuncio) {
        await enviarResposta(token, adminChatId, "⚠️ <b>Erro:</b> Digite a mensagem após o comando. Ex: <code>/anuncio Novas contas Netflix em estoque!</code>");
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      // 1. Buscar todos os usuários registrados na nova tabela bot_users
      const { data: clientes, error: searchError } = await supabase
        .from('bot_users')
        .select('chat_id');

      if (searchError || !clientes) {
        await enviarResposta(token, adminChatId, "❌ Falha ao buscar lista de clientes.");
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      // Extrai os IDs únicos
      const idsUnicos = clientes.map(c => c.chat_id);

      if (idsUnicos.length === 0) {
        await enviarResposta(token, adminChatId, "ℹ️ Nenhum cliente encontrado para envio.");
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      await enviarResposta(token, adminChatId, `🚀 <b>Iniciando transmissão para ${idsUnicos.length} clientes...</b>`);

      let sucessos = 0;
      let falhas = 0;

      // 2. Loop de envio (sequencial para respeitar limites do Telegram)
      for (const targetChatId of idsUnicos) {
        try {
          const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: targetChatId,
              text: `📢 <b>COMUNICADO OFICIAL NOTECEL</b>\n\n${mensagemAnuncio}`,
              parse_mode: 'HTML'
            })
          });
          if (res.ok) sucessos++; else falhas++;
          // Pequena pausa para evitar bloqueio por spam do Telegram
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch { falhas++; }
      }

      await enviarResposta(token, adminChatId, `✅ <b>Transmissão Finalizada!</b>\n\n🟢 Sucessos: <b>${sucessos}</b>\n🔴 Falhas: <b>${falhas}</b>`);
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    } else if (text === '/estatisticas') {
      // Lógica para estatísticas de usuários
      const seteDiasAtras = new Date();
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

      // 1. Buscar lista de novos usuários para verificar conversão
      const { data: novosUsuariosList, error: errNovos } = await supabase
        .from('bot_users')
        .select('chat_id')
        .gte('created_at', seteDiasAtras.toISOString());

      // 2. Total de usuários (Leads)
      const { count: totalUsuarios, error: errTotal } = await supabase
        .from('bot_users')
        .select('*', { count: 'exact', head: true });

      if (errNovos || errTotal) {
        console.error("Erro ao consultar estatísticas:", errNovos || errTotal);
        await enviarResposta(token, adminChatId, "❌ <b>Erro:</b> Falha ao carregar estatísticas.");
      } else {
        const novosUsuariosCount = novosUsuariosList?.length || 0;
        let novosCompradores = 0;

        // 3. Verificar quantos desses novos usuários já compraram
        if (novosUsuariosCount > 0) {
          const idsParaBusca = novosUsuariosList!.map(u => `Telegram:${u.chat_id}`);
          const { data: compras } = await supabase
            .from('pedidos')
            .select('customer_whatsapp')
            .eq('status', 'PAGO')
            .in('customer_whatsapp', idsParaBusca);

          // Usamos um Set para contar apenas usuários únicos que compraram
          novosCompradores = new Set(compras?.map(c => c.customer_whatsapp)).size;
        }

        const taxaConversao = novosUsuariosCount > 0 ? ((novosCompradores / novosUsuariosCount) * 100).toFixed(1) : "0";

        const msg = `📊 <b>ESTATÍSTICAS DO SISTEMA</b>\n\n` +
                    `👥 <b>Novos Usuários (7 dias):</b> ${novosUsuariosCount}\n` +
                    `💰 <b>Novos Compradores:</b> ${novosCompradores}\n` +
                    `🎯 <b>Taxa de Conversão:</b> ${taxaConversao}%\n\n` +
                    `📊 <b>Total de Leads no Bot:</b> ${totalUsuarios}\n\n` +
                    `<i>Dados baseados em leads e vendas pagas nos últimos 7 dias.</i>`;
        
        const inlineBtn = {
          inline_keyboard: [[{ text: "📢 Criar Anúncio para Leads", callback_data: "/anuncio_ajuda" }]]
        };

        await enviarResposta(token, adminChatId, msg, inlineBtn);
      }

      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    } else if (text.startsWith('/vendas')) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )

      const today = new Date();
      today.setHours(0, 0, 0, 0); // Início do dia atual
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1); // Início do próximo dia

      const { data: sales, error: salesError } = await supabase
        .from('pedidos')
        .select('total')
        .eq('status', 'PAGO')
        .eq('is_archived', false)
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString()); // Menor que o início do próximo dia

      if (salesError) {
        console.error("Erro ao consultar vendas:", salesError);
        await enviarResposta(token, adminChatId, "❌ Erro ao consultar vendas do dia.");
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      const totalSales = sales.reduce((sum, sale) => sum + Number(sale.total), 0);

      const salesMsg = `📊 <b>RELATÓRIO EXECUTIVO DE VENDAS</b>\n\n` +
                       `🗓 <b>Data:</b> ${today.toLocaleDateString('pt-BR')}\n` +
                       `💰 <b>Faturamento Total:</b> R$ ${totalSales.toFixed(2).replace('.', ',')}\n` +
                       `📈 <b>Qtd. Pedidos:</b> ${sales.length}\n\n` +
                       `<i>Resumo gerado em tempo real.</i>`;

      await enviarResposta(token, adminChatId, salesMsg);
    }

    return new Response(JSON.stringify({ ok: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error("Erro no Webhook:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
  }
})

async function enviarResposta(token: string, chatId: string, texto: string, replyMarkup?: any) {
  const payload: any = {
    chat_id: chatId,
    text: texto,
    parse_mode: 'HTML'
  }

  if (replyMarkup) {
    payload.reply_markup = replyMarkup
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorData = await response.json()
    console.error("❌ Erro ao enviar para o Telegram:", errorData)
  }
}

async function enviarFoto(token: string, chatId: string, fotoUrl: string, legenda: string, replyMarkup?: any) {
  const payload: any = {
    chat_id: chatId,
    photo: fotoUrl,
    caption: legenda,
    parse_mode: 'HTML'
  }

  if (replyMarkup) {
    payload.reply_markup = replyMarkup
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!response.ok) console.error("❌ Erro ao enviar foto:", await response.json())
}
