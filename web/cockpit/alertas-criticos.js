// alertas-criticos.js — monitora as amostras vivas (T4000 + T3000 + GPS) e
// dispara as 20 mensagens críticas do catálogo aprovado v1.
//
// Spec / decisões de produto:
//   - reference_p1fast_mensagens_criticas_painel_piloto_v1 (catálogo de 20
//     mensagens aprovado por Flávio em 27/05/2026).
//   - Vermelhas piscam, amarelas e azuis ficam fixas.
//   - Sobrepõem mensagens de pilotagem enquanto a condição existir.
//   - Não somem por tempo — só quando o sensor volta ao normal.
//
// Catálogo aprovado:
//   01 ÁGUA QUENTE       — water > limit
//   02 ÓLEO QUENTE       — oilTemp > limit
//   03 ÓLEO BAIXO        — oilPress < minimo com rpm > 2000
//   04 ESCAPE QUENTE     — egt > limit
//   05 MISTURA POBRE     — lambda > limit_pobre
//   06 MISTURA RICA      — lambda < limit_rica
//   07 DETONAÇÃO         — knock detectado
//   08 FALHANDO          — misfire detectado
//   09 BATERIA           — battery < min
//   10 COMBUSTÍVEL       — fuel < 15%
//   11 ENCHE AGORA       — fuel < 5%
//   12 PNEU QUENTE       — tireTemp > limit (se sensor disponível)
//   13 PNEU MURCHO       — tirePress queda rápida (se sensor disponível)
//   14 RODA TRAVOU       — slip ratio extremo no freio (T3000 ou IMU)
//   15 FREIO QUENTE      — discTemp > limit (se sensor disponível)
//   16 PISTA SUJA        — derrapagem repetida no mesmo trecho
//   17 BOX               — comando externo
//   18 SEM GPS           — qualidade do GPS caiu
//   19 ÚLTIMA VOLTA      — comando externo
//   20 SEM DADOS         — bridge perdeu T4000

import { MsgTipo } from './cockpit-state.js';

// ── Limites canônicos (calibráveis por carro) ──
//
// Bubi (Celta 1.4) — limites iniciais conservadores em
// docs/hardware/T4000_CAN_SPEC.md. Sempre que houver dado por carro no banco,
// usar esse em vez do default.

export const ALERTA_LIMITES_DEFAULT = Object.freeze({
  // Bubi opera FRIO (config superdimensionada de refrigeração).
  // Decisão Flávio 27/05/2026: ideal 50°C, preditivo 70°C, crítico 80°C.
  waterIdealC:      50,
  waterPredictivoC: 70,    // dispara MOTOR AQUECENDO
  waterMaxC:        80,    // dispara MOTOR QUENTE (crítico absoluto)
  // Padrão preditivo por padrão histórico (decisão Flávio 27/05/2026):
  // 3 voltas estabelecem padrão; desvio de 20% acima ou abaixo dispara.
  desvioPadraoPct:  0.20,
  voltasMinPraPadrao: 3,
  cambioTempMaxC:   140,   // limite duro CÂMBIO QUENTE (sensor a instalar)
  oilTempMaxC:      130,
  oilPressMinBar:   0.5,
  oilPressRpmMin:   2000,
  egtMaxC:          900,    // Bubi com sonda WB — ajustar com calibração
  lambdaPobre:      1.15,   // mistura > 1.15 = pobre demais
  lambdaRica:       0.80,   // mistura < 0.80 = rica demais
  batteryMinV:      11.8,
  fuelLowPct:       15,
  fuelCriticoPct:   5,
  tireTempMaxC:     120,
  tirePressMinBar:  1.6,
  discTempMaxC:     500,
  gpsAccMaxM:       30,     // accuracy > 30m = "sem GPS confiável"
  noT4000TimeoutMs: 2000,   // sem amostra T4000 nesse tempo = "SEM DADOS"
});

