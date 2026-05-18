-- Documenta os nomes canônicos usados pelo app para os índices urbanísticos.
-- A tabela normas_locais deve expor somente as chaves *_min / *_max abaixo.

ALTER TABLE public.normas_locais
  ADD COLUMN IF NOT EXISTS taxa_permeabilidade_min double precision DEFAULT 0.20;

UPDATE public.normas_locais
SET taxa_permeabilidade_min = COALESCE(taxa_permeabilidade_min, 0.20);

COMMENT ON COLUMN public.normas_locais.indice_aproveitamento_max IS
  'Índice de aproveitamento máximo da zona (Art. 20 / Anexo IV vigente).';
COMMENT ON COLUMN public.normas_locais.taxa_ocupacao_max IS
  'Taxa de ocupação máxima da zona em fração ou percentual normalizável (Art. 21).';
COMMENT ON COLUMN public.normas_locais.taxa_permeabilidade_min IS
  'Taxa mínima de permeabilidade em fração; padrão 0.20 conforme Art. 22.';
COMMENT ON COLUMN public.normas_locais.recuo_frontal_min IS
  'Recuo frontal mínimo em metros (Art. 31).';

CREATE OR REPLACE VIEW public.zonas_urbanisticas AS
SELECT
  zona_urbanistica AS zona,
  zona_urbanistica,
  indice_aproveitamento_max,
  taxa_ocupacao_max,
  taxa_permeabilidade_min,
  recuo_frontal_min,
  recuo_lateral_min,
  observacao
FROM public.normas_locais;
