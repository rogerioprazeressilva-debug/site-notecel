// ⚠️ IMPORTANTE: Substitua as strings abaixo pelas chaves reais do seu painel Supabase
const SUPABASE_URL = 'https://uaaslrletscnlqxctnee.supabase.co'; // <--- COLOQUE A SUA PROJECT URL AQUI
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhYXNscmxldHNjbmxxeGN0bmVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NzcyMjMsImV4cCI6MjA5MjM1MzIyM30.60XnfXhjaL4XraJP0o3O7a8MMNmbqHEIlBcGi9MPJfw'; // <--- COLOQUE A SUA ANON PUBLIC KEY AQUI

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const FUNC_URL = `${SUPABASE_URL}/functions/v1/gerar-pix`;

let produtosGlobal = [];
let carrinho = [];
let categoriaAtual = 'todos';
let ocultarEsgotados = false;

// CONFIGURAÇÃO DE MÚSICA DE FUNDO
let bgPlayer;
const PLAYLIST_ID = 'PLR5p_8U3vO_D7K7qX9W_S4tq_V_m8J0Xw'; // <--- COLOQUE O ID DA SUA PLAYLIST AQUI
let volumeSlider;
let lastVolume = 20;
let musicStarted = false;
let vendasChartInstance = null;

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
        criarTodosOsCardsIniciais(); // Cria todos os cards inicialmente
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

// CARREGAR VÍDEOS DA HOME
async function carregarVideos() {
    const container = document.getElementById('video-container');
    if (!container) return;

    try {
        const { data, error } = await supabaseClient
            .from('videos_inicio')
            .select('*')
            .order('ordem', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = data.map(video => {
            let safeUrl = video.url_embed;
            let isPlaylist = false;

            if (video.plataforma === 'youtube') {
                if (safeUrl.includes('list=')) {
                    isPlaylist = true;
                    // Caso seja uma Playlist
                    const listId = safeUrl.split('list=')[1].split('&')[0];
                    // Adicionamos enablejsapi=1 para permitir controle via JS
                    safeUrl = `https://www.youtube.com/embed/videoseries?list=${listId}&loop=1&enablejsapi=1`;
                } else {
                    // Caso seja um Vídeo Único
                    const videoId = safeUrl.includes('watch?v=') 
                        ? safeUrl.split('v=')[1].split('&')[0] 
                        : safeUrl.split('/').pop().split('?')[0];
                    
                    safeUrl = `https://www.youtube.com/embed/${videoId}?loop=1&playlist=${videoId}&enablejsapi=1`;
                }
            }

            return `
                <div class="reveal mb-12">
                    <h2 class="text-2xl font-black text-slate-900 mb-6 text-center uppercase tracking-tight">${video.titulo}</h2>
                    <iframe 
                        id="player-${video.id}"
                        src="${safeUrl}" 
                        title="${video.titulo}"
                        class="aspect-video" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                        allowfullscreen>
                    </iframe>
                    ${isPlaylist ? `
                        <div class="text-center mt-4">
                            <button onclick="pularVideo('player-${video.id}')" class="bg-slate-900 text-white px-6 py-2 rounded-full font-bold text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all shadow-md active:scale-95">
                                <i class="fa-solid fa-forward-step mr-2"></i> Próximo Vídeo
                            </button>
                        </div>
                    ` : ''}
                </div>`;
        }).join('');

        // Pequeno delay para garantir que o DOM renderizou antes de ativar a animação de revelação
        setTimeout(() => {
            container.querySelectorAll('.reveal').forEach(el => el.classList.add('reveal-active'));
        }, 100);

    } catch (err) {
        console.error('Erro ao carregar vídeos:', err.message);
    }
}

// FUNÇÃO PARA PULAR VÍDEO NA PLAYLIST
window.pularVideo = (frameId) => {
    const iframe = document.getElementById(frameId);
    if (iframe) {
        // Envia comando para a API do YouTube dentro do iframe
        iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: 'nextVideo'
        }), '*');
    }
};

