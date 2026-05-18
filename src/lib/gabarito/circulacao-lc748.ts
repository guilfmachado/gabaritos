import type { ChecklistItem, ValidacaoRebaixosLc748Input, ViaLoteamentoLc748Input } from "@/types/gabarito";

export const LC748_2010 = {
  id: "lc-748-2010",
  titulo: "LC 748/2010 - Código do Sistema de Circulação",
  status: "ativo",
} as const;

function item(id: string, rotulo: string, detalhe: string): ChecklistItem {
  return {
    id,
    rotulo,
    status: "inconforme",
    detalhe,
  };
}

export function validarRebaixosAcessoVeicularLc748(input: ValidacaoRebaixosLc748Input): ChecklistItem[] {
  const out: ChecklistItem[] = [];
  const testada = Number(input.testada_m);
  const rebaixos = input.rebaixos.filter((r) => Number.isFinite(r.largura_m) && r.largura_m > 0);
  const larguraTotal = rebaixos.reduce((sum, r) => sum + r.largura_m, 0);
  const limitePercentual = input.nao_residencial_rua_sem_estacionamento ? 0.75 : 0.5;
  const limiteTestada = testada <= 5 ? Math.min(2.5, testada) : testada * limitePercentual;
  const usoEspecial = input.uso_especial === "posto_combustivel" || input.uso_especial === "logistica_5_ou_mais_caminhoes";
  const larguraMaxima = usoEspecial || input.nao_residencial_rua_sem_estacionamento ? 10 : 7.2;
  const afastamentoObrigatorio = usoEspecial ? 2.5 : 1;

  if (Number.isFinite(testada) && testada > 0 && larguraTotal > limiteTestada) {
    out.push(
      item(
        "lc748_rebaixo_total_testada",
        "Rebaixo de meio-fio acima do limite da testada",
        `LC 748/2010, Art. 11: soma dos rebaixos ${larguraTotal.toFixed(2)} m excede o limite de ${limiteTestada.toFixed(2)} m.`,
      ),
    );
  }

  rebaixos.forEach((rebaixo, idx) => {
    if (rebaixo.largura_m > larguraMaxima) {
      out.push(
        item(
          `lc748_rebaixo_largura_${idx + 1}`,
          "Rebaixo de acesso veicular acima da largura máxima",
          `LC 748/2010, Art. 13: rebaixo ${idx + 1} tem ${rebaixo.largura_m.toFixed(2)} m; limite aplicável ${larguraMaxima.toFixed(2)} m.`,
        ),
      );
    }

    if (rebaixo.largura_m > 3.6 && rebaixo.largura_m <= larguraMaxima) {
      const afastamento = rebaixo.afastamento_divisa_m;
      if (afastamento == null || !Number.isFinite(afastamento) || afastamento < afastamentoObrigatorio) {
        out.push(
          item(
            `lc748_rebaixo_afastamento_${idx + 1}`,
            "Rebaixo exige afastamento mínimo da divisa",
            `LC 748/2010, Art. 13: rebaixo ${idx + 1} maior que 3,60 m exige afastamento mínimo de ${afastamentoObrigatorio.toFixed(2)} m da divisa.`,
          ),
        );
      }
    }
  });

  input.distancias_entre_rebaixos_m?.forEach((distancia, idx) => {
    if (Number.isFinite(distancia) && distancia < 5) {
      out.push(
        item(
          `lc748_rebaixo_intervalo_${idx + 1}`,
          "Intervalo insuficiente entre rebaixos",
          `LC 748/2010, Art. 13: intervalo ${idx + 1} tem ${distancia.toFixed(2)} m; mínimo exigido 5,00 m.`,
        ),
      );
    }
  });

  return out;
}

export function validarViaLoteamentoLc748(input: ViaLoteamentoLc748Input): ChecklistItem[] {
  const out: ChecklistItem[] = [];
  const extensao = Number(input.extensao_via_m);
  const gabarito = Number(input.gabarito_via_m);

  if (input.uso_loteamento === "residencial" && Number.isFinite(extensao) && Number.isFinite(gabarito)) {
    const minimo = extensao <= 400 ? 13 : 15;
    if (gabarito < minimo) {
      out.push(
        item(
          "lc748_loteamento_gabarito_via",
          "Gabarito insuficiente para via de loteamento residencial",
          `LC 748/2010, Art. 24: via com ${extensao.toFixed(2)} m exige gabarito mínimo de ${minimo.toFixed(2)} m; informado ${gabarito.toFixed(2)} m.`,
        ),
      );
    }
  }

  if (
    input.sem_saida
    && Number.isFinite(extensao)
    && extensao > 30
    && !input.possui_via_transversal_ate_30m_final
  ) {
    const raio = input.raio_praca_retorno_m;
    if (raio == null || !Number.isFinite(raio) || raio < 7.5) {
      out.push(
        item(
          "lc748_via_sem_saida_praca_retorno",
          "Via sem saída exige praça de retorno",
          "LC 748/2010, Arts. 21 e 28: via sem saída com mais de 30,00 m exige praça de retorno com raio mínimo de 7,50 m.",
        ),
      );
    }
  }

  return out;
}
