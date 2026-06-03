// ═══════════════════════════════════════════════════════════
// supabase/functions/trecho-analisar — Tradutor (Bloco 3 + Plano 2026-05-18)
// ═══════════════════════════════════════════════════════════
//
// Recebe um trecho fechado (~5 s) e devolve um pacote padronizado que
// alimenta os 3 Command Box · Visão Engenheiro:
//
//   • Lambda Track State Advisor (aprovado 2026-05-15)
//   • PAce Torque Delivery Advisor (aprovado 2026-05-15)
//   • Motor Health Advisor (novo, irmão dos 2)
//
// O pacote leva 4 blocos:
//   1. genérico (cor, frase, causa, top oportunidade, evidência)
//   2. lambda (sonda, alvo, estado da mistura, proposta de ajuste)
//   3. pace (torque entregue vs esperado pela curva oficial)
//   4. motorHealth (saúde do motor por trecho, faixa de RPM, pendência)
//   5. cadeia (contadores das 3 etapas — Engenheiro · Equipe · Injeção)
//
// Honesto: sem T4000 (RPM/pedal/marcha/sonda reais), os campos derivados
// vêm como `null` e os advisors caem no estado "sem dado de sonda" /
// "sem T4000" que cada um já tem desenhado. O pipeline funciona seco.

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { CELTA_BUBI_2026_05_18 } from "./dyno-curve.ts";
import {
  classificarCausa,
  AmostraTrecho,
  CarroConfig,
  LIMIARES_DEFAULT,
  Limiares,
} from "./classificar-causa.ts";
import { priorizarTrechos } from "./priorizar-trecho.ts";
import { detectarMotorDecaindo, LeituraHistorica } from "./motor-decair.ts";
import { aceleracaoTeorica } from "./aceleracao-teorica.ts";

// ─────────────────────────────────────────────────────────────
// Tipos do contrato HTTP
// ─────────────────────────────────────────────────────────────

interface AnaliseRequest {
  trechoId: string;
  amostras: AmostraTrecho[];
  identificacao: {
    carroId: string;
    configId: string;
    pilotoId: string;
    eventoId: string;
  };
  carro: CarroConfig;
  historicoTrecho?: LeituraHistorica[];
  limiares?: Partial<Limiares>;
  /** Hint do tipo de trecho ("Reta" | "Curva" | "Aceleração" | "Plena carga") */
  tipoTrecho?: string;
  /** Estado da cadeia de aprovação (vem do banco — contadores das 3 etapas). */
  cadeia?: { engenheiro: number; equipe: number; injecao: number };
}

export interface BlocoLambda {
  /** λ alvo configurado pra esse tipo de trecho (0.88 reta / 0.92 curva). */
  lambdaAlvo: number;
  /** λ medido pela sonda (média da janela). `null` quando T4000 ausente. */
  lambdaMedida: number | null;
  /** 0..1 — confiança da leitura (queda em duty alto, ruído alto, etc.) */
  confianca: number | null;
  /** "correta" | "rica" | "pobre" | "sem_dado" */
  estadoMistura: "correta" | "rica" | "pobre" | "sem_dado";
  /** "leve" | "forte" | "critica" | null */
  severidadeMistura: "leve" | "forte" | "critica" | null;
  /** Sugestão de ajuste percentual de bico (vem da regra do Lambda Advisor). */
  propostaAjusteBicoPct: number | null;
}

export interface BlocoPace {
  /** Torque ENTREGUE pela roda (estimado pela aceleração real). */
  torqueEntregueNm: number | null;
  /** Torque ESPERADO pela curva do dinamômetro nesse RPM. */
  torqueEsperadoNm: number | null;
  /** Torque Delivery Index — relação entre entregue e esperado (0..1+). */
  tdiAtual: number | null;
  /** TDI esperado pra esse tipo de trecho (default 0.95+). */
  tdiEsperado: number;
  /** Sugestão de ajuste do avanço de ignição (em graus). */
  sugestaoAjusteIgnicaoGrau: number | null;
  /** Estimativa de ganho em segundos se TDI subir pro esperado. */
  ganhoEstimadoSegPace: number;
}