// Inicialização inteligente
window.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('product-grid')) carregarProdutos();
    if (document.getElementById('apps-grid')) carregarApps();
    if (document.getElementById('video-container')) carregarVideos();

    initBgMusic();

    // Inicializa o slider de volume
    volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
        const savedVolume = localStorage.getItem('bgMusicVolume');
        const initialVol = savedVolume !== null ? savedVolume : 20;
        
        volumeSlider.value = initialVol;
        atualizarIconeVolume(initialVol);

        volumeSlider.addEventListener('input', () => {
            const vol = volumeSlider.value;
            if (bgPlayer && bgPlayer.setVolume) {
                bgPlayer.setVolume(vol);
                localStorage.setItem('bgMusicVolume', vol);
                atualizarIconeVolume(vol);
            }
        });
    }
});

// INICIALIZAÇÃO DA MÚSICA DE FUNDO
function initBgMusic() {
    // Carrega a API do YouTube se ainda não existir
    if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
}

// Chamado automaticamente pela API do YouTube
window.onYouTubeIframeAPIReady = function() {
    // Verifica se o player de música deve ser criado
    if (document.getElementById('bgMusicPlayer')) {
        bgPlayer = new YT.Player('bgMusicPlayer', {
            height: '0',
            width: '0',
            videoId: '', // Deixe vazio pois usaremos list
            playerVars: {
                listType: 'playlist',
                list: PLAYLIST_ID,
                loop: 1,
                autoplay: 0
            },
            events: {
                'onReady': onBgPlayerReady,
                'onStateChange': onBgPlayerStateChange
            }
        });
    }
};

function onBgPlayerReady(event) {
    const savedTime = localStorage.getItem('bgMusicTime') || 0;
    const savedVolume = localStorage.getItem('bgMusicVolume') || 20; // Pega o volume salvo ou usa 20
    const wasPlaying = localStorage.getItem('bgMusicPlaying') === 'true'; // Verifica se estava tocando
    
    event.target.setVolume(parseInt(savedVolume)); // Define o volume inicial do player
    event.target.seekTo(parseFloat(savedTime));
    atualizarIconeVolume(savedVolume);

    if (wasPlaying) {
        // O navegador pode bloquear. O usuário precisará clicar no botão de música.
        console.log("Tentando retomar música...");
    }
}

function onBgPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        localStorage.setItem('bgMusicPlaying', 'true');
        document.getElementById('musicToggleBtn').classList.add('animate-pulse', 'bg-red-700');
    } else {
        localStorage.setItem('bgMusicPlaying', 'false');
        document.getElementById('musicToggleBtn').classList.remove('animate-pulse', 'bg-red-700');
    }
}

window.toggleBgMusic = () => {
    if (!bgPlayer) return;
    const state = bgPlayer.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
        bgPlayer.pauseVideo();
    } else {
        bgPlayer.playVideo();
    }
};

// FUNÇÕES DE VOLUME E MUDO
window.atualizarIconeVolume = (volume) => {
    const icon = document.getElementById('muteBtn');
    if (!icon) return;
    
    icon.classList.remove('fa-volume-xmark', 'fa-volume-low', 'fa-volume-high');
    
    const v = parseInt(volume);
    if (v === 0) {
        icon.classList.add('fa-volume-xmark');
    } else if (v < 50) {
        icon.classList.add('fa-volume-low');
    } else {
        icon.classList.add('fa-volume-high');
    }
};

window.toggleMute = () => {
    if (!bgPlayer || !volumeSlider) return;
    
    if (parseInt(volumeSlider.value) > 0) {
        lastVolume = volumeSlider.value;
        volumeSlider.value = 0;
    } else {
        volumeSlider.value = lastVolume > 0 ? lastVolume : 20;
    }
    
    bgPlayer.setVolume(volumeSlider.value);
    localStorage.setItem('bgMusicVolume', volumeSlider.value);
    atualizarIconeVolume(volumeSlider.value);
};

// --- FUNÇÕES DO PAINEL ADMIN ---

window.carregarProdutosAdmin = async () => {
    const select = document.getElementById('selectProduto');
    if (!select) return;

    const { data } = await supabaseClient.from('produtos').select('id, nome').neq('categoria', 'Loja');
    if (data) {
        select.innerHTML = data.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
    }
};

