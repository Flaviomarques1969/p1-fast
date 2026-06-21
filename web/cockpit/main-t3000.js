// main-t3000.js — bootstrap do cockpit ao vivo lendo a Injepro T3000
// direto via WebUSB. Roda em p1t4000.vercel.app.
//
// Fluxo:
//   1. Usuário clica "Autorizar T3000".
//   2. Página manda ACK e espera "OK".
//   3. Loop a 10Hz: manda RI → recebe bloco → decodifica → alimenta bridge.
//   4. Renderer atualiza o painel canônico (shift light, alertas, etc).

import { CockpitState, ApexEstado } from './cockpit-state.js';
import { attachRendererToDocument } from './cockpit-renderer.js';
import { LiveDataBridge, DEFAULT_LIMITS } from './live-data-bridge.js';
import { parseT3000RIBlock, ACK_BYTES, RI_BYTES, isAckOk, leituraPlausivel } from './t3000-usb-parser.js';
import { startCloudBridge, publishSample, publishEvento, onStatusChange, onGpsPoint, getStats } from './cloud-bridge.js';
import { loadDynoCurve, loadGearRatios, BUBI_CARRO_ID } from './dyno-loader.js';
import { TrechoDetector } from './trecho-detector.js';
import { AlertasCriticos } from './alertas-criticos.js';
import { calcularDelta } from './delta-calculator.js';
import { PadraoAcumulador } from './padrao-acumulador.js';
import { ChegadaDetector, loadMarcoChegada } from './chegada-detector.js';
import { BoxDetector, loadMarcosBox } from './box-detector.js';
// ── Shift light v2 (3 modos + cruzamento de força + aprendizado online) ──
// Decisão Flávio 2026-05-29. Plugado em 2026-05-29 conforme auditoria severa.
import { criarShiftLightOrquestrador } from './shift-light-orquestrador.js';
import { ModoStint } from './shift-light-modos.js';
// ── Mensagens pedagógicas (17 aprovadas em 27/05/2026) ──
import { criarEmpurradorDeMensagens } from './mensagens-pedagogicas.js';
// ── Watchdog do conversor T3000 (queda de sinal → alerta visual no painel) ──
import { criarT3000Watchdog } from './t3000-watchdog.js';
// ── Orientação por trecho (autorização Flávio 09/06: coreografia + tela v3) ──
import { OportunidadeTrecho } from './oportunidade-trecho.js';
import { criarTelaOrientacao } from './tela-orientacao.js';
import { CoreografiaVolta } from './coreografia-volta.js';
// Agente VIVO de classificação de curva (Flávio 13/06): a cada passagem fechada, classifica o
// trecho e PROPÕE mudar o tipo quando a evolução é consistente. Persistência LOCAL (não a nuvem).
import { criarClassificadorVivo } from './classificador-vivo-bridge.js';
import { carregarTipoCurvaPorTrecho } from './tipo-trecho-loader.js';
// ── Treino de técnica (Stint Revestido — autorização Flávio 11/06) ──
import { resolvePlanoStint, buscarPlanoStintDaNuvem, TreinoStint } from './treino-stint.js';
// ── Cockpit em modo treino TRAIL BRAKING (ditado 11-12/06, mockup VIVO) ──
import { TrailCockpitMotor } from './trail-cockpit-motor.js';
import { criarTrailCockpitTela } from './trail-cockpit-tela.js';
import { APICES_SEMENTE_BRASILIA } from './apices-semente-brasilia.js';
import { onSample } from './cloud-bridge.js';
import { criarGravador, criarStoreIndexedDB, criarStoreMemoria, estimarArmazenamento } from './session-recorder.js';
// segments-loader/melhores-loader importam Supabase via esm.sh — dynamic
// import dentro da IIFE evita quebra em smoke Node.

