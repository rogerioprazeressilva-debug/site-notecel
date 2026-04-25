// 1. ESTOQUE DE PRODUTOS (Reserva caso o banco falhe)
const produtos = [
    { 
        id: 1, 
        nome: "Netflix Premium - 4K", 
        preco: 19.90, 
        categoria: "Streaming", 
        imagem: "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=500&q=80" 
    },
    { 
        id: 2, 
        nome: "Disney+ & Star+ (Combo)", 
        preco: 24.90, 
        categoria: "Streaming", 
        imagem: "https://images.unsplash.com/photo-1633448555759-387ee28ac7fb?w=500&q=80" 
    },
    { 
        id: 3, 
        nome: "Gift Card Razer Gold R$ 50", 
        preco: 50.00, 
        categoria: "Acessórios", 
        imagem: "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=500&q=80" 
    },
    { 
        id: 4, 
        nome: "Controle Gamer Pro", 
        preco: 189.90, 
        categoria: "Loja", 
        imagem: "https://images.unsplash.com/photo-1592840496694-26d035b52b48?w=500&q=80" 
    }
];

// 2. CONFIGURAÇÃO SUPABASE
const SUPABASE_URL = 'https://uaaslrletscnlqxctnee.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhYXNscmxldHNjbmxxeGN0bmVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NzcyMjMsImV4cCI6MjA5MjM1MzIyM30.60XnfXhjaL4XraJP0o3O7a8MMNmbqHEIlBcGi9MPJfw';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let carrinho = JSON.parse(localStorage.getItem('notecel_cart')) || [];
let isRegisterMode = false;

/**
 * LÓGICA DO CARRINHO (SIDEBAR)
 */
function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');

    if (!sidebar || !overlay) return;

    if (sidebar.style.right === "0px") {
        // FECHAR
        sidebar.style.right = "-400px";
        overlay.style.display = "none";
    } else {
        // ABRIR
        sidebar.style.right = "0px";
        overlay.style.display = "block";
    }
}

/**
 * RENDERIZAÇÃO DO CATÁLOGO
 */
async function renderizarProdutos(categoriaFiltro = 'todos') {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    grid.innerHTML = '<div class="col-span-full text-center py-20"><i class="fa-solid fa-spinner animate-spin text-3xl text-red-700"></i></div>';

    try {
        const { data, error } = await supabaseClient.from('produtos').select('*');
        if (!error && data && data.length > 0) {
            // Atualiza a lista local com os dados do banco
            produtos.length = 0;
            data.forEach(p => produtos.push({
                id: p.id,
                nome: p.nome,
                preco: p.preco,
                categoria: p.categoria,
                imagem: p.imagem_url || p.imagem
            }));
        }
    } catch (e) {
        console.warn("Usando catálogo de fallback.");
    }

    const listaFiltrada = categoriaFiltro === 'todos' ? produtos : produtos.filter(p => p.categoria === categoriaFiltro);
    grid.innerHTML = '';

    listaFiltrada.forEach(produto => {
        grid.innerHTML += `
            <div class="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all product-card reveal-active">
                <img src="${produto.imagem}" class="w-full h-48 object-cover rounded-2xl mb-4 shadow-inner">
                <span class="text-[10px] font-bold uppercase text-red-700 tracking-widest">${produto.categoria}</span>
                <h3 class="font-bold text-slate-900 text-lg">${produto.nome}</h3>
                <div class="flex justify-between items-center mt-4">
                    <span class="font-black text-xl text-slate-900">R$ ${produto.preco.toFixed(2)}</span>
                    <button onclick="adicionarAoCarrinho(${produto.id})" class="bg-slate-900 text-white p-3 rounded-xl hover:bg-red-700 transition-all active:scale-90 shadow-lg">
                        <i class="fa-solid fa-cart-plus"></i>
                    </button>
                </div>
            </div>
        `;
    });
}

/**
 * FILTROS E NAVEGAÇÃO
 */
function filtrar(categoria) {
    renderizarProdutos(categoria);
    
    // Estilização dos botões de filtro
    document.querySelectorAll('[onclick^="filtrar"]').forEach(btn => {
        if (btn.getAttribute('onclick').includes(`'${categoria}'`)) {
            btn.classList.add('bg-red-700', 'text-white', 'border-red-700');
        } else {
            btn.classList.remove('bg-red-700', 'text-white', 'border-red-700');
        }
    });
}

