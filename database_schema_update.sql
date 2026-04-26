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
    quantidade INTEGER DEFAULT 0,
    categoria TEXT DEFAULT 'Logins',
    descricao TEXT,
    imagem_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS e permitir leitura pública para produtos
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

-- Criar política de leitura pública (Usamos DROP para evitar o bloco IF/DO)
DROP POLICY IF EXISTS "Produtos visíveis para todos" ON public.produtos;
CREATE POLICY "Produtos visíveis para todos" ON public.produtos FOR SELECT TO anon, authenticated USING (true);

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
    produto_id INTEGER REFERENCES public.produtos(id),
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
SELECT 'Netflix Premium 4K', 14.90, 'Streaming', 'Tela Ultra HD com acesso ilimitado.', 'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=800&q=80'
WHERE NOT EXISTS (SELECT 1 FROM public.produtos WHERE nome = 'Netflix Premium 4K');

INSERT INTO public.produtos (nome, preco, categoria, descricao, imagem_url)
SELECT 'Xbox Game Pass Ultimate', 29.90, 'Acessórios', 'Centenas de jogos no seu PC ou Console.', 'https://images.unsplash.com/photo-1621259182978-fbf93132d53d?w=800&q=80'
WHERE NOT EXISTS (SELECT 1 FROM public.produtos WHERE nome = 'Xbox Game Pass Ultimate');

INSERT INTO public.produtos (nome, preco, categoria, descricao, imagem_url)
SELECT 'HBO Max - 1 Mês', 12.00, 'Streaming', 'As melhores séries e filmes da Warner.', 'https://images.unsplash.com/photo-1616469829581-73993eb86b02?w=500&q=80'
WHERE NOT EXISTS (SELECT 1 FROM public.produtos WHERE nome = 'HBO Max - 1 Mês');

INSERT INTO public.produtos (nome, preco, categoria, descricao, imagem_url)
SELECT 'Disney+ & Star+', 19.90, 'Streaming', 'O combo perfeito para a família.', 'https://images.unsplash.com/photo-1633174524827-db00a6b7bc74?w=500&q=80'
WHERE NOT EXISTS (SELECT 1 FROM public.produtos WHERE nome = 'Disney+ & Star+');

INSERT INTO public.produtos (nome, preco, categoria, descricao, imagem_url)
SELECT 'PlayStation Plus Deluxe', 35.00, 'Acessórios', 'Catálogo de clássicos e jogos mensais.', 'https://images.unsplash.com/photo-1592155931584-901ac15763e3?w=800&q=80'
WHERE NOT EXISTS (SELECT 1 FROM public.produtos WHERE nome = 'PlayStation Plus Deluxe');

INSERT INTO public.produtos (nome, preco, categoria, descricao, imagem_url)
SELECT 'Crunchyroll Premium', 9.90, 'Streaming', 'Assista seus animes favoritos sem anúncios.', 'https://images.unsplash.com/photo-1578632292335-df3abbb0d586?w=500&q=80'
WHERE NOT EXISTS (SELECT 1 FROM public.produtos WHERE nome = 'Crunchyroll Premium');

INSERT INTO public.produtos (nome, preco, categoria, descricao, imagem_url)
SELECT 'Youtube Premium 1 Mês', 15.00, 'Streaming', 'Músicas e vídeos sem anúncios em segundo plano.', 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&q=80'
WHERE NOT EXISTS (SELECT 1 FROM public.produtos WHERE nome = 'Youtube Premium 1 Mês');

-- NOVOS PRODUTOS PARA A CATEGORIA LOJA
INSERT INTO public.produtos (nome, preco, categoria, descricao, imagem_url)
SELECT 'TV Box MXQ Pro 4K', 189.90, 'Loja', 'Transforme sua TV em Smart com Android atualizado.', 'https://images.unsplash.com/photo-1595935736128-db1f0a261263?w=800&q=80'
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
-- Adicionando múltiplos logins para testes de estoque
INSERT INTO public.logins_disponiveis (produto_id, username, password, status) 
SELECT id, 'user_teste_' || generate_series(1, 10) || '@email.com', 'senha123', 'disponivel'
FROM public.produtos 
WHERE categoria != 'Loja';

-- Se você quiser resetar os que já foram usados para 'disponivel' novamente:
UPDATE public.logins_disponiveis 
SET status = 'disponivel', reserved_by_pedido_id = NULL 
WHERE status = 'reservado';

-- 7. HABILITAR REALTIME
-- Isso permite que o site "ouça" quando o pagamento for aprovado
-- Tentamos adicionar a tabela à publicação; se já existir, o erro será ignorado silenciosamente em muitos contextos de script
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'pedidos') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;
    END IF;
END $$;

