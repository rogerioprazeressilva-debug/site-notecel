// 0. CONFIGURAÇÃO SUPABASE (Substitua pelas suas chaves do painel do Supabase)
const SUPABASE_URL = 'https://uaaslrletscnlqxctnee.supabase.co'; // <-- COLOQUE AQUI A URL DO SEU PROJETO SUPABASE
const SUPABASE_KEY = 'sb_publishable_nKcbuBqKfu6MghVmJvB5OQ_elexxgqa'; // <-- COLOQUE AQUI A CHAVE 'anon public' DO SUPABASE

if (SUPABASE_URL.includes("SUBSTITUA_PELA_URL")) {
    console.warn("⚠️ SISTEMA EM MODO DE CONFIGURAÇÃO: Insira as credenciais de produção nas variáveis de ambiente.");
}

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 1. BANCO DE DADOS DE PRODUTOS E SERVIÇOS
let produtos = [];

// 2. ESTADO DA APLICAÇÃO (CARRINHO)
let cart = JSON.parse(localStorage.getItem('notecel_cart')) || [];
let currentUser = JSON.parse(localStorage.getItem('notecel_user')) || null;

// Utils
const formatarMoeda = (valor) => {
    return valor.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
};

// --- FUNÇÕES DE NAVEGAÇÃO E FILTRO ---

