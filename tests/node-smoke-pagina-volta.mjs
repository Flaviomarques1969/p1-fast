// node-smoke-pagina-volta.mjs — CATRACA do item 6 do GPS (Flávio 27/10/2026, painel p1fast-gps-funcoes-0850):
// celular — página da volta dentro do app e comparação entre duas voltas.
// Casa da conta: web/command-box/cerebro/cerebro-pagina-volta.js. Porta de leitura: web/cockpit/arquivo-sessoes.js.
// Offline, sem rede. Cada regra tem um CONTROLE que tem de dar o resultado oposto.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { pontosDaGravacao, conferirKmh, montarPaginaVolta, compararVoltas, N_TRECHOS }
  from '../web/command-box/cerebro/cerebro-pagina-volta.js';
import { listarSessoes, baixarSessao } from '../web/cockpit/arquivo-sessoes.js';

let ok = 0, fail = 0;
const t = (nome, cond, extra) => { if (cond) { ok++; console.log('  ok ', nome); } else { fail++; console.log('  FAIL', nome, extra ?? ''); } };
const ler = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const perto = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol;
const soma = (xs) => xs.reduce((a, b) => a + b, 0);

// ── Gravação REAL de pista de 21/06 (2 voltas) nos dois formatos ──
const replay = JSON.parse(ler('web/command-box/fixtures/replay-hoje-2026-06-21.json')).amostras;
const mapa = JSON.parse(ler('web/command-box/fixtures/replay-hoje-mapa.json'));
// o mesmo dado como o notebook grava no .jsonl (e a nuvem guarda em sessao_dumps)
const jsonl = replay.map(a => a.tipo === 'gps'
  ? { Tipo: 'gps', TWall: a.tWall, Dados: { lat: a.lat, lon: a.lon, kmh: a.kmh, fix: a.fix, hacc: a.hacc } }
  : { Tipo: 'sample', TWall: a.tWall, Dados: { rpm: a.rpm } });

// 1) Real 21/06
const pR = montarPaginaVolta(replay);
const pJ = montarPaginaVolta(jsonl);
t('real 21/06: 2 voltas, tempos = recorte do mapa (±0,1 s)', pR.voltas.length === 2
  && pR.voltas.every((v, i) => perto(v.tempoS, mapa.voltas[i].lapSec, 0.1)), JSON.stringify(pR.voltas.map(v => v.tempoS)));
t('real 21/06: as 2 voltas têm 3 setores que somam a volta', pR.voltas.every(v => v.setoresS && v.setoresS.length === 3
  && perto(soma(v.setoresS), v.tempoS, 0.002)), JSON.stringify(pR.voltas.map(v => v.setoresS)));
t('real 21/06: melhor volta = a 2ª, delta da 1ª contra ela = +35,356', pR.voltas[1].melhor && !pR.voltas[0].melhor
  && perto(pR.voltas[0].deltaMelhorS, 35.356, 0.01), pR.voltas[0].deltaMelhorS);
t('real 21/06: perfil ponto a ponto com fração, tempo, distância, km/h e x/y', pR.voltas.every(v => v.perfil.length > 300
  && v.perfil.every(s => s.p != null && s.t != null && s.d != null && s.x != null && s.y != null)));
t('formatos: .jsonl do notebook e replay dão a MESMA página (tempos, setores, nº de pontos)',
  pJ.voltas.length === pR.voltas.length && pJ.sessao.nPontos === pR.sessao.nPontos
  && pJ.voltas.every((v, i) => v.tempoS === pR.voltas[i].tempoS && JSON.stringify(v.setoresS) === JSON.stringify(pR.voltas[i].setoresS)),
  pJ.sessao.nPontos + ' × ' + pR.sessao.nPontos);
t('linhas que não são GPS ficam de fora', pontosDaGravacao(jsonl).length === replay.filter(a => a.tipo === 'gps').length
  || pontosDaGravacao(jsonl).length === pR.sessao.nPontos);
