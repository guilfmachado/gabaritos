import type { AlinhamentoViaDecreto9155, ParametrosViaDecreto9155 } from "@/types/gabarito";

export const DECRETO_9155_2010 = {
  id: "decreto-9155-2010",
  titulo: "Decreto nº 9155/2010",
  status: "ativo",
  escopo: "Vias existentes e projetadas do Município de Blumenau; gabarito, simetria, eixo e alinhamento.",
} as const;

export function calcularAlinhamentoViaDecreto9155(
  params: ParametrosViaDecreto9155,
  recuoFrontalM: number | null,
): AlinhamentoViaDecreto9155 {
  const gabarito = Number(params.gabarito_via_m);
  const recuo = recuoFrontalM != null && Number.isFinite(recuoFrontalM) ? recuoFrontalM : null;
  const distanciaInformada = params.distancia_eixo_ao_alinhamento_m;
  const distanciaEixoAoAlinhamento =
    distanciaInformada != null && Number.isFinite(distanciaInformada)
      ? distanciaInformada
      : params.simetria === "simetrica" && Number.isFinite(gabarito) && gabarito > 0
        ? gabarito / 2
        : null;

  const exigeProjetoOficial = params.simetria === "assimetrica" || params.simetria === "desnivel";
  return {
    distancia_eixo_ao_alinhamento_m: distanciaEixoAoAlinhamento,
    distancia_eixo_ate_recuo_edificacao_m:
      distanciaEixoAoAlinhamento != null && recuo != null ? distanciaEixoAoAlinhamento + recuo : null,
    exige_projeto_oficial_via: exigeProjetoOficial,
    nota_tecnica: exigeProjetoOficial
      ? "Via assimétrica ou em desnível: não presuma metade do gabarito; use o projeto oficial da via para definir o ponto de medição."
      : "Via simétrica: o alinhamento pode ser estimado pela metade do gabarito da via, somando o recuo frontal a partir desse alinhamento.",
  };
}
