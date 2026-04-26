// ⚠️ IMPORTANTE: Substitua as strings abaixo pelas chaves reais do seu painel Supabase
const SUPABASE_URL = 'https://uaaslrletscnlqxctnee.supabase.co'; // <--- COLOQUE A SUA PROJECT URL AQUI
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhYXNscmxldHNjbmxxeGN0bmVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NzcyMjMsImV4cCI6MjA5MjM1MzIyM30.60XnfXhjaL4XraJP0o3O7a8MMNmbqHEIlBcGi9MPJfw'; // <--- COLOQUE A SUA ANON PUBLIC KEY AQUI

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const FUNC_URL = `${SUPABASE_URL}/functions/v1/gerar-pix`;

let produtosGlobal = [];
let carrinho = [];

// 1. CARREGAR PRODUTOS DO BANCO DE DADOS
async function carregarProdutos() {
    console.log("--- Tentando conectar ao Supabase ---");
    try {
        const { data, error } = await supabaseClient
            .from('produtos')
            .select('*')
            .order('id', { ascending: true });

        if (error) throw error;

        console.log("Produtos recebidos:", data);

        if (!data || data.length === 0) {
            console.warn("Atenção: A tabela 'produtos' está vazia no seu banco de dados.");
            const grid = document.getElementById('product-grid');
            if (grid) grid.innerHTML = '<p class="col-span-full text-center text-slate-500">Nenhum produto encontrado no banco.</p>';
            return;
        }

        produtosGlobal = data;
        renderizarProdutos('todos');
    } catch (err) {
        console.error('❌ Erro de Conexão:', err.message);
        showToast("Erro de Conexão", err.message, "fa-triangle-exclamation");
    }
}

// CARREGAR APLICATIVOS
async function carregarApps() {
    const grid = document.getElementById('apps-grid');
    if (!grid) return;

    try {
        const { data, error } = await supabaseClient.from('aplicativos').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        // Diagnóstico: Abre uma tabela no console para conferir as colunas
        console.log("--- Diagnóstico de Aplicativos ---");
        console.table(data);

        if (!data || data.length === 0) {
            console.log("ℹ️ Tabela de aplicativos está vazia.");
            grid.innerHTML = '<p class="col-span-full text-center text-slate-500">Nenhum aplicativo disponível.</p>';
            return;
        }

        grid.innerHTML = data.map(app => `
            <div class="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-6 group hover:border-red-700/30 transition-all transform hover:-translate-y-1">
                <div class="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 shadow-inner bg-slate-50">
                    <img src="${app.icone_url || 'https://via.placeholder.com/150'}" class="w-full h-full object-cover" onerror="this.src='https://via.placeholder.com/150?text=App'">
                </div>
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                        <h3 class="font-bold text-slate-900">${app.nome}</h3>
                        <span class="text-[8px] bg-slate-100 px-2 py-0.5 rounded-full font-black uppercase text-slate-400">${app.plataforma}</span>
                    </div>
                    <p class="text-slate-500 text-xs line-clamp-2 mb-3">${app.descricao || ''}</p>
                    <a href="${app.link_playstore || app.link_ntdown || app.link_downloader || '#'}"
                       target="_blank"
                       ${!(app.link_playstore || app.link_ntdown || app.link_downloader) ? 'style="opacity: 0.5; pointer-events: none;"' : ''}
                       class="inline-flex items-center gap-2 text-red-700 font-bold text-[10px] uppercase tracking-widest hover:gap-3 transition-all">
                        Download <i class="fa-solid fa-arrow-right-long"></i>
                    </a>
                </div>
            </div>
        `).join('');
    } catch (err) {
        grid.innerHTML = `<p class="col-span-full text-center text-red-600">Erro ao carregar apps: ${err.message}</p>`;
    }
}

// Inicialização inteligente
window.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('product-grid')) carregarProdutos();
    if (document.getElementById('apps-grid')) carregarApps();
});

