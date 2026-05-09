-- Gabarito: projetos + normas locais (Blumenau/SC)
-- Referências normativas: LC 1.181/2018, LC 751, LC 1.247 (ajuste valores com o texto oficial).

CREATE TABLE IF NOT EXISTS public.normas_locais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zona_urbanistica text NOT NULL UNIQUE,
  recuo_frontal_min double precision NOT NULL,
  recuo_lateral_min double precision NOT NULL,
  taxa_ocupacao_max double precision NOT NULL,
  indice_aproveitamento_max double precision NOT NULL,
  observacao text
);

CREATE TABLE IF NOT EXISTS public.projetos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  nome text,
  zona_urbanistica text NOT NULL REFERENCES public.normas_locais (zona_urbanistica) ON UPDATE CASCADE,
  inscricao_imobiliaria text,
  status_checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  planta_url text,
  ultima_analise_ia text
);

CREATE INDEX IF NOT EXISTS projetos_zona_idx ON public.projetos (zona_urbanistica);
CREATE INDEX IF NOT EXISTS projetos_created_at_idx ON public.projetos (created_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projetos_updated ON public.projetos;
CREATE TRIGGER trg_projetos_updated
  BEFORE UPDATE ON public.projetos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.normas_locais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;

-- Leitura pública das normas (catálogo municipal); em produção restrinja a roles específicos.
CREATE POLICY "normas_locais_select_public"
  ON public.normas_locais FOR SELECT
  USING (true);

-- Projetos: acesso via service role no backend (bypass RLS). Para client direto, habilite após Auth.
CREATE POLICY "projetos_service_all"
  ON public.projetos FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Valores ilustrativos — substitua pelos extratos consolidados do PDM/LC aplicáveis à zona.
INSERT INTO public.normas_locais (
  zona_urbanistica,
  recuo_frontal_min,
  taxa_ocupacao_max,
  indice_aproveitamento_max,
  recuo_lateral_min,
  observacao
) VALUES
  ('ZR1', 5.00, 60.00, 1.200, 1.50, 'Parâmetros de exemplo para habitação em zona predominantemente residencial.'),
  ('ZR2', 5.00, 70.00, 2.000, 1.50, 'Parâmetros de exemplo — conferir quadro do PDM vigente.'),
  ('ZI', 10.00, 80.00, 2.500, 3.00, 'Parâmetros de exemplo para zona industrial.')
ON CONFLICT (zona_urbanistica) DO NOTHING;
