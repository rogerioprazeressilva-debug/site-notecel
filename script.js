// Este é o seu "estoque" virtual. O site usa isso para criar os cards automaticamente.
let produtos = [
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

// O resto do código (carrinho, filtros, etc) vem logo abaixo...

// 0. CONFIGURAÇÃO SUPABASE
const SUPABASE_URL = 'https://uaaslrletscnlqxctnee.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhYXNscmxldHNjbmxxeGN0bmVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NzcyMjMsImV4cCI6MjA5MjM1MzIyM30.60XnfXhjaL4XraJP0o3O7a8MMNmbqHEIlBcGi9MPJfw';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let carrinho = JSON.parse(localStorage.getItem('notecel_cart')) || [];
let isRegisterMode = false;

// Função para salvar o carrinho no LocalStorage
function salvarCarrinho() {
    localStorage.setItem('notecel_cart', JSON.stringify(carrinho));
    atualizarCarrinho();
}

// 1. RENDERIZAR PRODUTOS NA GRADE
async function renderizarProdutos(categoriaFiltro = 'todos') {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    // Busca produtos reais do banco de dados para garantir funcionamento 100%
    const { data, error } = await supabaseClient.from('produtos').select('*');
    if (!error && data && data.length > 0) {
        produtos = data;
    }

    grid.innerHTML = '';
    const listaFiltrada = categoriaFiltro === 'todos'
        ? produtos
        : produtos.filter(p => p.categoria === categoriaFiltro);

    listaFiltrada.forEach(produto => {
        grid.innerHTML += `
            <div class="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                <img src="${produto.imagem_url || produto.imagem}" class="w-full h-48 object-cover rounded-2xl mb-4">
                <span class="text-[10px] font-bold uppercase text-red-700 tracking-widest">${produto.categoria}</span>
                <h3 class="font-bold text-slate-900 text-lg">${produto.nome}</h3>
                <div class="flex justify-between items-center mt-4">
                    <span class="font-black text-xl text-slate-900">R$ ${produto.preco.toFixed(2)}</span>
                    <button onclick="adicionarAoCarrinho(${produto.id})" class="bg-slate-900 hover:bg-red-700 text-white p-3 rounded-xl transition-all active:scale-90">
                        <i class="fa-solid fa-cart-plus"></i>
                    </button>
                </div>
            </div>
        `;
    });
}

// 2. LÓGICA DO CARRINHO
function adicionarAoCarrinho(id) {
    const produto = produtos.find(p => p.id === id);
    
    // Opcional: Evitar itens duplicados (comum em contas premium)
    const jaExiste = carrinho.find(item => item.id === id);
    if (jaExiste) {
        alert("Este item já está no seu carrinho!");
        return;
    }

    carrinho.push(produto);
    salvarCarrinho();
    
    // Feedback visual: abre o carrinho automaticamente
    if (document.getElementById('cartSidebar').classList.contains('translate-x-full')) {
        toggleCart();
    }
}

function atualizarCarrinho() {
    const container = document.getElementById('cart-items');
    const totalElement = document.getElementById('cart-total');
    const countElements = document.querySelectorAll('#cart-count'); // Seleciona todos os contadores
    
    container.innerHTML = '';
    let total = 0;

    if (carrinho.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-64 text-slate-400">
                <i class="fa-solid fa-cart-shopping text-5xl mb-4 opacity-20"></i>
                <p class="font-bold text-sm uppercase tracking-widest">Carrinho Vazio</p>
            </div>
        `;
    } else {
        carrinho.forEach((item, index) => {
            total += item.preco;
            container.innerHTML += `
                <div class="flex items-center gap-4 bg-white border border-slate-100 p-4 rounded-2xl shadow-sm cart-item-enter">
                    <img src="${item.imagem_url || item.imagem}" class="w-14 h-14 rounded-xl object-cover shadow-inner">
                    <div class="flex-1">
                        <h4 class="text-xs font-black text-slate-900 uppercase">${item.nome}</h4>
                        <p class="text-red-700 font-black text-base">R$ ${item.preco.toFixed(2)}</p>
                    </div>
                    <button onclick="removerDoCarrinho(${index})" class="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                </div>
            `;
        });
    }

    totalElement.innerText = `R$ ${total.toFixed(2)}`;
    countElements.forEach(el => el.innerText = carrinho.length);
}

function removerDoCarrinho(index) {
    carrinho.splice(index, 1);
    salvarCarrinho();
}

// 3. INTERFACE (MODAIS E MENUS)
function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');
    sidebar.classList.toggle('translate-x-full');
    overlay.classList.toggle('hidden');
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    const overlay = document.getElementById('menuOverlay');
    menu.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');
}

function scrollToGrid(categoria) {
    document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' });
    renderizarProdutos(categoria);
}

// 4. CHECKOUT REAL
async function openCheckoutModal() {
    if (carrinho.length === 0) {
        alert("Adicione pelo menos um produto para continuar!");
        return;
    }

    // Verifica se o usuário está logado antes de prosseguir
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        alert("Por favor, faça login para finalizar sua compra.");
        openAuthModal();
        return;
    }

    document.getElementById('checkoutModal').classList.remove('hidden');
    // Inicia a fase de coleta de WhatsApp e reseta estados anteriores
    mostrarCamposCheckout();
}

function mostrarCamposCheckout() {
    document.getElementById('loader')?.classList.add('hidden');
    document.getElementById('pixData').classList.add('hidden');
    document.getElementById('successState').classList.add('hidden');
    document.getElementById('checkoutFields').classList.remove('hidden');
}

async function checkout() {
    const whatsapp = document.getElementById('whatsappInput').value;
    const totalCarrinho = carrinho.reduce((acc, item) => acc + item.preco, 0);

    if (whatsapp.length < 10) {
        return alert("Por favor, insira um WhatsApp válido com DDD.");
    }

    document.getElementById('checkoutFields').classList.add('hidden');
    document.getElementById('loader')?.classList.remove('hidden');

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();

        // Chamada para o backend PHP (XAMPP ou Servidor)
        const response = await fetch('gerar_pix.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                total: totalCarrinho,
                whatsapp: whatsapp,
                cartItems: carrinho,
                user_id: session?.user?.id || null,
                email: session?.user?.email || "cliente@anonimo.com"
            })
        });

        const result = await response.json();
        if (result.error) throw new Error(result.error);

        // O PHP retorna 'qr_code' para o copia e cola e 'qr_code_base64' para a imagem do QR Code
        if (result.qr_code) {
            exibirPix(result.qr_code, result.qr_code_base64);
            // Inicia a escuta em tempo real para aprovação automática
            iniciarEscutaPagamento(result.id_pagamento);
        }
    } catch (error) {
        console.error("Erro no checkout:", error);
        alert("Erro ao conectar com o servidor: " + error.message);
        mostrarCamposCheckout();
    }
}

function exibirPix(codigo, qrCodeBase64 = null) {
    document.getElementById('loader')?.classList.add('hidden');
    document.getElementById('pixData').classList.remove('hidden');
    document.getElementById('checkoutFields').classList.add('hidden');
    
    // Insere o código no input ou botão visível
    const pixInput = document.getElementById('pixCopiaCola');
    if (pixInput) pixInput.value = codigo;

    const btnCopy = document.getElementById('btnCopy');
    if (btnCopy) {
        btnCopy.onclick = () => {
            navigator.clipboard.writeText(codigo);
            btnCopy.innerHTML = '<i class="fa-solid fa-check"></i> Código Copiado!';
            btnCopy.classList.replace('bg-yellow-400', 'bg-green-500');
            
            setTimeout(() => {
                btnCopy.innerHTML = '<i class="fa-regular fa-copy"></i> Copiar Código PIX';
                btnCopy.classList.replace('bg-green-500', 'bg-yellow-400');
            }, 3000);
        };
    }

    // Exibe o QR Code (Imagem real ou ícone de fallback)
    const qrImg = document.getElementById('qrCodeImg');
    if (qrImg && qrCodeBase64) {
        qrImg.src = `data:image/jpeg;base64,${qrCodeBase64}`;
    } else {
        const qrcodePlaceholder = document.getElementById('qrcode');
        if (qrcodePlaceholder) {
            qrcodePlaceholder.innerHTML = `<p class="text-[10px] break-all p-2">${codigo.substring(0, 50)}...</p> <br> <i class="fa-solid fa-qrcode text-5xl"></i>`;
        }
    }
}

function iniciarEscutaPagamento(idPagamento) {
    if (!idPagamento) return;
    
    // Canal Realtime para ouvir mudanças na tabela 'pedidos' específicas deste PIX
    supabaseClient
        .channel(`pedido_${idPagamento}`)
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'pedidos', 
            filter: `pix_id=eq.${idPagamento}` 
        }, (payload) => {
            if (payload.new.status === 'PAGO') {
                document.getElementById('pixData').classList.add('hidden');
                document.getElementById('successState').classList.remove('hidden');
                
                // Limpa o carrinho após a compra confirmada
                carrinho = [];
                salvarCarrinho();
            }
        })
        .subscribe();
}

function closeModal() {
    document.getElementById('checkoutModal').classList.add('hidden');
    document.getElementById('pixData').classList.add('hidden');
    document.getElementById('successState').classList.add('hidden');
}

// 5. LÓGICA DE AUTENTICAÇÃO
function openAuthModal() {
    document.getElementById('authModal').classList.remove('hidden');
}

function closeAuthModal() {
    document.getElementById('authModal').classList.add('hidden');
}

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
    btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Processando...';

    if (isRegisterMode) {
        const nome = document.getElementById('regNome').value;
        const whatsapp = document.getElementById('regWhatsapp').value;

        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: { data: { full_name: nome, whatsapp: whatsapp } }
        });

        if (error) alert("Erro no cadastro: " + error.message);
        else alert("Verifique seu e-mail para confirmar o cadastro!");
    } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) alert("Erro no login: " + error.message);
        else {
            closeAuthModal();
            updateUserUI(data.user);
        }
    }
    btn.disabled = false;
    btn.innerHTML = isRegisterMode ? '<span>Criar Conta</span>' : '<span>Entrar</span>';
}

function updateUserUI(user) {
    if (user) {
        document.getElementById('userNameDisplay').innerText = user.user_metadata.full_name || user.email;
        document.getElementById('logoutBtn').classList.remove('hidden');
        if (user.user_metadata.whatsapp) {
            document.getElementById('whatsappInput').value = user.user_metadata.whatsapp;
        }
    }
}

async function carregarMeusPedidos() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    // Busca os pedidos e faz um join com a tabela de logins para mostrar as credenciais
    const { data: pedidos, error } = await supabaseClient
        .from('pedidos')
        .select(`
            *,
            logins_disponiveis (username, password)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Erro ao carregar pedidos:", error.message);
        return;
    }
    
    console.log("Seus pedidos:", pedidos);
    return pedidos;
}

async function logout() {
    await supabaseClient.auth.signOut();
    location.reload();
}

// INICIALIZAÇÃO
window.onload = async () => {
    renderizarProdutos();
    atualizarCarrinho(); // Atualiza a UI do carrinho com os itens do localStorage
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) updateUserUI(user);
};