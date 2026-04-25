/**
 * 1. CONFIGURAÇÕES E ESTOQUE DE RESERVA
 */
const SUPABASE_URL = 'https://uaaslrletscnlqxctnee.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhYXNscmxldHNjbmxxeGN0bmVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NzcyMjMsImV4cCI6MjA5MjM1MzIyM30.60XnfXhjaL4XraJP0o3O7a8MMNmbqHEIlBcGi9MPJfw';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const produtosReserva = [
    { id: 1, nome: "Netflix Premium - 4K", preco: 19.90, categoria: "Streaming", quantidade: 10, imagem: "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=500" },
    { id: 2, nome: "Disney+ & Star+ (Combo)", preco: 24.90, categoria: "Streaming", quantidade: 5, imagem: "https://images.unsplash.com/photo-1633448555759-387ee28ac7fb?w=500" },
    { id: 3, nome: "Gift Card Razer Gold R$ 50", preco: 50.00, categoria: "Acessórios", quantidade: 0, imagem: "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=500" },
    { id: 4, nome: "Controle Gamer Pro", preco: 189.90, categoria: "Loja", quantidade: 3, imagem: "https://images.unsplash.com/photo-1592840496694-26d035b52b48?w=500" }
];

let produtosAtuais = [...produtosReserva];
let carrinho = JSON.parse(localStorage.getItem('notecel_cart')) || [];
let isRegisterMode = false;

/**
 * 2. CARREGAMENTO DE DADOS (SUPABASE)
 */
async function carregarDados(categoriaFiltro = 'todos') {
    const grid = document.getElementById('product-grid');
    if (grid) grid.innerHTML = '<div class="col-span-full text-center py-20"><i class="fa-solid fa-spinner animate-spin text-3xl text-red-700"></i></div>';

    try {
        const { data, error } = await supabaseClient.from('produtos').select('*');
        if (error) throw error;

        if (data && data.length > 0) {
            produtosAtuais = data.map(p => ({
                id: p.id,
                nome: p.nome,
                preco: p.preco,
                categoria: p.categoria,
                quantidade: p.quantidade || 0, // Mapeando a nova coluna
                imagem: p.imagem_url || p.imagem
            }));
        }
    } catch (error) {
        console.warn('Usando catálogo de reserva:', error.message);
    } finally {
        renderizarProdutos(categoriaFiltro);
    }
}

/**
 * 3. RENDERIZAÇÃO DA INTERFACE
 */
function renderizarProdutos(categoriaFiltro = 'todos') {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    const listaFiltrada = categoriaFiltro === 'todos' ? produtosAtuais : produtosAtuais.filter(p => p.categoria === categoriaFiltro);
    
    grid.innerHTML = listaFiltrada.map(produto => {
        const esgotado = produto.quantidade <= 0;
        return `
        <div class="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all product-card reveal-active ${esgotado ? 'opacity-75' : ''}">
            <div class="relative">
                <img src="${produto.imagem}" onerror="this.src='https://placehold.co/500x300?text=Imagem+Indisponivel'" class="w-full h-48 object-cover rounded-2xl mb-4 shadow-inner">
                ${esgotado ? '<span class="absolute top-2 right-2 bg-red-600 text-white text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-tighter">Esgotado</span>' : ''}
            </div>
            <div class="flex justify-between items-start">
                <span class="text-[10px] font-bold uppercase text-red-700 tracking-widest">${produto.categoria}</span>
                <span class="text-[10px] font-medium text-slate-400">Estoque: ${produto.quantidade}</span>
            </div>
            <h3 class="font-bold text-slate-900 text-lg">${produto.nome}</h3>
            <div class="flex justify-between items-center mt-4">
                <span class="font-black text-xl text-slate-900">R$ ${produto.preco.toFixed(2)}</span>
                <button 
                    onclick="adicionarAoCarrinho(${produto.id})" 
                    ${esgotado ? 'disabled' : ''}
                    class="${esgotado ? 'bg-slate-200 cursor-not-allowed' : 'bg-slate-900 hover:bg-red-700 active:scale-90 shadow-lg'} text-white p-3 rounded-xl transition-all">
                    <i class="fa-solid ${esgotado ? 'fa-box-open' : 'fa-cart-plus'}"></i>
                </button>
            </div>
        </div>
    `}).join('');
}

/**
 * 4. LÓGICA DO CARRINHO
 */
