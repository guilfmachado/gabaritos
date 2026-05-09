-- Snapshot de análise: terreno declarado e potencial construtivo não utilizado (m²).
ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS area_terreno_m2 double precision,
  ADD COLUMN IF NOT EXISTS area_restante_potencial_m2 double precision;

COMMENT ON COLUMN public.projetos.area_terreno_m2 IS 'Área do terreno (m²) informada na análise.';
COMMENT ON COLUMN public.projetos.area_restante_potencial_m2 IS 'Potencial não utilizado: limite de área construída (× CA) menos estimativa da IA, quando houver.';