-- 8. TABELA DE APLICATIVOS
CREATE TABLE IF NOT EXISTS public.aplicativos (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT,
    icone_url TEXT,
    link_playstore TEXT,
    link_downloader TEXT,
    link_ntdown TEXT,
    plataforma TEXT DEFAULT 'Android',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Garantir que as colunas de links existam sem usar blocos DO $$
ALTER TABLE public.aplicativos ADD COLUMN IF NOT EXISTS link_playstore TEXT;
ALTER TABLE public.aplicativos ADD COLUMN IF NOT EXISTS link_downloader TEXT;
ALTER TABLE public.aplicativos ADD COLUMN IF NOT EXISTS link_ntdown TEXT;

ALTER TABLE public.aplicativos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura pública para aplicativos" ON public.aplicativos;
CREATE POLICY "Leitura pública para aplicativos" ON public.aplicativos FOR SELECT TO anon, authenticated USING (true);

-- Garantir que as roles da API tenham acesso à tabela e à sequência de IDs
GRANT ALL ON TABLE public.aplicativos TO postgres, anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.aplicativos_id_seq TO postgres, anon, authenticated, service_role;

-- Forçar atualização do cache do PostgREST (API)
NOTIFY pgrst, 'reload schema';

-- 9. CONFIGURAÇÃO DE STORAGE (OPCIONAL - RECOMENDADO)
-- Cria um bucket para armazenar suas fotos se ele não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('notecell_media', 'notecell_media', true)
ON CONFLICT (id) DO NOTHING;

-- Adicionar restrição de unicidade no nome para permitir o ON CONFLICT
-- 1. Removemos registros duplicados caso existam (mantendo apenas o primeiro de cada nome)
DELETE FROM public.aplicativos 
WHERE id NOT IN (
    SELECT MIN(id) 
    FROM public.aplicativos 
    GROUP BY nome
);

-- 2. Agora aplicamos a restrição de unicidade com segurança
ALTER TABLE public.aplicativos DROP CONSTRAINT IF EXISTS aplicativos_nome_key;
ALTER TABLE public.aplicativos ADD CONSTRAINT aplicativos_nome_key UNIQUE (nome);

-- Permite que qualquer pessoa veja as fotos
DROP POLICY IF EXISTS "Fotos públicas" ON storage.objects;
CREATE POLICY "Fotos públicas" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'notecell_media');

-- Permite que você (admin) suba fotos (exige autenticação)
DROP POLICY IF EXISTS "Admin pode subir fotos" ON storage.objects;
CREATE POLICY "Admin pode subir fotos" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'notecell_media');

INSERT INTO public.aplicativos (nome, descricao, icone_url, link_playstore, link_downloader, link_ntdown, plataforma)
SELECT 'IPTV Smarters Pro', 'Melhor player para listas IPTV com interface moderna.', 'https://play-lh.googleusercontent.com/1-h9mZp-L7vB2K3q6vBvLp1k4VjUuW6_vVvVvVvVvVvVvVvVvVvVvVvVvVvVvVvV', 'https://play.google.com/store/apps/details?id=com.nst.iptvsmarterstvbox', '78292', 'https://www.iptvsmarters.com/smarters.apk', 'Android'
WHERE NOT EXISTS (SELECT 1 FROM public.aplicativos WHERE nome = 'IPTV Smarters Pro');

INSERT INTO public.aplicativos (nome, descricao, icone_url, link_playstore, link_downloader, link_ntdown, plataforma)
SELECT 'XCIPTV Player', 'Excelente alternativa para reprodução de conteúdo.', 'https://play-lh.googleusercontent.com/9v_mX_X-L7vB2K3q6vBvLp1k4VjUuW6_vVvVvVvVvVvVvVvVvVvVvVvVvVvVvVvV', 'https://play.google.com/store/apps/details?id=com.nathnetwork.xciptv', '91234', 'https://ottrun.com/xciptv.apk', 'Multiplataforma'
WHERE NOT EXISTS (SELECT 1 FROM public.aplicativos WHERE nome = 'XCIPTV Player');

INSERT INTO public.aplicativos (nome, descricao, icone_url, link_playstore, link_downloader, link_ntdown, plataforma)
SELECT 'Downloader', 'Ferramenta essencial para navegar e baixar arquivos diretamente na sua Android TV ou TV Box.', 'https://placehold.co/150?text=Downloader', 'https://play.google.com/store/apps/details?id=com.esaba.downloader', '80456', 'https://www.aftvnews.com/downloader.apk', 'Android TV'
WHERE NOT EXISTS (SELECT 1 FROM public.aplicativos WHERE nome = 'Downloader');

