-- Limpeza (Opcional: use se quiser recriar tudo do zero)
-- CUIDADO: Descomente as linhas abaixo apenas se quiser apagar tudo e recomeçar
-- DROP TABLE IF EXISTS public.pedidos CASCADE;
-- DROP TABLE IF EXISTS public.logins_disponiveis CASCADE;
-- DROP TABLE IF EXISTS public.produtos CASCADE;

-- 1. Tabela de Produtos
CREATE TABLE IF NOT EXISTS public.produtos (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    preco NUMERIC(10, 2) NOT NULL,
    categoria TEXT DEFAULT 'Logins',
    descricao TEXT,
    imagem_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS e permitir leitura pública para produtos
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Produtos visíveis para todos') THEN
        CREATE POLICY "Produtos visíveis para todos" ON public.produtos FOR SELECT TO anon, authenticated USING (true);
    END IF;
END $$;

-- 2. Tabela de Logins Disponíveis (Criada antes de Pedidos para resolver dependência)
CREATE TABLE IF NOT EXISTS public.logins_disponiveis (
    id SERIAL PRIMARY KEY,
    produto_id INTEGER REFERENCES public.produtos(id) ON DELETE CASCADE, -- Vincula a qual "tipo" de login pertence (ex: Netflix, Spotify)
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    status TEXT DEFAULT 'disponivel' NOT NULL,
    -- reserved_by_pedido_id será adicionado depois para evitar dependência circular
    sold_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar Row Level Security (RLS) para a tabela de logins_disponiveis
ALTER TABLE public.logins_disponiveis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir delete de logins quando o produto é deletado" ON public.logins_disponiveis;
CREATE POLICY "Permitir delete de logins quando o produto é deletado" ON public.logins_disponiveis FOR DELETE USING (TRUE);

-- 3. Tabela de Pedidos (Criada sem FKs inicialmente)
CREATE TABLE IF NOT EXISTS public.pedidos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pix_id TEXT UNIQUE,
    total NUMERIC(10, 2) NOT NULL,
    status TEXT DEFAULT 'PENDENTE' NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    -- login_id será adicionado depois para evitar dependência circular
    customer_whatsapp TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS e Realtime para pedidos
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários veem seus próprios pedidos" ON public.pedidos;
CREATE POLICY "Usuários veem seus próprios pedidos" ON public.pedidos FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Qualquer um pode criar pedidos" ON public.pedidos;
CREATE POLICY "Qualquer um pode criar pedidos" ON public.pedidos FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 4. Adicionar chaves estrangeiras após a criação de ambas as tabelas
ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS login_id INTEGER;

ALTER TABLE public.pedidos
DROP CONSTRAINT IF EXISTS fk_pedido_login,
ADD CONSTRAINT fk_pedido_login FOREIGN KEY (login_id) REFERENCES public.logins_disponiveis(id) ON DELETE SET NULL;

ALTER TABLE public.logins_disponiveis
ADD COLUMN IF NOT EXISTS reserved_by_pedido_id UUID;

ALTER TABLE public.logins_disponiveis
DROP CONSTRAINT IF EXISTS fk_login_pedido,
ADD CONSTRAINT fk_login_pedido FOREIGN KEY (reserved_by_pedido_id) REFERENCES public.pedidos(id) ON DELETE SET NULL;


-- 5. INSERÇÃO DE DADOS INICIAIS (Para o site não ficar vazio)
-- Usamos o WHERE NOT EXISTS para não duplicar se você rodar o script de novo
INSERT INTO public.produtos (nome, preco, categoria, descricao, imagem_url)
SELECT 'Netflix Premium 4K', 14.90, 'Streaming', 'Tela Ultra HD com acesso ilimitado.', 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=500&q=80'
WHERE NOT EXISTS (SELECT 1 FROM public.produtos WHERE nome = 'Netflix Premium 4K');

INSERT INTO public.produtos (nome, preco, categoria, descricao, imagem_url)
SELECT 'Xbox Game Pass Ultimate', 29.90, 'Acessórios', 'Centenas de jogos no seu PC ou Console.', 'https://images.unsplash.com/photo-1605901309584-818e25960a8f?w=500&q=80'
WHERE NOT EXISTS (SELECT 1 FROM public.produtos WHERE nome = 'Xbox Game Pass Ultimate');

INSERT INTO public.produtos (nome, preco, categoria, descricao, imagem_url)
SELECT 'HBO Max - 1 Mês', 12.00, 'Streaming', 'As melhores séries e filmes da Warner.', 'https://images.unsplash.com/photo-1616469829581-73993eb86b02?w=500&q=80'
WHERE NOT EXISTS (SELECT 1 FROM public.produtos WHERE nome = 'HBO Max - 1 Mês');

INSERT INTO public.produtos (nome, preco, categoria, descricao, imagem_url)
SELECT 'Disney+ & Star+', 19.90, 'Streaming', 'O combo perfeito para a família.', 'https://images.unsplash.com/photo-1633174524827-db00a6b7bc74?w=500&q=80'
WHERE NOT EXISTS (SELECT 1 FROM public.produtos WHERE nome = 'Disney+ & Star+');

INSERT INTO public.produtos (nome, preco, categoria, descricao, imagem_url)
SELECT 'PlayStation Plus Deluxe', 35.00, 'Acessórios', 'Catálogo de clássicos e jogos mensais.', 'https://images.unsplash.com/photo-1500995617113-cf789362a3e1?w=500&q=80'
WHERE NOT EXISTS (SELECT 1 FROM public.produtos WHERE nome = 'PlayStation Plus Deluxe');

INSERT INTO public.produtos (nome, preco, categoria, descricao, imagem_url)
SELECT 'Crunchyroll Premium', 9.90, 'Streaming', 'Assista seus animes favoritos sem anúncios.', 'https://images.unsplash.com/photo-1578632292335-df3abbb0d586?w=500&q=80'
WHERE NOT EXISTS (SELECT 1 FROM public.produtos WHERE nome = 'Crunchyroll Premium');

INSERT INTO public.produtos (nome, preco, categoria, descricao, imagem_url)
SELECT 'Youtube Premium 1 Mês', 15.00, 'Streaming', 'Músicas e vídeos sem anúncios em segundo plano.', 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&q=80'
WHERE NOT EXISTS (SELECT 1 FROM public.produtos WHERE nome = 'Youtube Premium 1 Mês');

-- NOVOS PRODUTOS PARA A CATEGORIA LOJA
INSERT INTO public.produtos (nome, preco, categoria, descricao, imagem_url)
SELECT 'TV Box MXQ Pro 4K', 189.90, 'Loja', 'Transforme sua TV em Smart com Android atualizado.', 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=500&q=80'
WHERE NOT EXISTS (SELECT 1 FROM public.produtos WHERE nome = 'TV Box MXQ Pro 4K');

INSERT INTO public.produtos (nome, preco, categoria, descricao, imagem_url)
SELECT 'Controle Remoto TV Box', 25.00, 'Loja', 'Controle universal compatível com diversos modelos.', 'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=500&q=80'
WHERE NOT EXISTS (SELECT 1 FROM public.produtos WHERE nome = 'Controle Remoto TV Box');

INSERT INTO public.produtos (nome, preco, categoria, descricao, imagem_url)
SELECT 'Carregador Turbo 20W USB-C', 45.00, 'Loja', 'Carregamento rápido para iPhone e Android.', 'https://images.unsplash.com/photo-1619130709230-03879a953e5e?w=500&q=80'
WHERE NOT EXISTS (SELECT 1 FROM public.produtos WHERE nome = 'Carregador Turbo 20W USB-C');

INSERT INTO public.produtos (nome, preco, categoria, descricao, imagem_url)
SELECT 'Mouse Óptico Sem Fio', 35.00, 'Loja', 'Design ergonômico e conexão 2.4Ghz estável.', 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&q=80'
WHERE NOT EXISTS (SELECT 1 FROM public.produtos WHERE nome = 'Mouse Óptico Sem Fio');

INSERT INTO public.produtos (nome, preco, categoria, descricao, imagem_url)
SELECT 'Cabo HDMI 2.0 Ultra HD', 19.90, 'Loja', 'Cabo de 1.5 metros com pontas banhadas a ouro.', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=500&q=80'
WHERE NOT EXISTS (SELECT 1 FROM public.produtos WHERE nome = 'Cabo HDMI 2.0 Ultra HD');

INSERT INTO public.produtos (nome, preco, categoria, descricao, imagem_url)
SELECT 'Fone de Ouvido Bluetooth', 79.90, 'Loja', 'Alta fidelidade sonora e bateria de longa duração.', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80'
WHERE NOT EXISTS (SELECT 1 FROM public.produtos WHERE nome = 'Fone de Ouvido Bluetooth');

-- 6. ADICIONAR ALGUNS LOGINS PARA TESTE (Opcional)
-- Adicionando estoque para Netflix
INSERT INTO public.logins_disponiveis (produto_id, username, password) 
SELECT id, 'premium_user1@email.com', 'senha_forte_1' FROM public.produtos WHERE nome = 'Netflix Premium 4K' LIMIT 1;

-- Adicionando estoque para HBO Max
INSERT INTO public.logins_disponiveis (produto_id, username, password) 
SELECT id, 'hbo_cliente@gmail.com', 'max_acesso_2024' FROM public.produtos WHERE nome = 'HBO Max - 1 Mês' LIMIT 1;

-- Adicionando estoque para Disney+
INSERT INTO public.logins_disponiveis (produto_id, username, password) 
SELECT id, 'disney_kids@outlook.com', 'mickey123' FROM public.produtos WHERE nome = 'Disney+ & Star+' LIMIT 1;

-- Adicionando estoque para Crunchyroll
INSERT INTO public.logins_disponiveis (produto_id, username, password) 
SELECT id, 'otaku_br@nime.com', 'naruto_shippuden' FROM public.produtos WHERE nome = 'Crunchyroll Premium' LIMIT 1;

-- 7. HABILITAR REALTIME
-- Isso permite que o site "ouça" quando o pagamento for aprovado
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'pedidos'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;
    END IF;
END $$;