// controle: linha repetida (reenvio do bloco) não duplica o ponto
const dobrado = montarPaginaVolta(jsonl.concat(jsonl));
t('controle: gravação com as linhas repetidas → mesma página', dobrado.sessao.nPontos === pJ.sessao.nPontos
  && dobrado.voltas.length === 2 && dobrado.voltas.every((v, i) => v.tempoS === pJ.voltas[i].tempoS), dobrado.sessao.nPontos);

// 2) km/h gravado × distância andada
t('real 21/06: km/h veio 3,6× (leitor antigo) → razão ≈3,6, fator 1/3,6 e aviso', perto(pR.sessao.kmhRazao, 3.6, 0.1)
  && perto(pR.sessao.kmhFator, 1 / 3.6, 0.001) && /3,6/.test(pR.sessao.avisoKmh || ''), JSON.stringify(pR.sessao));
// carro na reta de Brasília: a distância andada em 1 s chega a ~230 km/h com o tremor do GPS; o gravado bruto passa de 500
t('real 21/06: velocidade máxima corrigida é de carro na reta (100–200 km/h)', pR.sessao.kmhMax > 100 && pR.sessao.kmhMax < 200, pR.sessao.kmhMax);
t('controle: sem a correção a máxima passaria de 500 km/h', Math.max(...pontosDaGravacao(replay).map(p => p.kmh ?? 0)) > 500);
// controle: mesma gravação com o km/h certo (= distância) → fator 1 e sem aviso
const certo = replay.map(a => (a.tipo === 'gps' && a.kmh != null ? { ...a, kmh: a.kmh / 3.6 } : a));
const kc = conferirKmh(pontosDaGravacao(certo));
t('controle: km/h certo → razão ≈1, fator 1, sem aviso', perto(kc.razao, 1, 0.1) && kc.fator === 1 && kc.aviso === null, JSON.stringify(kc));
// controle: divergência que não é 3,6 → só avisa, não corrige
const torto = replay.map(a => (a.tipo === 'gps' && a.kmh != null ? { ...a, kmh: a.kmh / 3.6 * 1.5 } : a));
const kt = conferirKmh(pontosDaGravacao(torto));
t('controle: km/h 1,5× → avisa "conferir o aparelho" e NÃO corrige', kt.fator === 1 && /conferir o aparelho/.test(kt.aviso || ''), JSON.stringify(kt));
t('gravação curta/parada → sem conferência (não inventa razão)', conferirKmh(pontosDaGravacao(replay.slice(0, 50))).razao === null);

// 3) Comparação entre duas voltas
const [v1, v2] = pR.voltas;
const c = compararVoltas(v1, v2);
t('comparação: diferença final = tempo B − tempo A (−35,356)', perto(c.deltaFinalS, -35.356, 0.002), c.deltaFinalS);
t('comparação: a curva da diferença começa em 0 e termina na diferença final',
  perto(c.serie[0].deltaS, 0, 0.001) && perto(c.serie[c.serie.length - 1].deltaS, c.deltaFinalS, 0.002),
  c.serie[0].deltaS + ' … ' + c.serie[c.serie.length - 1].deltaS);
t(`comparação: os ${N_TRECHOS} trechos somam a diferença final (±0,01)`, c.trechos.length === N_TRECHOS
  && perto(soma(c.trechos.map(x => x.difS)), c.deltaFinalS, 0.01), soma(c.trechos.map(x => x.difS)));
t('comparação: os 3 setores somam a diferença final', c.setores && c.setores.length === 3
  && perto(soma(c.setores.map(s => s.difS)), c.deltaFinalS, 0.01), JSON.stringify(c.setores));
t('comparação: "onde ganhou" lista só trechos com diferença negativa, do maior ganho para o menor',
  c.ganhou.length > 0 && c.ganhou.every(x => x.difS < 0) && c.ganhou.every((x, i, a) => i === 0 || a[i - 1].difS <= x.difS));