export interface BlocoMotorHealth {
  /** 0..1 — fração da janela em que motor ficou entre 4.500 e 6.300 RPM. */
  fracaoNaBandaIdeal: number | null;
  /** Quantas amostras passaram do teto físico 6.350 RPM. */
  picosAcimaTeto: number | null;
  /** RPM médio da janela. `null` quando T4000 ausente. */
  rpmMedio: number | null;
  /** Histograma de tempo por faixa de 500 RPM (1.500 a 7.000) — 11 valores. */
  distribuicaoFaixasRpm: number[] | null;
}

export interface BlocoCadeia {
  engenheiro: number;
  equipe: number;
  injecao: number;
}

export interface AnaliseResponse {
  trechoId: string;
  // ── bloco genérico ──
  cor: "verde" | "amarelo" | "vermelho";
  frase: string;
  topOportunidade: {
    descricao: string;
    ganhoEstimadoSeg: number;
  };
  causaProvavel: string;
  deltaAcumuladoMs2: number;
  evidencia: string;
  criarPendencia: boolean;
  sugestaoPendencia: string | null;
  // ── blocos especializados ──
  lambda: BlocoLambda;
  pace: BlocoPace;
  motorHealth: BlocoMotorHealth;
  cadeia: BlocoCadeia;
}

// ─────────────────────────────────────────────────────────────
// Helpers de cálculo dos blocos especializados
// ─────────────────────────────────────────────────────────────

const FRASES_POR_CAUSA: Record<string, string> = {
  motor_abaixo: "Carro entregou menos do que devia neste trecho.",
  marcha_baixa: "Saiu da curva em marcha curta demais.",
  pedal_parcial: "Sem ir até o fundo no acelerador.",
  cambio_escorregando: "Câmbio ou embreagem escorregou — checar mecânica.",
  indeterminado: "Trecho dentro do esperado.",
};

/** Faixas de RPM a cada 500 (1.500 a 7.000) — espelha `faixasRpm500` do Swift. */
const FAIXAS_RPM = [
  [1500, 2000], [2000, 2500], [2500, 3000], [3000, 3500],
  [3500, 4000], [4000, 4500], [4500, 5000], [5000, 5500],
  [5500, 6000], [6000, 6500], [6500, 7000],
];

function calcularBlocoLambda(amostras: AmostraTrecho[], tipoTrecho: string | undefined): BlocoLambda {
  // λ alvo simplificado: 0.88 em reta/aceleração, 0.92 em curva.
  const alvo = (tipoTrecho || "").toLowerCase().includes("curva") ? 0.92 : 0.88;

  // Como `AmostraTrecho` hoje não carrega `lambda`, o bloco fica em "sem dado"
  // até o T4000 entrar. Quando entrar, basta estender `AmostraTrecho` com
  // `lambdaMedida` e a média entra aqui.
  const medidasComLambda: number[] = [];
  for (const _a of amostras) {
    // placeholder pra extensão futura
  }
  if (medidasComLambda.length === 0) {
    return {
      lambdaAlvo: alvo,
      lambdaMedida: null,
      confianca: null,
      estadoMistura: "sem_dado",
      severidadeMistura: null,
      propostaAjusteBicoPct: null,
    };
  }
  const medida = medidasComLambda.reduce((s, v) => s + v, 0) / medidasComLambda.length;
  const erro = medida - alvo;
  let estado: BlocoLambda["estadoMistura"] = "correta";
  let sev: BlocoLambda["severidadeMistura"] = null;
  const abs = Math.abs(erro);
  if (abs > 0.10) { sev = "critica"; estado = erro > 0 ? "rica" : "pobre"; }
  else if (abs > 0.04) { sev = "forte"; estado = erro > 0 ? "rica" : "pobre"; }
  else if (abs > 0.02) { sev = "leve"; estado = erro > 0 ? "rica" : "pobre"; }
  // Proposta: ajuste linear de ~6% por 0.04 de erro
  const proposta = -Math.round(erro * 150) / 10; // -6.0..+6.0 etc.
  return {
    lambdaAlvo: alvo,
    lambdaMedida: medida,
    confianca: 0.90,
    estadoMistura: estado,
    severidadeMistura: sev,
    propostaAjusteBicoPct: estado === "correta" ? null : proposta,
  };
}

