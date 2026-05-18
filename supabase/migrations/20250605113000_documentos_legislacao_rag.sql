-- RAG jurídico do Gabarito: leis municipais (Plano Diretor, Código de Obras,
-- Zoneamento, LC 751/2010 e atualizações) com busca vetorial pgvector.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.documentos_legislacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  nome_lei text NOT NULL,
  artigo text,
  conteudo text NOT NULL,
  embedding vector(1536),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS documentos_legislacao_embedding_hnsw
  ON public.documentos_legislacao
  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS documentos_legislacao_nome_lei_idx
  ON public.documentos_legislacao (nome_lei);

CREATE INDEX IF NOT EXISTS documentos_legislacao_artigo_idx
  ON public.documentos_legislacao (artigo);

ALTER TABLE public.documentos_legislacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documentos_legislacao_select_public"
  ON public.documentos_legislacao FOR SELECT
  USING (true);

COMMENT ON TABLE public.documentos_legislacao IS
  'Trechos literais das leis de Blumenau com embeddings para RAG do Consultor IA.';
COMMENT ON COLUMN public.documentos_legislacao.embedding IS
  'Embedding 1536 dimensões (ex.: OpenAI text-embedding-3-small ou modelo compatível).';

CREATE OR REPLACE FUNCTION public.match_documentos_legislacao(
  query_embedding vector(1536),
  match_count int DEFAULT 6,
  similarity_threshold double precision DEFAULT 0.60
)
RETURNS TABLE (
  id uuid,
  nome_lei text,
  artigo text,
  conteudo text,
  similarity double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    d.id,
    d.nome_lei,
    d.artigo,
    d.conteudo,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM public.documentos_legislacao d
  WHERE d.embedding IS NOT NULL
    AND 1 - (d.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT GREATEST(1, match_count);
$$;

COMMENT ON FUNCTION public.match_documentos_legislacao(vector, int, double precision) IS
  'Busca trechos legais por similaridade de cosseno para RAG jurídico do Gabarito.';
