-- Base de conhecimento vetorial (RAG) para trechos das LC / PDM.
-- Popular com pipeline de chunking + modelo de embeddings; use match_normas_chunks no app.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.normas_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  referencia text NOT NULL,
  trecho text NOT NULL,
  zona_urbanistica text REFERENCES public.normas_locais (zona_urbanistica) ON UPDATE CASCADE ON DELETE SET NULL,
  embedding vector(1536),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS normas_chunks_embedding_hnsw
  ON public.normas_chunks
  USING hnsw (embedding vector_cosine_ops);

ALTER TABLE public.normas_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "normas_chunks_select_public"
  ON public.normas_chunks FOR SELECT
  USING (true);

COMMENT ON TABLE public.normas_chunks IS 'Chunks das leis municipais para recuperação semântica (pgvector).';
