// checklist-aparelhos.mjs — lista de tarefas a checar no teste de pista (T4000/carro, GPS, câmera).
//
// Cada item é AUTO (o registrador confere sozinho pelo dado que chega na nuvem) ou MANUAL
// (só dá pra confirmar olhando o notebook — ex.: imagem da câmera).
//
// Uso direto (imprime a lista de referência, sem dado):  node tools/checklist-aparelhos.mjs
// Uso real: o registrar-aparelhos.mjs importa CHECKLIST + avaliar() e mostra o status ao vivo.
//
// Critérios das faixas vêm de: docs/hardware/T4000_CAN_SPEC.md, RACEBOX_INTEGRATION_SPEC.md,
// docs/CHECKLIST_DIA_DE_PISTA.md e a sessão real T3000 de 26/05.

// ---- helpers de leitura do acumulador do registrador ----
const _hz = t => (!t || !t.n || !(t.last > t.first)) ? 0 : t.n / ((t.last - t.first) / 1000);
const _campo = (t, k) => (t && t.campos) ? t.campos.get(k) : null;
const _temDado = (t, k) => { const c = _campo(t, k); return !!(c && (c.n - c.nNull) > 0); };
const _max = (t, k) => { const c = _campo(t, k); return c && Number.isFinite(c.max) ? c.max : null; };
const _min = (t, k) => { const c = _campo(t, k); return c && Number.isFinite(c.min) ? c.min : null; };

// status possíveis: 'ok' | 'falhou' | 'atencao' | 'semdado' | 'manual'
const OK = d => ({ status: 'ok', detalhe: d });
const FALHA = d => ({ status: 'falhou', detalhe: d });
const ATEN = d => ({ status: 'atencao', detalhe: d });
const SEM = d => ({ status: 'semdado', detalhe: d });

export const CHECKLIST = [
  {
    aparelho: 'CÂMERA (DJI Osmo Action 6)',
    nota: 'O vídeo não passa pela nuvem — estes itens você confirma olhando o notebook.',
    itens: [
      { texto: 'A DJI Osmo aparece e foi escolhida no seletor (não a webcam do notebook)', modo: 'manual' },
      { texto: 'A imagem aparece na tela e a luz VÍDEO está "no ar"', modo: 'manual' },
      { texto: 'Qualidade boa (1080p) e câmera apontada pra frente (visão do piloto)', modo: 'manual' },
      { texto: 'Câmera carregada e transmissão estável (não fica "religando")', modo: 'manual' },
    ],
  },
  {
    aparelho: 'GPS (RaceBox)',
    itens: [
      { texto: 'RaceBox mandando posição (latitude/longitude)', modo: 'auto', criterio: ({ gps }) => {
        if (!gps || !gps.n) return SEM('nenhum pacote de GPS chegou na nuvem');
        if (_temDado(gps, 'lat') && _temDado(gps, 'lng')) return OK(`${gps.n} pacotes, com posição`);
        return ATEN('pacote chega, mas sem latitude/longitude');
      } },
      { texto: 'Sinal travado (3D) e satélites suficientes (≥6)', modo: 'auto', criterio: ({ gps }) => {
        if (!gps || !gps.n) return SEM('sem pacote de GPS');
        const fixMax = _max(gps, 'fix'), svMax = _max(gps, 'numSV');
        if (fixMax >= 3 && svMax >= 6) return OK(`fix 3D, até ${svMax} satélites`);
        if ((fixMax ?? 0) >= 1 || (svMax ?? 0) > 0) return ATEN(`fix máx ${fixMax}, satélites máx ${svMax} — reposicionar com vista do céu`);
        return FALHA('sem trava de sinal — RaceBox sem céu (debaixo de metal/teto)?');
      } },
      { texto: 'Taxa de atualização do GPS (quantas leituras por segundo)', modo: 'auto', criterio: ({ gps }) => {
        const hz = _hz(gps); if (!hz) return SEM('sem dado pra medir');
        const dica = hz >= 8 ? 'rápido (típico RaceBox)' : (hz <= 2 ? 'lento — pode ser o GPS do celular, não o RaceBox' : 'intermediário');
        return OK(`${hz.toFixed(1)}/s — ${dica}`);
      } },
      { texto: 'Sem buraco longo de sinal (perda > 3s)', modo: 'auto', criterio: ({ gps }) => {
        if (!gps || !gps.n) return SEM('sem dado');
        const g = gps.maxGapMs / 1000;
        return g < 3 ? OK(`maior buraco ${g.toFixed(1)}s`) : ATEN(`buraco de ${g.toFixed(1)}s — checar posição/carga do RaceBox`);
      } },
      { texto: 'RaceBox no para-brisa/teto com vista do céu (nunca sob metal)', modo: 'manual' },
      { texto: 'RaceBox carregado; cabo USB-C só de carga (não ocupa porta do notebook)', modo: 'manual' },
    ],
  },
  {
    aparelho: 'CARRO (T4000 / hoje T3000)',
    itens: [
      { texto: 'Carro mandando dados (rotação do motor)', modo: 'auto', criterio: ({ sample }) => {
        if (!sample || !sample.n) return SEM('nada chegou — a aba do painel do piloto está lendo a T4000? cabo USB ok?');
        return _temDado(sample, 'rpm') ? OK(`${sample.n} amostras, com rotação`) : ATEN('amostra chega sem rotação');
      } },
      { texto: 'Taxa de chegada dos dados do carro', modo: 'auto', criterio: ({ sample }) => {
        const hz = _hz(sample); return hz ? OK(`${hz.toFixed(1)}/s`) : SEM('sem dado pra medir');
      } },
      { texto: 'Temperatura da água lendo', modo: 'auto', criterio: ({ sample }) => {
        if (!_temDado(sample, 'waterTempC')) return SEM('sem leitura de temperatura da água');
        return OK(`faixa ${_min(sample, 'waterTempC')}..${_max(sample, 'waterTempC')}°C`);
      } },
      { texto: 'Bateria lendo e dentro do esperado (≥13,5V com motor)', modo: 'auto', criterio: ({ sample }) => {
        if (!_temDado(sample, 'batteryV')) return SEM('sem leitura de bateria');
        const mx = _max(sample, 'batteryV');
        return mx >= 13.5 ? OK(`até ${mx}V`) : ATEN(`máx ${mx}V — baixo; olhar alternador/correia/bateria`);
      } },
      { texto: 'Sonda lambda (banda larga) lendo', modo: 'auto', criterio: ({ sample }) => {
        return _temDado(sample, 'lambda') ? OK(`faixa ${_min(sample, 'lambda')}..${_max(sample, 'lambda')}`) : SEM('sem leitura de lambda');
      } },
      { texto: 'MAP (pressão do coletor) coerente (conferir com mecânico)', modo: 'auto', criterio: ({ sample }) => {
        if (!_temDado(sample, 'mapBar')) return SEM('sem leitura de MAP');
        return OK(`faixa ${_min(sample, 'mapBar')}..${_max(sample, 'mapBar')} bar — em marcha lenta esperar vácuo ~ -0,4 a -0,6`);
      } },
      { texto: 'Nenhuma leitura fora de faixa (valor impossível)', modo: 'auto', criterio: ({ sample }) => {
        if (!sample || !sample.n) return SEM('sem dado');
        if (!sample.alertas || sample.alertas.size === 0) return OK('tudo dentro da faixa');
        return FALHA([...sample.alertas.keys()].slice(0, 3).join(' · '));
      } },
      { texto: 'Pressão de freio (sensor novo) já lendo', modo: 'auto', criterio: ({ sample }) => {
        const c = _campo(sample, 'pressaoFreioBar');
        if (!c || (c.n - c.nNull) === 0) return SEM('canal de pressão de freio não veio');
        return (_max(sample, 'pressaoFreioBar') > 0)
          ? OK(`lendo: até ${_max(sample, 'pressaoFreioBar')} bar`)
          : ATEN('em 0,00 — sensor ainda não instalado/lendo, ou o carro não freou no teste');
      } },
      { texto: 'Cabo da T4000 no lugar, "Autorizar" feito, sem "religando"', modo: 'manual' },
    ],
  },
  {
    aparelho: 'NUVEM / INTEGRAÇÃO',
    itens: [
      { texto: 'Nuvem recebendo ao vivo', modo: 'auto', criterio: ({ gps, sample, evento }) => {
        return ((gps && gps.n) || (sample && sample.n) || (evento && evento.n)) ? OK('chegando dado na nuvem') : SEM('nada chegou na nuvem ainda');
      } },
      { texto: 'Sem misturar simulação com dado real', modo: 'auto', criterio: ({ gps, sample }) => {
        const misturaG = gps && gps.nReal > 0 && gps.nSim > 0;
        const misturaS = sample && sample.nReal > 0 && sample.nSim > 0;
        return (misturaG || misturaS) ? ATEN('simulador e dado real juntos — desligar o simulador') : OK('sem mistura');
      } },
      { texto: 'Quem acompanha vê em /painel (vídeo + GPS + dados do carro)', modo: 'manual' },
    ],
  },
];