t('comparação: trechos com posição no desenho da pista (x/y)', c.trechos.every(x => x.x != null && x.y != null));
const auto = compararVoltas(v1, v1);
t('controle: volta contra ela mesma → diferença 0 em todo ponto e em todo trecho',
  auto.serie.every(s => s.deltaS === 0) && auto.trechos.every(x => x.difS === 0) && auto.perdeu.length === 0 && auto.ganhou.length === 0);
const inv = compararVoltas(v2, v1);
t('controle: trocar A e B inverte o sinal em todo trecho', inv.trechos.every((x, i) => perto(x.difS, -c.trechos[i].difS, 0.002))
  && perto(inv.deltaFinalS, -c.deltaFinalS, 0.001));
t('volta sem perfil → sem comparação (não inventa)', compararVoltas(v1, { n: 9, tempoS: 60 }) === null);

// 4) G do carro: só quando o notebook gravou (zeroOk) — a página não refaz G
const comG = jsonl.map(l => (l.Tipo === 'gps' ? { ...l, Dados: { ...l.Dados, gLong: -0.4, gLat: 0.2, zeroOk: true } } : l));
const semZero = jsonl.map(l => (l.Tipo === 'gps' ? { ...l, Dados: { ...l.Dados, gLong: -0.4, gLat: 0.2, zeroOk: false } } : l));
t('G gravado com zero no box → página tem G', montarPaginaVolta(comG).sessao.temG === true);
t('controle: G sem zero no box → página sem G', montarPaginaVolta(semZero).sessao.temG === false);
t('controle: gravação sem G (21/06) → página sem G', pR.sessao.temG === false);
// o notebook grava o G no .jsonl (o arquivo que a página lê), calculado UMA vez antes do disco
const live = ler('windows/cockpit/P1Fast.Cockpit.UI/MainWindow.Live.cs');
const corpoGps = (live.match(/private void OnLiveGps\(RaceBoxFix f\)[\s\S]*?_liveCloudGps\.Enqueue/) || [''])[0];
const iConv = corpoGps.indexOf('_gpsFiltro.Acel.Converter(f.GX, f.GY)'), iDisco = corpoGps.indexOf('_liveRecorder?.Gps(');
// só o objeto gravado (new { … }), sem comentários — comentário que cita gLong não conta
const disco = ((corpoGps.slice(iDisco).match(/new\s*\{[^}]*\}/) || [''])[0]);
t('notebook: G do carro calculado antes do disco e gravado no .jsonl (gLong, gLat, zeroOk)',
  iConv > 0 && iDisco > iConv && /gLong/.test(disco) && /gLat/.test(disco) && /zeroOk/.test(disco), disco.slice(0, 200));
