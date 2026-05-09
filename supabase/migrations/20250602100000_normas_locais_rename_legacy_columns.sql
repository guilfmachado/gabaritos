-- Bancos criados com a migração antiga (recuo_frontal_m, taxa_ocupacao_pct, indice_aproveitamento).
-- Ambientes já alinhados ao novo esquema não executam alterações.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'normas_locais' AND column_name = 'recuo_frontal_m'
  ) THEN
    ALTER TABLE public.normas_locais RENAME COLUMN recuo_frontal_m TO recuo_frontal_min;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'normas_locais' AND column_name = 'taxa_ocupacao_pct'
  ) THEN
    ALTER TABLE public.normas_locais RENAME COLUMN taxa_ocupacao_pct TO taxa_ocupacao_max;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'normas_locais' AND column_name = 'indice_aproveitamento'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'normas_locais' AND column_name = 'indice_aproveitamento_max'
  ) THEN
    ALTER TABLE public.normas_locais RENAME COLUMN indice_aproveitamento TO indice_aproveitamento_max;
  END IF;
END $$;
