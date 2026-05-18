import { areaPermeavelMinParaFracao, taxaOcupacaoParaFracao } from "@/lib/gabarito/taxa-ocupacao";
import type { ChecklistItem, NormaLocal, ValidacaoZoneamentoLc751Input } from "@/types/gabarito";

export const LC751_2010 = {
  id: "lc-751-2010",
  titulo: "LC 751/2010 - Código de Zoneamento, Uso e Ocupação do Solo",
  status: "ativo",
} as const;

function inconformidade(id: string, rotulo: string, detalhe: string): ChecklistItem {
  return { id, rotulo, status: "inconforme", detalhe };
}

export function validarParametrosZoneamentoLc751(
  norma: NormaLocal,
  input: ValidacaoZoneamentoLc751Input,
): ChecklistItem[] {
  const out: ChecklistItem[] = [];
  const areaTerreno = Number(input.area_terreno_m2);

  if (!Number.isFinite(areaTerreno) || areaTerreno <= 0) {
    return out;
  }

  const taxaOcupacaoMax = taxaOcupacaoParaFracao(norma.taxa_ocupacao_max);
  const projecaoMaxima = areaTerreno * taxaOcupacaoMax;
  const projecao = input.area_projecao_horizontal_m2;
  if (projecao != null && Number.isFinite(projecao) && projecao > projecaoMaxima * 1.01) {
    out.push(
      inconformidade(
        "lc751_taxa_ocupacao",
        "Taxa de Ocupação acima do limite da zona",
        `${LC751_2010.titulo}, Art. 21: projeção ${projecao.toFixed(2)} m² excede o máximo de ${projecaoMaxima.toFixed(2)} m² para a zona ${norma.zona_urbanistica}.`,
      ),
    );
  }

  const permeabilidadeMin = Math.max(0.2, areaPermeavelMinParaFracao(norma.area_permeavel_min));
  const areaPermeavelMinima = areaTerreno * permeabilidadeMin;
  const areaPermeavel = input.area_permeavel_m2;
  if (areaPermeavel != null && Number.isFinite(areaPermeavel) && areaPermeavel < areaPermeavelMinima) {
    out.push(
      inconformidade(
        "lc751_taxa_permeabilidade",
        "Taxa de Permeabilidade abaixo do mínimo",
        "Taxa de Permeabilidade inferior aos 20% obrigatórios previstos no Art. 22 da LC 751/2010.",
      ),
    );
  }

  const recuoFrontalMinimo = Math.max(5, norma.recuo_frontal_min);
  const recuoFrontal = input.recuo_frontal_m;
  if (recuoFrontal != null && Number.isFinite(recuoFrontal) && recuoFrontal < recuoFrontalMinimo) {
    out.push(
      inconformidade(
        "lc751_recuo_frontal",
        "Recuo frontal inferior ao mínimo",
        `${LC751_2010.titulo}, Art. 31: recuo frontal informado ${recuoFrontal.toFixed(2)} m; mínimo aplicável ${recuoFrontalMinimo.toFixed(2)} m.`,
      ),
    );
  }

  const afastamentoLateral = input.afastamento_lateral_m;
  if (
    afastamentoLateral != null
    && Number.isFinite(afastamentoLateral)
    && afastamentoLateral <= 0
    && input.parede_lindeira_tem_aberturas === true
  ) {
    out.push(
      inconformidade(
        "lc751_abertura_divisa",
        "Abertura em parede encostada na divisa",
        `${LC751_2010.titulo}, Art. 35: parede lindeira sem afastamento deve ser cega, sem vãos de janela, ventilação ou iluminação.`,
      ),
    );
  }

  return out;
}
