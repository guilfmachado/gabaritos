/** Resposta resumida legada (Dropzone / ações). */
export type PlantaAnaliseIA = {
  status: "Aprovado" | "Pendente";
  resumo: string;
  pendencias: string[];
};

export type ChecklistStatus = "conforme" | "inconforme" | "revisar";

export type ChecklistItem = {
  id: string;
  rotulo: string;
  status: ChecklistStatus;
  detalhe?: string;
};

/** Linha da matriz tripla (medida | regra LC | conformidade). */
export type MatrizConformidadeLinha = {
  medida_identificada: string;
  regra_lc751: string;
  /** Fonte rastreável da regra aplicada (ex.: Plano Diretor - Art. 20, Zoneamento - Zona ZR4). */
  origem_legal?: string;
  status_conformidade: string;
};

/** Art. 13/20 — potencial construtivo indicativo com CA da zona. */
export type PotencialArt1320 = {
  area_terreno_m2: number;
  coeficiente_aproveitamento_max: number;
  limite_area_construida_m2: number;
  area_construida_estimada_ia_m2: number | null;
  utilizacao_coeficiente_pct: number | null;
  status: ChecklistStatus;
  nota_tecnica: string;
};

export type AlertaCriticoUrbano = {
  codigo: string;
  severidade: "critico" | "alerta";
  titulo: string;
  mensagem: string;
};

export type GabaritoEngineSeverity = "CRITICAL" | "WARNING" | "INFO";
export type GabaritoEngineViolation = {
  id: string;
  severity: GabaritoEngineSeverity;
  pillar: string;
  title: string;
  message: string;
  law: string;
  article: string;
  measured?: number | string | null;
  limit?: number | string | null;
};

export type GabaritoEngineSnapshot = {
  isAprovado: boolean;
  violations: GabaritoEngineViolation[];
};

export type NormaVigenciaStatus = "ativo" | "revogado" | "substituido";
export type RestricaoUsoSoloStatus = "nao_informado" | "sem_restricao" | "liberada_com_restricao" | "em_estudo" | "interditado";

export type ValorReferenciaFiscal = {
  valor: number;
  ano_fiscal: number;
  moeda: "BRL";
  fonte_legal: string;
};

export type CalculoContrapartidaUsoSolo = {
  norma_id: string;
  status: NormaVigenciaStatus;
  formula: "CF = ACD * VR";
  acd_m2: number;
  vr: ValorReferenciaFiscal;
  substituido_por?: string;
};

export type ParametrosViaDecreto9155 = {
  gabarito_via_m: number;
  simetria: "simetrica" | "assimetrica" | "desnivel" | "nao_informado";
  distancia_eixo_ao_alinhamento_m?: number | null;
};

export type AlinhamentoViaDecreto9155 = {
  distancia_eixo_ao_alinhamento_m: number | null;
  distancia_eixo_ate_recuo_edificacao_m: number | null;
  exige_projeto_oficial_via: boolean;
  nota_tecnica: string;
};

export type RebaixoAcessoVeicularLc748 = {
  largura_m: number;
  afastamento_divisa_m?: number | null;
};

export type ValidacaoRebaixosLc748Input = {
  testada_m: number;
  rebaixos: RebaixoAcessoVeicularLc748[];
  distancias_entre_rebaixos_m?: number[];
  uso_especial?: "posto_combustivel" | "logistica_5_ou_mais_caminhoes" | "outro";
  nao_residencial_rua_sem_estacionamento?: boolean;
};

export type ViaLoteamentoLc748Input = {
  uso_loteamento: "residencial" | "outro";
  extensao_via_m: number;
  gabarito_via_m: number;
  sem_saida?: boolean;
  raio_praca_retorno_m?: number | null;
  possui_via_transversal_ate_30m_final?: boolean;
};

export type CompartimentoLc1247 = {
  nome: string;
  tipo: "permanencia_prolongada" | "permanencia_transitoria";
  area_piso_m2: number;
  pe_direito_m?: number | null;
  area_iluminacao_m2?: number | null;
  area_ventilacao_m2?: number | null;
  possui_exaustao_mecanica?: boolean;
};

export type EscadaLc1247 = {
  uso: "coletivo" | "privativo" | "manutencao";
  largura_m?: number | null;
  espelho_cm?: number | null;
  piso_cm?: number | null;
  helicoidal?: boolean;
};

export type ValidacaoZoneamentoLc751Input = {
  area_terreno_m2: number;
  area_projecao_horizontal_m2?: number | null;
  area_permeavel_m2?: number | null;
  recuo_frontal_m?: number | null;
  afastamento_lateral_m?: number | null;
  parede_lindeira_tem_aberturas?: boolean | null;
};

