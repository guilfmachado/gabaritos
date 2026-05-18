import type { AlertaCriticoUrbano, ChecklistItem, CompartimentoLc1247, EscadaLc1247 } from "@/types/gabarito";

export const LC1247_2019 = {
  id: "lc-1247-2019",
  titulo: "LC 1247/2019 - Código de Edificações",
  status: "ativo",
} as const;

export const ALERTA_IMOVEL_TOMBADO_LC1247: AlertaCriticoUrbano = {
  codigo: "IMOVEL_TOMBADO_LC1247_ART68",
  severidade: "alerta",
  titulo: "Imóvel Tombado",
  mensagem:
    "Imóvel Tombado. Parâmetros edilícios condicionados à aprovação do órgão de patrimônio histórico municipal/estadual.",
};

function inconformidade(id: string, rotulo: string, detalhe: string): ChecklistItem {
  return { id, rotulo, status: "inconforme", detalhe };
}

export function validarCompartimentosLc1247(compartimentos: CompartimentoLc1247[]): ChecklistItem[] {
  const out: ChecklistItem[] = [];

  compartimentos.forEach((c, idx) => {
    const prefix = `lc1247_compartimento_${idx + 1}`;
    const nome = c.nome.trim() || `Compartimento ${idx + 1}`;
    const peMin = c.tipo === "permanencia_prolongada" ? 2.4 : 2.2;
    if (c.pe_direito_m != null && Number.isFinite(c.pe_direito_m) && c.pe_direito_m < peMin) {
      out.push(
        inconformidade(
          `${prefix}_pe_direito`,
          "Pé-direito inferior ao mínimo",
          `${LC1247_2019.titulo}: ${nome} tem pé-direito de ${c.pe_direito_m.toFixed(2)} m; mínimo exigido ${peMin.toFixed(2)} m.`,
        ),
      );
    }

    if (!Number.isFinite(c.area_piso_m2) || c.area_piso_m2 <= 0) return;
    const ilumMin = c.area_piso_m2 / (c.tipo === "permanencia_prolongada" ? 6 : 8);
    const ventMin = c.area_piso_m2 / (c.tipo === "permanencia_prolongada" ? 12 : 16);

    if (c.area_iluminacao_m2 != null && Number.isFinite(c.area_iluminacao_m2) && c.area_iluminacao_m2 < ilumMin) {
      out.push(
        inconformidade(
          `${prefix}_iluminacao`,
          "Área de iluminação natural insuficiente",
          `${LC1247_2019.titulo}: ${nome} exige vão de iluminação mínimo de ${ilumMin.toFixed(2)} m²; informado ${c.area_iluminacao_m2.toFixed(2)} m².`,
        ),
      );
    }

    const dispensaVentilacao = c.tipo === "permanencia_transitoria" && c.possui_exaustao_mecanica === true;
    if (
      !dispensaVentilacao
      && c.area_ventilacao_m2 != null
      && Number.isFinite(c.area_ventilacao_m2)
      && c.area_ventilacao_m2 < ventMin
    ) {
      out.push(
        inconformidade(
          `${prefix}_ventilacao`,
          "Área de ventilação efetiva insuficiente",
          `${LC1247_2019.titulo}: ${nome} exige ventilação mínima de ${ventMin.toFixed(2)} m²; informado ${c.area_ventilacao_m2.toFixed(2)} m².`,
        ),
      );
    }
  });

  return out;
}

export function validarEscadasLc1247(escadas: EscadaLc1247[]): ChecklistItem[] {
  const out: ChecklistItem[] = [];

  escadas.forEach((e, idx) => {
    const prefix = `lc1247_escada_${idx + 1}`;
    if (e.uso === "coletivo" && e.largura_m != null && Number.isFinite(e.largura_m) && e.largura_m < 1.2) {
      out.push(
        inconformidade(
          `${prefix}_largura`,
          "Escada coletiva com largura insuficiente",
          `${LC1247_2019.titulo}: escada coletiva exige largura mínima de 1,20 m; informado ${e.largura_m.toFixed(2)} m.`,
        ),
      );
    }

    if (e.uso === "coletivo" && e.espelho_cm != null && Number.isFinite(e.espelho_cm) && e.espelho_cm > 18) {
      out.push(
        inconformidade(
          `${prefix}_espelho`,
          "Espelho de degrau acima do máximo",
          `${LC1247_2019.titulo}: escada coletiva exige espelho máximo de 18 cm; informado ${e.espelho_cm.toFixed(1)} cm.`,
        ),
      );
    }

    if (e.uso === "coletivo" && e.piso_cm != null && Number.isFinite(e.piso_cm) && e.piso_cm < 28) {
      out.push(
        inconformidade(
          `${prefix}_piso`,
          "Pisada de degrau abaixo do mínimo",
          `${LC1247_2019.titulo}: escada coletiva exige pisada mínima de 28 cm; informado ${e.piso_cm.toFixed(1)} cm.`,
        ),
      );
    }

    if (e.uso === "coletivo" && e.espelho_cm != null && e.piso_cm != null) {
      const blondel = 2 * e.espelho_cm + e.piso_cm;
      if (Number.isFinite(blondel) && (blondel < 63 || blondel > 64)) {
        out.push(
          inconformidade(
            `${prefix}_blondel`,
            "Escada fora da Fórmula de Blondel",
            `${LC1247_2019.titulo}: 2h+b deve ficar entre 63 cm e 64 cm; resultado ${blondel.toFixed(1)} cm.`,
          ),
        );
      }
    }

    if (e.uso === "coletivo" && e.helicoidal === true) {
      out.push(
        inconformidade(
          `${prefix}_helicoidal`,
          "Escada helicoidal indevida em uso coletivo",
          `${LC1247_2019.titulo}: escada helicoidal é admitida apenas para acesso secundário de manutenção ou uso privativo interno.`,
        ),
      );
    }
  });

  return out;
}

export function filtrarAlertasEdiliciosPorTombamento(alertas: AlertaCriticoUrbano[] | undefined, isTombado: boolean) {
  if (!isTombado) return alertas;
  const filtrados = (alertas ?? []).filter((a) => !/LC\s*1247|Código de Edificações|edil/i.test(`${a.codigo} ${a.titulo} ${a.mensagem}`));
  if (filtrados.some((a) => a.codigo === ALERTA_IMOVEL_TOMBADO_LC1247.codigo)) return filtrados;
  return [ALERTA_IMOVEL_TOMBADO_LC1247, ...filtrados];
}