// Catálogo v2 aprovado por Flávio em 27/05/2026 (substitui v1).
// Níveis de gravidade:
//   'super'    — escandaloso, esconde o painel inteiro
//   'critico'  — sobrepõe mensagens de pilotagem, mantém painel
//   'atencao'  — informa sem alarme
//   'info'     — operacional
export const ALERTAS = Object.freeze({
  // ─── Super crítico (9) ───
  MOTOR_AQUECENDO:  { id: 'MOTOR_AQUECENDO',  texto: 'MOTOR AQUECENDO', gravidade: 'super' },
  MOTOR_QUENTE:     { id: 'MOTOR_QUENTE',     texto: 'MOTOR QUENTE',    gravidade: 'super' },
  OLEO_BAIXO:       { id: 'OLEO_BAIXO',       texto: 'ÓLEO BAIXO',      gravidade: 'super' },
  COMBUSTIVEL_BAIXO_CRITICO: { id: 'COMBUSTIVEL_BAIXO_CRITICO', texto: 'COMBUSTÍVEL BAIXO', gravidade: 'super' },
  PNEU_AQUECENDO:   { id: 'PNEU_AQUECENDO',   texto: 'PNEU AQUECENDO',  gravidade: 'super' },
  PRESSAO_PNEU:     { id: 'PRESSAO_PNEU',     texto: 'PRESSÃO PNEU',    gravidade: 'super' },
  PNEU_QUENTE:      { id: 'PNEU_QUENTE',      texto: 'PNEU QUENTE',     gravidade: 'super' },
  CAMBIO_AQUECENDO: { id: 'CAMBIO_AQUECENDO', texto: 'CÂMBIO AQUECENDO',gravidade: 'super' },
  CAMBIO_QUENTE:    { id: 'CAMBIO_QUENTE',    texto: 'CÂMBIO QUENTE',   gravidade: 'super' },

  // ─── Crítico (3) ───
  MOTOR_ESFRIANDO:  { id: 'MOTOR_ESFRIANDO',  texto: 'MOTOR ESFRIANDO', gravidade: 'critico' },
  MISTURA_POBRE:    { id: 'MISTURA_POBRE',    texto: 'MISTURA POBRE',   gravidade: 'critico' },
  SEM_DADOS:        { id: 'SEM_DADOS',        texto: 'SEM DADOS',       gravidade: 'critico' },

  // ─── Atenção (4) ───
  COMBUSTIVEL_BAIXO:{ id: 'COMBUSTIVEL_BAIXO',texto: 'COMBUSTÍVEL BAIXO', gravidade: 'atencao' },
  MISTURA_RICA:     { id: 'MISTURA_RICA',     texto: 'MISTURA RICA',    gravidade: 'atencao' },
  FALHANDO:         { id: 'FALHANDO',         texto: 'FALHANDO',        gravidade: 'atencao' },
  BATERIA:          { id: 'BATERIA',          texto: 'BATERIA',         gravidade: 'atencao' },

  // ─── Informação (3) ───
  BOX:              { id: 'BOX',              texto: 'BOX',             gravidade: 'info' },
  ULTIMA_VOLTA:     { id: 'ULTIMA_VOLTA',     texto: 'ÚLTIMA VOLTA',    gravidade: 'info' },
  SEM_GPS:          { id: 'SEM_GPS',          texto: 'SEM GPS',         gravidade: 'info' },
});

// ── Avaliadores puros — recebem amostra + limites, retornam alertas ativos ──

/**
 * Avalia uma amostra T4000 contra os limites e retorna a lista de ids de
 * alertas que devem estar ativos com base nessa amostra.
 */
export function avaliarT4000(sample, limits = ALERTA_LIMITES_DEFAULT) {
  if (!sample) return [];
  const ativos = [];

  // ─── Motor (água do sistema de refrigeração) ───
  if (typeof sample.waterTempC === 'number') {
    if (sample.waterTempC >= limits.waterMaxC) {
      ativos.push('MOTOR_QUENTE');         // ≥80°C — crítico absoluto
    } else if (sample.waterTempC >= limits.waterPredictivoC) {
      ativos.push('MOTOR_AQUECENDO');      // ≥70°C — preditivo
    }
  }

  // ─── Óleo (T3000 só fornece bit booleano de baixa pressão) ───
  if (sample.alarmes?.baixaPressaoOleo === true
      && typeof sample.rpm === 'number'
      && sample.rpm > limits.oilPressRpmMin) {
    ativos.push('OLEO_BAIXO');
  }

  // ─── Lambda (mistura ar/combustível) ───
  if (typeof sample.lambda === 'number') {
    if (sample.lambda > limits.lambdaPobre) ativos.push('MISTURA_POBRE');
    if (sample.lambda < limits.lambdaRica)  ativos.push('MISTURA_RICA');
  }

  // ─── Cilindros desbalanceados (deriva pra FALHANDO) ───
  if (sample.fuelInjectionBalanced === false) ativos.push('FALHANDO');

  // ─── Bateria ───
  if (typeof sample.batteryV === 'number' && sample.batteryV < limits.batteryMinV) {
    ativos.push('BATERIA');
  }

  // ─── Combustível (T3000 só fornece bits) ───
  // baixaPressaoCombustivel + alertaNivelCombustivel = nível crítico (5%)
  // alertaNivelCombustivel sozinho = atenção (15%)
  if (sample.alarmes?.alertaNivelCombustivel === true) {
    if (sample.alarmes?.baixaPressaoCombustivel === true) {
      ativos.push('COMBUSTIVEL_BAIXO_CRITICO');
    } else {
      ativos.push('COMBUSTIVEL_BAIXO');
    }
  }

  // ─── Pneu (TPMS — quando o sensor for instalado) ───
  if (typeof sample.tireTempMaxC === 'number' && sample.tireTempMaxC > limits.tireTempMaxC) {
    ativos.push('PNEU_QUENTE');
  }

  // ─── Câmbio (quando sensor for instalado) ───
  if (typeof sample.cambioTempC === 'number' && sample.cambioTempC > limits.cambioTempMaxC) {
    ativos.push('CAMBIO_QUENTE');
  }

  return ativos;
}