window.cadastrarLogin = async (e) => {
    e.preventDefault();
    const produtoId = document.getElementById('selectProduto').value;
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;

    try {
        const { error } = await supabaseClient.from('logins_disponiveis').insert({
            produto_id: produtoId,
            username: username,
            password: password,
            status: 'disponivel'
        });

        if (error) throw error;

        showToast("Sucesso", "Novo login adicionado ao estoque!", "fa-check-circle");
        e.target.reset();
        window.carregarLoginsAdmin();
    } catch (err) {
        showToast("Erro", err.message, "fa-circle-xmark");
    }
};

window.carregarLoginsAdmin = async (searchTerm = '') => {
    const tabela = document.getElementById('tabelaLogins');
    if (!tabela) return;

    let query = supabaseClient
        .from('logins_disponiveis')
        .select('id, username, password, status, produtos(nome)')
        .order('created_at', { ascending: false });
    
    if (searchTerm) {
        query = query.ilike('produtos.nome', `%${searchTerm}%`);
    }

    const { data, error } = await query;

    if (error) return console.error(error);

    tabela.innerHTML = data.map(l => `
        <tr class="border-b border-slate-50">
            <td class="py-4 font-bold text-slate-700">${l.produtos?.nome || 'N/A'}</td>
            <td class="py-4 text-slate-500 cursor-pointer hover:text-red-700 transition-colors" title="Clique para copiar" onclick="window.copiarTexto('${l.username}', this)">${l.username}</td>
            <td class="py-4 text-slate-500 cursor-pointer hover:text-red-700 transition-colors" title="Clique para copiar" onclick="window.copiarTexto('${l.password}', this)">${l.password}</td>
            <td class="py-4">
                <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase ${l.status === 'disponivel' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                    ${l.status}
                </span>
            </td>
            <td class="py-4">
                <button onclick="window.excluirLogin(${l.id})" class="text-slate-300 hover:text-red-700 transition-colors"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        </tr>
    `).join('');
};

window.excluirLogin = async (id) => {
    if (!confirm("Deseja remover este login do estoque?")) return;
    const { error } = await supabaseClient.from('logins_disponiveis').delete().eq('id', id);
    if (error) showToast("Erro", error.message, "fa-circle-xmark");
    else window.carregarLoginsAdmin();
};

