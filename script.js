// 0. CONFIGURAÇÃO SUPABASE (Substitua pelas suas chaves do painel do Supabase)
var SUPABASE_URL = 'https://uaaslrletscnlqxctnee.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhYXNscmxldHNjbmxxeGN0bmVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NzcyMjMsImV4cCI6MjA5MjM1MzIyM30.60XnfXhjaL4XraJP0o3O7a8MMNmbqHEIlBcGi9MPJfw';

if (SUPABASE_URL.indexOf("https://uaaslrletscnlqxctnee.supabase.co") !== -1) {
    console.warn("⚠️ SISTEMA EM MODO DE CONFIGURAÇÃO: Insira as credenciais de produção nas variáveis de ambiente.");
}

var supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 1. BANCO DE DADOS DE PRODUTOS E SERVIÇOS
var produtos = [];

// 2. ESTADO DA APLICAÇÃO (CARRINHO)
var cart = JSON.parse(localStorage.getItem('notecel_cart')) || [];
var currentUser = JSON.parse(localStorage.getItem('notecel_user')) || null;

// Utils
function formatarMoeda(valor) {
    var n = Number(valor) || 0;
    return n.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
}

// --- FUNÇÕES DE NAVEGAÇÃO E FILTRO ---

// Helper para pegar parâmetros da URL (ex: ?cat=Loja)
function getQueryParam(name) {
    var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
    return results ? decodeURIComponent(results[1]) : null;
}