// Helper para rolar até a vitrine e filtrar automaticamente
function scrollToGrid(categoria) {
    filtrar(categoria);
    document.getElementById('product-grid').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function filtrar(categoria) {
    const grid = document.getElementById('product-grid');
    const tituloPagina = document.querySelector('header h1');
    
    if (!grid) return;
    grid.innerHTML = '<div class="col-span-full text-center py-10"><i class="fa-solid fa-circle-notch animate-spin text-3xl text-red-700"></i></div>';

    if (!tituloPagina) return;

    // Busca produtos do Supabase se a lista estiver vazia
    if (produtos.length === 0) {
        const { data, error } = await supabaseClient.from('produtos').select('*');
        
        if (error || !data || data.length === 0) {
            grid.innerHTML = '<p class="col-span-full text-center text-slate-500 py-10">Nenhum produto encontrado no banco de dados.</p>';
            return;
        } else {
            produtos = data;
        }
    }

    const filtrados = (categoria === 'todos') 
        ? produtos 
        : produtos.filter(p => p.categoria === categoria);

    // Atualiza o título dinamicamente para o usuário saber onde está
    if(categoria === 'todos') {
        tituloPagina.innerHTML = 'Contas Premium <br>com <span class="text-red-700">acesso imediato.</span>';
    } else {
        tituloPagina.innerText = categoria;
    }

    grid.innerHTML = filtrados.map(p => `
        <div class="product-card bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div class="h-48 overflow-hidden">
                <img src="${p.imagem_url}" alt="${p.nome}" class="w-full h-full object-cover transition-transform duration-500 hover:scale-110">
            </div>
            <div class="p-8">
                <span class="text-[10px] font-bold tracking-widest bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase">${p.categoria}</span>
                <h3 class="text-lg font-bold mt-3 text-slate-900">${p.nome}</h3>
                <p class="text-slate-500 text-xs mt-1">${p.descricao}</p>
                <div class="mt-6 flex items-center justify-between">
                    <span class="text-2xl font-black text-slate-900">${formatarMoeda(p.preco)}</span>
                    <button onclick="addToCart(${p.id})" class="bg-slate-900 hover:bg-red-700 text-white p-3 rounded-2xl transition active:scale-90 shadow-lg">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.nav-link').forEach(link => {
        const linkText = link.innerText.trim();
        const ehAtivo = (categoria === 'todos' && linkText === 'Início') || 
                       (categoria === 'Streaming' && linkText === 'Streaming') ||
                       (categoria === 'Games' && linkText === 'Games');

        if(ehAtivo) link.classList.add('text-red-700', 'border-b-2', 'border-red-700');
        else link.classList.remove('text-red-700', 'border-b-2', 'border-red-700');
    });

    // Scroll suave para a grade de produtos ao filtrar (melhora a UX no mobile)
    if(categoria !== 'todos' && grid.innerHTML !== "") {
        document.getElementById('product-grid').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// --- SISTEMA DE AUTENTICAÇÃO ---
let isRegisterMode = false;

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
    const submitBtn = document.getElementById('authSubmitBtn');

    const btnSpan = submitBtn ? submitBtn.querySelector('span') : null;

    if (isRegisterMode) {
        tabRegister.className = "flex-1 pb-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 border-red-700 text-red-700";
        tabLogin.className = "flex-1 pb-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 border-transparent text-slate-400 hover:text-slate-600";
        registerFields.classList.remove('hidden');
        if (btnSpan) btnSpan.innerText = "Criar Minha Conta";
    } else {
        tabLogin.className = "flex-1 pb-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 border-red-700 text-red-700";
        tabRegister.className = "flex-1 pb-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 border-transparent text-slate-400 hover:text-slate-600";
        registerFields.classList.add('hidden');
        if (btnSpan) btnSpan.innerText = "Entrar";
    }
}

function togglePasswordVisibility() {
    const passwordInput = document.getElementById('authPass');
    const toggleIcon = document.getElementById('passwordToggleIcon');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        toggleIcon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

async function handleAuth(event) {
    event.preventDefault();
    const email = document.getElementById('authEmail').value;
    const senha = document.getElementById('authPass').value;
    const btn = document.getElementById('authSubmitBtn');
    const originalContent = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch animate-spin"></i> Processando...`;
    
    try {
        if(isRegisterMode) {
            const nome = document.getElementById('regNome').value;
            const whatsapp = document.getElementById('regWhatsapp').value;

            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password: senha,
                options: { data: { nome, whatsapp } }
            });

            if (error) throw error;
            
            if (data.user && data.session === null) {
                alert("Cadastro realizado! Por favor, verifique seu e-mail para confirmar a conta antes de fazer login.");
                setAuthMode(false);
            } else {
                alert("Cadastro realizado com sucesso!");
                // Se o email confirmation estiver desligado, o usuário já loga aqui
            }
        } else {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email: email, password: senha });
            if (error) throw error;

            currentUser = {
                id: data.user.id,
                nome: data.user.user_metadata.nome,
                email: data.user.email,
                whatsapp: data.user.user_metadata.whatsapp
            };
            
            localStorage.setItem('notecel_user', JSON.stringify(currentUser));
            updateUserUI();
            closeAuthModal();
            alert(`Bem-vindo, ${currentUser.nome}!`);
        }
    } catch (err) {
        console.error("❌ Erro na Autenticação:", err);
        if (err.message === "Failed to fetch") {
            alert("Erro de conexão com o Supabase. Verifique sua internet ou as configurações do projeto.");
        } else if (err.message === "Email not confirmed") {
            alert("⚠️ E-mail não confirmado! Verifique sua caixa de entrada (ou spam) e clique no link de confirmação para ativar sua conta.");
        } else {
            alert(err.message);
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}

async function logout() {
    if (confirm("Deseja realmente sair da sua conta?")) {
        await supabaseClient.auth.signOut();
        currentUser = null;
        localStorage.removeItem('notecel_user');
        updateUserUI();
        
        // Fecha o carrinho se estiver aberto para garantir privacidade
        if (document.getElementById('cartSidebar').classList.contains('cart-open')) {
            toggleCart();
        }
    }
}

function updateUserUI() {
    const nameDisplay = document.getElementById('userNameDisplay');
    const logoutBtn = document.getElementById('logoutBtn');
    const userBtn = document.getElementById('userBtn');

    if (!nameDisplay) return;

    if(currentUser) {
        nameDisplay.innerText = `Olá, ${currentUser.nome.split(' ')[0]}`;
        nameDisplay.classList.remove('hidden');
        logoutBtn.classList.remove('hidden');
        userBtn.onclick = null; // Desabilita abertura do modal ao clicar no nome
        userBtn.classList.add('cursor-default');
    } else {
        nameDisplay.innerText = "Entrar";
        logoutBtn.classList.add('hidden');
        userBtn.onclick = openAuthModal;
        userBtn.classList.remove('cursor-default');
    }
}

// --- FUNÇÕES DO CARRINHO ---
function toggleCart() {
    document.getElementById('cartSidebar').classList.toggle('cart-open');
    document.getElementById('cartOverlay').classList.toggle('hidden');
}

function toggleMobileMenu() {
    alert("Implementar menu lateral ou dropdown mobile");
}

function addToCart(id) {
    const index = cart.findIndex(p => p.id === id);
    
    if (index !== -1) {
        cart[index].quantidade++;
    } else {
        const item = produtos.find(p => p.id === id);
        cart.push({ ...item, quantidade: 1 });
    }
    
    saveCart();

    // Animação no botão do carrinho na navbar
    const cartIcon = document.querySelector('nav button');
    cartIcon.classList.add('cart-bump');
    setTimeout(() => cartIcon.classList.remove('cart-bump'), 400);

    if(!document.getElementById('cartSidebar').classList.contains('cart-open')) toggleCart();
}

function updateQuantity(id, delta) {
    const index = cart.findIndex(p => p.id === id);
    if (index !== -1) {
        cart[index].quantidade += delta;
        if (cart[index].quantidade <= 0) {
            removeFromCart(index);
        } else {
            saveCart();
        }
    }
}

function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart();
}

