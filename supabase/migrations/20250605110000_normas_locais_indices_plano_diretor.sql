-- Normaliza aliases dos índices urbanísticos para suportar consultas por Plano Diretor / Zoneamento.
-- Mantém compatibilidade com as colunas antigas já usadas pelo app (`*_min`, `*_max`).

ALTER TABLE public.normas_locais
  ADD COLUMN IF NOT EXISTS coeficiente_aproveitamento_basico double precision,
  ADD COLUMN IF NOT EXISTS coeficiente_aproveitamento_maximo double precision,
  ADD COLUMN IF NOT EXISTS taxa_ocupacao double precision,
  ADD COLUMN IF NOT EXISTS taxa_permeabilidade double precision DEFAULT 0.20,
  ADD COLUMN IF NOT EXISTS recuo_frontal double precision,
  ADD COLUMN IF NOT EXISTS afastamento_lateral_fundos text DEFAULT 'H/6 (Art. 35 da LC 751/2010)';

UPDATE public.normas_locais
SET
  coeficiente_aproveitamento_maximo = COALESCE(coeficiente_aproveitamento_maximo, indice_aproveitamento_max),
  coeficiente_aproveitamento_basico = COALESCE(coeficiente_aproveitamento_basico, indice_aproveitamento_max),
  taxa_ocupacao = COALESCE(taxa_ocupacao, taxa_ocupacao_max),
  taxa_permeabilidade = COALESCE(taxa_permeabilidade, area_permeavel_min, 0.20),
  recuo_frontal = COALESCE(recuo_frontal, recuo_frontal_min),
  afastamento_lateral_fundos = COALESCE(afastamento_lateral_fundos, 'H/6 (Art. 35 da LC 751/2010)');

COMMENT ON COLUMN public.normas_locais.coeficiente_aproveitamento_basico IS
  'Coeficiente de aproveitamento básico da zona (Art. 20 / Anexo IV vigente).';
COMMENT ON COLUMN public.normas_locais.coeficiente_aproveitamento_maximo IS
  'Coeficiente de aproveitamento máximo da zona (Art. 20 / Anexo IV vigente).';
COMMENT ON COLUMN public.normas_locais.taxa_ocupacao IS
  'Taxa de ocupação da zona em fração (Art. 21).';
COMMENT ON COLUMN public.normas_locais.taxa_permeabilidade IS
  'Taxa mínima de permeabilidade em fração; padrão 0.20 conforme Art. 22.';
COMMENT ON COLUMN public.normas_locais.recuo_frontal IS
  'Recuo frontal mínimo em metros (Art. 31).';
COMMENT ON COLUMN public.normas_locais.afastamento_lateral_fundos IS
  'Regra textual para afastamentos laterais/fundos; padrão H/6 conforme Art. 35.';

CREATE OR REPLACE VIEW public.zonas_urbanisticas AS
SELECT
  zona_urbanistica AS zona,
  zona_urbanistica,
  COALESCE(coeficiente_aproveitamento_basico, indice_aproveitamento_max) AS coeficiente_aproveitamento_basico,
  COALESCE(coeficiente_aproveitamento_maximo, indice_aproveitamento_max) AS coeficiente_aproveitamento_maximo,
  COALESCE(taxa_ocupacao, taxa_ocupacao_max) AS taxa_ocupacao,
  COALESCE(taxa_permeabilidade, area_permeavel_min, 0.20) AS taxa_permeabilidade,
  COALESCE(recuo_frontal, recuo_frontal_min) AS recuo_frontal,
  COALESCE(afastamento_lateral_fundos, 'H/6 (Art. 35 da LC 751/2010)') AS afastamento_lateral_fundos,
  observacao
FROM public.normas_locais;
