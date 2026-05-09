import type { NormaLocal } from "@/types/gabarito";

/** Garante `area_permeavel_min` quando a coluna ainda não existir em bases antigas. */
export function coerceNormaLocal(row: Record<string, unknown>): NormaLocal {
  return {
    id: String(row.id ?? ""),
    zona_urbanistica: String(row.zona_urbanistica ?? ""),
    recuo_frontal_min: Number(row.recuo_frontal_min),
    recuo_lateral_min: Number(row.recuo_lateral_min),
    taxa_ocupacao_max: Number(row.taxa_ocupacao_max),
    indice_aproveitamento_max: Number(row.indice_aproveitamento_max),
    area_permeavel_min:
      row.area_permeavel_min != null && row.area_permeavel_min !== ""
        ? Number(row.area_permeavel_min)
        : 0.2,
    observacao: row.observacao == null ? null : String(row.observacao),
  };
}
