import { buildAlertasCriticosUrbanos } from "@/lib/gabarito/alertas-art41";
import {
  buildAlertaBloqueioOcupacaoArt41,
  buildSugestaoAproveitamentoPotencial,
  computePotencialArt1320,
} from "@/lib/gabarito/potencial";
import type { NormaLocal, StatusChecklist } from "@/types/gabarito";

export function enrichChecklistWithUrbanIntelligence(
  checklist: StatusChecklist,
  norma: NormaLocal,
  areaTerrenoM2?: number | null,
): StatusChecklist {
  const areaTerreno =
    areaTerrenoM2 != null && Number.isFinite(areaTerrenoM2) && areaTerrenoM2 > 0 ? areaTerrenoM2 : null;

  let potencial = checklist.potencial;
  if (areaTerreno != null) {
    potencial = computePotencialArt1320(
      areaTerreno,
      norma,
      checklist.area_construida_estimada_ia_m2 ?? null,
    );
  }

  const alertaBloqueio = buildAlertaBloqueioOcupacaoArt41(checklist, norma.zona_urbanistica);
  const alertasRegra = buildAlertasCriticosUrbanos(checklist);
  const alertasModelo = checklist.alertas_criticos ?? [];
  const merged = [
    ...(alertaBloqueio ? [alertaBloqueio] : []),
    ...alertasRegra,
    ...alertasModelo,
  ];
  const alertas_criticos = merged.length ? dedupeAlertas(merged) : undefined;

  let otimizacao = checklist.otimizacao_sugestao_ia?.trim();
  if (potencial) {
    const sug = buildSugestaoAproveitamentoPotencial(potencial);
    if (sug) {
      otimizacao = otimizacao ? `${otimizacao}\n\n${sug}` : sug;
    }
  }

  return {
    ...checklist,
    potencial,
    alertas_criticos,
    otimizacao_sugestao_ia: otimizacao || checklist.otimizacao_sugestao_ia,
  };
}

function dedupeAlertas(list: NonNullable<StatusChecklist["alertas_criticos"]>) {
  const seen = new Set<string>();
  return list.filter((a) => {
    const k = `${a.codigo}:${a.titulo}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
