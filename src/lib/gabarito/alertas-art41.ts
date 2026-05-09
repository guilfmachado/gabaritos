import type { AlertaCriticoUrbano, StatusChecklist } from "@/types/gabarito";

/**
 * Alertas a partir de inferências do modelo (visão) + regras declarativas LC 751/2010.
 * Não substitui consulta a GIS/PMC ou estudo geotécnico.
 */
export function buildAlertasCriticosUrbanos(checklist: StatusChecklist): AlertaCriticoUrbano[] {
  const out: AlertaCriticoUrbano[] = [];

  const apr = checklist.inferencia_area_potencial_risco === true;
  const enc = checklist.inferencia_cota_enchente_12m === true;
  const res = checklist.inferencia_uso_residencial === true;

  if ((apr || enc) && res) {
    out.push({
      codigo: "BLOQUEIO_OCUPACAO",
      severidade: "critico",
      titulo: "BLOQUEIO DE OCUPAÇÃO (pré-análise — IA)",
      mensagem:
        "A leitura automática sugere uso residencial associado a Área com Potencial de Risco (APR) e/ou cotas compatíveis com enchimento acima da referência municipal (12 m — LC 751/2010, Art. 41, I). " +
        "Não há efeito vinculante: confirme em cadastro municipal, estudo geotécnico e aprovação formal.",
    });
  } else if (enc && !res) {
    out.push({
      codigo: "ENCHENTE_ART41_I",
      severidade: "alerta",
      titulo: "Risco de enchimento (sinalização)",
      mensagem:
        "A prancha ou legendas sugerem cotas em faixa sensível a enchente (referência 12 m). Valide com a PMC e normas de segurança.",
    });
  } else if (apr && !res) {
    out.push({
      codigo: "APR_GENERICO",
      severidade: "alerta",
      titulo: "Área com potencial de risco (APR)",
      mensagem:
        "Elementos na planta ou legenda sugerem sobreposição com APR. Verifique zoneamento e exigências específicas.",
    });
  }

  return out;
}
