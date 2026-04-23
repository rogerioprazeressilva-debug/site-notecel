-- 1. Tabela de Produtos (Base para os Logins)
-- Define os tipos de contas (Ex: Netflix, Spotify, Canva)
CREATE TABLE IF NOT EXISTS public.produtos (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    preco NUMERIC(10, 2) NOT NULL,
    categoria TEXT DEFAULT 'Logins',
    descricao TEXT,
    imagem_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Pedidos (Base para as vendas)
CREATE TABLE IF NOT EXISTS public.pedidos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pix_id TEXT UNIQUE,
    total NUMERIC(10, 2) NOT NULL,
    status TEXT DEFAULT 'PENDENTE' NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS e Realtime para pedidos
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos REPLICA IDENTITY FULL;
CREATE POLICY "Usuários veem seus próprios pedidos" ON public.pedidos FOR SELECT USING (auth.uid() = user_id);

-- Tabela de Logins Disponíveis
-- Armazena os pares de usuário/senha que serão vendidos.
CREATE TABLE public.logins_disponiveis (
    id SERIAL PRIMARY KEY,
    produto_id INTEGER REFERENCES public.produtos(id) ON DELETE CASCADE, -- Vincula a qual "tipo" de login pertence (ex: Netflix, Spotify)
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    status TEXT DEFAULT 'disponivel' NOT NULL, -- 'disponivel', 'reservado', 'vendido'
    reserved_by_pedido_id UUID REFERENCES public.pedidos(id) ON DELETE SET NULL, -- Pedido que reservou este login
    sold_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar Row Level Security (RLS) para a tabela de logins_disponiveis
ALTER TABLE public.logins_disponiveis ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para logins_disponiveis:
-- Ninguém pode ver os logins diretamente, apenas a Edge Function pode manipulá-los.
-- Apenas o serviço de role key (Edge Functions) pode inserir, atualizar ou selecionar.
-- Para isso, não criaremos políticas de SELECT/INSERT/UPDATE para usuários comuns.
-- Apenas a política de DELETE para o caso de um produto ser deletado.
CREATE POLICY "Permitir delete de logins quando o produto é deletado"
ON public.logins_disponiveis FOR DELETE
USING (TRUE); -- A Edge Function com service_role_key pode deletar.


-- Alterar a tabela de Pedidos
-- Adicionar colunas para vincular ao login vendido e armazenar o WhatsApp do cliente.
ALTER TABLE public.pedidos
ADD COLUMN login_id INTEGER REFERENCES public.logins_disponiveis(id) ON DELETE SET NULL,
ADD COLUMN customer_whatsapp TEXT;

-- Atualizar políticas de RLS para pedidos (se necessário, para incluir a nova coluna)
-- A política existente "Usuários podem ver seus próprios pedidos." já deve cobrir.
-- CREATE POLICY "Usuários podem ver seus próprios pedidos."
-- ON public.pedidos FOR SELECT
-- USING (auth.uid() = user_id);

-- CREATE POLICY "Usuários podem criar seus próprios pedidos."
-- ON public.pedidos FOR INSERT
-- WITH CHECK (auth.uid() = user_id);

-- Exemplo de inserção de produtos para logins (se você não tiver no CSV)
-- INSERT INTO public.produtos (nome, preco, categoria, descricao, imagem_url) VALUES
-- ('Login Netflix Premium 1 Mês', 29.90, 'Logins', 'Acesso completo a filmes e séries em 4K.', 'https://images.unsplash.com/photo-1611162616475-46b635ed681d?w=500&q=80'),
-- ('Login Spotify Premium 3 Meses', 19.90, 'Logins', 'Música sem anúncios e offline.', 'https://images.unsplash.com/photo-1611162616475-46b635ed681d?w=500&q=80');

-- Exemplo de inserção de logins disponíveis (faça isso manualmente ou via script após criar a tabela)
-- INSERT INTO public.logins_disponiveis (produto_id, username, password) VALUES
-- (ID_DO_PRODUTO_NETFLIX, 'usuario_netflix_1', 'senha_netflix_1'),
-- (ID_DO_PRODUTO_NETFLIX, 'usuario_netflix_2', 'senha_netflix_2'),
-- (ID_DO_PRODUTO_SPOTIFY, 'usuario_spotify_1', 'senha_spotify_1');

-- Lembre-se de substituir ID_DO_PRODUTO_NETFLIX e ID_DO_PRODUTO_SPOTIFY pelos IDs reais dos produtos
-- que você cadastrar na tabela 'produtos' para representar esses logins.