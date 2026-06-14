// shift-light-orquestrador.js — costura os 4 módulos novos do shift light
// inteligente e expõe uma única interface pro painel piloto.
//
// Decisão Flávio 2026-05-29 + auditor.
//
// Quem ele costura:
//   - shift-light-modos.js: janela do modo ativo do stint
//   - gear-detector-online.js: identifica marcha em tempo real
//   - forca-integrada-calculator.js: calcula RPM ótimo de troca por marcha
//   - aprendizado-confianca.js: calcula % de aprendizado da combinação ativa
//
// Quem ele alimenta:
//   - cockpitState.setAprendizado(pct) → barra de aprendizado no painel
//   - (futuro) shift-target consumindo getRpmOtimoTroca() pra acender LEDs

import { criarGearDetectorOnline } from './gear-detector-online.js';
import { criarAcumuladorConfianca } from './aprendizado-confianca.js';
import { calcularPontoOtimoTroca } from './forca-integrada-calculator.js';
import { janelaParaModo, ENVELOPE_DEFAULT_BUBI, ModoStint } from './shift-light-modos.js';
// Onda 7 (Flávio 2026-05-29): antecipação adaptativa baseada no tempo de
// troca do piloto + ritmo de subida do giro. Aprendido por trecho × marcha.
import { computeCompensation, learnFromEvent } from './pilot-reaction.js';
import { loadPerfis, savePerfis } from './pilot-reaction-persister.js';

const RAIO_RODA_BUBI_M = 0.2888;     // 577,6 mm de diâmetro / 2 (memória reference_p1fast_bubi_pneu)
const DIFERENCIAL_BUBI = 3.94;        // F17 Wide Ratio — só seed; ajustável depois
const TRECHO_CRITICOS_BRASILIA = [3, 4, 5]; // marchas que mais importam (memória)

/**
 * @param {Object} opts
 * @param {CockpitState} opts.cockpitState — onde escreve o pct de aprendizado
 * @param {Array} opts.dynoCurve — curva do motor (rpm, potencia_cv, torque_nm)
 * @param {string} opts.modoStintInicial — Durabilidade|Normal|Agressivo
 * @param {Function} [opts.onPontoCalculado] — callback debug (marcha, rpmOtimo)
 */