const MARCA = { ok: '[ OK ]', falhou: '[FALHOU]', atencao: '[ ! ]', semdado: '[ aguardando ]', manual: '[ conferir no notebook ]' };

export function avaliar(tipos) {
  const grupos = CHECKLIST.map(g => ({
    aparelho: g.aparelho,
    nota: g.nota || null,
    itens: g.itens.map(it => {
      if (it.modo === 'manual') return { texto: it.texto, status: 'manual', detalhe: '' };
      let r; try { r = it.criterio(tipos); } catch (e) { r = SEM('erro ao avaliar: ' + e.message); }
      return { texto: it.texto, status: r.status, detalhe: r.detalhe };
    }),
  }));
  const flat = grupos.flatMap(g => g.itens);
  const resumo = {
    ok: flat.filter(i => i.status === 'ok').length,
    falhou: flat.filter(i => i.status === 'falhou').length,
    atencao: flat.filter(i => i.status === 'atencao').length,
    semdado: flat.filter(i => i.status === 'semdado').length,
    manual: flat.filter(i => i.status === 'manual').length,
    total: flat.length,
  };
  return { grupos, resumo };
}

export function imprimir({ grupos, resumo }) {
  console.log('\n================= LISTA DE VERIFICAÇÃO DOS APARELHOS =================');
  for (const g of grupos) {
    console.log(`\n### ${g.aparelho}`);
    if (g.nota) console.log(`    (${g.nota})`);
    for (const it of g.itens) {
      const marca = MARCA[it.status] || '[ ? ]';
      const det = it.detalhe ? `  — ${it.detalhe}` : '';
      console.log(`  ${marca.padEnd(26)} ${it.texto}${det}`);
    }
  }
  console.log('\n--- resumo ---');
  console.log(`  OK: ${resumo.ok}   atenção: ${resumo.atencao}   falhou: ${resumo.falhou}   aguardando dado: ${resumo.semdado}   conferir no notebook: ${resumo.manual}   (total ${resumo.total})`);
  console.log('=====================================================================\n');
}

// Execução direta: imprime a lista de referência (sem dado capturado).
if (import.meta.url === `file://${process.argv[1]}`) {
  const vazio = { gps: { n: 0 }, sample: { n: 0 }, evento: { n: 0 } };
  imprimir(avaliar(vazio));
}
