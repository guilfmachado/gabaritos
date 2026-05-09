import type { MetricasTerrenoPrecomputadas } from "@/lib/gabarito/metricas-terreno";
import { areaPermeavelParaPercentual, taxaOcupacaoParaPercentual } from "@/lib/gabarito/taxa-ocupacao";
import type { NormaLocal } from "@/types/gabarito";

const FONTE_NORMATIVA_REF = "LC 1.181/2018; LC 751/2010; LC 1.247";

export type BuildVisionPromptOptions = {
  /** Área do terreno (m²) declarada pelo utilizador — base para limite × CA. */
  areaTerrenoM2?: number | null;
  /** Limites calculados no servidor (obrigatório no fluxo Gabarito). */
  metricas?: MetricasTerrenoPrecomputadas | null;
  /** Área construída declarada pelo responsável técnico (quadro de áreas). */
  areaConstruidaProjetoM2?: number | null;
  /** Área permeável proposta declarada pelo responsável técnico. */
  areaPermeavelPropostaM2?: number | null;
  /** Uso declarado pelo usuário (ex.: Residencial, Comercial, Misto). */
  usoImovel?: string | null;
};

/**
 * Prompt multi-passo: matriz 3 colunas, APR/Art. 41, otimização de CA, parâmetros só a partir das colunas oficiais.
 */
