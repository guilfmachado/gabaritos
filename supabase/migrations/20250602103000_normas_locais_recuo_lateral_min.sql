-- Alinha nome da coluna ao esquema atual (recuo_lateral_min).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'normas_locais' AND column_name = 'recuo_lateral_m'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'normas_locais' AND column_name = 'recuo_lateral_min'
  ) THEN
    ALTER TABLE public.normas_locais RENAME COLUMN recuo_lateral_m TO recuo_lateral_min;
  END IF;
END $$;