window.exportarLoginsParaCSV = async () => {
    try {
        const { data, error } = await supabaseClient
            .from('logins_disponiveis')
            .select('id, username, password, status, created_at, sold_at, produtos(nome)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            showToast("Aviso", "Nenhum login para exportar.", "fa-info-circle");
            return;
        }

        // Cabeçalho do CSV
        const headers = ["ID", "Produto", "Usuário", "Senha", "Status", "Criado Em", "Vendido Em"];
        const csvRows = [];
        csvRows.push(headers.join(';')); // Adiciona o cabeçalho

        // Dados
        data.forEach(login => {
            const produtoNome = login.produtos?.nome || 'N/A';
            const createdAt = new Date(login.created_at).toLocaleString('pt-BR');
            const soldAt = login.sold_at ? new Date(login.sold_at).toLocaleString('pt-BR') : 'N/A';
            csvRows.push([login.id, produtoNome, login.username, login.password, login.status, createdAt, soldAt].join(';'));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `logins_notecel_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Sucesso", "Estoque exportado para CSV!", "fa-check-circle");
    } catch (err) {
        showToast("Erro", `Falha ao exportar: ${err.message}`, "fa-circle-xmark");
    }
};

window.processarImportacao = async (e) => {
    const file = e.target.files[0];
    const produtoId = document.getElementById('selectProduto').value;
    
    if (!produtoId) {
        showToast("Erro", "Selecione um produto no formulário ao lado antes de importar.", "fa-exclamation-circle");
        e.target.value = '';
        return;
    }
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const text = event.target.result;
            
            // 1. Buscar usernames já existentes no banco para este produto
            const { data: existingInDb } = await supabaseClient
                .from('logins_disponiveis')
                .select('username')
                .eq('produto_id', produtoId);
            
            const dbUsernames = new Set(existingInDb?.map(l => l.username.toLowerCase()) || []);
            const localUsernames = new Set(); // Para evitar duplicatas dentro do próprio arquivo
            let duplicatasIgnoradas = 0;

            const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
            
            const totalLogins = lines.map(line => {
                const parts = line.split(';');
                const u = parts[0]?.trim();
                const p = parts[1]?.trim();
                
                if (!u || !p) return null;

                const lowerU = u.toLowerCase();
                if (dbUsernames.has(lowerU) || localUsernames.has(lowerU)) {
                    duplicatasIgnoradas++;
                    return null;
                }
                localUsernames.add(lowerU);
                return { produto_id: produtoId, username: u, password: p, status: 'disponivel' };
            }).filter(l => l !== null);

            if (totalLogins.length === 0) throw new Error("Formato inválido. Use: usuario;senha");

            // Configuração da Barra de Progresso
            const container = document.getElementById('importProgressContainer');
            const bar = document.getElementById('importProgressBar');
            const percentText = document.getElementById('importPercentage');
            const statusText = document.getElementById('importStatusText');
            
            container.classList.remove('hidden');
            const chunkSize = 100; // Tamanho de cada lote
            let processados = 0;

            for (let i = 0; i < totalLogins.length; i += chunkSize) {
                const chunk = totalLogins.slice(i, i + chunkSize);
                const { error } = await supabaseClient.from('logins_disponiveis').insert(chunk);
                
                if (error) throw error;

                processados += chunk.length;
                const percent = Math.round((processados / totalLogins.length) * 100);
                
                // Atualiza UI
                bar.style.width = `${percent}%`;
                percentText.innerText = `${percent}%`;
                statusText.innerText = `Importando: ${processados} de ${totalLogins.length}`;
            }

            const msgSucesso = duplicatasIgnoradas > 0 
                ? `${totalLogins.length} importados (${duplicatasIgnoradas} duplicatas ignoradas).`
                : `${totalLogins.length} logins importados com sucesso!`;

            showToast("Sucesso", msgSucesso, "fa-check-circle");
            window.carregarLoginsAdmin();
            
            // Esconde a barra após um pequeno delay
            setTimeout(() => {
                container.classList.add('hidden');
                bar.style.width = '0%';
            }, 3000);

        } catch (err) {
            showToast("Erro na Importação", err.message, "fa-circle-xmark");
            document.getElementById('importProgressContainer').classList.add('hidden');
        } finally { e.target.value = ''; }
    };
    reader.readAsText(file);
};

window.copiarTexto = (texto, el) => {
    navigator.clipboard.writeText(texto);
    const originalText = el.innerText;
    el.innerText = "Copiado!";
    el.classList.add('text-green-600', 'font-bold');
    
    setTimeout(() => {
        el.innerText = originalText;
        el.classList.remove('text-green-600', 'font-bold');
    }, 1500);
};

window.iniciarMonitoramentoPedidos = () => {
    console.log("🔔 Monitoramento de novos pedidos ativado...");

    const canalPedidos = supabaseClient
        .channel('admin-notificacoes')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'pedidos' 
        }, (payload) => {
            const novoPedido = payload.new;
            
            if (novoPedido.status === 'PENDENTE') {
                // Feedback Visual
                showToast(
                    "Novo Pedido!", 
                    `Um novo pedido de R$ ${Number(novoPedido.total).toFixed(2)} foi criado.`, 
                    "fa-bell animate-bounce"
                );

                // Feedback Sonoro (Opcional - Beep suave)
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const osc = audioContext.createOscillator();
                osc.connect(audioContext.destination);
                osc.start();
                osc.stop(audioContext.currentTime + 0.2);
            }
        })
        .subscribe();
};

window.carregarResumoAdmin = async () => {
    try {
        // 1. Buscar faturamento e contagem de vendas pagas
        const { data: vendas, error: errVendas } = await supabaseClient
            .from('pedidos')
            .select('total')
            .eq('status', 'PAGO');

        // 2. Buscar contagem de itens disponíveis no estoque digital
        const { count: totalEstoque, error: errEstoque } = await supabaseClient
            .from('logins_disponiveis')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'disponivel');

        if (errVendas || errEstoque) throw (errVendas || errEstoque);

        const faturamento = vendas.reduce((acc, curr) => acc + Number(curr.total), 0);
        const totalVendas = vendas.length;

        if (document.getElementById('faturamentoTotal')) document.getElementById('faturamentoTotal').innerText = `R$ ${faturamento.toFixed(2).replace('.', ',')}`;
        if (document.getElementById('vendasConfirmadas')) document.getElementById('vendasConfirmadas').innerText = totalVendas;
        if (document.getElementById('itensDisponiveis')) document.getElementById('itensDisponiveis').innerText = totalEstoque || 0;

    } catch (err) {
        console.error('Erro ao carregar resumo:', err.message);
    }
};

window.carregarGraficoVendas = async () => {
    const ctx = document.getElementById('vendasChart');
    if (!ctx) return;

    try {
        const seteDiasAtras = new Date();
        seteDiasAtras.setDate(seteDiasAtras.getDate() - 6);
        seteDiasAtras.setHours(0, 0, 0, 0);

        const { data: pedidos, error } = await supabaseClient
            .from('pedidos')
            .select('total, created_at')
            .eq('status', 'PAGO')
            .gte('created_at', seteDiasAtras.toISOString());

        if (error) throw error;

        // Criar estrutura para os últimos 7 dias
        const ultimos7Dias = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            ultimos7Dias[d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })] = 0;
        }

        // Somar totais por dia
        pedidos.forEach(p => {
            const dataFormatada = new Date(p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            if (ultimos7Dias[dataFormatada] !== undefined) {
                ultimos7Dias[dataFormatada] += Number(p.total);
            }
        });

        const labels = Object.keys(ultimos7Dias);
        const valores = Object.values(ultimos7Dias);

        if (vendasChartInstance) vendasChartInstance.destroy();

        vendasChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Vendas (R$)',
                    data: valores,
                    backgroundColor: '#b91c1c', // Vermelho Notecel
                    borderRadius: 10,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `R$ ${context.raw.toFixed(2).replace('.', ',')}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: (value) => `R$ ${value}` },
                        grid: { display: false }
                    },
                    x: { grid: { display: false } }
                }
            }
        });

    } catch (err) {
        console.error('Erro ao carregar gráfico:', err.message);
    }
};

