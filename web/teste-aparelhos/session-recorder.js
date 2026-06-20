// ═══════════════════════════════════════════════════════════════════════════
// GRAVADOR DE SESSÃO — Central de Pista (notebook)
// ═══════════════════════════════════════════════════════════════════════════
// Resolve a causa-raiz da auditoria de 20/06/2026: não existia nada no caminho
// do notebook que GRAVASSE a sessão. O dado só passava ao vivo (transmissão sem
// persistência) e morria. Este módulo grava, do LIGA ao DESLIGA do carro, TODA
// amostra crua de GPS (RaceBox, na taxa de chegada) + T4000 (motor), append-only,
// no próprio notebook (IndexedDB), independente de internet e da nuvem.
//
// Princípios (ADR-003/004): fonte da verdade local durante a sessão; gravação
// append-only (só acrescenta, nunca apaga a série crua).
//
// DESENHO PARA TESTE: a lógica viva (ciclo da sessão, contadores, integridade,
// lacunas) está em `criarGravador`, que recebe um `store` injetável. No navegador
// passamos `criarStoreIndexedDB()`; nos testes em Node passamos um store de memória.
// Assim 100% da orquestração é testável sem navegador.
// ═══════════════════════════════════════════════════════════════════════════

// Quanto tempo de silêncio (sem GPS nem motor) consideramos "carro desligado".
const SILENCIO_FIM_MS = 8000;
// Buraco dentro da sessão acima disto vira "lacuna" registrada (honestidade: aba
// suspensa / notebook dormindo não fingem continuidade — o intervalo fica marcado).
const LACUNA_MIN_MS = 2000;

// Taxa instantânea (pontos nos últimos 5 s) — para mostrar 25 Hz de GPS sem mentir.
function taxaHz(janela, agoraMono) {
  while (janela.length && agoraMono - janela[0] > 5000) janela.shift();
  return janela.length / 5;
}