function calcularBlocoPace(
  amostras: AmostraTrecho[],
  carro: CarroConfig,
  tipoTrecho: string | undefined
): BlocoPace {
  // Pra calcular TDI precisa de RPM + marcha + aceleração real.
  // Sem T4000 (rpm = 0 / marcha = 0), devolve nulos.
  const comRpm = amostras.filter(a => a.rpm > 0 && a.marcha > 0);
  const tdiEsperado = (tipoTrecho || "").toLowerCase().includes("curva") ? 0.90 : 0.95;
  if (comRpm.length === 0) {
    return {
      torqueEntregueNm: null,
      torqueEsperadoNm: null,
      tdiAtual: null,
      tdiEsperado,
      sugestaoAjusteIgnicaoGrau: null,
      ganhoEstimadoSegPace: 0,
    };
  }
  // Média da janela
  let somaEsperado = 0;
  let somaEntregue = 0;
  let n = 0;
  for (const a of comRpm) {
    const r = aceleracaoTeorica({
      rpm: a.rpm,
      relacaoMarcha: carro.relacoesMarcha[a.marcha - 1] ?? 0,
      relacaoFinal: carro.relacaoFinal,
      raioPneuM: carro.raioPneuM,
      massaKg: carro.massaKg,
      velocidadeKmh: a.velocidadeKmh,
      curva: carro.curva,
    });
    if (!r) continue;
    somaEsperado += r.torqueMotorNm;
    // Torque ENTREGUE estimado pela aceleração real:
    // a_real = F_liquida / massa → F_tração_real = a_real × massa + arrasto + rolamento
    // Torque na roda = F_tração_real × raio_pneu → torque motor = torque_roda / (relMarcha × relFinal)
    const forcaTracaoReal = a.aceleracaoRealMs2 * carro.massaKg + r.forcaArrastoN + r.forcaRolamentoN;
    const torqueMotorReal =
      (forcaTracaoReal * carro.raioPneuM) /
      ((carro.relacoesMarcha[a.marcha - 1] ?? 1) * carro.relacaoFinal);
    somaEntregue += torqueMotorReal;
    n++;
  }
  if (n === 0) {
    return {
      torqueEntregueNm: null, torqueEsperadoNm: null, tdiAtual: null,
      tdiEsperado, sugestaoAjusteIgnicaoGrau: null, ganhoEstimadoSegPace: 0,
    };
  }
  const torqueEntregue = somaEntregue / n;
  const torqueEsperado = somaEsperado / n;
  const tdi = torqueEsperado > 0 ? torqueEntregue / torqueEsperado : 0;
  // Sugestão simplificada: cada 0.05 de TDI abaixo do esperado = +1° de avanço
  const gapTdi = tdiEsperado - tdi;
  const sugestaoGrau = gapTdi > 0.03 ? Math.round(gapTdi * 20) : null;
  // Ganho estimado: gap × 0.4 s (heurística inicial)
  const ganho = Math.max(0, gapTdi) * 0.4;
  return {
    torqueEntregueNm: Math.round(torqueEntregue * 10) / 10,
    torqueEsperadoNm: Math.round(torqueEsperado * 10) / 10,
    tdiAtual: Math.round(tdi * 100) / 100,
    tdiEsperado,
    sugestaoAjusteIgnicaoGrau: sugestaoGrau,
    ganhoEstimadoSegPace: Math.round(ganho * 100) / 100,
  };
}

function calcularBlocoMotorHealth(amostras: AmostraTrecho[]): BlocoMotorHealth {
  const rpms = amostras.map(a => a.rpm).filter(r => r > 0);
  if (rpms.length === 0) {
    return {
      fracaoNaBandaIdeal: null,
      picosAcimaTeto: null,
      rpmMedio: null,
      distribuicaoFaixasRpm: null,
    };
  }
  const dentro = rpms.filter(r => r >= 4500 && r < 6300).length;
  const picos = rpms.filter(r => r > 6350).length;
  const rpmMedio = rpms.reduce((s, v) => s + v, 0) / rpms.length;
  const dist = FAIXAS_RPM.map(([min, max]) =>
    rpms.filter(r => r >= min && r < max).length
  );
  return {
    fracaoNaBandaIdeal: Math.round((dentro / rpms.length) * 100) / 100,
    picosAcimaTeto: picos,
    rpmMedio: Math.round(rpmMedio),
    distribuicaoFaixasRpm: dist,
  };
}

// ─────────────────────────────────────────────────────────────
// Construção da resposta (função pura — usada por testes)
// ─────────────────────────────────────────────────────────────