t('notebook: uma conta só de G por fix (canal e disco usam o mesmo valor)',
  (corpoGps.match(/Acel\.Converter\(/g) || []).length === 1 && /\["gLong"\]\s*=\s*gLong/.test(live));

// 5) Porta de leitura da nuvem (fetch falso; só GET)
{
  const linhasDe = (p) => [{ Tipo: 'gps', TWall: p, Dados: {} }];
  const total = 45;   // parte 0 + 44 blocos
  const pedidos = [];
  const falso = (faltando) => async (url, init) => {
    pedidos.push({ url, init });
    const u = new URL(url);
    const q = u.searchParams;
    let corpo;
    if (q.get('select') === 'total') corpo = [{ total }];
    else if (q.get('parte') === 'eq.0') corpo = [{ sessao_id: 'a', criado_em: 'x', total, sessao_meta: { n_gps: 7 } }];
    else {
      const [de, ate] = q.getAll('parte').map(v => Number(v.split('.')[1]));
      corpo = [];
      for (let p = de; p <= ate; p++) if (p !== faltando) corpo.push({ parte: p, amostras: linhasDe(p) });
    }
    return { ok: true, status: 200, json: async () => corpo };
  };
  const linhas = await baixarSessao('s-1', { url: 'https://x', chave: 'k', fetch: falso(null) });
  t('nuvem: 44 blocos chegam inteiros e na ordem', linhas.length === 44 && linhas.every((l, i) => l.TWall === i + 1));
  t('nuvem: só GET (nenhum pedido com método/corpo)', pedidos.every(p => !p.init || (!p.init.method && !p.init.body)));
  let erro = null;
  try { await baixarSessao('s-1', { url: 'https://x', chave: 'k', fetch: falso(23) }); } catch (e) { erro = e.message; }
  t('controle: falta 1 bloco → erro "sessão incompleta" (não mostra pela metade)', /incompleta/.test(erro || ''), erro);
  const ls = await listarSessoes({ url: 'https://x', chave: 'k', fetch: falso(null) });
  t('nuvem: lista de sessões traz id, partes e nº de pontos GPS', ls.length === 1 && ls[0].partes === total && ls[0].nGps === 7);
  const fonte = ler('web/cockpit/arquivo-sessoes.js');
  t('nuvem: a porta não escreve (sem POST/PATCH/DELETE/upsert/createClient)', !/POST|PATCH|DELETE|upsert|insert\(|createClient/.test(fonte));
}

// 6) A página só desenha (a conta mora no cérebro)
const pagina = ler('web/volta/pagina-volta.html');
t('página: importa o cérebro da página e a porta de leitura', /cerebro-pagina-volta\.js/.test(pagina) && /arquivo-sessoes\.js/.test(pagina));
t('página: não refaz volta, setor, G nem distância', !/feedGps|criarCerebroGpsTv|criarDetectorChegada|fracDe\(|Math\.hypot|createClient|\/rest\/v1/.test(pagina));

// 7) Cópia do app do iPhone idêntica, pelo grafo de imports da página (régua nasce da fonte)
function grafo(rel, vistos = new Set()) {
  if (vistos.has(rel)) return vistos;
  vistos.add(rel);
  const src = ler(rel);
  for (const m of src.matchAll(/(?:import|from)\s*['"](\.{1,2}\/[^'"]+)['"]/g)) grafo(normalize(join(dirname(rel), m[1])), vistos);
  for (const m of src.matchAll(/^\s*import\s[\s\S]*?from\s*['"](\.{1,2}\/[^'"]+)['"]/gm)) grafo(normalize(join(dirname(rel), m[1])), vistos);
  return vistos;
}
const arquivos = [...grafo('web/volta/pagina-volta.html')];
const IOS = 'ios/p1fast-ios/Resources/Cockpit/';
t('grafo: a página puxa o cérebro, a peça da TV, a pista e a porta da nuvem',
  ['web/command-box/cerebro/cerebro-pagina-volta.js', 'web/command-box/cerebro/cerebro-gps-tv.js',
    'web/command-box/pista-cb-polyline.js', 'web/cockpit/arquivo-sessoes.js', 'web/cockpit/supabase-config.js']
    .every(f => arquivos.includes(f)), arquivos.join(', '));
const diferentes = arquivos.filter(f => !existsSync(new URL('../' + IOS + f, import.meta.url)) || ler(IOS + f) !== ler(f));
t(`iPhone: os ${arquivos.length} arquivos da página têm cópia idêntica no app`, diferentes.length === 0, diferentes.join(', '));
const tela = readFileSync(new URL('../ios/p1fast-ios/Sources/Views/PaginaVoltaView.swift', import.meta.url), 'utf8');
t('iPhone: a tela abre a página pelo cockpit:// com o mesmo caminho', /cockpit:\/\/app\/web\/volta\/pagina-volta\.html/.test(tela)
  && /CockpitSchemeHandler/.test(tela));
const home = ler('ios/p1fast-ios/Sources/Views/HomeView.swift');
t('iPhone: a tela inicial tem o botão VOLTAS GRAVADAS que abre a página', /VOLTAS GRAVADAS/.test(home) && /PaginaVoltaView/.test(home));

console.log(`\npagina-volta: ${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