// ─────────────────────────────────────────────────────────────────────────────
// GRAVADOR (lógica pura + orquestração; store injetável)
// ─────────────────────────────────────────────────────────────────────────────
export function criarGravador(opts = {}) {
  const now      = opts.now      || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  const wall     = opts.wall     || (() => Date.now());
  const gerarId  = opts.gerarId  || (() => 'sessao-' + new Date().toISOString().replace(/[:.]/g, '-'));
  const store    = opts.store    || criarStoreMemoria();
  const onEstado = opts.onEstado || (() => {});
  const silencioMs = opts.silencioMs || SILENCIO_FIM_MS;

  let sessao = null;     // { id, inicioWall, inicioMono, sim }
  let seq = 0;
  let nGps = 0, nMotor = 0, dropped = 0, okWrites = 0, storeMorto = false;
  let ultimoMono = 0, ultimoGpsMono = 0, ultimoMotorMono = 0;
  const janGps = [], janMotor = [];
  const lacunas = [];

  function emEstado(motivo) {
    onEstado(estado(), motivo);
  }

  function abrir(sim) {
    sessao = { id: gerarId(), inicioWall: wall(), inicioMono: now(), sim: !!sim };
    seq = 0; nGps = 0; nMotor = 0; dropped = 0;
    janGps.length = 0; janMotor.length = 0; lacunas.length = 0;
    ultimoMono = ultimoGpsMono = ultimoMotorMono = now();
    // metadado da sessão é best-effort; se o armazenamento falhar, seguimos gravando
    Promise.resolve(store.novaSessao({ ...sessao, status: 'gravando' })).catch(() => {});
    emEstado('inicio');
    return sessao;
  }

  function marcarLacuna(agoraMono) {
    const desde = ultimoMono;
    if (sessao && agoraMono - desde >= LACUNA_MIN_MS) {
      lacunas.push({ deMono: desde, ateMono: agoraMono, ms: Math.round(agoraMono - desde) });
    }
  }

  function gravar(tipo, dados, rawHex, sim) {
    const agora = now();
    if (!sessao) abrir(sim);            // primeiro dado da sessão = carro ligou
    else marcarLacuna(agora);           // buraco dentro da sessão fica registrado
    const registro = {
      sessaoId: sessao.id, seq: ++seq, tipo,
      tWall: wall(), tMono: Math.round(agora),
      dados, ...(rawHex ? { rawHex } : {}),
    };
    // append-only; falha de escrita conta como descartado (visível, nunca silencioso).
    // Se o armazenamento estiver morto (aba privada / sem IndexedDB), nada nunca
    // grava: após 50 falhas sem 1 sucesso, marca morto e o chamador para de gastar
    // trabalho (ver getter `ativo`).
    Promise.resolve(store.gravar(registro))
      .then(() => { okWrites++; })
      .catch(() => { dropped++; if (okWrites === 0 && dropped >= 50) storeMorto = true; });
    ultimoMono = agora;
    if (tipo === 'gps')   { nGps++;   ultimoGpsMono = agora;   janGps.push(agora); }
    else                  { nMotor++; ultimoMotorMono = agora; janMotor.push(agora); }
    return registro;
  }

  // Entradas públicas de dado
  function gps(decoded, rawHex = null, sim = false)  { return gravar('gps', decoded, rawHex, sim); }
  function motor(sample, rawHex = null, simOverride = undefined) {
    const sim = simOverride !== undefined ? !!simOverride : !!(sample && sample.source === 'sim-replay');
    return gravar('t4000', sample, rawHex, sim);
  }

  // Vigia do fim: chamado ~1x/s. Sem dado há `silencioMs` => carro desligou.
  function tick() {
    if (!sessao) return null;
    if (now() - ultimoMono >= silencioMs) return encerrar('silencio');
    emEstado('tick');
    return null;
  }

  function resumoAtual(durMs) {
    return {
      id: sessao.id, sim: sessao.sim,
      inicioWall: sessao.inicioWall, fimWall: wall(),
      duracaoS: Math.round(durMs / 100) / 10,
      nGps, nMotor,
      hzGpsMedia:   durMs > 0 ? Math.round(nGps   / (durMs / 1000) * 10) / 10 : 0,
      hzMotorMedia: durMs > 0 ? Math.round(nMotor / (durMs / 1000) * 10) / 10 : 0,
      dropped,
      lacunas: lacunas.map(l => ({ ms: l.ms })),
      maiorLacunaMs: lacunas.reduce((m, l) => Math.max(m, l.ms), 0),
    };
  }

  function encerrar(motivo = 'manual') {
    if (!sessao) return null;
    const durMs = ultimoMono - sessao.inicioMono;
    const resumo = resumoAtual(durMs);
    resumo.motivoFim = motivo;
    Promise.resolve(store.finalizar(sessao.id, { ...resumo, status: 'encerrada' })).catch(() => {});
    sessao = null;
    onEstado(estado(), 'fim');
    return resumo;
  }

  function estado() {
    if (!sessao) return { gravando: false, nGps, nMotor };
    const agora = now();
    return {
      gravando: true,
      sessaoId: sessao.id,
      sim: sessao.sim,
      tempoS: Math.round((agora - sessao.inicioMono) / 100) / 10,
      nGps, nMotor, dropped,
      hzGps:   Math.round(taxaHz(janGps, agora)   * 10) / 10,
      hzMotor: Math.round(taxaHz(janMotor, agora) * 10) / 10,
      gpsParadoS:   ultimoGpsMono   ? Math.round((agora - ultimoGpsMono) / 100) / 10   : null,
      motorParadoS: ultimoMotorMono ? Math.round((agora - ultimoMotorMono) / 100) / 10 : null,
      lacunas: lacunas.length,
    };
  }

  // Exportação / leitura
  async function exportarSessao(id) { return store.lerSessao(id); }
  async function listarSessoes()    { return store.listarSessoes(); }

  // Recuperação de órfãs: chamado no boot, ANTES de qualquer dado novo. Acha
  // sessões que ficaram com status 'gravando' (a tela foi recarregada ou o
  // notebook dormiu sem fechar) e as marca 'interrompida', recompondo o resumo
  // a partir das amostras cruas já gravadas. O dado nunca se perde (é append-only);
  // isto só devolve o acesso a ele pela tela. Retorna as órfãs recuperadas.
  async function recuperarOrfas() {
    const lista = await store.listarSessoes();
    const orfas = [];
    for (const s of (lista || [])) {
      if (s && s.status === 'gravando') {
        const dump = await store.lerSessao(s.id);
        const am = (dump && dump.amostras) || [];
        const nG = am.filter(a => a.tipo === 'gps').length;
        const nM = am.filter(a => a.tipo === 't4000').length;
        const tw = am.map(a => a.tWall).filter(v => typeof v === 'number');
        const durMs = tw.length ? (Math.max(...tw) - Math.min(...tw)) : 0;
        const resumo = {
          id: s.id, sim: !!s.sim, status: 'interrompida', motivoFim: 'interrompida',
          inicioWall: s.inicioWall, fimWall: tw.length ? Math.max(...tw) : s.inicioWall,
          duracaoS: Math.round(durMs / 100) / 10, nGps: nG, nMotor: nM,
          hzGpsMedia:   durMs > 0 ? Math.round(nG / (durMs / 1000) * 10) / 10 : 0,
          hzMotorMedia: durMs > 0 ? Math.round(nM / (durMs / 1000) * 10) / 10 : 0,
        };
        await store.finalizar(s.id, resumo);
        orfas.push(resumo);
      }
    }
    // mais recente primeiro
    return orfas.sort((a, b) => (b.fimWall || 0) - (a.fimWall || 0));
  }

  return { gps, motor, tick, encerrar, estado, exportarSessao, listarSessoes, recuperarOrfas,
           get sessaoAtiva() { return sessao; } };
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE EM MEMÓRIA (para testes e degradação se o IndexedDB faltar)
// ─────────────────────────────────────────────────────────────────────────────
export function criarStoreMemoria() {
  const sessoes = new Map();
  const amostras = [];
  return {
    async novaSessao(meta) { sessoes.set(meta.id, { ...meta }); },
    async gravar(reg)      { amostras.push(reg); },
    async finalizar(id, resumo) { sessoes.set(id, { ...(sessoes.get(id) || { id }), ...resumo }); },
    async lerSessao(id)    { return { sessao: sessoes.get(id) || null,
                                      amostras: amostras.filter(a => a.sessaoId === id) }; },
    async listarSessoes()  { return [...sessoes.values()]; },
    _debug: { sessoes, amostras },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE EM IndexedDB (navegador) — append-only, sobrevive a recarregar/cair a nuvem
// ─────────────────────────────────────────────────────────────────────────────
export function criarStoreIndexedDB(dbName = 'p1fast-sessoes') {
  let dbP = null;
  function abrir() {
    if (dbP) return dbP;
    dbP = new Promise((res, rej) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('sessoes'))  db.createObjectStore('sessoes', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('amostras')) {
          const os = db.createObjectStore('amostras', { keyPath: 'seqGlobal', autoIncrement: true });
          os.createIndex('porSessao', 'sessaoId', { unique: false });
        }
      };
      req.onsuccess = () => res(req.result);
      req.onerror   = () => rej(req.error);
    });
    return dbP;
  }
  function tx(store, modo, fn) {
    return abrir().then(db => new Promise((res, rej) => {
      const t = db.transaction(store, modo);
      const r = fn(t.objectStore(store));
      t.oncomplete = () => res(r && r.result !== undefined ? r.result : undefined);
      t.onerror    = () => rej(t.error);
      t.onabort    = () => rej(t.error);
    }));
  }
  return {
    novaSessao(meta) { return tx('sessoes', 'readwrite', os => os.put(meta)); },
    gravar(reg)      { return tx('amostras', 'readwrite', os => os.add(reg)); },
    finalizar(id, resumo) {
      return abrir().then(db => new Promise((res, rej) => {
        const t = db.transaction('sessoes', 'readwrite');
        const os = t.objectStore('sessoes');
        const g = os.get(id);
        g.onsuccess = () => os.put({ ...(g.result || { id }), ...resumo });
        t.oncomplete = res; t.onerror = () => rej(t.error);
      }));
    },
    lerSessao(id) {
      return abrir().then(db => new Promise((res, rej) => {
        const t = db.transaction(['sessoes', 'amostras'], 'readonly');
        const meta = t.objectStore('sessoes').get(id);
        const out = [];
        const idx = t.objectStore('amostras').index('porSessao');
        idx.openCursor(IDBKeyRange.only(id)).onsuccess = e => {
          const c = e.target.result; if (c) { out.push(c.value); c.continue(); }
        };
        t.oncomplete = () => res({ sessao: meta.result || null, amostras: out });
        t.onerror = () => rej(t.error);
      }));
    },
    listarSessoes() {
      return tx('sessoes', 'readonly', os => os.getAll());
    },
  };
}

// Suporte a ambientes sem ESM (testes podem usar require via import())
export default { criarGravador, criarStoreMemoria, criarStoreIndexedDB };