/** Metadados gravados com o snapshot no `status_checklist` (além dos itens da IA). */
export type ChecklistEntradaPersistida = {
  area_terreno_m2: number;
};

/** Cópia persistida de `MetricasTerrenoPrecomputadas` (evita import circular types ↔ lib). */
export type MetricasTerrenoSnapshot = {
  area_terreno_m2: number;
  area_maxima_construida_m2: number;
  area_projecao_maxima_m2: number;
  area_permeavel_necessaria_m2: number;
};

/** Saída estruturada da camada Llama Vision (extração da prancha). */
export type ExtracaoVisaoLlama = {
  /** Soma / área construída total lida no quadro de áreas (prioridade na extração). */
  area_construida_total_m2: number | null;
  /** Projeção horizontal no terreno (numerador da taxa de ocupação — Art. 21). */
  area_projecao_horizontal_m2: number | null;
  /** Legado / espelho: igual a total quando só um valor existe na prancha. */
  area_construida_estimada_m2: number | null;
  taxa_ocupacao_estimada_pct: number | null;
  recuo_frontal_m: number | null;
  recuo_lateral_m: number | null;
  recuo_fundos_m: number | null;
  altura_edificacao_estimada_m: number | null;
  area_permeavel_estimada_m2: number | null;
  uso_predominante_planta: string;
  observacoes_extracao: string;
};

export type StatusChecklist = {
  version?: number;
  updatedAt?: string;
  /** Extração visual (Llama 3.2 Vision) antes da auditoria 70B. */
  extracao_visao?: ExtracaoVisaoLlama | null;
  /** Indica se o parser precisou usar fallback textual/heurístico. */
  modo_fallback?: boolean;
  /** Valores de entrada da análise (persistência). */
  entrada?: ChecklistEntradaPersistida;
  /** Cópia das métricas calculadas no servidor antes da Replicate. */
  metricas_servidor?: MetricasTerrenoSnapshot;
  /** Potencial construtivo não utilizado (m²), alinhado à coluna homónima. */
  area_restante_potencial_m2?: number | null;
  itens: ChecklistItem[];
  analise_bruta?: string;
  divergencias_resumo?: string;
  /** Matriz 3 colunas (saída estruturada do modelo). */
  matriz_conformidade?: MatrizConformidadeLinha[];
  /** Texto de otimização sugerido pela IA e/ou regra dos 80% do CA. */
  otimizacao_sugestao_ia?: string;
  /**
   * Parecer técnico narrativo (Llama / visão): explicação fundamentada por inconformidade,
   * citando artigos da LC 751/2010.
   */
  parecer_tecnico_llama?: string;
  /** Inferências declaradas pelo modelo (boolean). */
  inferencia_area_potencial_risco?: boolean | null;
  inferencia_cota_enchente_12m?: boolean | null;
  inferencia_uso_residencial?: boolean | null;
  area_construida_estimada_ia_m2?: number | null;
  potencial?: PotencialArt1320;
  alertas_criticos?: AlertaCriticoUrbano[];
  validation_engine?: GabaritoEngineSnapshot;
};

/** Colunas oficiais de `normas_locais` usadas pelo Gabarito. */
export const NORMAS_LOCAIS_COLUMNS =
  "id, zona_urbanistica, recuo_frontal_min, recuo_lateral_min, taxa_ocupacao_max, indice_aproveitamento_max, area_permeavel_min, coeficiente_aproveitamento_basico, coeficiente_aproveitamento_maximo, taxa_ocupacao, taxa_permeabilidade, recuo_frontal, afastamento_lateral_fundos, observacao" as const;

/** Linha de `normas_locais`. */
export type NormaLocal = {
  id: string;
  zona_urbanistica: string;
  recuo_frontal_min: number;
  recuo_lateral_min: number;
  taxa_ocupacao_max: number;
  indice_aproveitamento_max: number;
  area_permeavel_min: number;
  coeficiente_aproveitamento_basico: number;
  coeficiente_aproveitamento_maximo: number;
  taxa_ocupacao: number;
  taxa_permeabilidade: number;
  recuo_frontal: number;
  afastamento_lateral_fundos: string;
  observacao: string | null;
};

export type ProjetoRow = {
  id: string;
  created_at: string;
  updated_at: string;
  nome: string | null;
  zona_urbanistica: string;
  inscricao_imobiliaria: string | null;
  status_checklist: StatusChecklist | Record<string, unknown>;
  planta_url: string | null;
  imagem_planta_url: string | null;
  resultado_ia: string | null;
  ultima_analise_ia: string | null;
  user_id?: string | null;
  area_terreno_m2?: number | null;
  area_restante_potencial_m2?: number | null;
};