export function criarShiftLightOrquestrador({
  cockpitState,
  dynoCurve = [],
  modoStintInicial = ModoStint.NORMAL,
  onPontoCalculado = null,
} = {}) {
  if (!cockpitState) throw new Error('orquestrador: cockpitState obrigatório');

  const detector = criarGearDetectorOnline({
    numMarchas: 5,
    onMarchaDetectada: ({ marcha }) => {
      acumulador.registrarMarchaDetectada(marcha);
      _atualizarPctNoEstado();
    },
  });

  const acumulador = criarAcumuladorConfianca({ marchasCriticas: TRECHO_CRITICOS_BRASILIA });

  let modoAtual = modoStintInicial;
  let curva = dynoCurve;
  let trechoAtual = null; // setado pelo trecho-detector externo
  let trechoAnterior = null;
  let _ultimoCalcPorMarcha = {}; // cache de rpmOtimo por marcha pra cada modo

  // Flash IA: agendado quando IA cruza 100%, dispara no meio da próxima reta.
  // Decisão Flávio 2026-05-29: "vc tem o mapa todo do autódromo, já rodou
  // nele no mínimo 3 voltas. Sabe exatamente qual é a próxima reta".
  let _flashPendenteAteProximaReta = false;
  let _flashCallback = null;     // (ativar) => void
  let _meioRetaDelayMs = 1500;   // tempo até "meio da próxima reta" após a mudança de trecho

  // Onda 8: mapa { trechoId → tipo } carregado do banco
  // (track_segments.tipo). Atualizado por `setTiposPorTrecho`.
  let _tiposPorTrecho = {};

  // Classifica um trecho como reta ou curva.
  // 1ª tentativa: tipo carregado do banco (track_segments.tipo)
  // 2ª: convenção do protótipo (ids que começam com 'r' ou contém 'reta')
  function _ehReta(trechoId) {
    if (!trechoId) return false;
    const tipoBanco = _tiposPorTrecho[trechoId];
    if (tipoBanco === 'reta_longa' || tipoBanco === 'reta_curta') return true;
    if (tipoBanco === 'curva' || tipoBanco === 'pit_lane') return false;
    // fallback regex
    return /^r|reta/i.test(String(trechoId));
  }

  // ── Onda 7: tracker de ritmo de subida do giro + perfis de tempo de troca ──
  // Janela móvel de pares (rpm, ts) pra calcular rpm/s instantâneo.
  let _rpmHistory = [];   // [{ rpm, ts }] últimos pontos
  const RPM_HISTORY_MS = 800; // janela de 0.8s pra média de subida

  // Cache in-memory de profiles (piloto+carro+gear+trecho → reaction_time_ms).
  // Em produção, virá do banco via tabela qualidade_troca_marcha.
  let _profiles = {};
  let _pilotoId = null;
  let _carroId = null;

  // Detector de evento de troca: guarda última marcha + último rpm antes da troca.
  let _ultimaMarchaVista = null;
  let _rpmAntesUltimo = null;
  let _rpmAtShiftUltimo = null;

  // Persistência dos perfis (Onda 7+): debounce de 3s pra agregar
  // múltiplas atualizações antes de bater no banco.
  let _saveTimer = null;
  let _saveEmAndamento = false;
  function _agendarSave() {
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(async () => {
      if (_saveEmAndamento) return;
      if (!_carroId) return;
      _saveEmAndamento = true;
      try {
        await savePerfis(_profiles, { pilotoId: _pilotoId, carroId: _carroId });
      } catch (e) {
        console.warn('[orquestrador] savePerfis falhou', e);
      } finally {
        _saveEmAndamento = false;
      }
    }, 3000);
  }

  function _calcularRpmRiseRate(rpmAtual, ts) {
    _rpmHistory.push({ rpm: rpmAtual, ts });
    _rpmHistory = _rpmHistory.filter(p => ts - p.ts <= RPM_HISTORY_MS);
    if (_rpmHistory.length < 2) return 0;
    const primeiro = _rpmHistory[0];
    const ultimo   = _rpmHistory[_rpmHistory.length - 1];
    const dt = (ultimo.ts - primeiro.ts) / 1000;
    if (dt <= 0.05) return 0;
    return (ultimo.rpm - primeiro.rpm) / dt; // rpm/s (positivo = subindo)
  }

  function _atualizarPctNoEstado() {
    if (!cockpitState || typeof cockpitState.setAprendizado !== 'function') return;
    const pctNovo = acumulador.getPct();
    const pctAnterior = cockpitState.get && cockpitState.get().aprendizado
      ? cockpitState.get().aprendizado.pct : 0;
    try { cockpitState.setAprendizado(pctNovo); }
    catch (e) { console.warn('[orquestrador] setAprendizado falhou', e); }

    // Detecta cruzamento pra 100 → agenda flash pra próxima reta
    if (pctNovo >= 100 && pctAnterior < 100) {
      _flashPendenteAteProximaReta = true;
    }
  }

  function _talvezDispararFlash(trechoIdNovo) {
    if (!_flashPendenteAteProximaReta) return;
    if (!_ehReta(trechoIdNovo)) return;
    // Carro acabou de entrar numa reta. Espera o tempo médio até o meio dela.
    _flashPendenteAteProximaReta = false;
    setTimeout(() => {
      if (cockpitState && typeof cockpitState.setFlashIa === 'function') {
        cockpitState.setFlashIa(true);
      }
      if (_flashCallback) try { _flashCallback(); } catch {}
    }, _meioRetaDelayMs);
  }

  function _calcularRpmOtimoParaMarcha(marchaOrigem) {
    if (!Array.isArray(curva) || curva.length < 5) return null;
    const marchas = detector.getMarchasIdentificadas();
    if (marchas.length < 2) return null;
    const origem = marchas[marchaOrigem - 1];
    const destino = marchas[marchaOrigem];
    if (!origem || !destino) return null;

    const janela = janelaParaModo(modoAtual);
    // Envelope teto duro tem prioridade sobre janela do modo
    const rpmMaxClamp = Math.min(janela.rpmMax, ENVELOPE_DEFAULT_BUBI.rpm_max_absoluto);

    const resultado = calcularPontoOtimoTroca({
      curva,
      razaoMarchaAtual:   origem.ratioMedia / DIFERENCIAL_BUBI,
      razaoMarchaProxima: destino.ratioMedia / DIFERENCIAL_BUBI,
      diferencial:        DIFERENCIAL_BUBI,
      raioRodaM:          RAIO_RODA_BUBI_M,
      janelaRpmMin:       janela.rpmMin,
      janelaRpmMax:       rpmMaxClamp,
    });
    if (onPontoCalculado) {
      try { onPontoCalculado({ marcha: marchaOrigem, ...resultado }); } catch {}
    }
    return resultado;
  }

  return {
    /**
     * Ingere uma amostra de telemetria. Chamado pelo bridge a cada update.
     * @param {{rpm: number, kmh: number, ts: number}} sample
     */
    ingestSample(sample) {
      detector.ingest(sample);

      // Onda 7: registra ritmo de subida do giro
      if (Number.isFinite(sample.rpm) && Number.isFinite(sample.ts)) {
        _calcularRpmRiseRate(sample.rpm, sample.ts);
      }

      // Detector de evento de troca: quando marchaAtual muda de N pra N+1,
      // registra o rpm antes (último estável) e o rpm "no momento da troca"
      // (primeiro estável na nova marcha). Diferença alimenta learnFromEvent.
      const marchaAgora = detector.getMarchaAtual();
      if (marchaAgora !== _ultimaMarchaVista) {
        if (_ultimaMarchaVista != null && marchaAgora === _ultimaMarchaVista + 1) {
          // Trocou pra próxima marcha — temos um evento.
          const rateAtSwitch = _rpmHistory.length >= 2
            ? Math.max(0, (_rpmHistory[_rpmHistory.length - 1].rpm - _rpmHistory[0].rpm) /
                Math.max(0.05, (_rpmHistory[_rpmHistory.length - 1].ts - _rpmHistory[0].ts) / 1000))
            : 0;
          const alvoVisualAtUltimo = _ultimoCalcPorMarcha[`${modoAtual}:${_ultimaMarchaVista}`]?.rpmOtimo;
          if (Number.isFinite(_rpmAntesUltimo) && Number.isFinite(alvoVisualAtUltimo)) {
            const novosProfiles = learnFromEvent({
              piloto_id:     _pilotoId,
              carro_id:      _carroId,
              gear_after:    marchaAgora,
              trecho_id:     trechoAtual,
              gear_confidence: detector.getConfianca(),
              rpm_at_shift:  _rpmAtShiftUltimo ?? sample.rpm,
              rpm_before:    _rpmAntesUltimo,
              rpm_rise_rate: rateAtSwitch,
              target_visual_rpm: alvoVisualAtUltimo,
              delta_rpm:     (_rpmAtShiftUltimo ?? sample.rpm) - alvoVisualAtUltimo,
            }, _profiles);
            // Só agenda save se o aprendizado realmente mudou algo.
            if (novosProfiles !== _profiles) {
              _profiles = novosProfiles;
              _agendarSave();
            }
          }
        }
        _ultimaMarchaVista = marchaAgora;
        _rpmAntesUltimo = sample.rpm;
        _rpmAtShiftUltimo = sample.rpm;
      } else {
        _rpmAntesUltimo = sample.rpm;
      }

      // Sempre que a marcha atual estiver estável, recalcula o ponto ótimo
      // pra ela e pra próxima. Em cache pra não recomputar a cada amostra.
      const marchaAtual = detector.getMarchaAtual();
      if (marchaAtual && !_ultimoCalcPorMarcha[`${modoAtual}:${marchaAtual}`]) {
        const r = _calcularRpmOtimoParaMarcha(marchaAtual);
        if (r) {
          _ultimoCalcPorMarcha[`${modoAtual}:${marchaAtual}`] = r;
          // Quando o trecho atual é conhecido, registra ponto aprendido
          if (trechoAtual) {
            acumulador.registrarPontoAprendido({
              trechoId:     trechoAtual,
              marchaOrigem: marchaAtual,
              rpmAprendido: r.rpmOtimo,
            });
            _atualizarPctNoEstado();
          }
        }
      }
    },

    /**
     * Marca trecho atual da pista (alimentado por trecho-detector externo).
     * Dispara flash IA se há pendência e o trecho novo é reta (Flávio 29/05).
     */
    setTrechoAtual(trechoId) {
      if (trechoId !== trechoAtual) {
        trechoAnterior = trechoAtual;
        trechoAtual = trechoId;
        _talvezDispararFlash(trechoId);
      }
    },

    /** Configura callback chamado quando o flash dispara (UI extra). */
    onFlashIa(cb) { _flashCallback = cb; },

    /** True se IA está esperando próxima reta pra disparar flash. */
    isFlashPendente() { return _flashPendenteAteProximaReta; },

    /** Ajusta o tempo de espera até o meio da reta (default 1500ms). */
    setMeioRetaDelayMs(ms) {
      if (Number.isFinite(ms) && ms > 0) _meioRetaDelayMs = ms;
    },

    /**
     * Atualiza o mapa de tipos por trecho. Recebido do tipo-trecho-loader
     * ou cadastrado manualmente em testes. Onda 8 (Flávio 29/05).
     */
    setTiposPorTrecho(mapa) {
      _tiposPorTrecho = { ..._tiposPorTrecho, ...(mapa || {}) };
    },

    /** Devolve cópia da classificação atual em memória. */
    getTiposPorTrecho() { return { ..._tiposPorTrecho }; },

    /**
     * Sinaliza fim de uma volta limpa (dentro do top 30% — filtro externo).
     */
    registrarVoltaLimpa() {
      acumulador.registrarVoltaLimpa();
      _atualizarPctNoEstado();
    },

    /**
     * Troca o modo (Durabilidade/Normal/Agressivo) e invalida cache.
     */
    setModoStint(modo) {
      modoAtual = modo;
      _ultimoCalcPorMarcha = {};
    },

    /**
     * Carrega ou atualiza a curva do motor (do banco ou cache).
     */
    setCurva(novaCurva) {
      curva = novaCurva;
      _ultimoCalcPorMarcha = {};
    },

    /**
     * Devolve o RPM ótimo pra trocar AGORA (na marcha que o piloto está).
     *
     * Lógica de produto (Flávio 2026-05-29):
     *   - Enquanto a barra está aprendendo (pct < 100): usa o cálculo da
     *     curva do motor + janela do modo (Durabilidade/Normal/Agressivo).
     *     Esse é o "padrão semente" — funciona desde a primeira volta.
     *   - Quando a barra atinge 100% (calibrado) E há ponto aprendido
     *     específico do trecho atual: usa o ponto aprendido (respeitando
     *     o envelope da janela do modo).
     *
     * Sempre dentro dos padrões do motor (janelas vêm da curva do dyno
     * do carro específico — outro motor terá outras janelas).
     */
    getRpmOtimoTroca() {
      const m = detector.getMarchaAtual();
      if (!m) return null;

      const pctAprendido = acumulador.getPct();
      const calibrado = pctAprendido >= 100;

      // Se calibrado E temos ponto aprendido específico desse trecho+marcha,
      // usa ele (preferência por dado real sobre estimativa).
      if (calibrado && trechoAtual) {
        const aprendido = acumulador.getPontoAprendido({
          trechoId:     trechoAtual,
          marchaOrigem: m,
        });
        if (aprendido) {
          // Clampa dentro da janela do modo (envelope sempre respeitado)
          const janela = janelaParaModo(modoAtual);
          const rpmClamp = Math.max(janela.rpmMin, Math.min(janela.rpmMax, aprendido.rpm));
          return rpmClamp;
        }
      }

      // Modo semente: usa cálculo da curva + janela do modo
      const r = _ultimoCalcPorMarcha[`${modoAtual}:${m}`] || _calcularRpmOtimoParaMarcha(m);
      return r ? r.rpmOtimo : null;
    },

    /**
     * Informa qual é a fonte do RPM atual ('aprendido' ou 'semente').
     * Útil pra UI mostrar se a luz está usando dado real ou estimativa.
     */
    getFonteRpmOtimo() {
      const m = detector.getMarchaAtual();
      if (!m) return 'indisponivel';
      if (acumulador.getPct() >= 100 && trechoAtual) {
        const aprendido = acumulador.getPontoAprendido({
          trechoId: trechoAtual, marchaOrigem: m,
        });
        if (aprendido) return 'aprendido';
      }
      return 'semente';
    },

    /**
     * Debug / introspecção.
     */
    getEstado() {
      return {
        modoAtual,
        marchaAtual: detector.getMarchaAtual(),
        confiancaMarcha: detector.getConfianca(),
        marchasIdentificadas: detector.getMarchasIdentificadas(),
        aprendizadoPct: acumulador.getPct(),
        detalheAprendizado: acumulador.getDetalhes(),
        ultimoCalc: _ultimoCalcPorMarcha,
      };
    },

    /**
     * Devolve o RPM ONDE A LUZ DEVE ACENDER (visual), com antecipação
     * adaptativa baseada no tempo de troca do piloto + ritmo atual do giro.
     *
     * Fórmula (Onda 7, decisão Flávio 2026-05-29):
     *   rpmLuz = rpmOtimoTroca - (tempoTrocaPiloto × ritmoSubidaGiro)
     *
     * Enquanto o sistema ainda está aprendendo o piloto (mín. 10 amostras),
     * usa default 250 ms.
     */
    getRpmVisualLuz({ mode = 'assisted' } = {}) {
      const m = detector.getMarchaAtual();
      if (!m) return null;
      const rpmAlvo = this.getRpmOtimoTroca();
      if (rpmAlvo == null) return null;

      const rate = _rpmHistory.length >= 2
        ? (_rpmHistory[_rpmHistory.length - 1].rpm - _rpmHistory[0].rpm) /
          Math.max(0.05, (_rpmHistory[_rpmHistory.length - 1].ts - _rpmHistory[0].ts) / 1000)
        : 0;

      const comp = computeCompensation({
        piloto_id:    _pilotoId,
        carro_id:     _carroId,
        gear:         m,
        trecho_id:    trechoAtual,
        rpmRiseRate:  Math.max(0, rate),
        profiles:     _profiles,
        mode,
      });
      const rpmVisual = Math.round(rpmAlvo - comp.compensation_rpm);
      return {
        rpmVisual,
        rpmAlvo,
        antecipouRpm: Math.round(comp.compensation_rpm),
        tempoTrocaMs: Math.round(comp.rt_ms),
        fonte:        comp.source, // 'exact' | 'piloto-carro-gear' | 'piloto-carro' | 'default' | 'learning_mode' | 'invalid_rate'
        ritmoSubidaRpmS: Math.round(rate),
      };
    },

    /** Define identificação do piloto/carro (alimenta a chave dos perfis). */
    setIdentificacao({ pilotoId, carroId }) {
      if (pilotoId !== undefined) _pilotoId = pilotoId;
      if (carroId  !== undefined) _carroId  = carroId;
    },

    /**
     * Carrega perfis do banco pra o carro identificado.
     * Idempotente — pode ser chamado a cada início de stint.
     */
    async carregarPerfisDoBanco() {
      if (!_carroId) return { ok: false, motivo: 'carro_id não definido' };
      try {
        const carregados = await loadPerfis(_carroId);
        // Merge: mantém o que já tá em memória mais novo
        for (const [k, v] of Object.entries(carregados)) {
          const atual = _profiles[k];
          if (!atual || (v.sample_count || 0) > (atual.sample_count || 0)) {
            _profiles[k] = v;
          }
        }
        return { ok: true, carregados: Object.keys(carregados).length };
      } catch (e) {
        return { ok: false, motivo: String(e && e.message || e) };
      }
    },

    /**
     * Força salvar agora (chamado ao final do stint ou fechamento do painel).
     */
    async forcarSalvarPerfis() {
      if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
      if (!_carroId) return { ok: false, motivo: 'carro_id não definido' };
      return await savePerfis(_profiles, { pilotoId: _pilotoId, carroId: _carroId });
    },

    /** Devolve os perfis aprendidos (debug). */
    getPerfisDeTroca() { return _profiles; },

    /** Devolve o ritmo de subida do giro corrente (rpm/s). */
    getRitmoSubidaGiro() {
      if (_rpmHistory.length < 2) return 0;
      const f = _rpmHistory[0], l = _rpmHistory[_rpmHistory.length - 1];
      const dt = (l.ts - f.ts) / 1000;
      return dt > 0.05 ? (l.rpm - f.rpm) / dt : 0;
    },

    /** Reseta tudo (ex: trocou configuração mecânica). */
    reset() {
      detector.reset();
      acumulador.reset();
      _ultimoCalcPorMarcha = {};
      _rpmHistory = [];
      _profiles = {};
      _ultimaMarchaVista = null;
      _rpmAntesUltimo = null;
      _rpmAtShiftUltimo = null;
      _atualizarPctNoEstado();
    },
  };
}