// ── Gravador de sessão (motor na ORIGEM: 10 Hz, amostra completa + bytes crus) ──
// Conserta o gap da auditoria 20/06: o motor só sobrevivia a 5 Hz e reduzido (via
// canal). Aqui grava a amostra INTEIRA do parser + os bytes crus, append-only, no
// IndexedDB local — sem tocar no layout do painel do piloto. Export pelo helper do
// console (window.__P1_BAIXAR_SESSAO__). Banco próprio do cockpit (separado da Central).
const RecCockpit = criarGravador({ store: criarStoreIndexedDB('p1fast-sessoes-cockpit') });
const _hexBytes = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += u8[i].toString(16).padStart(2, '0'); return s; };
try { setInterval(() => { try { RecCockpit.tick(); } catch (e) {} }, 1000); } catch (e) {}
(async () => {
  try {
    const orfas = await RecCockpit.recuperarOrfas();
    if (orfas.length) console.info('[gravador-cockpit] sessão anterior recuperada:', orfas[0]);
  } catch (e) {}
})();
if (typeof window !== 'undefined') {
  window.__P1_REC__ = RecCockpit;
  window.__P1_BAIXAR_SESSAO__ = async (id) => {
    try {
      const lista = await RecCockpit.listarSessoes();
      const alvo = id || (lista.slice().sort((a, b) => (b.fimWall || b.inicioWall || 0) - (a.fimWall || a.inicioWall || 0))[0] || {}).id;
      if (!alvo) { console.warn('[gravador-cockpit] nenhuma sessão gravada'); return; }
      const dump = await RecCockpit.exportarSessao(alvo);
      const blob = new Blob([JSON.stringify(dump, null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = alvo + '.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      console.info('[gravador-cockpit] baixou', dump.amostras.length, 'amostras de', alvo);
    } catch (e) { console.warn('[gravador-cockpit] falha ao baixar:', e); }
  };
}

// ── Blindagem contra perda silenciosa (decisão Flávio 21/06) ─────────────────
// O painel do piloto é SÓ ação: em operação normal NADA novo aparece. Só quando a
// gravação do motor falha de verdade (armazenamento morto, descarte de amostra) ou
// o espaço do notebook fica crítico é que surge uma faixa vermelha no topo — porque
// perder o dado do motor em silêncio é o pior caso. A faixa some sozinha quando
// normaliza. A saúde também fica em window.__P1_SESSAO_SAUDE__ (sai no export/console).
(function blindagemGravacaoCockpit() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  let faixa = null;
  function mostrar(txt) {
    if (!faixa) {
      faixa = document.createElement('div');
      faixa.id = 'p1-alarme-gravacao';
      faixa.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#b91c1c;' +
        'color:#fff;font:700 14px system-ui,sans-serif;padding:8px 12px;text-align:center;letter-spacing:.3px';
      document.body.appendChild(faixa);
    }
    faixa.textContent = txt;
    faixa.style.display = 'block';
  }
  function esconder() { if (faixa) faixa.style.display = 'none'; }
  async function vigia() {
    try {
      // No painel real olha a gravação real; em modo teste (?teste=1) olha a de teste.
      const rec = (window.__P1_TESTE_REC__ && window.__P1_TESTE_REC__.estado) ? window.__P1_TESTE_REC__ : RecCockpit;
      const e = rec.estado();
      const esp = await estimarArmazenamento();
      window.__P1_SESSAO_SAUDE__ = { alarme: e.alarme, dropped: e.dropped, ativo: e.ativo, espaco: esp };
      let msg = null;
      if (e.alarme === 'parada-armazenamento')
        msg = 'GRAVAÇÃO DO MOTOR PAROU — o armazenamento do notebook falhou. O dado NÃO está sendo guardado.';
      else if (e.alarme === 'perdendo-amostras')
        msg = 'GRAVAÇÃO PERDENDO AMOSTRAS DO MOTOR (' + e.dropped + '). Verifique o espaço/erro do navegador.';
      else if (esp.suportado && esp.nivel === 'critico')
        msg = 'ESPAÇO DO NOTEBOOK QUASE CHEIO (' + esp.pct + '%). Baixe e libere as sessões antigas.';
      if (msg) { console.error('[gravador-cockpit] ALARME:', msg, window.__P1_SESSAO_SAUDE__); mostrar(msg); }
      else esconder();
    } catch (e) {}
  }
  try { setInterval(vigia, 4000); vigia(); } catch (e) {}
})();

// ── Identificação do carro ativo ───────────────────────────────
// Bubi é o único carro hoje. Pra plugar outro carro no futuro, basta definir
// window.__P1_CARRO_ID__ no HTML ou gravar em localStorage. Default = Bubi.
function resolveCarroAtivo() {
  try {
    if (typeof window !== 'undefined' && typeof window.__P1_CARRO_ID__ === 'string' && window.__P1_CARRO_ID__) {
      return window.__P1_CARRO_ID__;
    }
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('p1fast-carro-ativo');
      if (stored) return stored;
    }
  } catch {}
  return BUBI_CARRO_ID;
}
const CARRO_ATIVO = resolveCarroAtivo();

// ── Modo de stint inicial — lê localStorage gravado pela tela de configuração ──
// Padrão escolhido por Flávio em 2026-05-29 via card de decisão: AGRESSIVO.
// Justificativa: ganho de ~0,4 s por volta no limite mecânico (6.250-6.350 rpm).
// Auto-rebaixa pra NORMAL se água < temperatura mínima do envelope (proteção).
function resolveModoStintInicial() {
  try {
    if (typeof localStorage !== 'undefined') {
      const m = localStorage.getItem('p1fast-modo-stint-v1');
      if (m === ModoStint.DURABILIDADE || m === ModoStint.NORMAL || m === ModoStint.AGRESSIVO) {
        return m;
      }
    }
  } catch {}
  return ModoStint.AGRESSIVO;
}

// ── Calibração inicial Bubi (dinamômetro Lenza Powerchips 2026-05-18) ──
// Valores DEFAULT — sobrescritos pela curva da nuvem quando carregar.
const BUBI_LIMITS = {
  ...DEFAULT_LIMITS,
  redlineRpm: 6300,      // regra: NÃO passar de 6.350 (queda abrupta após)
  peakTorqueRpm: 5200,   // pico de torque conhecido do dinamômetro (default seguro)
  torqueLitOffsetRpm: 300, // acende a 300 rpm antes do pico
};

// ── Setup do painel ───────────────────────────────────────────
const cockpitState = new CockpitState();
attachRendererToDocument(cockpitState, document);

// ── Treino de técnica armado pelo Planejamento do Stint (11/06) ──
// O painel passa a LER o plano gravado (precedente: p1fast-modo-stint-v1).
// Plano ausente, "livre" ou "testar" → painel byte-idêntico ao de hoje.
// ?treino=<foco> arma sem Planejamento (validação de bancada, só leitura).
let _planoStint = resolvePlanoStint();
let treinoStint = null;
if (_planoStint?.proposito === 'treinar' && _planoStint.foco) {
  try { treinoStint = new TreinoStint({ foco: _planoStint.foco, plano: _planoStint }); }
  catch (e) { console.warn('[treino] não armou:', e?.message); }
}

// ── Orientação por trecho (coreografia 09/06) ─────────────────
const oportunidade = new OportunidadeTrecho();
if (treinoStint) {
  oportunidade.setFoco({
    subs: treinoStint.subsFoco(),
    usaVmin: !!treinoStint.treino.usaVmin,
    degrauFn: (difM, segId) => treinoStint.aplicarDegrau(difM, segId),
  });
}

// Plano viaja com o envelope (11/06): sem plano local (notebook do carro não é
// a máquina onde o chefe aprovou), busca o plano do último envelope na nuvem.
// Chegando, arma o treino tarde: motor + foco da orientação + filtro + selo.
// Nuvem sem plano / sem rede / banco antigo → painel padrão, idêntico ao de hoje.
if (!_planoStint) {
  buscarPlanoStintDaNuvem({ carroId: CARRO_ATIVO }).then((planoNuvem) => {
    if (!planoNuvem || treinoStint) return;
    _planoStint = planoNuvem;
    if (planoNuvem.proposito !== 'treinar' || !planoNuvem.foco) return;
    try { treinoStint = new TreinoStint({ foco: planoNuvem.foco, plano: planoNuvem }); }
    catch (e) { console.warn('[treino] não armou (nuvem):', e?.message); return; }
    oportunidade.setFoco({
      subs: treinoStint.subsFoco(),
      usaVmin: !!treinoStint.treino.usaVmin,
      degrauFn: (difM, segId) => treinoStint.aplicarDegrau(difM, segId),
    });
    empurrarMsgPedagogica.setFiltro((msg, ev) => treinoStint.filtroMensagem(msg, ev));
    atualizarSeloTreino();
    if (window.__t3) { window.__t3.treinoStint = treinoStint; window.__t3.planoStint = _planoStint; }
    log(`treino armado: ${treinoStint.seloTexto()} (origem: nuvem — plano do último envelope aprovado hoje)`);
    tentarArmarTrailCockpit(); // trechos podem já ter carregado antes do plano
  }).catch((e) => console.warn('[treino] fallback da nuvem falhou:', e?.message));
}
const telaOrientacao = criarTelaOrientacao({});
let coreografia = null;

// ── Cockpit em modo treino TRAIL BRAKING ──────────────────────
// O treino MONTA a tela (ditado 11/06): com foco trail-braking armado E os
// trechos+melhores carregados, a camada visual própria é criada. Sem treino
// trail, NADA é criado — painel byte-idêntico (mesma regra do treino v1).
let trailCockpit = null;   // { motor, tela } quando armado
let _trailCtx = null;      // { ordenados, melhores } — preenchido na carga
// A3: rótulo de honestidade da FONTE do freio, fora do palco. Troca sozinho de
// FÍSICA GPS pra SENSOR quando o canal de pressão/pedal do T4000 começa a variar.
function atualizarSeloFonteFreio(fonte) {
  const selo = $('seloTreino');
  if (!selo) return;
  const rot = fonte === 'sensor-pressao' ? 'FREIO: SENSOR (pressão)'
            : fonte === 'sensor-pedal'   ? 'FREIO: SENSOR (pedal)'
            : 'FREIO: FÍSICA GPS';
  const base = selo.textContent.replace(/\s·\sFREIO:.*$/, ''); // troca só o sufixo da fonte
  selo.textContent = base + ' · ' + rot;
  selo.title = (typeof fonte === 'string' && fonte.startsWith('sensor'))
    ? `Curva de freio vinda do SENSOR de ${fonte === 'sensor-pressao' ? 'pressão' : 'pedal'} (T4000), fundida por tempo (±250 ms).`
    : 'Curva de freio derivada da física real do GPS (rotulada) até o sensor de pressão entrar (instalação 15-16/06).';
}
function tentarArmarTrailCockpit() {
  if (trailCockpit) return;
  if (!treinoStint || treinoStint.treino?.id !== 'trail-braking') return;
  if (!_trailCtx) return;
  try {
    const motor = new TrailCockpitMotor({
      segments: _trailCtx.ordenados,
      refs: _trailCtx.melhores,
      storage: (typeof localStorage !== 'undefined') ? localStorage : null,
      // par da blindagem (mesmo padrão do bridge): replay/simulador nunca
      // ensina a reação aprendida nem grava no armazenamento
      origemSimulador: () => !!window.__P1_ORIGEM_SIM__,
    });
    const tela = criarTrailCockpitTela({ cockpitState });
    tela._setAlvoResolver((segId) => motor.alvoDoTrecho(segId));
    motor.onRender((s) => tela.render(s));
    motor.onEfeito((e) => {
      // a metade da reta é do gráfico de frenagem: o resumo da volta
      // (overlay de tela cheia) sai de cena quando a aproximação entra
      if (e?.tipo === 'aproximacao') telaOrientacao.esconder();
      // A3: o sensor de freio acendeu/apagou — troca o rótulo de honestidade da fonte
      if (e?.tipo === 'fonte-freio') atualizarSeloFonteFreio(e.fonteFreio);
      tela.efeito(e);
    });
    trailCockpit = { motor, tela };
    tela.render(motor.snapshot());
    if (window.__t3) window.__t3.trailCockpit = trailCockpit;
    const armados = _trailCtx.ordenados.filter(sg => motor.alvoDoTrecho(sg.id)).length;
    log(`cockpit-treino TRAIL armado: ${armados}/${_trailCtx.ordenados.length} trechos com alvo de frenagem da melhor passagem`);
    // rótulo de fonte FORA do palco (regra de honestidade do freio-trecho.js):
    // até o sensor de pressão entrar, a curva de freio vem da física do GPS.
    // Acende sozinho pra SENSOR quando o canal começa a variar (A3 · efeito fonte-freio).
    if (!$('seloTreino')?.textContent.includes('FREIO:')) atualizarSeloFonteFreio(motor.fonteFreio());
  } catch (e) { console.warn('[trail-cockpit] não armou:', e?.message); }
}
// tempos de volta locais (pro resumo na reta longa)
const voltas = { n: null, inicioTs: null, ultimaS: null, melhorS: null };

// ── Voltas REAIS na nuvem (autorização Flávio 10/06) ──────────
let _sessaoAberta = null;       // cache da sessão aberta do stint
let _sessaoBuscadaEm = 0;
let _persistStats = null;       // contador da fábrica do persister (1º uso cria)
const _voltasPendentes = [];    // repescagem: volta que falhou tenta de novo na próxima chegada
async function persistirVoltaReal({ numero, tempoMs, inicioAt }) {
  try {
    const { acharSessaoAberta, gravarVoltaReal, criarContadorPersistencia } =
      await import('./voltas-persister.js');
    if (!_persistStats) _persistStats = criarContadorPersistencia();
    // revalida o cache: sem sessão re-busca a cada 60 s; COM sessão reconfere a
    // cada 2 min — pega stint novo aberto no app e solta stint fechado
    // (o cache antigo nunca invalidava; auditoria 10/06).
    const idade = Date.now() - _sessaoBuscadaEm;
    if ((!_sessaoAberta && idade > 60000) || (_sessaoAberta && idade > 120000)) {
      _sessaoBuscadaEm = Date.now();
      _sessaoAberta = await acharSessaoAberta(CARRO_ATIVO);
    }
    // fila de tentativa: a volta atual entra; o que falhou antes sai junto
    _voltasPendentes.push({ numero, tempoMs, inicioAt });
    while (_voltasPendentes.length > 20) _voltasPendentes.shift(); // teto de sanidade
    if (!_sessaoAberta) {
      _persistStats.semSessao++;
      if (_persistStats.semSessao === 1) {
        log('volta real NÃO gravada: nenhum stint aberto no app (abra o stint pra contagem valer; fica na repescagem)');
      }
      return;
    }
    // grava tudo que está pendente (a atual + repescagens), na ordem
    const fila = _voltasPendentes.splice(0, _voltasPendentes.length);
    for (const v of fila) {
      const okGravou = await gravarVoltaReal({ sessao: _sessaoAberta, ...v });
      if (okGravou) {
        _persistStats.gravadas++;
        log(`volta ${v.numero} gravada na sessão ${String(_sessaoAberta.id).slice(0, 8)}`);
      } else {
        _persistStats.recusadas++;
        _voltasPendentes.push(v); // volta pra repescagem
        _sessaoAberta = null;     // pode ter fechado/perdido permissão — re-busca na próxima
        if (_persistStats.recusadas === 1) {
          log('volta real NÃO gravada: banco recusou (permissão em decisão; fica na repescagem)');
        }
        break; // sem sessão válida, não adianta insistir nas demais agora
      }
    }
  } catch (e) { log('erro ao gravar volta real: ' + e.message); }
}
/** Mensagem que ATROPELA a orientação: só níveis super/crítico.
 *  Avisos de atenção/info convivem com a tela (calibrado 10/06 — alerta
 *  preditivo constante escondia a orientação 2x/segundo no replay). */
function mensagemGraveAtiva() {
  const m = alertasCriticos.getMensagemPrincipal();
  return m && (m.gravidade === 'super' || m.gravidade === 'critico') ? m : null;
}
function fmtVolta(v) {
  if (v == null || !(v > 0)) return null;
  const m = Math.floor(v / 60);
  return `${m}:${(v - m * 60).toFixed(1).padStart(4, '0')}`;
}

// Engines plugáveis (decisão Flávio 27/05/2026 — passo A). Detector é
// instanciado depois que track_segments carrega via Supabase.
let trechoDetector = null;
const alertasCriticos = new AlertasCriticos({
  onChange: () => {
    const msg = alertasCriticos.getMensagemPrincipal();
    if (mensagemGraveAtiva()) telaOrientacao.esconder(); // só GRAVE atropela a orientação
    if (!msg) { cockpitState.hideMessage(); return; }
    cockpitState.showMessage({ tipo: msg.tipo, texto: msg.texto });
  },
});
setInterval(() => alertasCriticos.tick(), 500);

// Empurrador das 17 mensagens pedagógicas (decisão Flávio 27/05/2026).
// Plugado nos eventos delta-calculado + apice-passagem disparados pelo bridge.
// Com treino armado, o filtro segura mensagens fora do foco (válvula: erro
// grave fora do foco fura 1 vez — decisão Flávio 11/06).
const empurrarMsgPedagogica = criarEmpurradorDeMensagens({
  cockpitState,
  filtro: treinoStint ? (msg, ev) => treinoStint.filtroMensagem(msg, ev) : null,
});

// Orquestrador shift light v2 — instanciado quando a curva carrega.
let shiftOrquestrador = null;
let _modoStintAtual = resolveModoStintInicial();

// Estado compartilhado: último segmento da volta (preenchido após carga).
let padraoAcumulador = null;
let _ultimoSegmentId = null;
let chegadaDetector = null;
let boxDetector = null;
let _ctxConfig = { carroId: CARRO_ATIVO, trackId: null, layoutId: null, tipoPneu: null };
// Agente vivo de classificação de curva (instanciado após carregar os segmentos). Null-safe:
// se não montar, o resto do cockpit segue normal.
let classificadorVivo = null;
// Padrão DEFINITIVO do Flávio (13/06) por nome de curva — fonte de verdade: migration 0043 /
// _decisao-flavio-padrao-curvas-2026-06-13.json. Fallback do tipo APROVADO enquanto o banco lido
// (produção) ainda não tem a coluna tipo_curva (carregarTipoCurvaPorTrecho retorna {} sem ela).
const PADRAO_TIPO_CURVA = {
  'CURVA 01': 'T5', 'CURVA DA RETA OPOSTA': 'T1', 'CURVA 2': 'T0', 'CURVA DA JUNÇÃO': 'T2',
  'CURVA DA BRUXA': 'T0', 'CURVA DO PLACAR': 'T2', 'CURVA "S"': 'T4', 'CURVA DA VITÓRIA': 'SF',
};

const bridge = new LiveDataBridge({
  cockpitState,
  limits: BUBI_LIMITS,
  alertasCriticos,
  deltaCalculator: calcularDelta,
  // Passagem de simulador nunca vira referência local nem vai pro banco
  // (par local da blindagem __P1_ORIGEM_SIM__ — sem isso o replay trocava a
  // referência pela volta 1 do simulador e o delta zerava nas seguintes).
  origemSimulador: () => !!window.__P1_ORIGEM_SIM__,
  onSalvarPassagem: async ({ segmentId, tempoS, pontos }) => {
    if (window.__P1_ORIGEM_SIM__) { log('passagem NÃO salva (origem: simulador)'); return; }
    if (!_ctxConfig.carroId || !_ctxConfig.trackId || !_ctxConfig.tipoPneu) return;
    try {
      const { gravarPassagem } = await import('./melhores-loader.js');
      const gravou = await gravarPassagem({
        carroId:     _ctxConfig.carroId,
        autodromoId: _ctxConfig.trackId,
        layoutId:    _ctxConfig.layoutId,
        segmentId,
        tipoPneu:    _ctxConfig.tipoPneu,
        tempoS,
        pontos,
      });
      // gravarPassagem devolve false quando o banco recusa (ex.: trava de acesso
      // só-time barra o painel anônimo) — antes o log dizia "salva" sem conferir
      // e num dia de pista real ninguém perceberia a perda (achado 10/06).
      if (gravou) log(`passagem salva: ${segmentId.slice(0,8)} ${tempoS.toFixed(2)}s`);
      else log(`passagem NÃO gravada (banco recusou — ver acesso): ${segmentId.slice(0,8)} ${tempoS.toFixed(2)}s`);
    } catch (e) { log('erro ao salvar passagem: ' + e.message); }
  },
  onTrechoEvent: (ev) => {
    if (!ev) return;
    if (coreografia) coreografia.evento(ev);
    // Cockpit-treino trail: o motor consome os MESMOS eventos do detector
    // (entrada/freada/ápice/saída/passagem-fechada) — nada novo é inventado.
    if (trailCockpit) { try { trailCockpit.motor.evento(ev); } catch {} }
    if (ev.type === 'delta-calculado') {
      oportunidade.registrarDelta(ev);
      // Motor pedagógico do treino: consistência, falhas, consolidação.
      if (treinoStint) treinoStint.registrarDelta(ev);
    }
    if (ev.type === 'apice-cruzou') oportunidade.registrarApice(ev);
    // Ponto de freada REAL (metros desde a entrada) — era medido e morria
    // órfão; vira a métrica do treino de frenagem (conserto 11/06).
    if (ev.type === 'freada-iniciou' && treinoStint) treinoStint.registrarFreada(ev);
    // Nova melhor passagem na sessão → a marca OURO da orientação passa a
    // apontar pra ELA (antes ficava na referência do boot até recarregar).
    if (ev.type === 'passagem-salva' && ev.ref) {
      oportunidade.setReferencia(ev.segmentId, ev.ref);
      // Cockpit-treino trail: o alvo de frenagem do trecho também passa a ser
      // a nova melhor (é assim que a régua nasce com dado denso no dia de pista).
      if (trailCockpit && Array.isArray(ev.ref.pontos)) {
        try { trailCockpit.motor.atualizarReferencia(ev.segmentId, ev.ref.pontos); } catch {}
      }
    }
    // Toda passagem fechada (melhor ou não) vira o hábito mais recente do
    // piloto — antes só as "novas melhores" alimentavam as marcas VOCÊ.
    if (ev.type === 'passagem-fechada') {
      oportunidade.registrarPassagem({ segmentId: ev.segmentId, pontos: ev.pontos, vminKmh: ev.vminKmh });
      // Agente VIVO: classifica esta passagem e acumula. Guardado — nunca quebra o cockpit.
      if (classificadorVivo) {
        try {
          classificadorVivo.aoFecharPassagem({
            segmentId: ev.segmentId, pontos: ev.pontos, vminKmh: ev.vminKmh,
            contexto: { tipo_pneu: _ctxConfig.tipoPneu },
          });
        } catch (e) { log('classificador vivo: ' + e.message); }
      }
    }
    // Espelha eventos básicos pro canal da nuvem (tela ASSISTIR no app).
    if (ev.type === 'entrada-cruzou') {
      publishEvento({ tipo: 'trecho', segmentId: ev.segmentId });
    }
    if (ev.type === 'delta-calculado' && typeof ev.deltaTotalS === 'number') {
      publishEvento({ tipo: 'delta', segmentId: ev.segmentId, deltaS: ev.deltaTotalS });
    }
    if (ev.type === 'apice-cruzou') {
      const dist  = typeof ev.distFromIdealM === 'number' ? ev.distFromIdealM : null;
      const angle = typeof ev.angleFromIdealDeg === 'number' ? ev.angleFromIdealDeg : null;
      const estado = (dist != null && dist <= 1.5) ? ApexEstado.OK_MELHOR
                   : (dist != null) ? ApexEstado.OK_PIOR : ApexEstado.PENDENTE;
      cockpitState.setApexPonto('apice', { estado, distM: dist, angleDeg: angle });
      // Alimenta contexto do empurrador pra próxima mensagem pedagógica
      empurrarMsgPedagogica.setUltimoApice(ev);
    }
    // Quando entra no trecho, informa o orquestrador (Onda 8: flash IA + tipos).
    if (ev.type === 'entrada-cruzou' && shiftOrquestrador) {
      try { shiftOrquestrador.setTrechoAtual(ev.segmentId); } catch {}
    }
    // delta-calculado → empurra mensagem pedagógica das 17 aprovadas.
    // NUNCA por cima de alerta super/crítico: a pedagógica escrevia por cima
    // de MOTOR AQUECENDO no mostrador e o piloto perdia o aviso (achado 10/06).
    if (ev.type === 'delta-calculado' && !mensagemGraveAtiva()) {
      try { empurrarMsgPedagogica(ev); } catch {}
    }
    if (!chegadaDetector && ev.type === 'saida-cruzou'
        && padraoAcumulador && ev.segmentId === _ultimoSegmentId) {
      padraoAcumulador.fecharVolta();
    }
  },
});

const _bridgeIngestT4000_t = bridge.ingestT4000.bind(bridge);
bridge.ingestT4000 = (sample) => {
  _bridgeIngestT4000_t(sample);
  // Simulador NUNCA alimenta o padrão histórico do carro real (par da blindagem
  // __P1_ORIGEM_SIM__ — o replay poluía a média com meia volta fria e tudo
  // depois virava MOTOR AQUECENDO falso; achado 10/06).
  if (padraoAcumulador && !window.__P1_ORIGEM_SIM__) padraoAcumulador.ingestT4000(sample);
  // Alimenta o orquestrador shift light v2 — se carregado.
  // Tem fallback automático: se a curva não tiver carregado, o orquestrador
  // não recalcula (devolve null) e o bridge segue com BUBI_LIMITS estáticos.
  if (shiftOrquestrador && typeof sample?.rpm === 'number') {
    try {
      shiftOrquestrador.ingestSample({
        rpm: sample.rpm,
        kmh: sample.speedKmh ?? 0,
        ts:  sample.tMono ?? sample.t ?? Date.now(),
      });
      // Onda 7 / reconciliação 14/06: o LED acende no ponto VISUAL (com a
      // antecipação do tempo de reação do piloto descontada), não no alvo cru —
      // assim a troca REAL cai no ponto certo (potência máxima 6.050). Cai pro
      // alvo cru se ainda não há ritmo de giro pra calcular a antecipação.
      const luz = shiftOrquestrador.getRpmVisualLuz();
      const rpmLuz = (luz && Number.isFinite(luz.rpmVisual)) ? luz.rpmVisual : null;
      if (Number.isFinite(rpmLuz) && rpmLuz > 0) {
        // peakTorqueRpm é nome legado do bridge — semanticamente agora é
        // "rpm onde a luz de troca acende".
        bridge.setLimits({ peakTorqueRpm: rpmLuz });
      }
    } catch (e) {
      // Não derrubar o cockpit. Logar e seguir com BUBI_LIMITS estáticos.
      console.warn('[orquestrador] ingestSample falhou:', e?.message);
    }
  }
  // A2: leva a amostra de freio (pressão/pedal do T4000) ao motor do trail,
  // bufferizada por tempo (mesmo tMono do GPS) pra fusão em A3. NÃO muda a fonte
  // do veredito — proxy GPS segue como fonte até o sensor entrar (A3).
  if (trailCockpit && (Number.isFinite(sample?.pressaoFreioBar) || Number.isFinite(sample?.pedalFreioPct))) {
    try {
      const n = trailCockpit.motor.amostraFreio({
        t: sample.tMono ?? sample.t ?? Date.now(),
        pressaoFreioBar: sample.pressaoFreioBar,
        pedalFreioPct: sample.pedalFreioPct,
        pedalAceleradorPct: sample.pedalAceleradorPct,
      });
      if (n === 1) log('cockpit-treino TRAIL: 1ª amostra de freio chegou ao motor (transporte A2 OK; fonte segue FÍSICA GPS até o sensor entrar em A3)');
    } catch {}
  }
};

// ── GPS vindo do canal da nuvem (RaceBox publicado pela Central de Pista) ──
// O canal cockpit-bubi-live carrega eventos 'gps' além das amostras do motor.
// Aqui eles alimentam o detector de trechos/chegada/box igual ao GPS do iPhone.
onGpsPoint((p) => {
  if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number') return;
  // GPS marcado como simulador liga a blindagem MESMO no modo cabo — antes a
  // flag só ligava em ?semfio e o cabo gravava passagem/padrão de replay (fiscais 10/06).
  if (p.sim) window.__P1_ORIGEM_SIM__ = true;
  bridge.ingestImuGps({
    source: 'iphone-imu', // formato canônico que o bridge entende (fonte indistinta)
    payload: {
      lat: p.lat,
      lng: p.lng,
      kmh: typeof p.kmh === 'number' ? p.kmh : undefined,
      t:   p.tWall ?? Date.now(),
      acc: p.accM,
    },
  });
  // grava também o GPS que chega ao painel (espelho), pra a sessão do cockpit
  // ter motor (origem) + linha do GPS juntos
  if (RecCockpit.ativo) { try { RecCockpit.gps({ lat: p.lat, lng: p.lng, kmh: p.kmh, accM: p.accM }, null, !!p.sim); } catch (e) {} }
});

const _bridgeIngestImu_t = bridge.ingestImuGps.bind(bridge);
bridge.ingestImuGps = (envelope) => {
  _bridgeIngestImu_t(envelope);
  if (!envelope?.payload?.lat) return;
  const gps = {
    lat: envelope.payload.lat,
    lng: envelope.payload.lng,
    t:   envelope.payload.tMono ?? envelope.payload.t ?? Date.now(),
  };
  if (chegadaDetector) chegadaDetector.ingestGps(gps);
  if (boxDetector) boxDetector.ingestGps(gps);
  if (coreografia) coreografia.gps({ lat: gps.lat, lng: gps.lng });
  if (trailCockpit) {
    try {
      trailCockpit.motor.gps({
        lat: gps.lat, lng: gps.lng, t: gps.t,
        kmh: typeof envelope.payload.kmh === 'number' ? envelope.payload.kmh : null,
      });
    } catch {}
  }
};

// Carga assíncrona dos segmentos (Supabase). Sem segmentos = detector
// inativo; T3000 USB continua entregando shift + alertas T4000.
(async () => {
  const isBrowser = typeof window !== 'undefined' && typeof window.addEventListener === 'function';
  if (!isBrowser) return;
  try {
    const { loadBrasiliaPrincipal } = await import('./segments-loader.js');
    const segments = await loadBrasiliaPrincipal();
    if (Array.isArray(segments) && segments.length > 0) {
      log(`track_segments carregados: ${segments.length}`);
      // ── Melhores passagens ANTES do detector: o ápice de cada trecho é
      // CALCULADO da melhor passagem (decisão Flávio 27/05), não cadastrado.
      // (Era o defeito que deixava o detector inativo: o carregador exigia
      // ápice cadastrado, que não existe no banco — tudo era descartado.)
      const tipoPneu = window.__P1_TIPO_PNEU__ ?? 'radial-185-14';
      const autodromoId = window.__P1_AUTODROMO_ID__ ?? 'e8335412-3312-54fe-b634-db2d02c7fa81';
      _ctxConfig = {
        carroId: CARRO_ATIVO, trackId: autodromoId,
        layoutId: '0dc85cfb-6236-567e-814c-eddf610b301f', tipoPneu,
      };
      let melhores = new Map();
      try {
        const { loadMelhoresPassagens } = await import('./melhores-loader.js');
        melhores = await loadMelhoresPassagens({ carroId: CARRO_ATIVO, autodromoId, tipoPneu });
        for (const [segId, ref] of melhores) {
          bridge.setReferenciaSegmento(segId, ref);
          oportunidade.setReferencia(segId, ref);
        }
        log(`melhores passagens: ${melhores.size}`);
      } catch (e) { log('melhores falharam: ' + e.message); }
      let daMelhor = 0, daSemente = 0;
      for (const seg of segments) {
        if (!seg.apicePoint) {
          const ap = melhores.get(seg.id)?.apicePoint;
          if (ap) { seg.apicePoint = ap; daMelhor++; }
          else if (APICES_SEMENTE_BRASILIA[seg.nome]) {
            // SEMENTE: ápice marcado pelo Flávio no mapa oficial — sai de cena
            // sozinho quando a melhor passagem tiver pontos pro cálculo físico.
            seg.apicePoint = APICES_SEMENTE_BRASILIA[seg.nome];
            daSemente++;
          }
        }
      }
      const comApice = segments.filter(sg => sg.apicePoint);
      log(`ápices: ${daMelhor} da melhor passagem + ${daSemente} semente (mapa oficial) · ${comApice.length}/${segments.length} trechos armados`);
      trechoDetector = new TrechoDetector({ segments: comApice });
      bridge._trechoDetector = trechoDetector;
      trechoDetector._onEvent = (ev) => bridge._handleTrechoEvent(ev);
      _ultimoSegmentId = (comApice.length ? comApice[comApice.length - 1] : segments[segments.length - 1]).id;
      // ── Agente VIVO de classificação de curva (Flávio 13/06) ──
      // tipo aprovado: do banco (coluna tipo_curva, Fase 2) quando existir; senão o padrão
      // definitivo embutido. Persistência LOCAL (localStorage) — NÃO grava na nuvem de produção.
      try {
        const tiposBanco = await carregarTipoCurvaPorTrecho('0dc85cfb-6236-567e-814c-eddf610b301f');
        const segmentosVivo = segments.map(sg => ({
          id: sg.id, nome: sg.nome, ordem: sg.ordem,
          tipoAprovado: tiposBanco[sg.id] || PADRAO_TIPO_CURVA[sg.nome] || 'ND',
          origem: tiposBanco[sg.id] ? 'banco' : 'padrao-flavio',
        }));
        const storeLocal = {
          salvar(snap) { try { localStorage.setItem('p1_classificador_vivo', JSON.stringify(snap)); } catch (_) {} },
        };
        classificadorVivo = criarClassificadorVivo({
          segmentos: segmentosVivo,
          store: storeLocal,
          onProposta: (info) => {
            log(`PROPOSTA de tipo: ${info.trecho} ${info.proposta.de}→${info.proposta.para} (rever no celular)`);
            try { localStorage.setItem('p1_classificador_proposta', JSON.stringify({ ...info, em: Date.now() })); } catch (_) {}
          },
        });
        const comBanco = segmentosVivo.filter(s => s.origem === 'banco').length;
        log(`agente vivo ligado: ${segmentosVivo.length} trechos (${comBanco} do banco, ${segmentosVivo.length - comBanco} do padrão)`);
      } catch (e) { log('agente vivo não ligou: ' + e.message); }
      // ── Coreografia da volta (Flávio 09/06): painel ↔ orientação ↔ resumo ──
      const ordenados = segments.slice().sort((x, y) => (x.ordem ?? 0) - (y.ordem ?? 0));
      coreografia = new CoreografiaVolta(ordenados, {
        onPainel: () => telaOrientacao.esconder(),
        onResumoVolta: () => {
          if (mensagemGraveAtiva()) { telaOrientacao.esconder(); return; }
          telaOrientacao.mostrarResumoVolta({
            voltaN: voltas.n,
            tempoTxt: fmtVolta(voltas.ultimaS),
            melhorTxt: fmtVolta(voltas.melhorS),
            melhorou: (voltas.ultimaS != null && voltas.melhorS != null)
              ? voltas.ultimaS <= voltas.melhorS : null,
          });
        },
        onOrientacao: (seg, prog) => {
          if (mensagemGraveAtiva()) { telaOrientacao.esconder(); return; }
          // Cockpit-treino trail: a metade da reta é do GRÁFICO DE FRENAGEM
          // ALVO (ditado 11/06) — a tela de orientação não entra neste modo.
          if (trailCockpit) { telaOrientacao.esconder(); return; }
          // Treino: calibração (2 passagens), trecho consolidado/saturado e
          // consolidação pré-box NÃO recebem meta nova — painel padrão.
          if (treinoStint && !treinoStint.deveOrientar(seg.id)) { telaOrientacao.esconder(); return; }
          const o = oportunidade.getOrientacao(seg.id);
          if (!o) { telaOrientacao.esconder(); return; } // 1ª volta / sem perda → painel
          if (!telaOrientacao.visivel() || telaOrientacao._segAtual !== seg.id) {
            telaOrientacao.mostrar(seg, o);
            telaOrientacao._segAtual = seg.id;
          }
          telaOrientacao.setProgresso(prog);
        },
      });
      log(`coreografia da volta ativa (${ordenados.length} trechos; reta longa após ${coreografia.retaMaisLonga().deSegId.slice(0, 8)})`);
      // Cockpit-treino trail: precisa dos trechos ordenados + melhores passagens.
      _trailCtx = { ordenados, melhores };
      tentarArmarTrailCockpit();
      try {
        const marco = await loadMarcoChegada('0dc85cfb-6236-567e-814c-eddf610b301f');
        if (marco) {
          chegadaDetector = new ChegadaDetector({
            marco,
            onChegada: ({ voltaN }) => {
              if (padraoAcumulador) padraoAcumulador.fecharVolta();
              const agora = Date.now();
              let durMs = null;
              if (voltas.inicioTs) {
                const dur = (agora - voltas.inicioTs) / 1000;
                if (dur > 20 && dur < 1200) {
                  voltas.ultimaS = dur;
                  durMs = Math.round(dur * 1000);
                  if (voltas.melhorS == null || dur < voltas.melhorS) voltas.melhorS = dur;
                }
              }
              const inicioVolta = voltas.inicioTs;
              voltas.n = voltaN; voltas.inicioTs = agora;
              // Consolidação pré-box do treino depende da volta atual.
              if (treinoStint) treinoStint.setVoltaAtual(voltaN);
              // Trilho do cockpit-treino é POR VOLTA: virada limpa as células.
              if (trailCockpit) { try { trailCockpit.motor.setVoltaAtual(voltaN); } catch {} }
              // Tela ASSISTIR: a Central calcula o tempo da volta pela
              // diferença entre duas chegadas consecutivas (tWall).
              publishEvento({ tipo: 'volta', n: voltaN });
              log(`volta ${voltaN} fechada pela linha de chegada`);
              // VOLTA REAL na nuvem (autorização Flávio 10/06): entra na sessão
              // aberta do stint. Replay de escritório nunca grava; sem sessão
              // aberta ou banco recusando, o log conta a verdade.
              if (!window.__P1_ORIGEM_SIM__ && durMs != null) {
                persistirVoltaReal({ numero: voltaN, tempoMs: durMs, inicioAt: inicioVolta });
              } else if (!window.__P1_ORIGEM_SIM__ && inicioVolta) {
                // tinha cronômetro mas a duração caiu fora da sanidade (20s-20min)
                // — descarte aparece no registro, não some em silêncio (auditoria 10/06)
                log(`volta ${voltaN} NÃO gravada: duração fora de sanidade`);
              }
            },
          });
          log('marco de chegada carregado');
        } else log('sem marco de chegada → fallback no último trecho');
      } catch (e) { log('marco chegada falhou: ' + e.message); }
      try {
        const mb = await loadMarcosBox('0dc85cfb-6236-567e-814c-eddf610b301f');
        if (mb) {
          boxDetector = new BoxDetector({
            pitIn: mb.pitIn, pitOut: mb.pitOut,
            onEntradaBox: () => {
              cockpitState.setNoBox(true);
              cockpitState.setSilencioso(true);
              cockpitState.showMessage({ tipo: 'grave', texto: 'NO BOX' });
              log('entrou no box');
            },
            onSaidaBox: () => {
              cockpitState.setNoBox(false);
              cockpitState.setSilencioso(false);
              cockpitState.hideMessage();
              log('saiu do box');
            },
          });
          log('detector de box ativo');
        }
      } catch (e) { log('marcos box falharam: ' + e.message); }
      if (tipoPneu && autodromoId) {
        {
          const { loadPadrao, savePadrao } = await import('./padrao-persister.js');
          const inicial = await loadPadrao({ carroId: CARRO_ATIVO, trackId: autodromoId, tipoPneu });
          padraoAcumulador = new PadraoAcumulador({
            carroId: CARRO_ATIVO,
            trackId: autodromoId,
            tipoPneu,
            padraoInicial: inicial?.padrao ?? null,
            voltasIniciais: inicial?.voltas ?? [],
            desvioPct: inicial?.desvioPct ?? 0.20,
            onAlertasPreditivos: (ids) => {
              // aplicar = sobe E limpa por volta. raiseManual aqui TRAVAVA o
              // alerta pra sempre (manual só sai com clearManual, que não havia).
              alertasCriticos.aplicarPreditivos(ids);
            },
            onPersist: async (snap) => { await savePadrao(snap); },
          });
          log(`padrão acumulador pronto. Voltas iniciais: ${inicial?.voltas?.length ?? 0}`);
        }
      }
    } else {
      log('track_segments vazio — detector inativo até layout existir');
    }
  } catch (e) {
    log('segments-loader falhou: ' + e.message);
  }
})();

// ── UI mínima do conector ─────────────────────────────────────
const $ = id => document.getElementById(id);
function setStatus(text, cls) {
  const el = $('connStatus'); if (!el) return;
  el.textContent = text;
  el.className = 'conn-status ' + (cls||'');
}
function setCloudStatus(s) {
  const el = $('cloudStatus'); if (!el) return;
  const labels = { off:'nuvem: desligado', connecting:'nuvem: conectando…', online:'nuvem: ao vivo', error:'nuvem: erro' };
  const cls    = { off:'warn', connecting:'warn', online:'ok', error:'bad' };
  el.textContent = labels[s] || ('nuvem: ' + s);
  el.className = 'conn-status ' + (cls[s] || 'warn');
}
onStatusChange(setCloudStatus);
function log(msg) {
  console.log('[t3000]', msg);
  const el = $('connLog'); if (!el) return;
  const line = document.createElement('div');
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  el.appendChild(line);
  while (el.children.length > 20) el.removeChild(el.firstChild);
}

// ── Estado da leitura ─────────────────────────────────────────
// blocosCurtos / leiturasRuins: contadores de "trava silenciosa" — leitura que
// não cai no catch (cabo entregando lixo curto ou amostra fora de faixa) mas
// também não é dado bom. Quando estouram o limite, forçamos religação do USB.
const t3 = { device:null, iface:null, epIn:null, epOut:null, reading:false, lastSampleTs:0,
             vid:null, pid:null, religando:false, blocosCurtos:0, leiturasRuins:0 };

// Limites de tolerância antes de forçar religação do USB sem erro explícito.
// 30 blocos curtos seguidos ≈ 3 s de lixo curto a ~10 Hz.
// 8 leituras inválidas seguidas = sintoma do "tranco" da partida do motor
// (decisão deste fix: religa pra refazer o handshake e estabilizar a leitura).
const T3_MAX_BLOCOS_CURTOS = 30;
const T3_MAX_LEITURAS_RUINS = 8;

// Filtro de sanidade do main: usa a MESMA função pura do parser pra decidir se
// a amostra pode alimentar bridge/nuvem/painel. Conservador: segura o último
// valor bom quando reprova (não sobrescreve a tela com lixo).
function sampleValido(s) {
  if (!s || typeof s !== 'object') return false;
  return leituraPlausivel(s).ok;
}

// ── Abrir + saudação (usado na 1ª conexão e em toda religação) ─
async function abrirEHandshake(dev) {
  await dev.open();
  if (dev.configuration === null) await dev.selectConfiguration(1);
  let ifc = -1, epIn = null, epOut = null;
  for (const it of dev.configuration.interfaces) {
    for (const a of it.alternates) {
      for (const e of a.endpoints) {
        if (e.direction === 'in'  && epIn  === null) { ifc = it.interfaceNumber; epIn  = e.endpointNumber; }
        if (e.direction === 'out' && epOut === null) { epOut = e.endpointNumber; }
      }
    }
  }
  if (ifc < 0 || epIn === null || epOut === null) {
    throw new Error('aparelho sem canal de leitura/escrita');
  }
  await dev.claimInterface(ifc);
  await dev.transferOut(epOut, ACK_BYTES);
  const ackResp = await dev.transferIn(epIn, 64);
  const ackBuf = new Uint8Array(ackResp.data.buffer);
  if (!isAckOk(ackBuf)) {
    throw new Error('saudação rejeitada: ' + Array.from(ackBuf.slice(0, 8)).map(b => b.toString(16)).join(' '));
  }
  t3.device = dev; t3.iface = ifc; t3.epIn = epIn; t3.epOut = epOut;
  t3.vid = dev.vendorId; t3.pid = dev.productId;
  return true;
}

// ── Religação automática da T4000 ─────────────────────────────
// Aparelho já autorizado uma vez reaparece em navigator.usb.getDevices()
// sem novo diálogo — dá pra religar sozinho quando o cabo/energia voltar.
async function reconectarT3000() {
  if (t3.religando) return false;
  t3.religando = true;
  setStatus('T3000 caiu — religando sozinho…', 'bad');
  log('⚠ leitura caiu. Tentando religar automaticamente a cada 2 s…');
  let tent = 0;
  try {
    while (t3.reading) {
      tent++;
      try {
        try { if (t3.device && t3.device.opened) await t3.device.close(); } catch {}
        const devs = await navigator.usb.getDevices();
        const dev = devs.find(d =>
          (t3.vid == null) || (d.vendorId === t3.vid && d.productId === t3.pid));
        if (!dev) throw new Error('aparelho ainda não voltou na USB');
        await abrirEHandshake(dev);
        setStatus('conectado — lendo a T3000', 'ok');
        log(`✓ T3000 religada sozinha (tentativa ${tent})`);
        return true;
      } catch (e) {
        if (tent === 1 || tent % 15 === 0) log(`religando T3000… tentativa ${tent} (${e.message})`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    return false;
  } finally {
    t3.religando = false;
  }
}

// Watchdog do T3000 — instanciado no boot pra reagir ao primeiro silêncio.
const _t3000Watchdog = criarT3000Watchdog({
  getUltimaAmostraTs: () => t3.lastSampleTs,
  onMudancaSinal: (perdeu) => {
    if (perdeu) {
      setStatus('SEM SINAL — conversor T3000 silenciou', 'bad');
      log('⚠ T3000 sem amostras há >1,5 s — alerta SEM SINAL no painel');
    } else {
      setStatus('conectado — lendo a T3000', 'ok');
      log('✓ T3000 voltou a mandar amostras');
    }
    atualizarOverlaySemSinal(perdeu);
  },
});
function iniciarWatchdog() {
  // Inicialização tardia (depois do handshake) — getter já está pronto.
  _t3000Watchdog.iniciar();
}

async function connectAndRun() {
  if (!('usb' in navigator)) {
    setStatus('navegador não suporta WebUSB', 'bad');
    log('navegador não suporta WebUSB');
    return;
  }
  try {
    setStatus('escolhendo aparelho…', 'warn');
    const dev = await navigator.usb.requestDevice({ filters: [] });
    log(`autorizado: ${dev.manufacturerName||''} ${dev.productName||''} (${dev.vendorId.toString(16)}:${dev.productId.toString(16)})`);
    await abrirEHandshake(dev);
    log(`canal aberto: interface ${t3.iface}, leitura ep ${t3.epIn}, escrita ep ${t3.epOut}`);
    log('central respondeu OK — handshake confirmado');
    setStatus('conectado — lendo a T3000', 'ok');

    // Watchdog do conversor T3000: avisa o piloto se o cabo cair.
    // Inicia AGORA (após handshake) pra ignorar o intervalo de boot.
    iniciarWatchdog();

    // assina canal ao vivo na nuvem (sem bloquear painel se falhar)
    setCloudStatus('connecting');
    startCloudBridge().then(s => {
      log('canal ao vivo na nuvem: ' + s);
    }).catch(e => log('canal ao vivo falhou: ' + e.message));

    // carrega a curva do dinamômetro da nuvem (não-bloqueante)
    loadDynoCurve(CARRO_ATIVO).then(async curva => {
      if (curva) {
        bridge.setLimits({
          peakTorqueRpm: curva.peakTorqueRpm,
          redlineRpm: curva.redlineRpm ?? BUBI_LIMITS.redlineRpm,
        });
        log(`curva ${curva.apelido}: pico de torque ${curva.peakTorqueNm.toFixed(2)} Nm @ ${curva.peakTorqueRpm} rpm (${curva.pointsCount} pontos)`);

        // ── Liga o orquestrador shift light v2 ────────────────────────
        // Só faz sentido instanciar se temos os pontos brutos da curva.
        try {
          shiftOrquestrador = criarShiftLightOrquestrador({
            cockpitState,
            dynoCurve: curva.pontos || [],
            modoStintInicial: _modoStintAtual,
            onPontoCalculado: (info) => {
              // debug — pode logar se quiser ver os RPM ótimos calculados
              // log(`shift v2: marcha ${info.marcha} → ótimo ${info.rpmOtimo} rpm`);
            },
          });
          shiftOrquestrador.setIdentificacao({ carroId: CARRO_ATIVO });
          // Carrega perfis de reação do piloto (Onda 7) — não bloqueia.
          shiftOrquestrador.carregarPerfisDoBanco()
            .then(r => log(`perfis de reação: ${r.ok ? r.carregados + ' carregados' : 'sem perfil ainda (' + r.motivo + ')'}`))
            .catch(e => log('perfis: erro ' + e.message));
          log(`shift light v2 ligado (máximo desempenho — troca na potência máxima, sem modos)`);
          atualizarBadgeSafeMode(false);
        } catch (e) {
          log('shift light v2 falhou ao ligar: ' + e.message);
          shiftOrquestrador = null;
          atualizarBadgeSafeMode(true, 'Shift light v2 falhou ao iniciar — usando limites estáticos do código');
        }
      } else {
        log(`curva da nuvem indisponível, usando default (pico em ${BUBI_LIMITS.peakTorqueRpm} rpm) — MODO SEMENTE`);
        atualizarIndicadorFonte('semente');
        atualizarBadgeSafeMode(true, 'Curva do dinamômetro indisponível — usando limites estáticos do código');
      }
    }).catch(e => {
      log('curva: erro ' + e.message);
      atualizarBadgeSafeMode(true, 'Erro ao baixar curva do dinamômetro: ' + e.message);
    });

    // loop principal: pede medidores a cada 100ms, decodifica, alimenta painel
    t3.reading = true;
    $('btnConnect').disabled = true;
    runReadLoop();
  } catch (e) {
    setStatus('falha: ' + e.message, 'bad');
    log('erro: ' + e.message);
  }
}

async function runReadLoop() {
  while (t3.reading) {
    try {
      await t3.device.transferOut(t3.epOut, RI_BYTES);
      // a central manda os bytes em vários pacotes de 64 → acumula
      const chunks = [];
      let total = 0;
      const T_TIMEOUT = 200; // ms
      const tStart = performance.now();
      while (performance.now() - tStart < T_TIMEOUT) {
        const r = await t3.device.transferIn(t3.epIn, 256);
        if (r.status === 'stall') { await t3.device.clearHalt('in', t3.epIn); break; }
        if (!r.data || r.data.byteLength === 0) break;
        chunks.push(new Uint8Array(r.data.buffer));
        total += r.data.byteLength;
        if (total >= 460) break;
      }
      if (total < 92) {
        // Bloco curto — antes era pulado em silêncio (trava silenciosa: nunca
        // caía no catch, nunca religava). Agora conta e, após N seguidos,
        // força religação do USB reaproveitando a lógica que já existe.
        t3.blocosCurtos = (t3.blocosCurtos || 0) + 1;
        if (t3.blocosCurtos >= T3_MAX_BLOCOS_CURTOS) {
          log(`${T3_MAX_BLOCOS_CURTOS} blocos curtos seguidos — religando leitura…`);
          t3.blocosCurtos = 0;
          const voltou = await reconectarT3000();
          // Só encerra se reconectar falhou E não há outra tentativa em curso
          // (evita break prematuro quando o catch já está religando em paralelo).
          if (!voltou && !t3.religando) { setStatus('leitura encerrada', 'bad'); t3.reading = false; break; }
        }
        continue;
      }
      const merged = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) { merged.set(c, off); off += c.byteLength; }
      const sample = parseT3000RIBlock(merged, { tMono: performance.now() });
      if (sample && sampleValido(sample)) {
        // Caminho feliz — dado bom: tudo igual a antes.
        bridge.ingestT4000(sample); // bridge é agnóstico de fonte; aceita t3000
        publishSample(sample);      // espelha pra nuvem (não-bloqueante; throttle interno)
        if (RecCockpit.ativo) { try { RecCockpit.motor(sample, _hexBytes(merged), window.__P1_ORIGEM_SIM__ === true); } catch (e) {} } // grava o motor na ORIGEM (10 Hz, completo + cru; respeita o modo simulador)
        t3.lastSampleTs = performance.now();
        // atualiza HUD curto
        updateHud(sample);
        t3.blocosCurtos = 0;
        t3.leiturasRuins = 0; // zera contadores de trava silenciosa
      } else if (sample) {
        // Amostra chegou mas reprovou na sanidade (fora de faixa física):
        // NÃO publica na nuvem, NÃO sobrescreve a tela com lixo (segura o
        // último valor bom), NÃO atualiza lastSampleTs (watchdog acende SEM
        // SINAL e a guarda de trava conta).
        t3.leiturasRuins = (t3.leiturasRuins || 0) + 1;
        if (t3.leiturasRuins === 1) {
          const motivos = (sample.sanidade?.motivos || []).slice(0, 4).join(', ');
          setStatus('leitura instável — segurando último valor', 'warn');
          log(`leitura inválida descartada (fora de faixa: ${motivos}) — não publicada`);
        }
        if (t3.leiturasRuins >= T3_MAX_LEITURAS_RUINS) {
          // N inválidas seguidas = tranco da partida / leitura corrompida persistente.
          log(`${T3_MAX_LEITURAS_RUINS} leituras inválidas seguidas — religando leitura…`);
          t3.leiturasRuins = 0;
          const voltou = await reconectarT3000();
          if (!voltou && !t3.religando) { setStatus('leitura encerrada', 'bad'); t3.reading = false; break; }
        }
      }
    } catch (e) {
      // NÃO desiste: religa sozinho (cabo solto, queda de energia, USB resetada).
      // O watchdog já mostra SEM SINAL no painel enquanto isso.
      log('leitura interrompida: ' + e.message);
      const voltou = await reconectarT3000();
      if (!voltou) { setStatus('leitura encerrada', 'bad'); t3.reading = false; break; }
      t3.blocosCurtos = 0; t3.leiturasRuins = 0; // religou: zera contadores de trava
      continue;
    }
    // throttle pra ~10Hz total (intervalo + tempo de transferência)
    await new Promise(r => setTimeout(r, 50));
  }
}

function updateHud(sample) {
  const hud = $('hud');
  if (!hud) return;
  const fmt = (v, d=1) => (typeof v === 'number' && Number.isFinite(v)) ? v.toFixed(d) : '—';
  const cilOk = sample.fuelInjectionBalanced;
  const alarmes = sample.alarmes || {};
  const alarmesAtivos = Object.entries(alarmes).filter(([,v]) => v).map(([k]) => k);
  hud.innerHTML = `
    <span><b>RPM</b> ${sample.rpm}</span>
    <span><b>Bat</b> ${fmt(sample.batteryV)}V</span>
    <span><b>Água</b> ${sample.waterTempC !== null ? sample.waterTempC + '°C' : '—'}</span>
    <span><b>Ar</b> ${sample.airTempC !== null ? sample.airTempC + '°C' : '—'}</span>
    <span><b>λ</b> ${fmt(sample.lambda, 2)}</span>
    <span><b>MAP</b> ${fmt(sample.mapBar, 2)}b</span>
    <span><b>TPS</b> ${fmt(sample.tpsPct, 0)}%</span>
    <span><b>Acel</b> ${fmt(sample.pedalAceleradorPct, 0)}%</span>
    <span><b>Freio</b> ${fmt(sample.pressaoFreioBar, 1)}b</span>
    <span><b>Vel</b> ${fmt(sample.speedKmh, 0)}km/h</span>
    <span><b>Gx</b> ${fmt(sample.accelXg, 2)}g</span>
    <span><b>Cil</b> ${cilOk ? '✓' : `⚠Δ${sample.fuelInjectionSpread}`}</span>
    ${alarmesAtivos.length ? `<span style="color:#fca5a5"><b>⚠ ${alarmesAtivos.join(', ')}</b></span>` : ''}
  `;
}

// Atualiza o indicador da fonte de RPM ótimo no painel. Estados:
//   'dyno'      — usando curva real (verde, visual padrão)
//   'aprendido' — usando ponto aprendido pra trecho atual (verde+brilho)
//   'semente'   — sem curva no banco ou aprendizado <100% (amarelo)
function atualizarIndicadorFonte(estado) {
  const el = $('fonteShiftStatus');
  if (!el) return;
  const labels = { dyno: 'shift: dyno', aprendido: 'shift: aprendido', semente: 'shift: semente' };
  const cls    = { dyno: 'ok', aprendido: 'ok', semente: 'warn' };
  el.textContent = labels[estado] || ('shift: ' + estado);
  el.className = 'conn-status ' + (cls[estado] || 'warn');
}

// Badge "MODO SEGURO" — acende quando faltar curva do dinamômetro
// ou orquestrador shift light v2 (algum motivo: erro ao carregar, sem
// curva no banco). Indica ao piloto que limites de RPM estão usando os
// defaults estáticos do código, não a curva real do motor.
function atualizarBadgeSafeMode(ativo, motivo) {
  const el = $('badgeSafeMode');
  if (!el) return;
  el.dataset.active = ativo ? '1' : '0';
  if (ativo && motivo) el.title = motivo;
}

// Overlay "SEM SINAL" — acende quando o conversor T3000 perde amostras
// por mais do que a tolerância do watchdog (1,5 s). Recupera sozinho
// quando voltam a chegar amostras.
function atualizarOverlaySemSinal(ativo) {
  const el = $('noSignalOverlay');
  if (!el) return;
  el.dataset.active = ativo ? '1' : '0';
  // Shift light apaga durante a queda — segurança visual.
  const sl = $('shiftLight');
  if (sl) sl.dataset.state = ativo ? 'off' : (sl.dataset.state || 'off');
}

// Botões manuais — mecânico aciona BOX/ÚLTIMA VOLTA pelo painel.
function plugarBotoesManuais() {
  const btnBox = $('btnBox');
  if (btnBox) {
    btnBox.addEventListener('click', () => {
      const ativo = btnBox.dataset.ativo === '1';
      if (ativo) {
        alertasCriticos.clearManual('BOX');
        btnBox.dataset.ativo = '0';
        btnBox.style.background = '#2a3645';
        btnBox.style.color = '#fcd34d';
        btnBox.textContent = 'BOX';
        log('BOX desligado');
      } else {
        alertasCriticos.raiseManual('BOX');
        btnBox.dataset.ativo = '1';
        btnBox.style.background = '#3a2a0f';
        btnBox.style.color = '#fcd34d';
        btnBox.textContent = 'BOX (on)';
        log('BOX ligado');
      }
    });
  }
  const btnUv = $('btnUltimaVolta');
  if (btnUv) {
    btnUv.addEventListener('click', () => {
      const ativo = btnUv.dataset.ativo === '1';
      if (ativo) {
        alertasCriticos.clearManual('ULTIMA_VOLTA');
        btnUv.dataset.ativo = '0';
        btnUv.style.background = '#2a3645';
        btnUv.textContent = 'ÚLTIMA VOLTA';
        log('ÚLTIMA VOLTA desligado');
      } else {
        alertasCriticos.raiseManual('ULTIMA_VOLTA');
        btnUv.dataset.ativo = '1';
        btnUv.style.background = '#1f3a52';
        btnUv.textContent = 'ÚLTIMA VOLTA (on)';
        log('ÚLTIMA VOLTA ligado');
      }
    });
  }
}

// Atualiza indicador da fonte do shift light a cada 1s (barato).
setInterval(() => {
  if (!shiftOrquestrador) return;
  try {
    const fonte = shiftOrquestrador.getFonteRpmOtimo();
    if (fonte === 'aprendido' || fonte === 'semente') atualizarIndicadorFonte(fonte);
    else if (fonte === 'indisponivel') atualizarIndicadorFonte('semente');
    else atualizarIndicadorFonte('dyno');
  } catch {}
}, 1000);

// Selo do modo TREINO na barra operacional (fora do palco de ações).
// Único elemento visual novo do treino: responde "estou treinando? de quê?".
// Selo apagado = treino NÃO armado (mitigação do plano preso ao navegador).
function atualizarSeloTreino() {
  const el = $('seloTreino');
  if (!el) return;
  if (treinoStint) {
    el.textContent = treinoStint.seloTexto();
    el.style.display = 'inline-block';
  } else {
    el.style.display = 'none';
  }
}

// botão de início
window.addEventListener('DOMContentLoaded', () => {
  const btn = $('btnConnect');
  if (btn) btn.addEventListener('click', connectAndRun);
  setStatus('aguardando você clicar em Autorizar', 'warn');
  log('p1t4000 — cockpit ao vivo. Clica "Autorizar T3000 via WebUSB" pra começar.');
  atualizarSeloTreino();
  if (treinoStint) log(`treino armado: ${treinoStint.seloTexto()} (origem: ${_planoStint.origem})`);
  // MODO SEM FIO: ?semfio — recebe amostras pela nuvem (Central/simulador transmite).
  if (new URLSearchParams(location.search).has('semfio')) {
    setStatus('modo sem fio — recebendo pela nuvem', 'warn');
    log('MODO SEM FIO: amostras vêm do canal da nuvem (sem cabo da T4000).');
    let _reaisSeguidas = 0; // destravamento automático pós-teste (auditoria 10/06)
    onSample((s) => {
      if (s && s.source === 'sim-replay') {
        if (!window.__P1_ORIGEM_SIM__) log('teste de escritório detectado — gravações pausadas');
        window.__P1_ORIGEM_SIM__ = true;
        _reaisSeguidas = 0;
      } else if (window.__P1_ORIGEM_SIM__) {
        // 50 amostras reais seguidas (~10 s) = carro de verdade falando → religa
        // a contagem sozinho (antes só recarregando a tela; em pista, teste rápido
        // de replay matava a gravação do resto do dia em silêncio).
        if (++_reaisSeguidas >= 50) {
          window.__P1_ORIGEM_SIM__ = false;
          _reaisSeguidas = 0;
          log('dados reais de volta há 10 s — gravações religadas');
        }
      }
      // Mesmo filtro de sanidade do cabo: amostra da nuvem fora de faixa não
      // alimenta o bridge nem sobrescreve a tela (segura o último valor bom).
      // Sem cabo aqui = sem religação USB; só descarta e avisa uma vez.
      if (sampleValido(s)) {
        bridge.ingestT4000(s);
        t3.lastSampleTs = performance.now();
        updateHud(s);
        t3.leiturasRuins = 0;
      } else {
        t3.leiturasRuins = (t3.leiturasRuins || 0) + 1;
        if (t3.leiturasRuins === 1) {
          const motivos = (s?.sanidade?.motivos || []).slice(0, 4).join(', ');
          setStatus('leitura instável (sem fio) — segurando último valor', 'warn');
          log(`amostra inválida da nuvem descartada${motivos ? ' (' + motivos + ')' : ''}`);
        }
      }
    });
    setCloudStatus('connecting');
    startCloudBridge().then(st => log('canal ao vivo: ' + st)).catch(e => log('canal falhou: ' + e.message));
    iniciarWatchdog();
    const bc = $('btnConnect'); if (bc) bc.disabled = true;
  }
  plugarBotoesManuais();
  atualizarIndicadorFonte('semente'); // estado inicial até a curva carregar

  // Modo silencioso — toque longo (1s) alterna. Estado salvo entre sessões.
  // Alertas críticos (motor, óleo, pneu) NUNCA são silenciados.
  const btnSil = $('btnSilencioso');
  const LS_KEY = 'p1fast-silencioso-v1';
  function aplicar(silencioso) {
    cockpitState.setSilencioso(silencioso);
    if (btnSil) {
      btnSil.textContent = silencioso ? 'mensagens OFF' : 'mensagens ON';
      btnSil.style.background = silencioso ? '#3a2a0f' : '#2a3645';
    }
    try { localStorage.setItem(LS_KEY, silencioso ? '1' : '0'); } catch {}
  }
  // Carrega estado salvo
  try { aplicar(localStorage.getItem(LS_KEY) === '1'); } catch {}
  if (btnSil) {
    let pressT = 0, timer = null;
    const startPress = () => {
      pressT = Date.now();
      timer = setTimeout(() => { aplicar(!cockpitState.isSilencioso()); }, 800);
    };
    const cancelPress = () => { if (timer) clearTimeout(timer); timer = null; };
    btnSil.addEventListener('pointerdown', startPress);
    btnSil.addEventListener('pointerup',   cancelPress);
    btnSil.addEventListener('pointerleave', cancelPress);
  }
});

// Expose pra DevTools
window.__t3 = { t3, cockpitState, bridge, oportunidade, getCoreografia: () => coreografia, telaOrientacao,
                treinoStint, planoStint: _planoStint, getTrailCockpit: () => trailCockpit };