// Helper para rolar até a vitrine e filtrar automaticamente
function scrollToGrid(categoria) {
    // Se não estiver na página da loja, redireciona
    var path = window.location.pathname;
    if (path.indexOf('loja') === -1) {
        window.location.href = 'loja.html?cat=' + categoria;
    } else {
        filtrar(categoria);
        var grid = document.getElementById('product-grid');
        if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function filtrar(categoria) {
    var grid = document.getElementById('product-grid');
    var tituloPagina = document.querySelector('#hero h1');
    
    if (!grid) return;
    
    // Força a visibilidade do container para que o loader e mensagens apareçam
    var parent = grid.parentNode;
    while (parent && parent !== document.body) {
        if (parent.classList && parent.classList.contains('reveal')) {
            parent.classList.add('reveal-active');
        }
        parent = parent.parentNode;
    }
    
    grid.innerHTML = '<div class="col-span-full text-center py-10"><i class="fa-solid fa-circle-notch animate-spin text-3xl text-red-700"></i></div>';

    if (produtos.length === 0) {
        supabaseClient.from('produtos').select('*').then(function(res) {
            if (res.error) {
                grid.innerHTML = '<p class="col-span-full text-center text-red-500 py-10">Erro ao carregar produtos.</p>';
                return;
            }
            produtos = res.data || [];
            exibirProdutos(categoria);
        });
    } else {
        exibirProdutos(categoria);
    }
}

function exibirProdutos(categoria) {
    var grid = document.getElementById('product-grid');
    var tituloPagina = document.querySelector('#hero h1');
    var filtrados = [];

    for (var i = 0; i < produtos.length; i++) {
        if (categoria === 'todos' || (produtos[i].categoria || '').toLowerCase() === categoria.toLowerCase()) {
            filtrados.push(produtos[i]);
        }
    }

    if (tituloPagina) {
        if(categoria === 'todos') {
            tituloPagina.innerHTML = 'Contas Premium <br>com <span class="text-red-700">acesso imediato.</span>';
        } else {
            tituloPagina.innerText = categoria;
        }
    }

    var html = '';
    for (var j = 0; j < filtrados.length; j++) {
        var p = filtrados[j];
        html += '<div class="product-card bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">' +
            '<div class="h-48 overflow-hidden">' +
                '<img src="' + (p.imagem_url || 'https://via.placeholder.com/400x300') + '" class="w-full h-full object-cover transition-transform duration-500 hover:scale-110">' +
            '</div>' +
            '<div class="p-8">' +
                '<span class="text-[10px] font-bold tracking-widest bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase">' + (p.categoria || 'Digital') + '</span>' +
                '<h3 class="text-lg font-bold mt-3 text-slate-900">' + p.nome + '</h3>' +
                '<p class="text-slate-500 text-xs mt-1">' + (p.descricao || '') + '</p>' +
                '<div class="mt-6 flex items-center justify-between">' +
                    '<span class="text-2xl font-black text-slate-900">' + formatarMoeda(p.preco) + '</span>' +
                    '<button onclick="addToCart(' + p.id + ')" class="bg-slate-900 hover:bg-red-700 text-white p-3 rounded-2xl shadow-lg"><i class="fa-solid fa-plus"></i></button>' +
                '</div>' +
            '</div>' +
        '</div>';
    }
    grid.innerHTML = html;

    var links = document.querySelectorAll('.nav-link');
    for (var k = 0; k < links.length; k++) {
        var linkText = links[k].innerText.trim();
        var ehAtivo = (categoria === 'todos' && linkText === 'Início') || 
                       (categoria === 'Streaming' && linkText === 'Streaming') ||
                       (categoria === 'Acessórios' && linkText === 'Acessórios') ||
                       (categoria === 'Loja' && linkText === 'Loja');

        if (ehAtivo) {
            links[k].classList.add('text-red-700', 'border-red-700');
            links[k].classList.remove('border-transparent');
        } else {
            links[k].classList.remove('text-red-700', 'border-red-700');
            links[k].classList.add('border-transparent');
        }
    }

    // Atualiza links mobile de forma sincronizada
    var mobileLinks = document.querySelectorAll('.nav-link-mobile');
    for (var m = 0; m < mobileLinks.length; m++) {
        var mLinkText = mobileLinks[m].innerText.trim();
        var mEhAtivo = (categoria === 'todos' && mLinkText === 'Início') || 
                        (categoria === 'Streaming' && mLinkText === 'Streaming') ||
                        (categoria === 'Acessórios' && mLinkText === 'Acessórios') ||
                        (categoria === 'Loja' && mLinkText === 'Loja');

        if(mEhAtivo) mobileLinks[m].className = 'nav-link-mobile p-4 rounded-xl bg-red-50 text-red-700 transition-colors';
        else mobileLinks[m].className = 'nav-link-mobile p-4 rounded-xl hover:bg-slate-50 transition-colors';
    }

    // Scroll suave para a grade de produtos ao filtrar (melhora a UX no mobile)
    if(categoria !== 'todos' && grid.innerHTML !== "") {
        document.getElementById('product-grid').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// --- SISTEMA DE AUTENTICAÇÃO ---
var isRegisterMode = false;

function openAuthModal() {
    document.getElementById('authModal').classList.remove('hidden');
}

function closeAuthModal() {
    document.getElementById('authModal').classList.add('hidden');
}

function setAuthMode(register) {
    isRegisterMode = register;
    var tabLogin = document.getElementById('tabLogin');
    var tabRegister = document.getElementById('tabRegister');
    var registerFields = document.getElementById('registerFields');
    var submitBtn = document.getElementById('authSubmitBtn');
    var btnSpan = submitBtn ? submitBtn.querySelector('span') : null;

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
    var passwordInput = document.getElementById('authPass');
    var toggleIcon = document.getElementById('passwordToggleIcon');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        toggleIcon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

function handleAuth(event) {
    event.preventDefault();
    var email = document.getElementById('authEmail').value;
    var senha = document.getElementById('authPass').value;
    var btn = document.getElementById('authSubmitBtn');
    var originalContent = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = 'Processando...';
    
    if(isRegisterMode) {
        var nome = document.getElementById('regNome').value;
        var whatsapp = document.getElementById('regWhatsapp').value;

        supabaseClient.auth.signUp({
            email: email,
            password: senha,
            options: { data: { nome: nome, whatsapp: whatsapp } }
        }).then(function(res) {
            if (res.error) alert(res.error.message);
            else if (res.data.user && res.data.session === null) {
                alert("Cadastro realizado! Por favor, verifique seu e-mail para confirmar a conta antes de fazer login.");
                setAuthMode(false);
            } else alert("Cadastro realizado com sucesso!");
            btn.disabled = false;
            btn.innerHTML = originalContent;
        });
    } else {
        supabaseClient.auth.signInWithPassword({ email: email, password: senha }).then(function(res) {
            if (res.error) alert(res.error.message);
            else {
                currentUser = {
                    id: res.data.user.id,
                    nome: res.data.user.user_metadata.nome,
                    email: res.data.user.email,
                    whatsapp: res.data.user.user_metadata.whatsapp
                };
                localStorage.setItem('notecel_user', JSON.stringify(currentUser));
                updateUserUI();
                closeAuthModal();
                alert("Bem-vindo, " + currentUser.nome + "!");
            }
            btn.disabled = false;
            btn.innerHTML = originalContent;
        });
    }
}

function logout() {
    if (confirm("Deseja realmente sair da sua conta?")) {
        supabaseClient.auth.signOut().then(function() {
            currentUser = null;
            localStorage.removeItem('notecel_user');
            updateUserUI();
            var sidebar = document.getElementById('cartSidebar');
            if (sidebar && sidebar.classList.contains('translate-x-0')) {
                toggleCart();
            }
        });
    }
}

function updateUserUI() {
    var nameDisplay = document.getElementById('userNameDisplay');
    var logoutBtn = document.getElementById('logoutBtn');
    var userBtn = document.getElementById('userBtn');

    if (!nameDisplay || !logoutBtn || !userBtn) return;

    if(currentUser) {
        var nomeExibicao = (currentUser.nome || 'Usuário').split(' ')[0];
        nameDisplay.innerText = "Olá, " + nomeExibicao;
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
    var sidebar = document.getElementById('cartSidebar');
    var overlay = document.getElementById('cartOverlay');
    
    if (!sidebar || !overlay) return;

    var isOpen = sidebar.classList.contains('translate-x-0');

    if (!isOpen) {
        sidebar.classList.add('translate-x-0');
        overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    } else {
        sidebar.classList.remove('translate-x-0');
        overlay.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

function toggleMobileMenu() {
    var menu = document.getElementById('mobileMenu');
    var overlay = document.getElementById('menuOverlay');
    
    if (!menu || !overlay) return;

    var isOpen = menu.classList.contains('translate-x-0');

    if (!isOpen) {
        menu.classList.add('translate-x-0');
        overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    } else {
        menu.classList.remove('translate-x-0');
        overlay.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

function addToCart(id) {
    if (produtos.length === 0) {
        alert("Os produtos ainda estão sendo carregados. Por favor, aguarde um instante.");
        return;
    }

    var productToAdd = null;
    for (var i = 0; i < produtos.length; i++) {
        if (produtos[i].id == id) {
            productToAdd = produtos[i];
            break;
        }
    }

    if (!productToAdd) {
        alert("Não foi possível adicionar o produto ao carrinho. O produto não foi encontrado ou ainda não foi carregado.");
        return;
    }

    var existingItemIndex = -1;
    for (var j = 0; j < cart.length; j++) {
        if (cart[j].id == id) {
            existingItemIndex = j;
            break;
        }
    }
    
    if (existingItemIndex !== -1) {
        cart[existingItemIndex].quantidade++;
    } else {
        var newItem = {
            id: productToAdd.id,
            nome: productToAdd.nome,
            preco: productToAdd.preco,
            imagem_url: productToAdd.imagem_url,
            quantidade: 1
        };
        cart.push(newItem);
    }
    
    saveCart();

    var countElement = document.getElementById('cart-count');
    if (countElement) {
        var cartButton = countElement.parentNode; 
        if (cartButton) {
            cartButton.classList.add('cart-bump');
            setTimeout(function() { cartButton.classList.remove('cart-bump'); }, 400);
        }
    }

    var sidebar = document.getElementById('cartSidebar');
    if (sidebar && !sidebar.classList.contains('translate-x-0')) toggleCart();
}

function updateQuantity(id, delta) {
    var index = -1;
    for (var i = 0; i < cart.length; i++) {
        if (cart[i].id == id) {
            index = i;
            break;
        }
    }

    if (index !== -1) {
        cart[index].quantidade += delta;
        if (cart[index].quantidade <= 0) removeFromCart(index);
        else saveCart();
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
    var container = document.getElementById('cart-items');
    var totalElement = document.getElementById('cart-total');
    var countElement = document.getElementById('cart-count');
    
    if (!container || !totalElement || !countElement) return;

    var totalItens = 0;
    for (var i = 0; i < cart.length; i++) totalItens += cart[i].quantidade;
    countElement.innerText = totalItens;
    
    var total = 0;
    if (cart.length === 0) {
        container.innerHTML = '<p class="text-center text-slate-400 mt-10">Carrinho vazio</p>';
    } else {
        var html = '';
        for (var k = 0; k < cart.length; k++) {
            var item = cart[k];
            var subtotal = item.preco * item.quantidade;
            total += subtotal;
            html += '<div class="flex flex-col bg-slate-50 p-3 rounded-lg border border-slate-200 gap-2">' +
                        '<div class="flex justify-between items-start gap-3">' +
                            '<img src="' + (item.imagem_url || 'https://via.placeholder.com/50') + '" class="w-12 h-12 rounded-lg object-cover border border-slate-200 shadow-sm">' +
                            '<div class="flex-1">' +
                                '<p class="font-bold text-sm text-slate-800">' + item.nome + '</p>' +
                                '<p class="text-red-700 font-bold text-xs">' + formatarMoeda(item.preco) + ' un.</p>' +
                            '</div>' +
                            '<button onclick="removeFromCart(' + k + ')" class="text-slate-300 hover:text-red-500 transition"><i class="fa-solid fa-trash-can"></i></button>' +
                        '</div>' +
                        '<div class="flex justify-between items-center mt-1">' +
                            '<div class="flex items-center gap-3 bg-white border rounded-md px-2 py-1">' +
                                '<button onclick="updateQuantity(' + item.id + ', -1)" class="text-red-700 px-1 rounded">-</button>' +
                                '<span class="text-xs font-bold w-4 text-center">' + item.quantidade + '</span>' +
                                '<button onclick="updateQuantity(' + item.id + ', 1)" class="text-green-700 px-1 rounded">+</button>' +
                            '</div>' +
                            '<p class="text-slate-900 font-black text-sm">' + formatarMoeda(subtotal) + '</p>' +
                        '</div>' +
                    '</div>';
        }
        container.innerHTML = html;
    }
    totalElement.innerText = formatarMoeda(total);
}

// --- FUNÇÕES DE CHECKOUT PIX ---
function closeModal() {
    document.getElementById('checkoutModal').classList.add('hidden');
}

function openCheckoutModal() {
    if (cart.length === 0) return alert("Adicione itens antes de pagar!");
    
    if (!currentUser) {
        alert("Para sua segurança, identifique-se antes de finalizar a compra.");
        return openAuthModal();
    }
    
    document.getElementById('checkoutModal').classList.remove('hidden');
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('pixData').classList.add('hidden');
    document.getElementById('successState').classList.add('hidden');
    document.getElementById('checkoutFields').classList.remove('hidden');
    
    // Preenche whatsapp se já existir no perfil
    if (currentUser && currentUser.whatsapp) {
        document.getElementById('whatsappInput').value = currentUser.whatsapp;
    }
}

function checkout() {
    var whatsappInput = document.getElementById('whatsappInput');
    var whatsappNumber = whatsappInput ? whatsappInput.value.replace(/\D/g, '') : '';
    
    if (whatsappNumber.length < 10) {
        return alert("Por favor, informe seu WhatsApp com DDD para receber o acesso.");
    }

    var total = 0;
    for (var i = 0; i < cart.length; i++) total += (cart[i].preco * cart[i].quantidade);
    
    if (total < 1.00) {
        return alert("O valor mínimo para pagamento via PIX é R$ 1,00.");
    }

    document.getElementById('checkoutFields').classList.add('hidden');
    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('qrcode').innerHTML = '';
    
    var userName = 'Cliente';
    if (currentUser) {
        userName = currentUser.nome || (currentUser.user_metadata ? currentUser.user_metadata.nome : 'Cliente');
    }
    
    var descricao = "Pedido Notecel (" + userName + ") - Login Digital";

    supabaseClient.functions.invoke('gerar-pix', {
        body: { 
            valor: total, 
            descricao: descricao, 
            email: currentUser.email, 
            customer_whatsapp: whatsappNumber, 
            cartItems: cart 
        }
    }).then(function(res) {
        if (res.error) throw res.error;
        exibirPix(res.data.qr_code_base64, res.data.qr_code, res.data.id_pagamento);
    }).catch(function(err) {
        alert('Erro ao processar checkout: ' + err.message);
        closeModal();
    });
}

function exibirPix(base64, copiaCola, id) {
    if (!base64) return closeModal();

    var qrImg = 'data:image/png;base64,' + base64;
    var btnCopy = document.getElementById('btnCopy');

    document.getElementById('qrcode').innerHTML = '<img src="' + qrImg + '" class="w-48 h-48 mx-auto shadow-lg rounded-lg">';
    btnCopy.onclick = function() {
        navigator.clipboard.writeText(copiaCola);
        var originalHTML = btnCopy.innerHTML;
        btnCopy.innerHTML = '<i class="fa-solid fa-check"></i> Copiado!';
        btnCopy.classList.replace('bg-yellow-400', 'bg-green-500');
        btnCopy.classList.add('text-white');

        setTimeout(function() {
            btnCopy.innerHTML = originalHTML;
            btnCopy.classList.replace('bg-green-500', 'bg-yellow-400');
            btnCopy.classList.remove('text-white');
        }, 2000);
    };

    document.getElementById('loader').classList.add('hidden');
    document.getElementById('pixData').classList.remove('hidden');

    verificarPagamento(id);
}

function verificarPagamento(pix_id) {
    if (!pix_id) return;
    
    supabaseClient
        .channel('schema-db-changes')
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'pedidos', 
            filter: 'pix_id=eq.' + pix_id 
        }, function(payload) {
            if (payload.new.status === 'PAGO') {
                var pixData = document.getElementById('pixData');
                var successState = document.getElementById('successState');
                
                pixData.classList.add('hidden');
                successState.classList.remove('hidden');

                cart = [];
                saveCart();
                supabaseClient.removeAllChannels();
            }
        }).subscribe();
}

// --- ANIMAÇÃO DE REVELAÇÃO (INTERSECTION OBSERVER) ---
function initScrollReveal() {
    var reveals = document.querySelectorAll('.reveal');
    if (!window.IntersectionObserver) {
        for (var j = 0; j < reveals.length; j++) {
            reveals[j].classList.add('reveal-active');
        }
        return;
    }
    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('reveal-active');
            }
        });
    }, { threshold: 0.1 });

    for (var i = 0; i < reveals.length; i++) {
        observer.observe(reveals[i]);
    }
}

window.onload = function() {
    // Limpa Service Workers antigos que causam o erro "Resource not cached"
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(regs) {
            for(var i = 0; i < regs.length; i++) regs[i].unregister();
        });
    }

    // Lógica de inicialização inteligente baseada na página
    var catParam = getQueryParam('cat');
    var path = window.location.pathname;
    var isShopPage = path.indexOf('loja') !== -1;

    if (isShopPage) {
        filtrar(catParam || 'todos');
    } else if (document.getElementById('product-grid')) {
        filtrar('todos');
    }

    updateCartUI();
    updateUserUI();
    initScrollReveal();
};