/**
 * Avaliador preditivo por padrão histórico.
 *
 * @param {Object} amostraVoltaAtual  Valor médio/máx da volta atual: { motorMaxC, pneuMaxC, pneuMinPressBar, cambioMaxC }
 * @param {Object} padrao             Padrão estabelecido em 3+ voltas: { motor:{media}, pneu:{tempMedia, pressMedia}, cambio:{media} }
 * @param {number} desvioPct          Default 0.20 (20%)
 */
export function avaliarPreditivoPorPadrao(amostraVoltaAtual, padrao, desvioPct = 0.20) {
  const ativos = [];
  if (!amostraVoltaAtual || !padrao) return ativos;

  // Padrão só vale com 3+ voltas COM a métrica (decisão Flávio 27/05: "aprende
  // padrão em 3 voltas"). Sem isso, voltas antigas do banco SEM temperatura
  // contavam pro mínimo e a média armava com 1 volta só — meia volta fria de
  // aquecimento virava o "padrão" e tudo depois disparava falso (provado 10/06).
  const nOk = (m) => m && m.media > 0 && (m.n == null || m.n >= 3);

  // Motor — preditivo acima (aquecendo) e abaixo (esfriando = trinca radiador)
  if (typeof amostraVoltaAtual.motorMaxC === 'number' && nOk(padrao.motor)) {
    const limiteAlto = padrao.motor.media * (1 + desvioPct);
    const limiteBaixo = padrao.motor.media * (1 - desvioPct);
    if (amostraVoltaAtual.motorMaxC > limiteAlto) ativos.push('MOTOR_AQUECENDO');
    else if (amostraVoltaAtual.motorMaxC < limiteBaixo) ativos.push('MOTOR_ESFRIANDO');
  }

  // Pneu — temperatura acima
  if (typeof amostraVoltaAtual.pneuMaxC === 'number' && padrao.pneu?.tempMedia > 0
      && (padrao.pneu.n == null || padrao.pneu.n >= 3)) {
    const limite = padrao.pneu.tempMedia * (1 + desvioPct);
    if (amostraVoltaAtual.pneuMaxC > limite) ativos.push('PNEU_AQUECENDO');
  }

  // Pneu — pressão caindo (queda de 20% do padrão)
  if (typeof amostraVoltaAtual.pneuMinPressBar === 'number' && padrao.pneu?.pressMedia > 0
      && (padrao.pneu.n == null || padrao.pneu.n >= 3)) {
    const limite = padrao.pneu.pressMedia * (1 - desvioPct);
    if (amostraVoltaAtual.pneuMinPressBar < limite) ativos.push('PRESSAO_PNEU');
  }

  // Câmbio — preditivo acima
  if (typeof amostraVoltaAtual.cambioMaxC === 'number' && nOk(padrao.cambio)) {
    const limite = padrao.cambio.media * (1 + desvioPct);
    if (amostraVoltaAtual.cambioMaxC > limite) ativos.push('CAMBIO_AQUECENDO');
  }

  return ativos;
}

/**
 * Avalia o GPS — se accuracy degradada ou ausente, dispara SEM_GPS.
 */
export function avaliarGps(sample, limits = ALERTA_LIMITES_DEFAULT) {
  if (!sample) return ['SEM_GPS'];
  if (typeof sample.accM === 'number' && sample.accM > limits.gpsAccMaxM) {
    return ['SEM_GPS'];
  }
  return [];
}

// ── Orquestrador ──

/**
 * AlertasCriticos — mantém o conjunto de alertas ativos no momento. Quando
 * o conjunto muda, chama onChange com os ids ativos. Cabe ao consumidor
 * priorizar (critico > atencao > info) e exibir o de maior gravidade.
 *
 * Uso:
 *   const ac = new AlertasCriticos({ limits, onChange: (ativos)=>{...} });
 *   ac.ingestT4000(sample);
 *   ac.ingestGps(sample);
 *   ac.tick(); // chamar a cada amostra ou via setInterval, pra timeout de SEM_DADOS
 *   ac.raiseManual('BOX');   // do comando externo do mecânico
 *   ac.clearManual('BOX');
 */