function scrollToGrid(categoria) {
    const grid = document.getElementById('product-grid');
    if (grid) {
        grid.scrollIntoView({ behavior: 'smooth' });
        filtrar(categoria);
    } else {
        // Se não estiver na página com o grid, redireciona para a loja com o filtro
        window.location.href = `loja.html?cat=${categoria}`;
    }
}

/**
 * GESTÃO DO CARRINHO
 */
function adicionarAoCarrinho(id) {
    const produto = produtos.find(p => p.id === id);
    if (!produto) return;

    carrinho.push(produto);
    salvarCarrinho();
    
    // Feedback visual
    const btn = document.getElementById('cartBtnHeader');
    if (btn) btn.classList.add('cart-bump');
    setTimeout(() => btn?.classList.remove('cart-bump'), 400);

    if (document.getElementById('cartSidebar').style.right !== "0px") {
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

    let total = 0;
    container.innerHTML = '';

    if (carrinho.length === 0) {
        container.innerHTML = '<p class="text-center text-slate-400 mt-10 uppercase text-[10px] tracking-widest font-bold">Seu carrinho está vazio.</p>';
    } else {
        carrinho.forEach((item, index) => {
            total += item.preco;
            container.innerHTML += `
                <div class="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl cart-item-enter mb-3 border border-slate-100">
                    <img src="${item.imagem}" class="w-12 h-12 rounded-xl object-cover shadow-sm">
                    <div class="flex-1">
                        <h4 class="text-[10px] font-black uppercase text-slate-900">${item.nome}</h4>
                        <p class="text-red-700 font-black text-sm">R$ ${item.preco.toFixed(2)}</p>
                    </div>
                    <button onclick="removerDoCarrinho(${index})" class="text-slate-300 hover:text-red-600 transition-colors">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                </div>
            `;
        });
    }

    totalElement.innerText = `R$ ${total.toFixed(2)}`;
    counts.forEach(c => c.innerText = carrinho.length);
}

/**
 * LÓGICA DE AUTENTICAÇÃO
 */
function openAuthModal() { document.getElementById('authModal').classList.remove('hidden'); }
function closeAuthModal() { document.getElementById('authModal').classList.add('hidden'); }

function setAuthMode(register) {
    isRegisterMode = register;
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const registerFields = document.getElementById('registerFields');
    const submitBtnText = document.querySelector('#authSubmitBtn span');

    if (register) {
        tabRegister.classList.add('border-red-700', 'text-red-700');
        tabLogin.classList.remove('border-red-700', 'text-red-700');
        registerFields.classList.remove('hidden');
        submitBtnText.innerText = "Criar Conta";
    } else {
        tabLogin.classList.add('border-red-700', 'text-red-700');
        tabRegister.classList.remove('border-red-700', 'text-red-700');
        registerFields.classList.add('hidden');
        submitBtnText.innerText = "Entrar";
    }
}

async function handleAuth(event) {
    event.preventDefault();
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPass').value;
    const btn = document.getElementById('authSubmitBtn');

    btn.disabled = true;
    btn.innerHTML = 'Processando...';

    if (isRegisterMode) {
        const { error } = await supabaseClient.auth.signUp({ 
            email, 
            password, 
            options: { data: { full_name: document.getElementById('regNome').value, whatsapp: document.getElementById('regWhatsapp').value } } 
        });
        if (error) alert(error.message); else alert("Verifique seu e-mail!");
    } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) alert(error.message); else {
            closeAuthModal();
            updateUserUI(data.user);
        }
    }
    btn.disabled = false;
    btn.innerHTML = isRegisterMode ? 'Criar Conta' : 'Entrar';
}

function updateUserUI(user) {
    if (user) {
        document.getElementById('userNameDisplay').innerText = user.user_metadata.full_name || user.email;
        document.getElementById('logoutBtn').classList.remove('hidden');
    }
}

/**
 * LÓGICA DE CHECKOUT E PAGAMENTO
 */