// Salva o tempo da música antes de sair da página
window.addEventListener('beforeunload', () => {
    if (bgPlayer && bgPlayer.getCurrentTime) {
        localStorage.setItem('bgMusicTime', bgPlayer.getCurrentTime());
    }
});

// Helper function para criar um único card de produto
function criarCardProduto(produto) {
    const isAvailable = produto.categoria === 'Loja' ? (produto.quantidade > 0) : true;
    const card = document.createElement('div');
    card.dataset.productId = produto.id; // Armazena o ID do produto para referência futura
    card.className = `product-card bg-white p-4 md:p-6 rounded-2xl md:rounded-[2rem] shadow-sm border border-slate-100 flex flex-col h-full cursor-pointer hover:border-red-700/30 transition-all ${!isAvailable ? 'opacity-75' : ''}`;
    card.onclick = (e) => {
        if (!isAvailable) return showToast("Indisponível", "Este produto está temporariamente esgotado.", "fa-box-open");
        if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'I') {
            adicionarAoCarrinho(produto.id);
        }
    };
    card.innerHTML = `
        <img src="${produto.imagem_url}" alt="${produto.nome}" class="w-full h-32 md:h-48 object-cover rounded-xl md:rounded-2xl mb-3 md:mb-4" onerror="this.src='https://via.placeholder.com/400x300?text=Produto+Indispon%C3%ADvel'">
        <div class="flex justify-between items-center mb-2">
            <span class="text-[10px] font-bold uppercase tracking-widest text-red-600">${produto.categoria}</span>
            <span class="badge-stock ${isAvailable ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}">
                ${isAvailable ? '<i class="fa-solid fa-check mr-1"></i> Em estoque' : '<i class="fa-solid fa-xmark mr-1"></i> Esgotado'}
            </span>
        </div>
        <h3 class="font-bold text-slate-900 mb-1 md:mb-2 text-sm md:text-base">${produto.nome}</h3>
        <p class="text-slate-500 text-[10px] md:text-xs mb-4 flex-1 line-clamp-2">${produto.descricao || ''}</p>
        <div class="flex justify-between items-center mt-auto">
            <span class="font-black text-base md:text-xl text-slate-900">R$ ${Number(produto.preco).toFixed(2).replace('.', ',')}</span>
            <button onclick="adicionarAoCarrinho(${produto.id})" ${!isAvailable ? 'disabled' : ''} class="bg-slate-900 text-white p-2 md:p-3 rounded-lg md:rounded-xl hover:bg-red-700 transition-colors disabled:bg-slate-200 disabled:text-slate-400">
                <i class="fa-solid fa-plus"></i>
            </button>
        </div>
    `;
    return card;
}