// 2. RENDERIZAR PRODUTOS NA GRID
function renderizarProdutos(categoria = 'todos') {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    grid.innerHTML = '';
    const filtrados = categoria === 'todos' 
        ? produtosGlobal 
        : produtosGlobal.filter(p => p.categoria === categoria);

    filtrados.forEach(produto => {
        const card = document.createElement('div');
        card.className = 'product-card bg-white p-4 md:p-6 rounded-2xl md:rounded-[2rem] shadow-sm border border-slate-100 flex flex-col h-full cursor-pointer hover:border-red-700/30 transition-all';
        card.onclick = (e) => {
            // Impede disparar se clicar direto no botão (que já tem seu próprio listener)
            if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'I') {
                adicionarAoCarrinho(produto.id);
            }
        };
        card.innerHTML = `
            <img src="${produto.imagem_url}" alt="${produto.nome}" class="w-full h-32 md:h-48 object-cover rounded-xl md:rounded-2xl mb-3 md:mb-4" onerror="this.src='https://via.placeholder.com/400x300?text=Produto+Indispon%C3%ADvel'">
            <span class="text-[10px] font-bold uppercase tracking-widest text-red-600 mb-2">${produto.categoria}</span>
            <h3 class="font-bold text-slate-900 mb-1 md:mb-2 text-sm md:text-base">${produto.nome}</h3>
            <p class="text-slate-500 text-[10px] md:text-xs mb-4 flex-1 line-clamp-2">${produto.descricao || ''}</p>
            <div class="flex justify-between items-center mt-auto">
                <span class="font-black text-base md:text-xl text-slate-900">R$ ${Number(produto.preco).toFixed(2).replace('.', ',')}</span>
                <button onclick="adicionarAoCarrinho(${produto.id})" class="bg-slate-900 text-white p-2 md:p-3 rounded-lg md:rounded-xl hover:bg-red-700 transition-colors">
                    <i class="fa-solid fa-plus"></i>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// 3. LÓGICA DO CARRINHO
window.adicionarAoCarrinho = async (id) => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        showToast("Identificação Necessária", "Por favor, faça login ou cadastre-se para continuar sua compra.", "fa-user-lock");
        openAuthModal();
        return;
    }
    const produto = produtosGlobal.find(p => p.id === id);
    if (produto) {
        carrinho.push(produto);
        atualizarCarrinhoUI();
        // abrirCarrinho(); // Remova o comentário se quiser que abra automaticamente ao adicionar
    }
};

function atualizarCarrinhoUI() {
    const cartContainer = document.getElementById('cart-items');
    const totalElement = document.getElementById('cart-total');
    const badges = document.querySelectorAll('.cart-count-badge');

    if (!cartContainer) return;

    if (carrinho.length === 0) {
        cartContainer.innerHTML = '<p class="text-center text-slate-400 mt-10 uppercase text-[10px] tracking-widest font-bold">Seu carrinho está vazio.</p>';
    } else {
        cartContainer.innerHTML = carrinho.map((item, index) => `
            <div class="flex items-center gap-4 mb-4 bg-slate-50 p-3 rounded-xl cart-item-enter">
                <img src="${item.imagem_url}" class="w-12 h-12 rounded-lg object-cover">
                <div class="flex-1">
                    <h4 class="text-xs font-bold">${item.nome}</h4>
                    <span class="text-red-700 font-bold text-xs">R$ ${Number(item.preco).toFixed(2)}</span>
                </div>
                <button onclick="removerDoCarrinho(${index})" class="text-slate-300 hover:text-red-600"><i class="fa-solid fa-trash"></i></button>
            </div>
        `).join('');
    }

    const total = carrinho.reduce((sum, item) => sum + Number(item.preco), 0);
    totalElement.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
    badges.forEach(b => b.innerText = carrinho.length);
}

window.removerDoCarrinho = (index) => {
    carrinho.splice(index, 1);
    atualizarCarrinhoUI();
};

// 4. FUNÇÕES DE INTERFACE (UI)
window.toggleCart = () => {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');
    if(sidebar) sidebar.classList.toggle('open');
    if(overlay) overlay.classList.toggle('active');
};

window.abrirCarrinho = () => {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');
    if (sidebar) {
        sidebar.classList.add('open');
    }
    if (overlay) {
        overlay.classList.add('active');
    }
};

window.scrollToGrid = (categoria) => {
    renderizarProdutos(categoria);
    document.getElementById('product-grid').scrollIntoView({ behavior: 'smooth' });
};

window.toggleMobileMenu = () => {
    const menu = document.getElementById('mobileMenu');
    const overlay = document.getElementById('menuOverlay');
    menu.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');
};

window.openCheckoutModal = async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        showToast("Sessão Expirada", "Sua sessão expirou. Por favor, faça login novamente.", "fa-clock-rotate-left");
        openAuthModal();
        return;
    }

    if (carrinho.length === 0) return showToast("Carrinho Vazio", "Seu carrinho está vazio! Adicione algum produto antes de finalizar.", "fa-cart-plus");
    document.getElementById('checkoutModal').classList.remove('hidden');
    
    // Fecha o carrinho automaticamente para limpar a tela
    toggleCart();

    const total = carrinho.reduce((sum, item) => sum + Number(item.preco), 0);
    
    // Chama a função de finalização que já tínhamos
    finalizarCompra({
        total: total,
        itens: carrinho,
        whatsapp: session.user.user_metadata?.whatsapp || 'Não informado',
        email: session.user.email
    });
};

// Função para o botão "Gerar PIX" dentro do modal na loja.html
window.checkout = async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return openAuthModal();

    const whatsappInput = document.getElementById('whatsappInput');
    const whatsapp = whatsappInput ? whatsappInput.value : '';
    
    if (!whatsapp || whatsapp.length < 10) {
        return showToast("Atenção", "Por favor, informe um WhatsApp válido para receber os dados.", "fa-whatsapp");
    }

    const total = carrinho.reduce((sum, item) => sum + Number(item.preco), 0);
    await finalizarCompra({
        total: total,
        itens: carrinho,
        whatsapp: whatsapp,
        email: session.user.email
    });
};

window.closeModal = () => {
    document.getElementById('checkoutModal').classList.add('hidden');
};

// 5. SISTEMA DE AUTENTICAÇÃO (Login/Cadastro)
window.openAuthModal = () => {
    document.getElementById('authModal').classList.remove('hidden');
};

window.closeAuthModal = () => {
    document.getElementById('authModal').classList.add('hidden');
};

window.setAuthMode = (isRegister) => {
    const regFields = document.getElementById('registerFields');
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    
    if (isRegister) {
        regFields.classList.remove('hidden');
        tabRegister.classList.add('border-red-700', 'text-red-700');
        tabRegister.classList.remove('border-transparent', 'text-slate-400');
        tabLogin.classList.remove('border-red-700', 'text-red-700');
        tabLogin.classList.add('border-transparent', 'text-slate-400');
    } else {
        regFields.classList.add('hidden');
        tabLogin.classList.add('border-red-700', 'text-red-700');
        tabLogin.classList.remove('border-transparent', 'text-slate-400');
        tabRegister.classList.remove('border-red-700', 'text-red-700');
        tabRegister.classList.add('border-transparent', 'text-slate-400');
    }
};

window.handleAuth = async (e) => {
    e.preventDefault();
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPass').value;
    const isRegister = !document.getElementById('registerFields').classList.contains('hidden');

    try {
        if (isRegister) {
            const nome = document.getElementById('regNome').value;
            const whatsapp = document.getElementById('regWhatsapp').value;
            const { error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: { data: { full_name: nome, whatsapp: whatsapp } }
            });
            if (error) throw error;
            showToast("Sucesso!", "Cadastro realizado! Verifique seu e-mail para confirmar sua conta.", "fa-envelope-circle-check");
        } else {
            const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            closeAuthModal();
        }
    } catch (error) {
        showToast("Erro", error.message, "fa-circle-xmark");
    }
};

window.logout = async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) showToast("Erro", error.message, "fa-circle-xmark");
    else location.reload();
};

// 6. HISTÓRICO DE PEDIDOS
window.openHistoryModal = async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return openAuthModal();

    document.getElementById('historyModal').classList.remove('hidden');
    const container = document.getElementById('history-list');
    container.innerHTML = '<div class="py-12"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-red-700 mx-auto"></div></div>';

    try {
        const { data: pedidos, error } = await supabaseClient
            .from('pedidos')
            .select(`
                id, total, status, created_at, 
                produtos(nome), 
                logins_disponiveis(username, password)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!pedidos || pedidos.length === 0) {
            container.innerHTML = '<p class="text-center text-slate-400 py-8">Você ainda não possui pedidos.</p>';
            return;
        }

        container.innerHTML = pedidos.map(p => `
            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-4">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-bold text-slate-900">${p.produtos?.nome || 'Produto'}</h4>
                        <p class="text-[10px] text-slate-400 uppercase font-bold">${new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                    <span class="px-2 py-1 rounded-md text-[9px] font-black uppercase ${p.status === 'PAGO' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                        ${p.status}
                    </span>
                </div>
                ${p.status === 'PAGO' && p.logins_disponiveis ? `
                    <div class="mt-3 p-3 bg-white rounded-xl border border-dashed border-slate-200">
                        <p class="text-[10px] font-bold text-slate-400 mb-1">DADOS DE ACESSO:</p>
                        <p class="text-xs"><strong>User:</strong> ${p.logins_disponiveis.username}</p>
                        <p class="text-xs"><strong>Senha:</strong> ${p.logins_disponiveis.password}</p>
                    </div>
                ` : ''}
                <div class="mt-2 text-right">
                    <span class="text-sm font-black text-slate-900">R$ ${Number(p.total).toFixed(2)}</span>
                </div>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = `<p class="text-center text-red-600 p-4">Erro: ${err.message}</p>`;
    }
};

window.closeHistoryModal = () => document.getElementById('historyModal').classList.add('hidden');

// Mapeia a função filtrar para renderizarProdutos para compatibilidade na loja.html
window.filtrar = (cat) => renderizarProdutos(cat);

// Monitorar estado da autenticação para atualizar a UI
supabaseClient.auth.onAuthStateChange((event, session) => {
    const user = session?.user;
    const logoutBtn = document.getElementById('logoutBtn');
    const historyBtn = document.getElementById('historyBtn');
    const userNameDisplay = document.getElementById('userNameDisplay');

    if (user) {
        if (userNameDisplay) userNameDisplay.innerText = user.user_metadata?.full_name || user.email.split('@')[0];
        if (logoutBtn) logoutBtn.classList.remove('hidden');
        if (historyBtn) historyBtn.classList.remove('hidden');
    } else {
        if (userNameDisplay) userNameDisplay.innerText = 'Entrar';
        if (logoutBtn) logoutBtn.classList.add('hidden');
        if (historyBtn) historyBtn.classList.add('hidden');
    }
});

async function finalizarCompra(dadosCarrinho) {
    const btn = document.getElementById('btnFinalizar');
    if(btn) {
        btn.disabled = true;
        btn.innerText = 'Gerando PIX...';
    }

    try {
        // PEGANDO O ID DO PRIMEIRO PRODUTO (Para baixar o estoque)
        // Se o seu sistema vende um item por vez, isso é perfeito.
        const primeiroProdutoId = dadosCarrinho.itens[0]?.id;

        const { data: { session } } = await supabaseClient.auth.getSession();
        const token = session?.access_token || SUPABASE_ANON_KEY;

        const response = await fetch(FUNC_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify({
                valor: dadosCarrinho.total,
                customer_whatsapp: dadosCarrinho.whatsapp,
                email: dadosCarrinho.email,
                cartItems: dadosCarrinho.itens,
                produto_id: primeiroProdutoId // <--- ENVIANDO O ID PARA A FUNCTION
            })
        });

        const result = await response.json();
        if (result.error) throw new Error(result.error);

        // Sincronizando a interface após a geração
        const loader = document.getElementById('loader');
        const pixData = document.getElementById('pixData');
        const qrcodeDiv = document.getElementById('qrcode');
        const btnCopy = document.getElementById('btnCopy');
        const btnZapPix = document.getElementById('btnZapPix');
        const checkoutFields = document.getElementById('checkoutFields');

        if (checkoutFields) checkoutFields.classList.add('hidden');
        if (loader) loader.classList.add('hidden');
        if (pixData) pixData.classList.remove('hidden');
        
        if (qrcodeDiv) {
            qrcodeDiv.innerHTML = `<img src="data:image/png;base64,${result.qr_code_base64}" class="mx-auto rounded-lg shadow-sm">`;
        }

        if (btnCopy) {
            btnCopy.onclick = () => {
                navigator.clipboard.writeText(result.qr_code);
                const originalText = btnCopy.innerHTML;
                btnCopy.innerText = "✅ Copiado!";
                setTimeout(() => btnCopy.innerHTML = originalText, 2000);
            };
        }

        if (btnZapPix) {
            btnZapPix.onclick = () => {
                let whatsapp = dadosCarrinho.whatsapp;
                
                // Caso o whatsapp não tenha sido definido no registro/login, tenta pegar do input de checkout (loja.html)
                if (!whatsapp || whatsapp === 'Não informado') {
                    whatsapp = document.getElementById('whatsappInput')?.value || document.getElementById('regWhatsapp')?.value;
                }

                if (!whatsapp || whatsapp.length < 10) {
                    whatsapp = prompt("Informe seu WhatsApp (DDD + Número) para enviarmos o código:");
                }

                if (whatsapp) {
                    const cleanWhatsapp = whatsapp.replace(/\D/g, '');
                    const finalWhatsapp = cleanWhatsapp.startsWith('55') ? cleanWhatsapp : '55' + cleanWhatsapp;
                    const mensagem = encodeURIComponent(`*NOTECEL PAY*\n\nAqui está o seu código PIX:\n\n${result.qr_code}\n\n*Valor:* R$ ${Number(dadosCarrinho.total).toFixed(2)}\n\n_O acesso será enviado após o pagamento._`);
                    window.open(`https://wa.me/${finalWhatsapp}?text=${mensagem}`, '_blank');
                }
            };
        }

        // INICIAR ESCUTA REALTIME
        ouvirStatusPagamento(result.id_pagamento); // Usando o pix_id retornado

    } catch (error) {
        console.error(error);
        showToast("Erro no Pedido", error.message, "fa-circle-exclamation");
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerText = 'Finalizar Compra';
        }
    }
}