function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');
    if (!sidebar) return;

    sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    const overlay = document.getElementById('menuOverlay');
    if (!menu) return;

    const isHidden = menu.classList.contains('-translate-x-full');
    menu.classList.toggle('-translate-x-full', !isHidden);
    if (overlay) overlay.classList.toggle('hidden', !isHidden);
}

function adicionarAoCarrinho(id) {
    const produto = produtosAtuais.find(p => p.id === id);
    if (!produto) return;

    // Bloqueio de estoque
    if (produto.quantidade <= 0) {
        alert("Este produto acabou de esgotar!");
        return;
    }

    carrinho.push(produto);
    salvarCarrinho();
    
    const sidebar = document.getElementById('cartSidebar');
    if (sidebar && !sidebar.classList.contains('open')) {
        toggleCart();
    }
}

function removerDoCarrinho(index) {
    carrinho.splice(index, 1);
    salvarCarrinho();
}

function salvarCarrinho() {
    localStorage.setItem('notecel_cart', JSON.stringify(carrinho));
    atualizarCarrinho();
}

function atualizarCarrinho() {
    const container = document.getElementById('cart-items');
    const totalElement = document.getElementById('cart-total');
    const counts = document.querySelectorAll('#cart-count');
    if (!container) return;

    if (carrinho.length === 0) {
        container.innerHTML = '<p class="text-center text-slate-400 mt-10 uppercase text-[10px] tracking-widest font-bold">Seu carrinho está vazio.</p>';
        if (totalElement) totalElement.innerText = `R$ 0,00`;
    } else {
        let total = 0;
        container.innerHTML = carrinho.map((item, index) => {
            total += item.preco;
            return `
                <div class="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl mb-3 border border-slate-100">
                    <img src="${item.imagem}" class="w-12 h-12 rounded-xl object-cover">
                    <div class="flex-1">
                        <h4 class="text-[10px] font-black uppercase text-slate-900">${item.nome}</h4>
                        <p class="text-red-700 font-black text-sm">R$ ${item.preco.toFixed(2)}</p>
                    </div>
                    <button onclick="removerDoCarrinho(${index})" class="text-slate-300 hover:text-red-600">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                </div>`;
        }).join('');
        if (totalElement) totalElement.innerText = `R$ ${total.toFixed(2)}`;
    }
    counts.forEach(c => c.innerText = carrinho.length);
}

/**
 * 5. FILTROS E AUTENTICAÇÃO (Sem alterações)
 */
function openAuthModal() { document.getElementById('authModal')?.classList.remove('hidden'); }
function closeAuthModal() { document.getElementById('authModal')?.classList.add('hidden'); }

function setAuthMode(register) {
    isRegisterMode = register;
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const registerFields = document.getElementById('registerFields');
    const submitBtnText = document.querySelector('#authSubmitBtn span');

    if (register) {
        tabRegister?.classList.add('border-red-700', 'text-red-700');
        tabLogin?.classList.remove('border-red-700', 'text-red-700');
        registerFields?.classList.remove('hidden');
        if (submitBtnText) submitBtnText.innerText = "Criar Conta";
    } else {
        tabLogin?.classList.add('border-red-700', 'text-red-700');
        tabRegister?.classList.remove('border-red-700', 'text-red-700');
        registerFields?.classList.add('hidden');
        if (submitBtnText) submitBtnText.innerText = "Entrar";
    }
}

async function handleAuth(event) {
    event.preventDefault();
    const email = document.getElementById('authEmail')?.value;
    const password = document.getElementById('authPass')?.value;
    const btn = document.getElementById('authSubmitBtn');

    if (btn) btn.disabled = true;

    try {
        if (isRegisterMode) {
            const nome = document.getElementById('regNome')?.value;
            const whatsapp = document.getElementById('regWhatsapp')?.value;
            const { error } = await supabaseClient.auth.signUp({ email, password, options: { data: { full_name: nome, whatsapp } } });
            if (error) throw error;
            alert("Verifique seu e-mail para confirmar o cadastro!");
        } else {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            location.reload();
        }
    } catch (err) {
        alert("Erro: " + err.message);
    } finally {
        if (btn) btn.disabled = false;
    }
}

function filtrar(categoria) {
    renderizarProdutos(categoria);
}

/**
 * 6. CHECKOUT E PIX
 */