function saveCart() {
    localStorage.setItem('notecel_cart', JSON.stringify(cart));
    updateCartUI();
}

function updateCartUI() {
    const container = document.getElementById('cart-items');
    const totalElement = document.getElementById('cart-total');
    const countElement = document.getElementById('cart-count');
    
    if (!container || !totalElement || !countElement) return;

    const totalItens = cart.reduce((acc, item) => acc + item.quantidade, 0);
    countElement.innerText = totalItens;
    
    let total = 0;
    if (cart.length === 0) {
        container.innerHTML = '<p class="text-center text-slate-400 mt-10">Carrinho vazio</p>';
    } else {
        container.innerHTML = cart.map((item, index) => {
            const subtotal = item.preco * item.quantidade;
            total += subtotal;
            return `
                <div class="flex flex-col bg-slate-50 p-3 rounded-lg border border-slate-200 gap-2">
                    <div class="flex justify-between items-start gap-3">
                        <img src="${item.imagem_url}" class="w-12 h-12 rounded-lg object-cover border border-slate-200 shadow-sm">
                        <div class="flex-1">
                            <p class="font-bold text-sm text-slate-800">${item.nome}</p>
                            <p class="text-red-700 font-bold text-xs">${formatarMoeda(item.preco)} un.</p>
                        </div>
                        <button onclick="removeFromCart(${index})" class="text-slate-300 hover:text-red-500 transition">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                    <div class="flex justify-between items-center mt-1">
                        <div class="flex items-center gap-3 bg-white border rounded-md px-2 py-1">
                            <button onclick="updateQuantity(${item.id}, -1)" class="text-red-700 hover:bg-slate-100 px-1 rounded">-</button>
                            <span class="text-xs font-bold w-4 text-center">${item.quantidade}</span>
                            <button onclick="updateQuantity(${item.id}, 1)" class="text-green-700 hover:bg-slate-100 px-1 rounded">+</button>
                        </div>
                        <p class="text-slate-900 font-black text-sm">${formatarMoeda(subtotal)}</p>
                    </div>
                </div>
            `;
        }).join('');
    }
    totalElement.innerText = formatarMoeda(total);
}

// --- FUNÇÕES DE CHECKOUT PIX ---
function closeModal() {
    document.getElementById('checkoutModal').classList.add('hidden');
}

