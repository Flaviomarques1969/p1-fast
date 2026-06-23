// gh-live-relay.mjs — ponte autônoma: cockpit-bubi-live (Supabase) → GitHub.
//
// PROBLEMA QUE RESOLVE
//   O container do Claude (assistente) só alcança github.com / npm — NÃO
//   alcança o Supabase nem a página do cockpit. Então o Claude não consegue
//   "ver" o stream ao vivo por conta própria. Este relê roda NO NOTEBOOK
//   (que alcança tudo), assina o canal ao vivo e espelha um retrato rolante
//   pra um arquivo no repositório GitHub. O Claude lê esse arquivo do GitHub
//   diretamente — sem depender de foto/log manual.
//
//   Fluxo:  T4000 → página p1t4000 → Supabase (cockpit-bubi-live)
//                                        │
//                              [ESTE RELÊ no notebook]
//                                        ▼
//                       GitHub: live/cockpit-bubi-live.json  ← Claude lê aqui
//
// COMO RODAR (no notebook, uma vez):
//   1. npm install @supabase/supabase-js   (se ainda não tiver)
//   2. Criar um GitHub Personal Access Token (fine-grained) com permissão
//      Contents: Read and write no repo flaviomarques1969/p1-fast.
//   3. set GH_TOKEN=ghp_xxx           (Windows: setx GH_TOKEN ghp_xxx, reabrir terminal)
//      node tools/gh-live-relay.mjs
//
// Tudo é configurável por variável de ambiente (defaults abaixo).

import { createClient } from '@supabase/supabase-js';

const CFG = {
  supabaseUrl:  process.env.SUPABASE_URL  || 'https://fvhwltzhytpnhlqbttmd.supabase.co',
  supabaseAnon: process.env.SUPABASE_ANON || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA',
  channel:      process.env.CHANNEL       || 'cockpit-bubi-live',
  ghToken:      process.env.GH_TOKEN       || '',
  ghRepo:       process.env.GH_REPO        || 'flaviomarques1969/p1-fast',
  ghBranch:     process.env.GH_BRANCH      || 'claude/t3000-t4000-live-stream-tdrk70',
  ghPath:       process.env.GH_PATH        || 'live/cockpit-bubi-live.json',
  pushMs:       Number(process.env.PUSH_INTERVAL_MS || 3000),
  keepSamples:  Number(process.env.KEEP_SAMPLES || 60),
};

if (!CFG.ghToken) {
  console.error('✗ Falta GH_TOKEN (token do GitHub com Contents: read/write).');
  console.error('  Crie em github.com → Settings → Developer settings → Fine-grained tokens.');
  process.exit(1);
}

const recent = [];        // últimas amostras (rolante)
let totalRecebidas = 0;
let ultimaTs = 0;
let ultimoSha = null;     // sha do arquivo no GitHub (pra update)
let assinaturaStatus = 'iniciando';

const client = createClient(CFG.supabaseUrl, CFG.supabaseAnon);
const ch = client.channel(CFG.channel, { config: { broadcast: { ack: false, self: false } } });

ch.on('broadcast', { event: 'sample' }, (msg) => {
  const s = msg.payload || {};
  totalRecebidas += 1;
  ultimaTs = Date.now();
  recent.push(s);
  while (recent.length > CFG.keepSamples) recent.shift();
});

ch.subscribe((st) => {
  assinaturaStatus = st;
  console.log('[relay] canal Supabase:', st);
});

// ── push pro GitHub via REST contents API ───────────────────────────────────
const ghHeaders = {
  'Authorization': `Bearer ${CFG.ghToken}`,
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'p1fast-gh-live-relay',
};
const contentsUrl = `https://api.github.com/repos/${CFG.ghRepo}/contents/${CFG.ghPath}`;

async function carregarShaInicial() {
  try {
    const r = await fetch(`${contentsUrl}?ref=${CFG.ghBranch}`, { headers: ghHeaders });
    if (r.status === 200) { ultimoSha = (await r.json()).sha; }
  } catch { /* arquivo ainda não existe — ok */ }
}

function montarRetrato() {
  const ult = recent[recent.length - 1] || null;
  const idadeMs = ultimaTs ? Date.now() - ultimaTs : null;
  return {
    atualizadoEm: new Date().toISOString(),
    canal: CFG.channel,
    statusAssinatura: assinaturaStatus,
    fluindo: idadeMs !== null && idadeMs < 5000,   // recebeu amostra nos últimos 5s?
    idadeUltimaAmostraMs: idadeMs,
    totalRecebidas,
    // resumo rápido pro Claude ler de relance
    ultima: ult ? {
      rpm: ult.rpm, waterTempC: ult.waterTempC, lambda: ult.lambda,
      tpsPct: ult.tpsPct, batteryV: ult.batteryV, speedKmh: ult.speedKmh,
      pedalAceleradorPct: ult.pedalAceleradorPct, mapBar: ult.mapBar,
      alarmes: ult.alarmes,
    } : null,
    amostras: recent,   // janela rolante completa
  };
}

async function pushGitHub() {
  const retrato = montarRetrato();
  const content = Buffer.from(JSON.stringify(retrato, null, 2)).toString('base64');
  const body = {
    message: `chore(live): snapshot cockpit-bubi-live (${retrato.fluindo ? 'fluindo' : 'sem amostra'}, n=${totalRecebidas})`,
    content, branch: CFG.ghBranch,
    ...(ultimoSha ? { sha: ultimoSha } : {}),
  };
  try {
    const r = await fetch(contentsUrl, { method: 'PUT', headers: ghHeaders, body: JSON.stringify(body) });
    if (r.status === 200 || r.status === 201) {
      ultimoSha = (await r.json()).content.sha;
      const u = retrato.ultima;
      console.log(`[relay] push OK · ${retrato.fluindo ? 'FLUINDO' : 'sem amostra'} · n=${totalRecebidas}` +
        (u ? ` · rpm=${u.rpm} água=${u.waterTempC}°C λ=${u.lambda} tps=${u.tpsPct}%` : ''));
    } else {
      console.error(`[relay] push falhou: HTTP ${r.status} — ${(await r.text()).slice(0, 200)}`);
    }
  } catch (e) {
    console.error('[relay] push erro de rede:', e.message);
  }
}

await carregarShaInicial();
console.log(`[relay] espelhando '${CFG.channel}' → github:${CFG.ghRepo}@${CFG.ghBranch}/${CFG.ghPath} a cada ${CFG.pushMs}ms`);
const timer = setInterval(pushGitHub, CFG.pushMs);
await pushGitHub();   // primeiro retrato imediato (Claude já vê que o relê subiu)

process.on('SIGINT', async () => {
  clearInterval(timer);
  console.log('\n[relay] encerrando — último push…');
  await pushGitHub();
  await ch.unsubscribe();
  process.exit(0);
});