export function buildVisionPrompt(zona: string, norma: NormaLocal, options?: BuildVisionPromptOptions): string {
  const rf = norma.recuo_frontal_min;
  const rl = norma.recuo_lateral_min;
  const toPct = taxaOcupacaoParaPercentual(norma.taxa_ocupacao_max);
  const ca = norma.indice_aproveitamento_max;
  const permPct = areaPermeavelParaPercentual(norma.area_permeavel_min);
  const areaTerreno = options?.areaTerrenoM2;
  const m = options?.metricas;
  const areaConstruidaProjeto = options?.areaConstruidaProjetoM2 ?? null;
  const areaPermeavelProposta = options?.areaPermeavelPropostaM2 ?? null;
  const usoImovel = options?.usoImovel?.trim() || null;

  const limiteIndicativo =
    m != null
      ? ""
      : areaTerreno != null && areaTerreno > 0
        ? `Com terreno ≈ ${areaTerreno} m² e CA máximo ${ca}, o limite indicativo de área construída é ≈ ${(areaTerreno * ca).toFixed(1)} m² (terreno × coeficiente). Estime a área construída total (m²) lida na prancha e compare.`
        : "Estime a área construída total (m²) visível na prancha; o utilizador pode não ter declarado a área do terreno.";

  const blocoLimitesServidor =
    m != null
      ? [
          "",
          "=== Limites pré-calculados no sistema (compare com a planta) ===",
          "O servidor calculou os tetos físicos a partir da área do terreno informada e dos parâmetros da zona (valores em m²):",
          `Área do terreno declarada: ${m.area_terreno_m2.toFixed(2)} m².`,
          `- Área máxima construída (terreno × coeficiente de aproveitamento máximo ${ca}): ${m.area_maxima_construida_m2.toFixed(2)} m².`,
          `- Área de projeção máxima (terreno × taxa de ocupação máxima, em fração aplicável à zona): ${m.area_projecao_maxima_m2.toFixed(2)} m².`,
          `- Área permeável necessária mínima (terreno × fração permeável mínima ${permPct}% / Art. 22 LC 751): ${m.area_permeavel_necessaria_m2.toFixed(2)} m².`,
          "Verifique na prancha se a área construída estimada, a projeção no solo e a área permeável (quadras, jardins, passeios permeáveis, etc.) respeitam ou ultrapassam esses limites. Indique inconformidades quando a leitura visual sugerir ultrapassagem.",
          "Trate estes valores como referência operacional para a pré-análise; o memorial e o cadastro municipal prevalecem.",
        ].join("\n")
      : "";

  return [
    "Como especialista técnico da SEPLAN Blumenau, faça uma análise urbanística em camadas desta planta.",
    `Zona urbanística: ${zona}. Fonte normativa de referência: ${FONTE_NORMATIVA_REF}.`,
    "",
    "=== Parâmetros oficiais da zona (base de dados municipal) ===",
    `- Recuo frontal mínimo: ${rf} m`,
    `- Recuo lateral mínimo: ${rl} m`,
    `- Taxa de ocupação máxima: ${toPct}% (valor já em percentagem para leitura humana)`,
    `- Coeficiente de aproveitamento máximo (CA / índice construtivo): ${ca}`,
    `- Área permeável mínima no terreno: ${permPct}%`,
    limiteIndicativo,
    blocoLimitesServidor,
    "",
    "=== Dados técnicos declarados pelo usuário (fonte primária para auditoria cruzada) ===",
    `- Uso do imóvel declarado: ${usoImovel ?? "não informado"}.`,
    `- Área construída declarada no projeto (quadro de áreas): ${areaConstruidaProjeto != null ? `${areaConstruidaProjeto} m²` : "não informada"}.`,
    `- Área permeável proposta: ${areaPermeavelProposta != null ? `${areaPermeavelProposta} m²` : "não informada"}.`,
    "A IA deve atuar como auditora: confronte os números declarados com o que for lido visualmente na prancha e aponte divergências.",
    "Se houver diferença relevante entre área declarada e área lida na prancha, registre explicitamente no texto: 'Divergência de Áreas'.",
    "",
    "=== Definições literais da LC 751/2010 (use estas regras) ===",
    'Taxa de Ocupação (Art. 21): "Relação percentual entre a projeção horizontal da área construída e da área escriturada do terreno."',
    'Área Permeável (Art. 22): "Todo terreno deverá possuir área permeável, revestida com vegetação, na proporção mínima de 20% da área escriturada."',
    "Recuo Frontal (Art. 31): medido a partir do alinhamento predial e das divisas do imóvel.",
    'Recuo Lateral e de Fundos (Art. 35): "Calculado utilizando-se H/6 (altura da edificação sobre seis)."',
    "Filtro de isenções (Art. 31, § 1º): NÃO computar guaritas até 6m², lixeiras e centrais de gás no cálculo de recuo frontal.",
    "",
    "=== Procedimento técnico obrigatório (SEPLAN) ===",
    "1) Identifique a escala na prancha: procure régua gráfica, cotas externas e dimensões globais (ex.: 10,00m x 30,00m).",
    "2) Extraia cotas de todos os compartimentos fechados e liste internamente os ambientes usados no cálculo.",
    "2.1) Localize o Quadro de Áreas na prancha. Extraia 'Área Construída Total' com prioridade.",
    "3) Cálculo de projeção horizontal (Art. 21): some as áreas projetadas para estimar a Taxa de Ocupação.",
    "4) Cálculo de área construída (Art. 20): desconsidere áreas descobertas e canis até 4,00 m².",
    "4.1) Se não houver quadro de áreas, estime por soma aproximada dos polígonos dos ambientes fechados.",
    "5) Se alguma cota estiver parcialmente ilegível, faça aproximação técnica explícita com base nas medidas visíveis.",
    "",
    "=== Geotecnia e risco (LC 751/2010 — Art. 41 e correlatos) ===",
    "Indique, com base apenas no desenho e legendas: (1) se há indícios de Área com Potencial de Risco (APR); (2) se cotas ou textos sugerem pavimentação habitacional abaixo da referência de cota de enchente municipal (use 12 m como referência textual de trabalho quando a prancha mencionar cotas absolutas ou relativas a enchente).",
    "Se inferir uso predominantemente residencial E (APR OU risco de enchimento acima da referência), declare-o explicitamente nos campos boolean abaixo.",
    "",
    "=== FLUXO LÓGICO OBRIGATÓRIO — AUDITORIA PROFUNDA (LC 751/2010) ===",
    "Aplique, nesta ordem, e reflita cada passo no parecer técnico e na matriz:",
    "",
    "1) RECUOS LATERAIS E DE FUNDOS (Art. 35)",
    '   A lei estabelece recuo calculado por H/6, onde H é a altura da edificação. Exemplo numérico obrigatório de raciocínio: se H = 18 m, o recuo lateral mínimo exigido é 18/6 = 3,00 m.',
    "   - Estime H (altura da edificação em m) a partir de cortes, cotas verticais ou pavimentos típicos na prancha, quando visível.",
    "   - Compare com as cotas de recuo lateral e de fundos desenhadas. Se a planta indicar recuo inferior a H/6, registre inconformidade na matriz e no parecer, citando Art. 35.",
    "",
    "2) RISCO E USO RESIDENCIAL (Art. 41)",
    "   - Se o uso declarado pelo usuário for 'Residencial' (ou inferir uso residencial predominante) E a zona urbanística indicar APR ou ARCO (ou a prancha/legenda indicar área de risco compatível), você DEVE:",
    "     a) Incluir em `alertas_criticos` um objeto com severidade 'critico', codigo BLOQUEIO_OCUPACAO ou RISCO_ART41, e mensagem que contenha EXATAMENTE a frase literal: Proibido uso residencial abaixo da cota 12m",
    "     b) Repetir a fundamentação no `parecer_tecnico_llama` citando Art. 41, I.",
    "",
    "3) PERMEABILIDADE (Art. 22)",
    '   A LC 751 exige mínimo de 20% da área escriturada como área permeável vegetada.',
    "   - Confronte a área permeável declarada pelo usuário (se houver) e o desenho (lotes permeáveis, jardins) com o mínimo de " +
      `${permPct}% do terreno informado pelo sistema.`,
    "   - Se houver déficit aparente, registre na matriz e no parecer com citação ao Art. 22.",
    "",
    "4) OTIMIZAÇÃO DE ÁREA CONSTRUÍDA (potencial × CA)",
    "   - Se a área construída estimada (ou declarada coerente com a planta) for MENOR que o limite (terreno × CA máximo) informado acima, em `otimizacao_sugestao_ia` sugira onde o projeto pode ganhar área (ex.: ampliação de suítes, varandas técnica, novo pavimento dentro do envelope), sempre lembrando:",
    "     • respeito à Taxa de Ocupação e aos recuos;",
    "     • Art. 35-A: afastamento mínimo de 1,50 m para vãos de portas e janelas em relação ao alinhamento frontal e aos recuos obrigatórios, ao propor novas aberturas ou fachadas.",
    "",
    "=== Formato de resposta (JSON único, sem markdown) ===",
    "A análise principal deve incluir uma matriz em três colunas conceituais:",
    "1) medida_identificada — o que observou na planta;",
    "2) regra_lc751 — parâmetro da lista oficial acima que se aplica;",
    "3) status_conformidade — conforme | inconforme | revisar.",
    "Guarde essas linhas no array `matriz_conformidade` (máximo 12 linhas, sem duplicar o mesmo ambiente).",
    "",
    "Inclua `otimizacao_sugestao_ia` (string): conforme item 4 acima; se o aproveitamento já estiver no limite, resuma em uma frase.",
    "",
    "Chave OBRIGATÓRIA `parecer_tecnico_llama` (string): texto contínuo, em português, como parecer de auditor urbanístico.",
    "  - Para CADA inconformidade, divergência ou risco relevante que você identificar, escreva um parágrafo (ou item numerado) explicando o achado em linguagem humana e citando o artigo específico da LC 751/2010 (ex.: Art. 35, Art. 41, Art. 22, Art. 35-A).",
    "  - Se não houver achados negativos, declare a conformidade aparente com relação aos pontos analisados e cite os artigos verificados.",
    "  - Não copie o JSON no parecer; apenas narrativa técnica.",
    "",
    "Demais chaves obrigatórias do JSON:",
    "analise_texto (string), divergencias_resumo (string),",
    "matriz_conformidade: [{ medida_identificada, regra_lc751, status_conformidade }],",
    "itens: [{ id, rotulo, status: conforme|inconforme|revisar, detalhe? }] (máx. 12, tópicos urbanísticos reais),",
    "area_construida_estimada_ia_m2 (número OBRIGATÓRIO; nunca null. Se necessário, use aproximação técnica baseada nas cotas visíveis),",
    "altura_edificacao_estimada_m (número ou null) — melhor estimativa de H em metros para o cálculo H/6, se impossível null,",
    "divergencia_area_declarada_m2 (número; diferença entre área declarada e área estimada pela IA, quando houver dado declarado),",
    "inferencia_area_potencial_risco (boolean), inferencia_cota_enchente_12m (boolean), inferencia_uso_residencial (boolean),",
    "otimizacao_sugestao_ia (string), parecer_tecnico_llama (string).",
    "Opcional: alertas_criticos: [{ codigo, severidade, titulo, mensagem }] — use quando Art. 41 exigir alerta literal.",
    "",
    "Não use barras invertidas antes de _ nas chaves. Sem cercas de código.",
  ].join("\n");
}