async function checkout() {
    if (cart.length === 0) return alert("Adicione itens antes de pagar!");
    
    if (!currentUser) {
        alert("Para sua segurança, identifique-se antes de finalizar a compra.");
        return openAuthModal();
    }

    const total = cart.reduce((acc, i) => acc + (i.preco * i.quantidade), 0);
    
    if (total < 1.00) {
        return alert("O valor mínimo para pagamento via PIX é R$ 1,00.");
    }

    // Pega o WhatsApp do input ou do perfil do usuário
    let whatsappNumber = document.getElementById('whatsappInput').value.replace(/\D/g, '');
    if (!whatsappNumber && currentUser && currentUser.whatsapp) whatsappNumber = currentUser.whatsapp.replace(/\D/g, '');
    
    if (whatsappNumber.length < 10) return alert("Por favor, informe seu WhatsApp para receber os dados de acesso.");

    document.getElementById('checkoutModal').classList.remove('hidden');
    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('pixData').classList.add('hidden');
    document.getElementById('successState').classList.add('hidden');
    document.getElementById('qrcode').innerHTML = '';
    const descricao = `Pedido Notecel (${currentUser.nome}) - Login Digital`;

    try {
        // Chama a Supabase Edge Function
        const { data, error } = await supabaseClient.functions.invoke('gerar-pix', {
            body: { 
                valor: total, 
                descricao: descricao, // Descrição do pagamento no MP
                email: currentUser.email, // E-mail do pagador no MP
                customer_whatsapp: whatsappNumber, 
                cartItems: cart // Enviando o carrinho completo
            }
        });

        if (error) throw error;

        exibirPix(data.qr_code_base64, data.qr_code, data.id_pagamento);
    } catch (err) {
        alert('Erro ao processar checkout: ' + err.message);
        closeModal();
    }
}

function exibirPix(base64, copiaCola, id) {
    if (!base64) {
        alert("Falha na geração do QR Code. Por favor, tente novamente ou entre em contato com o suporte.");
        return closeModal();
    }

    const qrImg = `data:image/png;base64,${base64}`;
    const btnCopy = document.getElementById('btnCopy');

    document.getElementById('qrcode').innerHTML = `<img src="${qrImg}" class="w-48 h-48 mx-auto shadow-lg rounded-lg">`;
    btnCopy.onclick = () => {
        navigator.clipboard.writeText(copiaCola);
        const originalHTML = btnCopy.innerHTML;
        btnCopy.innerHTML = '<i class="fa-solid fa-check"></i> Copiado!';
        btnCopy.classList.replace('bg-yellow-400', 'bg-green-500');
        btnCopy.classList.add('text-white');

        setTimeout(() => {
            btnCopy.innerHTML = originalHTML;
            btnCopy.classList.replace('bg-green-500', 'bg-yellow-400');
            btnCopy.classList.remove('text-white');
        }, 2000);
    };

    document.getElementById('loader').classList.add('hidden');
    document.getElementById('pixData').classList.remove('hidden');

    verificarPagamento(id);
}

async function verificarPagamento(pix_id) {
    if (!pix_id) return;
    
    // Monitoramento Realtime do status do pedido no banco de dados
    supabaseClient
        .channel('schema-db-changes')
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'pedidos', 
            filter: `pix_id=eq.${pix_id}` 
        }, (payload) => {
            if (payload.new.status === 'PAGO') {
                const pixData = document.getElementById('pixData');
                const successState = document.getElementById('successState');
                
                pixData.classList.add('hidden');
                successState.classList.remove('hidden');
                if (document.getElementById('successMsg')) {
                    document.getElementById('successMsg').innerText = "Sua conta foi enviada via WhatsApp!";
                }

                cart = [];
                saveCart();
                supabaseClient.removeAllChannels();
            }
        }).subscribe();
}

// --- ANIMAÇÃO DE REVELAÇÃO (INTERSECTION OBSERVER) ---
function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('reveal-active');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

window.onload = () => {
    // Inicializa listeners de UI com segurança
    const mobileBtn = document.getElementById('mobileMenuBtn');
    if (mobileBtn) {
        mobileBtn.onclick = () => {
            alert("Menu Mobile profissional em construção (Sidebar Esquerda)");
        };
    }

    filtrar('todos');
    updateCartUI();
    updateUserUI();
    initScrollReveal();
};