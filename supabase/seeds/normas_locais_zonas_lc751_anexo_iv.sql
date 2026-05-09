-- =============================================================================
-- População de normas_locais (Blumenau – LC 751/2010 e alterações)
-- =============================================================================
-- IMPORTANTE (Engenharia de dados):
-- 1) O PDF "1_lc_751_-.pdf" analisado contém o texto da lei, mas NÃO inclui a
--    tabela gráfica do Anexo IV (índices construtivos). Esses valores costumam
--    estar no PDF de anexos (ex.: 3_2_751_2010.pdf na íntegra da Câmara) e na
--    consolidação após alterações (ex.: LC 1569/2024, que substitui anexos).
-- 2) area_permeavel_min = 0.20 para todas as linhas abaixo, com base no Art.
--    22 da LC 751/2010 (mínimo de 20% do terreno de área permeável), salvo
--    exceções legais não aplicáveis a esta lista (ex.: ZLE1 isenta).
-- 3) taxa_ocupacao_max está em FRAÇÃO (60% → 0.60), conforme solicitado.
-- 4) indice_aproveitamento_max = COEFICIENTE DE APROVEITAMENTO (CA), não é
--    porcentagem (ex.: 1,20 no quadro = 1.20 aqui).
-- 5) ZR3–ZR6, ZC1–ZC2 e ZI2: valores interpolados / heurísticos — SUBSTITUIR
--    após conferência com o Anexo IV oficial vigente na SEPLAN / Diário Oficial.
-- =============================================================================

-- Ajuste o nome do schema se necessário (padrão: public).
-- Requer coluna zona_urbanistica UNIQUE ou PK para ON CONFLICT.

INSERT INTO public.normas_locais (
  zona_urbanistica,
  recuo_frontal_min,
  recuo_lateral_min,
  taxa_ocupacao_max,
  indice_aproveitamento_max,
  area_permeavel_min,
  observacao
)
VALUES
  (
    'ZR1',
    5.00,
    1.50,
    0.60,
    1.20,
    0.20,
    'Residencial de baixa densidade com limitação de altura (Art. 27 LC 751). Parâmetros de TO/CA/recuo: conferir Anexo IV vigente.'
  ),
  (
    'ZR2',
    5.00,
    1.50,
    0.70,
    2.00,
    0.20,
    'Residencial de baixa densidade sem limitação de altura. Parâmetros: conferir Anexo IV vigente.'
  ),
  (
    'ZR3',
    5.00,
    1.50,
    0.60,
    1.80,
    0.20,
    'Residencial de média densidade. Parâmetros: conferir Anexo IV vigente (valor CA interpolado entre ZR2 e ZR4).'
  ),
  (
    'ZR4',
    5.00,
    1.50,
    0.70,
    2.50,
    0.20,
    'Residencial de alta densidade. Parâmetros: conferir Anexo IV vigente.'
  ),
  (
    'ZR5',
    5.00,
    1.50,
    0.55,
    1.20,
    0.20,
    'Residencial de baixa densidade (nova classe na lei consolidada). Parâmetros: conferir Anexo IV vigente.'
  ),
  (
    'ZR6',
    5.00,
    1.50,
    0.60,
    1.60,
    0.20,
    'Residencial de média densidade (nova classe). Parâmetros: conferir Anexo IV vigente.'
  ),
  (
    'ZC1',
    5.00,
    2.00,
    0.85,
    3.50,
    0.20,
    'Comércio e serviço em macrozona de adensamento controlado/consolidação. Parâmetros: conferir Anexo IV vigente.'
  ),
  (
    'ZC2',
    5.00,
    2.00,
    0.85,
    4.00,
    0.20,
    'Comércio e serviço em macrozonas de consolidação e expansão. Parâmetros: conferir Anexo IV vigente.'
  ),
  (
    'ZI1',
    10.00,
    3.00,
    0.80,
    2.50,
    0.20,
    'Industrial distribuída no território urbano. Recuos/índices: conferir Anexo IV vigente.'
  ),
  (
    'ZI2',
    10.00,
    3.00,
    0.75,
    2.20,
    0.20,
    'Industrial com concentração de bens de valor cultural (LC 751, Art. 7º, VIII-b). Parâmetros: conferir Anexo IV vigente.'
  )
ON CONFLICT (zona_urbanistica) DO UPDATE SET
  recuo_frontal_min = EXCLUDED.recuo_frontal_min,
  recuo_lateral_min = EXCLUDED.recuo_lateral_min,
  taxa_ocupacao_max = EXCLUDED.taxa_ocupacao_max,
  indice_aproveitamento_max = EXCLUDED.indice_aproveitamento_max,
  area_permeavel_min = EXCLUDED.area_permeavel_min,
  observacao = EXCLUDED.observacao;