async function openCheckoutModal() {
    if (carrinho.length === 0) return alert("Seu carrinho está vazio!");
    
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        alert("Por favor, entre na sua conta para finalizar o pedido.");
        openAuthModal();
        return;
    }

    const modal = document.getElementById('checkoutModal');
    const loader = document.getElementById('loader');
    const pixData = document.getElementById('pixData');
    const success = document.getElementById('successState');

    modal?.classList.remove('hidden');
    loader?.classList.remove('hidden');
    pixData?.classList.add('hidden');
    success?.classList.add('hidden');

    const whatsapp = session.user.user_metadata.whatsapp || "Não informado"; 
    await executarCheckoutAutomatico(whatsapp, session);
}

async function executarCheckoutAutomatico(whatsapp, session) {
    try {
        const total = carrinho.reduce((acc, item) => acc + item.preco, 0);

        const response = await fetch(`${SUPABASE_URL}/functions/v1/gerar-pix`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': SUPABASE_KEY
            },
            body: JSON.stringify({
                valor: total,
                descricao: `Pedido Notecell - ${session.user.email}`,
                customer_whatsapp: whatsapp,
                cartItems: carrinho,
                email: session.user.email
            })
        });

        const result = await response.json();
        if (result.error) throw new Error(result.error);

        exibirPix(result.qr_code, result.qr_code_base64, result.id_pagamento);
    } catch (error) {
        console.error("Erro no checkout:", error);
        alert("Erro ao processar pedido: " + error.message);
        closeModal(); 
    }
}

function exibirPix(codigo, base64, idPagamento) {
    document.getElementById('loader')?.classList.add('hidden');
    document.getElementById('pixData')?.classList.remove('hidden');
    
    const qrcodeContainer = document.getElementById('qrcode');
    if (qrcodeContainer && base64) {
        const cleanBase64 = base64.trim();
        const imgSrc = cleanBase64.startsWith('data:') ? cleanBase64 : `data:image/png;base64,${cleanBase64}`;
        qrcodeContainer.innerHTML = `<img src="${imgSrc}" class="mx-auto w-48 border-2 border-red-700 p-2 rounded-xl shadow-lg">`;
    }

    const btnCopy = document.getElementById('btnCopy');
    if (btnCopy) {
        btnCopy.onclick = () => {
            navigator.clipboard.writeText(codigo);
            btnCopy.innerText = "Copiado!";
            setTimeout(() => btnCopy.innerText = "Copiar Código PIX", 2000);
        };
    }

    const btnZapPix = document.getElementById('btnZapPix');
    if (btnZapPix) {
        btnZapPix.onclick = () => {
            const msg = `Segue o código PIX do meu pedido na Notecell:\n\n${codigo}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
    }

    iniciarEscutaPagamento(idPagamento);
}

function iniciarEscutaPagamento(idPagamento) {
    if (!idPagamento) return;
    
    supabaseClient
        .channel(`pedido_${idPagamento}`)
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'pedidos', 
            filter: `pix_id=eq.${idPagamento}` 
        }, (payload) => {
            if (payload.new.status === 'PAGO') {
                document.getElementById('pixData')?.classList.add('hidden');
                document.getElementById('successState')?.classList.remove('hidden');
                carrinho = [];
                salvarCarrinho();
            }
        })
        .subscribe();
}

function closeModal() {
    document.getElementById('checkoutModal')?.classList.add('hidden');
}

async function logout() {
    await supabaseClient.auth.signOut();
    location.reload();
}

function togglePasswordVisibility() {
    const passInput = document.getElementById('authPass');
    const icon = document.getElementById('passwordToggleIcon');
    if (!passInput) return;
    const isPass = passInput.type === 'password';
    passInput.type = isPass ? 'text' : 'password';
    if (icon) icon.className = isPass ? 'fa-solid fa-eye-slash' : 'fa-regular fa-eye';
}

/**
 * 7. INICIALIZAÇÃO
 */
window.onload = async () => {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');

    await carregarDados();
    atualizarCarrinho();

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
        const display = document.getElementById('userNameDisplay');
        if (display) display.innerText = user.user_metadata.full_name || user.email;
        document.getElementById('logoutBtn')?.classList.remove('hidden');
    }
};

document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") {
        const sidebar = document.getElementById('cartSidebar');
        if (sidebar && sidebar.classList.contains('open')) toggleCart();
        closeModal();
        closeAuthModal();
    }
});