// 2. CRIAR TODOS OS CARDS INICIAIS (chamado uma vez ao carregar produtos)
function criarTodosOsCardsIniciais() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    grid.innerHTML = '';
    produtosGlobal.forEach(produto => {
        const card = criarCardProduto(produto);
        grid.appendChild(card);
    });
    renderizarProdutos(categoriaAtual); // Aplica os filtros iniciais
}

// 2.1 RENDERIZAR PRODUTOS NA GRID (agora apenas gerencia visibilidade e animação)
function renderizarProdutos(categoria = 'todos') {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    categoriaAtual = categoria; // Atualiza a categoria atual

    produtosGlobal.forEach(produto => {
        const cardElement = grid.querySelector(`[data-product-id="${produto.id}"]`);
        if (!cardElement) return; // Não deve acontecer se os cards foram criados inicialmente

        const matchesCategory = (categoria === 'todos' || produto.categoria === categoria);
        // Lógica de disponibilidade: 
        // Produtos 'Loja' dependem da coluna quantidade. 
        // Outros (Streaming) assumimos estoque digital (controle feito no checkout).
        const isAvailable = produto.categoria === 'Loja' ? (produto.quantidade > 0) : true;
        const shouldBeVisible = matchesCategory && (!ocultarEsgotados || isAvailable);

        if (shouldBeVisible) {
            // Se deve estar visível, garante que está exibido e remove fade-out
            cardElement.style.display = '';
            cardElement.classList.remove('fade-out');
            cardElement.classList.add('fade-in'); // Adiciona fade-in para uma aparição suave
            cardElement.addEventListener('animationend', () => {
                cardElement.classList.remove('fade-in');
            }, { once: true });
        } else {
            // Se deve estar oculto, adiciona fade-out e depois esconde
            if (cardElement.style.display !== 'none') { // Apenas faz fade-out se estiver visível
                cardElement.classList.add('fade-out');
                cardElement.addEventListener('transitionend', () => {
                    cardElement.style.display = 'none';
                    cardElement.classList.remove('fade-out'); // Limpa a classe
                }, { once: true });
            }
        }
    });
}

// 2.1 LÓGICA DO FILTRO DE DISPONIBILIDADE
window.toggleOcultarEsgotados = () => {
    ocultarEsgotados = !ocultarEsgotados;
    renderizarProdutos(categoriaAtual); // Re-aplica os filtros e animações
};

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
    const adminLink = document.getElementById('adminLink');
    const adminLinkMobile = document.getElementById('adminLinkMobile');

    if (user) {
        if (userNameDisplay) userNameDisplay.innerText = user.user_metadata?.full_name || user.email.split('@')[0];
        if (logoutBtn) logoutBtn.classList.remove('hidden');
        if (historyBtn) historyBtn.classList.remove('hidden');
        
        // Verifica se o usuário logado é o administrador
        const isAdmin = user.email === 'rogerioprazeressilva@gmail.com';
        if (adminLink) adminLink.classList.toggle('hidden', !isAdmin);
        if (adminLinkMobile) adminLinkMobile.classList.toggle('hidden', !isAdmin);
    } else {
        if (userNameDisplay) userNameDisplay.innerText = 'Entrar';
        if (logoutBtn) logoutBtn.classList.add('hidden');
        if (historyBtn) historyBtn.classList.add('hidden');
        if (adminLink) adminLink.classList.add('hidden');
        if (adminLinkMobile) adminLinkMobile.classList.add('hidden');
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
    setTimeout(() => {
        container.classList.add('hidden');
        
        // Fecha o modal de checkout se ele estiver aberto (útil para erros de estoque ou conexão)
        const checkoutModal = document.getElementById('checkoutModal');
        if (checkoutModal && !checkoutModal.classList.contains('hidden')) {
            window.closeModal();
        }
    }, 300);
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