export class AlertasCriticos {
  constructor({ limits = ALERTA_LIMITES_DEFAULT, onChange = () => {} } = {}) {
    this._limits = limits;
    this._onChange = onChange;
    this._ativos = new Set();
    this._manuais = new Set();
    this._preditivos = new Set(); // ids subidos pelo padrão histórico (fonte própria)
    this._lastT4000T = null;
    this._derrapagemPorTrecho = new Map(); // trechoId -> contagem
  }

  ingestT4000(sample) {
    this._lastT4000T = (sample && typeof sample.t === 'number') ? sample.t : Date.now();
    const ids = avaliarT4000(sample, this._limits);
    this._set(ids, 'auto-t4000');
  }

  ingestGps(sample) {
    const ids = avaliarGps(sample, this._limits);
    // mantém SEM_GPS no conjunto, sem mexer nos T4000
    if (ids.includes('SEM_GPS')) this._add('SEM_GPS');
    else this._remove('SEM_GPS');
  }

  /** Conta derrapagens por trecho — se passar limiar, dispara PISTA_SUJA. */
  registrarDerrapagem(trechoId) {
    const n = (this._derrapagemPorTrecho.get(trechoId) ?? 0) + 1;
    this._derrapagemPorTrecho.set(trechoId, n);
    if (n >= 3) this._add('PISTA_SUJA');
  }

  /** Chamado periodicamente (ex: a cada 500ms) pra detectar timeout do T4000. */
  tick(now = Date.now()) {
    if (this._lastT4000T == null) return;
    if (now - this._lastT4000T > this._limits.noT4000TimeoutMs) {
      this._add('SEM_DADOS');
    } else {
      this._remove('SEM_DADOS');
    }
  }

  raiseManual(id) { this._add(id); this._manuais.add(id); }
  clearManual(id) { this._manuais.delete(id); this._remove(id); }

  getAtivos() {
    // retorna em ordem de gravidade: super > critico > atencao > info
    const order = { super: 0, critico: 1, atencao: 2, info: 3 };
    return [...this._ativos].sort((a, b) => {
      const ga = ALERTAS[a]?.gravidade ?? 'info';
      const gb = ALERTAS[b]?.gravidade ?? 'info';
      return order[ga] - order[gb];
    });
  }

  /** Pega o alerta de maior gravidade pra mostrar no painel (ou null). */
  getMensagemPrincipal() {
    const ativos = this.getAtivos();
    if (ativos.length === 0) return null;
    const a = ALERTAS[ativos[0]];
    if (!a) return null;
    return {
      id: a.id,
      texto: a.texto,
      gravidade: a.gravidade,
      tipo: (a.gravidade === 'super' || a.gravidade === 'critico') ? MsgTipo.GRAVE : MsgTipo.COMUNICACAO,
      countOutros: ativos.length - 1,
    };
  }

  // ── internos ──

  _set(ids, fonte) {
    // substitui o conjunto vindo dessa fonte sem mexer nos manuais e em
    // alertas de outras fontes (SEM_GPS por exemplo, vem do GPS).
    // catálogo v2 — só os ids que avaliarT4000 + avaliarPreditivoPorPadrao geram
    const automaticosConhecidos = [
      'MOTOR_AQUECENDO','MOTOR_QUENTE','MOTOR_ESFRIANDO',
      'OLEO_BAIXO','MISTURA_POBRE','MISTURA_RICA','FALHANDO','BATERIA',
      'COMBUSTIVEL_BAIXO','COMBUSTIVEL_BAIXO_CRITICO',
      'PNEU_AQUECENDO','PNEU_QUENTE','PRESSAO_PNEU',
      'CAMBIO_AQUECENDO','CAMBIO_QUENTE',
    ];
    let mudou = false;
    for (const id of automaticosConhecidos) {
      const deveriaEstar = ids.includes(id);
      const ja = this._ativos.has(id);
      if (deveriaEstar && !ja) { this._ativos.add(id); mudou = true; }
      else if (!deveriaEstar && ja && !this._manuais.has(id)) {
        this._ativos.delete(id); mudou = true;
      }
    }
    if (mudou) this._onChange(this.getAtivos());
  }

  _add(id) {
    if (this._ativos.has(id)) return;
    this._ativos.add(id);
    this._onChange(this.getAtivos());
  }
  _remove(id) {
    if (!this._ativos.has(id)) return;
    if (this._manuais.has(id)) return; // manuais só somem via clearManual
    this._ativos.delete(id);
    this._onChange(this.getAtivos());
  }
}
