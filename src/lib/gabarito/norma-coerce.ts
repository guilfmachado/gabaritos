import type { NormaLocal } from "@/types/gabarito";

/** Garante `area_permeavel_min` quando a coluna ainda não existir em bases antigas. */
export function coerceNormaLocal(row: Record<string, unknown>): NormaLocal {
  const recuoFrontalMin = Number(row.recuo_frontal_min);
  const recuoLateralMin = Number(row.recuo_lateral_min);
  const taxaOcupacaoMax = Number(row.taxa_ocupacao_max);
  const indiceAproveitamentoMax = Number(row.indice_aproveitamento_max);
  const areaPermeavelMin =
    row.area_permeavel_min != null && row.area_permeavel_min !== ""
      ? Number(row.area_permeavel_min)
      : 0.2;
  return {
    id: String(row.id ?? ""),
    zona_urbanistica: String(row.zona_urbanistica ?? ""),
    recuo_frontal_min: recuoFrontalMin,
    recuo_lateral_min: recuoLateralMin,
    taxa_ocupacao_max: taxaOcupacaoMax,
    indice_aproveitamento_max: indiceAproveitamentoMax,
    area_permeavel_min: areaPermeavelMin,
    coeficiente_aproveitamento_basico:
      row.coeficiente_aproveitamento_basico != null && row.coeficiente_aproveitamento_basico !== ""
        ? Number(row.coeficiente_aproveitamento_basico)
        : indiceAproveitamentoMax,
    coeficiente_aproveitamento_maximo:
      row.coeficiente_aproveitamento_maximo != null && row.coeficiente_aproveitamento_maximo !== ""
        ? Number(row.coeficiente_aproveitamento_maximo)
        : indiceAproveitamentoMax,
    taxa_ocupacao:
      row.taxa_ocupacao != null && row.taxa_ocupacao !== "" ? Number(row.taxa_ocupacao) : taxaOcupacaoMax,
    taxa_permeabilidade:
      row.taxa_permeabilidade != null && row.taxa_permeabilidade !== ""
        ? Number(row.taxa_permeabilidade)
        : areaPermeavelMin,
    recuo_frontal:
      row.recuo_frontal != null && row.recuo_frontal !== "" ? Number(row.recuo_frontal) : recuoFrontalMin,
    afastamento_lateral_fundos:
      row.afastamento_lateral_fundos == null || row.afastamento_lateral_fundos === ""
        ? "H/6 (Art. 35 da LC 751/2010)"
        : String(row.afastamento_lateral_fundos),
    observacao: row.observacao == null ? null : String(row.observacao),
  };
}