INSERT INTO public.aplicativos (nome, descricao, icone_url, link_playstore, link_downloader, link_ntdown, plataforma)
SELECT 'NTDown', 'Gerenciador de downloads otimizado para instalação rápida de apps via link direto.', 'https://placehold.co/150?text=NTDown', 'https://play.google.com/store/apps/details?id=com.ntdown.app', '55678', 'https://notecel.com/ntdown.apk', 'Android'
WHERE NOT EXISTS (SELECT 1 FROM public.aplicativos WHERE nome = 'NTDown');

-- 10. TABELA DE VÍDEOS DA HOME
CREATE TABLE IF NOT EXISTS public.videos_inicio (
    id SERIAL PRIMARY KEY,
    titulo TEXT NOT NULL,
    url_embed TEXT NOT NULL,
    plataforma TEXT NOT NULL, -- 'youtube', 'facebook' ou 'storage'
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.videos_inicio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Leitura pública para vídeos" ON public.videos_inicio;
CREATE POLICY "Leitura pública para vídeos" ON public.videos_inicio FOR SELECT TO anon, authenticated USING (true);

GRANT ALL ON TABLE public.videos_inicio TO postgres, anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.videos_inicio_id_seq TO postgres, anon, authenticated, service_role;

-- Garantir unicidade na URL para o ON CONFLICT funcionar
ALTER TABLE public.videos_inicio DROP CONSTRAINT IF EXISTS videos_url_key;
ALTER TABLE public.videos_inicio ADD CONSTRAINT videos_url_key UNIQUE (url_embed);

-- Forçar atualização do cache da API
NOTIFY pgrst, 'reload schema';

-- Exemplo de inserção (Substitua pelos seus links)
INSERT INTO public.videos_inicio (titulo, url_embed, plataforma, ordem) 
VALUES ('Como Instalar', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube', 1)
ON CONFLICT DO NOTHING;

INSERT INTO public.videos_inicio (titulo, url_embed, plataforma, ordem) 
VALUES ('Demonstração', 'https://www.facebook.com/facebook/videos/10153231339946729/', 'facebook', 2)
ON CONFLICT DO NOTHING;

-- Correção de segurança: Garante que todos os links de YouTube usem o formato /embed/
UPDATE public.videos_inicio 
SET url_embed = REPLACE(REPLACE(url_embed, 'watch?v=', 'embed/'), 'youtu.be/', 'youtube.com/embed/')
WHERE plataforma = 'youtube' AND url_embed NOT LIKE '%/embed/%';

-- INSERÇÃO/ATUALIZAÇÃO DO S.A PLAYER
INSERT INTO public.aplicativos (nome, descricao, icone_url, link_playstore, plataforma)
VALUES ('S.A PLAYER', 'O Aplicativo mais estável do mercado e disponível na play store.', 'https://play-lh.googleusercontent.com/97839352-7vB2K3q6vBvLp1k4VjUuW6_vVvVvVvVvVvVvVvVvVvVvVvVvVvVvVvV', 'https://play.google.com/store/apps/details?id=com.saplayer.android', 'Android')
ON CONFLICT (nome) DO UPDATE SET
    link_playstore = EXCLUDED.link_playstore,
    descricao = EXCLUDED.descricao,
    icone_url = EXCLUDED.icone_url,
    plataforma = EXCLUDED.plataforma;

-- 11. FUNÇÃO PARA LIMPEZA DE LOGINS EXPIRADOS
-- Esta função libera logins reservados por pedidos que não foram pagos em 30 minutos
CREATE OR REPLACE FUNCTION public.limpar_logins_expirados()
RETURNS void AS $$
BEGIN
    -- 1. Volta o status dos logins para 'disponivel' se o pedido estiver PENDENTE há mais de 30 min
    UPDATE public.logins_disponiveis
    SET status = 'disponivel',
        reserved_by_pedido_id = NULL
    WHERE status = 'reservado'
    AND reserved_by_pedido_id IN (
        SELECT id FROM public.pedidos
        WHERE status = 'PENDENTE'
        AND created_at < (NOW() - INTERVAL '30 minutes')
    );

    -- 2. Marca os pedidos como 'EXPIRADO' para que o cliente saiba que o PIX não vale mais
    UPDATE public.pedidos
    SET status = 'EXPIRADO'
    WHERE status = 'PENDENTE'
    AND created_at < (NOW() - INTERVAL '30 minutes');
END;
$$ LANGUAGE plpgsql;

-- 12. AGENDAMENTO AUTOMÁTICO (CRON)
-- Habilita a extensão de agendamento se ainda não estiver ativa
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agenda a função para rodar a cada 5 minutos
-- O comando abaixo garante que não criaremos agendamentos duplicados
SELECT cron.unschedule('limpar-logins-30min');
SELECT cron.schedule('limpar-logins-30min', '*/5 * * * *', 'SELECT public.limpar_logins_expirados()');
