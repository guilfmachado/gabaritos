-- Retorno bruto da IA + URL canônica da prancha para o modelo vision
ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS resultado_ia text,
  ADD COLUMN IF NOT EXISTS imagem_planta_url text;

UPDATE public.projetos
SET imagem_planta_url = COALESCE(imagem_planta_url, planta_url)
WHERE imagem_planta_url IS NULL AND planta_url IS NOT NULL;

COMMENT ON COLUMN public.projetos.resultado_ia IS 'Saída textual/JSON do modelo de visão (Replicate).';
COMMENT ON COLUMN public.projetos.imagem_planta_url IS 'URL pública da planta enviada ao modelo (Storage/CDN).';
