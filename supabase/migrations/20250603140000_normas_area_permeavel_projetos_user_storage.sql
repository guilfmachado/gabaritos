-- Normas: taxa de permeabilidade mínima (Art. 22 LC 751/2010 - valores no seed).
ALTER TABLE public.normas_locais
  ADD COLUMN IF NOT EXISTS taxa_permeabilidade_min double precision;

UPDATE public.normas_locais
SET taxa_permeabilidade_min = 0.20
WHERE taxa_permeabilidade_min IS NULL;

-- Projetos: vínculo opcional ao utilizador (histórico por auth.users).
ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS projetos_user_id_idx ON public.projetos (user_id);

COMMENT ON COLUMN public.normas_locais.taxa_permeabilidade_min IS 'Fração mínima de permeabilidade no terreno (ex.: 0.20 = 20%).';
COMMENT ON COLUMN public.projetos.user_id IS 'Proprietário lógico do projeto (Supabase Auth), quando disponível.';

-- Bucket público para pranchas persistidas (upload com service role — bypass RLS).
INSERT INTO storage.buckets (id, name, public)
VALUES ('plantas', 'plantas', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "plantas_public_read" ON storage.objects;
CREATE POLICY "plantas_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'plantas');
