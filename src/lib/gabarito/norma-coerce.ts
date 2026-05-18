import type { NormaLocal } from "@/types/gabarito";

/** Normaliza a linha atual de `normas_locais` para números usados no motor. */
export function coerceNormaLocal(row: Record<string, unknown>): NormaLocal {
  return {
    zona_urbanistica: String(row.zona_urbanistica ?? ""),
    taxa_ocupacao_max: Number(row.taxa_ocupacao_max),
    indice_aproveitamento_max: Number(row.indice_aproveitamento_max),
    taxa_permeabilidade_min: Number(row.taxa_permeabilidade_min),
    recuo_frontal_min: Number(row.recuo_frontal_min),
  };
}
