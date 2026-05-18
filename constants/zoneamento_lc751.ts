export type ZonaUrbanistica = {
  sigla: string;
  nome: string;
  taxaOcupacaoMax: number; // Porcentagem (ex: 0.6 para 60%)
  coeficienteAproveitamentoBasico: number;
  coeficienteAproveitamentoMax: number;
  taxaPermeabilidadeMin: number; // Padrão 0.20 (20%)
  recuoFrontalMin: number; // em metros
};

// Aqui você vai preencher com os dados exatos do Anexo III atualizado.
// Deixei as zonas mais comuns pré-estruturadas:
export const REGRAS_ZONEAMENTO: Record<string, ZonaUrbanistica> = {
  ZR1: {
    sigla: "ZR1",
    nome: "Zona Residencial 1",
    taxaOcupacaoMax: 0.60,
    coeficienteAproveitamentoBasico: 1.2,
    coeficienteAproveitamentoMax: 2.4,
    taxaPermeabilidadeMin: 0.20,
    recuoFrontalMin: 5.0,
  },
  ZR2: {
    sigla: "ZR2",
    nome: "Zona Residencial 2",
    taxaOcupacaoMax: 0.70,
    coeficienteAproveitamentoBasico: 2.4,
    coeficienteAproveitamentoMax: 4.8,
    taxaPermeabilidadeMin: 0.20,
    recuoFrontalMin: 5.0,
  },
  ZC: {
    sigla: "ZC",
    nome: "Zona Comercial",
    taxaOcupacaoMax: 0.80,
    coeficienteAproveitamentoBasico: 3.0,
    coeficienteAproveitamentoMax: 6.0,
    taxaPermeabilidadeMin: 0.20,
    recuoFrontalMin: 5.0, // Pode ter exceções com marquises
  },
  ZPA: {
    sigla: "ZPA",
    nome: "Zona de Preservação Ambiental",
    taxaOcupacaoMax: 0.10, // Altamente restritivo
    coeficienteAproveitamentoBasico: 0.2,
    coeficienteAproveitamentoMax: 0.2,
    taxaPermeabilidadeMin: 0.80,
    recuoFrontalMin: 10.0,
  },
};

export function getRegrasZona(sigla: string): ZonaUrbanistica | undefined {
  return REGRAS_ZONEAMENTO[sigla.toUpperCase()];
}
