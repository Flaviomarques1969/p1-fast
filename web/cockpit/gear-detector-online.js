// gear-detector-online.js — identifica marcha atual e relação efetiva
// observando pares (RPM × velocidade GPS) durante a volta.
//
// Decisão Flávio + auditor 2026-05-29: "tanto faz o câmbio porque você vai
// ver como é que o carro funciona". Sistema descobre as 5 marchas sozinho
// pela razão rpm/velocidade — é constante por marcha (1ª tem razão grande,
// 5ª tem razão pequena). Agrupamento estatístico revela as marchas.
//
// Vai além do `gear-estimation.js` antigo: filtra amostras estabilizadas
// (sem patinação, sem freada, sem troca em curso) e mantém estatística
// por marcha em tempo real.

const RAZAO_MIN_AMOSTRAS_VALIDA = 3;   // pares consecutivos estáveis
const VARIACAO_RPM_MAX_S = 50;          // rpm/s — acima disso é aceleração brusca
const VARIACAO_KMH_MIN = 5;             // km/h — abaixo é parado/box
const ESTABILIDADE_JANELA_MS = 300;     // janela mínima de estabilidade

/**
 * Cria um detector. Observa pares via `ingest({ rpm, kmh, ts })` e
 * mantém estatística por marcha.
 *
 * @param {Object} opts
 * @param {number} [opts.numMarchas=5] — número de marchas esperadas
 * @param {Function} [opts.onMarchaDetectada] — callback quando marcha muda
 */