export function montarResposta(req: AnaliseRequest): AnaliseResponse {
  const limiares = { ...LIMIARES_DEFAULT, ...(req.limiares ?? {}) };
  const classificacao = classificarCausa(req.amostras, req.carro, limiares);

  const tInicio = req.amostras[0]?.t ?? 0;
  const tFim = req.amostras[req.amostras.length - 1]?.t ?? tInicio;
  const tempoTrechoS = Math.max(0.1, tFim - tInicio);

  const priorizados = priorizarTrechos([
    { trechoId: req.trechoId, classificacao, tempoTrechoS },
  ]);
  const top = priorizados[0];

  let cor: "verde" | "amarelo" | "vermelho";
  if (classificacao.deltaAcumuladoMs2 < 0.5) cor = "verde";
  else if (classificacao.deltaAcumuladoMs2 < 2.0) cor = "amarelo";
  else cor = "vermelho";

  let criarPendencia = false;
  let sugestaoPendencia: string | null = null;
  if (req.historicoTrecho && req.historicoTrecho.length > 0) {
    const md = detectarMotorDecaindo([
      ...req.historicoTrecho,
      {
        evento: req.identificacao.eventoId,
        data: new Date().toISOString(),
        trechoId: req.trechoId,
        causa: classificacao.causa,
        deltaAcumuladoMs2: classificacao.deltaAcumuladoMs2,
      },
    ]);
    criarPendencia = md.decaindo;
    sugestaoPendencia = md.sugestaoPendencia;
  }

  // Blocos especializados
  const lambda = calcularBlocoLambda(req.amostras, req.tipoTrecho);
  const pace = calcularBlocoPace(req.amostras, req.carro, req.tipoTrecho);
  const motorHealth = calcularBlocoMotorHealth(req.amostras);
  const cadeia: BlocoCadeia = req.cadeia ?? { engenheiro: 0, equipe: 0, injecao: 0 };

  return {
    trechoId: req.trechoId,
    cor,
    frase: FRASES_POR_CAUSA[classificacao.causa] ?? "Sem informação.",
    topOportunidade: {
      descricao: `${classificacao.causa} (${classificacao.evidencia})`,
      ganhoEstimadoSeg: top?.ganhoEstimadoSeg ?? 0,
    },
    causaProvavel: classificacao.causa,
    deltaAcumuladoMs2: classificacao.deltaAcumuladoMs2,
    evidencia: classificacao.evidencia,
    criarPendencia,
    sugestaoPendencia,
    lambda,
    pace,
    motorHealth,
    cadeia,
  };
}

// ─────────────────────────────────────────────────────────────
// Construtor de defaults pro carro Celta Bubi
// ─────────────────────────────────────────────────────────────

export function celtaBubiCarroPadrao(): CarroConfig {
  return {
    relacoesMarcha: [3.92, 2.05, 1.36, 0.95, 0.76],
    relacaoFinal: 4.27,
    raioPneuM: 0.289,
    massaKg: 908,
    curva: CELTA_BUBI_2026_05_18,
  };
}

// ─────────────────────────────────────────────────────────────
// Validação
// ─────────────────────────────────────────────────────────────

export function validar(body: any): { ok: boolean; reason?: string } {
  if (!body || typeof body !== "object") return { ok: false, reason: "body-invalido" };
  if (typeof body.trechoId !== "string" || body.trechoId.length === 0)
    return { ok: false, reason: "trechoId-faltando" };
  if (!Array.isArray(body.amostras) || body.amostras.length === 0)
    return { ok: false, reason: "amostras-vazias" };
  if (typeof body.identificacao !== "object" || body.identificacao === null)
    return { ok: false, reason: "identificacao-faltando" };
  if (typeof body.carro !== "object" || body.carro === null)
    return { ok: false, reason: "carro-faltando" };
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// HTTP handler
// ─────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "metodo-nao-permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "json-invalido" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const v = validar(body);
  if (!v.ok) {
    return new Response(JSON.stringify({ error: v.reason }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  if (!body.carro.curva || !Array.isArray(body.carro.curva.samples)) {
    body.carro.curva = CELTA_BUBI_2026_05_18;
  }

  const resposta = montarResposta(body as AnaliseRequest);
  return new Response(JSON.stringify(resposta), {
    status: 200,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

// Só sobe o servidor quando o arquivo é executado direto. Quando é
// importado por testes (ou pelo serve-local.ts), só expõe `handler`.
if (import.meta.main) {
  serve(handler);
}