async function openCheckoutModal() {
    if (carrinho.length === 0) return alert("Seu carrinho está vazio!");
    
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        alert("Por favor, faça login para continuar com o pedido.");
        openAuthModal();
        return;
    }

    document.getElementById('checkoutModal').classList.remove('hidden');
    mostrarCamposCheckout();
}

function mostrarCamposCheckout() {
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('pixData').classList.add('hidden');
    document.getElementById('successState').classList.add('hidden');
    document.getElementById('checkoutFields').classList.remove('hidden');
}

async function checkout() {
    const whatsapp = document.getElementById('whatsappInput').value;
    if (whatsapp.length < 10) return alert("Por favor, insira um WhatsApp válido.");

    document.getElementById('checkoutFields').classList.add('hidden');
    document.getElementById('loader').classList.remove('hidden');

    const total = carrinho.reduce((acc, item) => acc + item.preco, 0);

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const response = await fetch(`${SUPABASE_URL}/functions/v1/gerar-pix`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token || SUPABASE_KEY}`,
                'apikey': SUPABASE_KEY
            },
            body: JSON.stringify({
                valor: total,
                descricao: `Pedido Notecell - ${whatsapp}`,
                customer_whatsapp: whatsapp,
                cartItems: carrinho,
                email: session?.user?.email || "cliente@email.com"
            })
        });

        const result = await response.json();
        if (result.error) throw new Error(result.error);

        exibirPix(result.qr_code, result.qr_code_base64, result.id_pagamento);
    } catch (error) {
        alert("Erro: " + error.message);
        mostrarCamposCheckout();
    }
}

function exibirPix(codigo, base64, idPagamento) {
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('pixData').classList.remove('hidden');
    
    // Verifica se o base64 já contém o prefixo de dados para evitar duplicação
    const imgSrc = (base64 && typeof base64 === 'string' && base64.startsWith('data:')) ? base64 : `data:image/png;base64,${base64 || ''}`;
    
    const qrcodeContainer = document.getElementById('qrcode');
    qrcodeContainer.innerHTML = `<img src="${imgSrc}" class="mx-auto w-48 border-2 border-red-700 p-2 rounded-xl" alt="QR Code PIX">`;
    
    const btnCopy = document.getElementById('btnCopy');
    const btnZapPix = document.getElementById('btnZapPix');
    const whatsappCliente = document.getElementById('whatsappInput').value.replace(/\D/g, '');

    btnCopy.onclick = () => {
        navigator.clipboard.writeText(codigo);
        btnCopy.innerText = "Copiado!";
        setTimeout(() => btnCopy.innerText = "Copiar Código PIX", 2000);
    };

    if (btnZapPix) {
        btnZapPix.onclick = () => {
            const msg = `Olá! Segue o código PIX para pagar meu pedido na Notecell:\n\n${codigo}`;
            const url = `https://wa.me/${whatsappCliente}?text=${encodeURIComponent(msg)}`;
            window.open(url, '_blank');
        };
    }

    iniciarEscutaPagamento(idPagamento);
}

function iniciarEscutaPagamento(idPagamento) {
    supabaseClient
        .channel(`pedido_${idPagamento}`)
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'pedidos', 
            filter: `pix_id=eq.${String(idPagamento)}` 
        }, (payload) => {
            if (payload.new.status === 'PAGO') {
                document.getElementById('pixData').classList.add('hidden');
                document.getElementById('successState').classList.remove('hidden');
                carrinho = [];
                salvarCarrinho();
            }
        })
        .subscribe();
}

function closeModal() { document.getElementById('checkoutModal').classList.add('hidden'); }
async function logout() { await supabaseClient.auth.signOut(); location.reload(); }

// Eventos globais
document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") {
        const sidebar = document.getElementById('cartSidebar');
        if (sidebar && sidebar.style.right === "0px") {
            toggleCart();
        }
    }
});

window.onload = async () => {
    renderizarProdutos();
    atualizarCarrinho();

    // Verificar se existe usuário logado
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) updateUserUI(user);
};
function togglePasswordVisibility() {
    const passInput = document.getElementById('authPass');
    const icon = document.getElementById('passwordToggleIcon');
    if (passInput.type === 'password') {
        passInput.type = 'text';
        icon.classList.replace('fa-regular', 'fa-solid');
    } else {
        passInput.type = 'password';
        icon.classList.replace('fa-solid', 'fa-regular');
    }
}