export function criarGearDetectorOnline({ numMarchas = 5, onMarchaDetectada = null } = {}) {
  // Estatísticas por marcha: razao média, contagem, faixa de RPM observada.
  const marchas = []; // [{ ratioMedia, amostras, rpmMin, rpmMax, ultimaAtualizacao }]

  // Buffer de amostras recentes pra filtrar estabilidade.
  let bufferRecente = [];

  let marchaAtual = null;
  let confiancaAtual = 0;

  function _isEstavel() {
    if (bufferRecente.length < RAZAO_MIN_AMOSTRAS_VALIDA) return false;
    const last = bufferRecente[bufferRecente.length - 1];
    const first = bufferRecente[0];
    const dt = (last.ts - first.ts) / 1000;
    if (dt < ESTABILIDADE_JANELA_MS / 1000) return false;
    if (last.kmh < VARIACAO_KMH_MIN) return false;
    const dRpm = Math.abs(last.rpm - first.rpm) / Math.max(0.1, dt);
    if (dRpm > VARIACAO_RPM_MAX_S) return false;
    return true;
  }

  function _classificarMarcha(razao) {
    if (marchas.length === 0) return null;
    let melhor = null;
    let menorDist = Infinity;
    for (let i = 0; i < marchas.length; i++) {
      const m = marchas[i];
      const dist = Math.abs(m.ratioMedia - razao);
      const tolerancia = m.ratioMedia * 0.08; // 8% de margem
      if (dist < tolerancia && dist < menorDist) {
        menorDist = dist;
        melhor = i + 1;
      }
    }
    return melhor;
  }

  function _adicionarComoNovaMarcha(razao, rpm) {
    if (marchas.length >= numMarchas) {
      // Já temos o máximo. Tenta substituir a marcha menos confiável (menos amostras)
      // se a nova razão for incompatível com todas.
      return;
    }
    marchas.push({
      ratioMedia:        razao,
      amostras:          1,
      rpmMin:            rpm,
      rpmMax:            rpm,
      ultimaAtualizacao: Date.now(),
    });
    // Ordena por razão decrescente (1ª tem razão maior, 5ª menor).
    marchas.sort((a, b) => b.ratioMedia - a.ratioMedia);
  }

  function _atualizarMarcha(idx, razao, rpm) {
    const m = marchas[idx];
    // Média móvel com peso 5% — mantém estável mas se adapta gradualmente.
    m.ratioMedia = m.ratioMedia * 0.95 + razao * 0.05;
    m.amostras += 1;
    if (rpm < m.rpmMin) m.rpmMin = rpm;
    if (rpm > m.rpmMax) m.rpmMax = rpm;
    m.ultimaAtualizacao = Date.now();
  }

  return {
    /**
     * Ingere uma amostra. Atualiza estatística e marcha atual.
     * @param {{rpm: number, kmh: number, ts: number}} amostra
     */
    ingest({ rpm, kmh, ts }) {
      if (!Number.isFinite(rpm) || !Number.isFinite(kmh) || !Number.isFinite(ts)) return;
      if (rpm < 1000 || kmh < VARIACAO_KMH_MIN) {
        bufferRecente = [];
        return;
      }
      bufferRecente.push({ rpm, kmh, ts });
      if (bufferRecente.length > 20) bufferRecente.shift();

      if (!_isEstavel()) return;

      // Amostra é estável → calcula razão
      const razao = rpm / kmh;

      let marchaIdx = _classificarMarcha(razao);
      if (marchaIdx === null) {
        // Marcha desconhecida — registra como nova
        _adicionarComoNovaMarcha(razao, rpm);
        marchaIdx = _classificarMarcha(razao);
      } else {
        _atualizarMarcha(marchaIdx - 1, razao, rpm);
      }

      if (marchaIdx !== null && marchaIdx !== marchaAtual) {
        marchaAtual = marchaIdx;
        confiancaAtual = Math.min(1, marchas[marchaIdx - 1].amostras / 30);
        if (onMarchaDetectada) {
          try { onMarchaDetectada({ marcha: marchaIdx, confianca: confiancaAtual }); } catch {}
        }
      } else if (marchaIdx !== null) {
        confiancaAtual = Math.min(1, marchas[marchaIdx - 1].amostras / 30);
      }
    },

    /** @returns {number|null} marcha atual estimada (1..numMarchas) ou null */
    getMarchaAtual() { return marchaAtual; },

    /** @returns {number} 0..1 confiança da detecção atual */
    getConfianca() { return confiancaAtual; },

    /** @returns {Array} cópia das estatísticas por marcha (ordenadas 1ª→Nª) */
    getMarchasIdentificadas() {
      return marchas.map((m, i) => ({
        marcha:     i + 1,
        ratioMedia: m.ratioMedia,
        amostras:   m.amostras,
        rpmMin:     m.rpmMin,
        rpmMax:     m.rpmMax,
      }));
    },

    /**
     * Calcula o RPM esperado depois de uma troca de marcha,
     * baseado nas razões observadas.
     * @param {number} marchaOrigem
     * @param {number} rpmAntes
     * @returns {number|null} rpm após troca, ou null se faltam dados
     */
    rpmAposTroca(marchaOrigem, rpmAntes) {
      if (marchaOrigem < 1 || marchaOrigem >= marchas.length) return null;
      const origem = marchas[marchaOrigem - 1];
      const destino = marchas[marchaOrigem]; // próxima
      if (!origem || !destino) return null;
      // RPM cai pela razão entre marchas (destino/origem < 1)
      return Math.round(rpmAntes * (destino.ratioMedia / origem.ratioMedia));
    },

    /**
     * Exporta as assinaturas aprendidas do câmbio (razão por marcha) para
     * persistir entre sessões — sem isto, o aprendizado some ao fechar.
     */
    exportarEstado() {
      return {
        versao: 1,
        marchas: marchas.map(m => ({
          ratioMedia: m.ratioMedia, amostras: m.amostras, rpmMin: m.rpmMin, rpmMax: m.rpmMax,
        })),
      };
    },

    /**
     * Importa assinaturas persistidas (idempotente; substitui o estado atual).
     * Mantém a ordem canônica (1ª→Nª por razão decrescente).
     */
    importarEstado(estado) {
      marchas.length = 0;
      bufferRecente = [];
      marchaAtual = null;
      confiancaAtual = 0;
      if (!estado || !Array.isArray(estado.marchas)) return;
      for (const m of estado.marchas) {
        if (!m || !Number.isFinite(m.ratioMedia)) continue;
        marchas.push({
          ratioMedia: m.ratioMedia,
          amostras: Number.isFinite(m.amostras) ? m.amostras : 0,
          rpmMin: Number.isFinite(m.rpmMin) ? m.rpmMin : m.ratioMedia,
          rpmMax: Number.isFinite(m.rpmMax) ? m.rpmMax : m.ratioMedia,
          ultimaAtualizacao: Date.now(),
        });
      }
      marchas.sort((a, b) => b.ratioMedia - a.ratioMedia);
    },

    /** Reseta o detector (ex: ao trocar configuração de câmbio). */
    reset() {
      marchas.length = 0;
      bufferRecente = [];
      marchaAtual = null;
      confiancaAtual = 0;
    },
  };
}