// FUNÇÕES DO SISTEMA DE TOAST (ALERTAS PROFISSIONAIS)
window.showToast = (title, message, icon = "fa-circle-info") => {
    const container = document.getElementById('toastContainer');
    const box = document.getElementById('toastBox');
    
    document.getElementById('toastTitle').innerText = title;
    document.getElementById('toastMessage').innerText = message;
    document.getElementById('toastIcon').innerHTML = `<i class="fa-solid ${icon} text-4xl text-red-700"></i>`;
    
    container.classList.remove('hidden');
    container.style.backgroundColor = "rgba(15, 23, 42, 0.85)";
    setTimeout(() => box.classList.add('toast-show'), 10);
};

window.closeToast = () => {
    const container = document.getElementById('toastContainer');
    const box = document.getElementById('toastBox');
    box.classList.remove('toast-show');
    container.style.backgroundColor = "rgba(15, 23, 42, 0)";
    setTimeout(() => container.classList.add('hidden'), 300);
};

function ouvirStatusPagamento(pixId) {
    console.log(`Aguardando confirmação do pagamento ${pixId}...`);

    // Implementação do Realtime do Supabase
    const channel = supabaseClient.channel(`pagamento-${pixId}`);

    channel
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'pedidos', 
            filter: `pix_id=eq.${pixId}` 
        }, (payload) => {
            if (payload.new.status === 'PAGO') {
                // Melhorando a UX: Em vez de alert/reload, mostra o estado de sucesso no modal
                const pixData = document.getElementById('pixData');
                const successState = document.getElementById('successState');
                const loader = document.getElementById('loader');

                if (loader) loader.classList.add('hidden');
                if (pixData) pixData.classList.add('hidden');
                if (successState) successState.classList.remove('hidden');
                
                console.log("✅ Pagamento confirmado via Realtime!");
                supabaseClient.removeChannel(channel);
            }
        })
        .subscribe();
}