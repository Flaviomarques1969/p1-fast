// node-smoke-tv-honesta.mjs — CATRACA da E1 da obra "TV do box ao vivo" (Flávio 27/10/2026:
// "esta tela não está funcionando corretamente"). A TV só diz AO VIVO quando é ao vivo.
// Casa da regra: web/command-box/cerebro/cerebro-tv-sinal.js. Offline, sem rede.
// Cada regra tem um CONTROLE que tem de dar o resultado oposto.
// Parte 2 confere, na FONTE da Vista Piloto, que o modo TV está ligado nos lugares certos.
import { readFileSync } from 'node:fs';
import { criarSinalTv, pontoBom, AO_VIVO_MS } from '../web/command-box/cerebro/cerebro-tv-sinal.js';

let ok = 0, fail = 0;
const t = (nome, cond, extra) => { if (cond) { ok++; console.log('  ok ', nome); } else { fail++; console.log('  FAIL', nome, extra ?? ''); } };
const ler = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const P = (tWall, extra = {}) => ({ lat: -15.7728, lng: -47.9001, kmh: 120, fix: 3, numSV: 14, tWall, source: 'racebox', ...extra });
const T0 = 1_800_000_000_000;

console.log('1) estados de partida');
{
  const s = criarSinalTv();
  t('ponte desligada → CONECTANDO', s.estado(T0).codigo === 'conectando');
  s.conexao('online');
  const e = s.estado(T0);
  t('ponte no ar sem ponto → AGUARDANDO O CARRO', e.codigo === 'aguardando' && e.texto === 'AGUARDANDO O CARRO' && !e.temDado, e);
  s.conexao('sem-ponte');
  t('ponte não carregou → SEM CONEXÃO', s.estado(T0).codigo === 'sem-conexao' && s.estado(T0).classe === 'cb-err');
}

console.log('2) ao vivo, queda e controle');
{
  const s = criarSinalTv(); s.conexao('online');
  for (let i = 0; i < 50; i++) s.chegou(P(T0 + i * 40), T0 + i * 40 + 120);   // 25 Hz, 120 ms de rede
  const ult = T0 + 49 * 40 + 120;
  const e = s.estado(ult + 100);
  t('fluxo normal → AO VIVO verde com dado', e.codigo === 'ao-vivo' && e.classe === 'cb-on' && e.temDado && e.sats === 14, e);
  const c = s.estado(ult + AO_VIVO_MS - 100);
  t('controle: 2,9 s sem ponto ainda é AO VIVO', c.codigo === 'ao-vivo', c);
  const q = s.estado(ult + 4200);
  t('4,2 s sem ponto → SEM SINAL HÁ 4 s, vermelho, sem dado', q.codigo === 'sem-sinal' && q.texto === 'SEM SINAL HÁ 4 s' && q.classe === 'cb-err' && !q.temDado, q);
  t('2 min sem ponto → "HÁ 2 min"', s.estado(ult + 125000).texto === 'SEM SINAL HÁ 2 min', s.estado(ult + 125000).texto);
  s.conexao('error');
  const x = s.estado(ult + 5000);
  t('ponte caiu → SEM CONEXÃO com a idade do último dado', x.codigo === 'sem-conexao' && /último dado há 5 s/.test(x.texto), x.texto);
}

console.log('3) ponto ruim não vale');
{
  t('fix 2 não é bom', !pontoBom(P(T0, { fix: 2 })));
  t('controle: fix 3 é bom', pontoBom(P(T0)));
  t('lat 0 não é bom', !pontoBom(P(T0, { lat: 0 })));
  t('controle: sem campo fix (simulador) é bom', pontoBom({ lat: -15.7, lng: -47.9, tWall: T0 }));
  const s = criarSinalTv(); s.conexao('online');
  s.chegou(P(T0), T0);
  for (let i = 1; i <= 100; i++) s.chegou(P(T0 + i * 40, { fix: 0, numSV: 3 }), T0 + i * 40);
  const e = s.estado(T0 + 4100);
  t('só chega fix ruim há 4 s → GPS SEM POSIÇÃO · 3 satélites (não AO VIVO)', e.codigo === 'sem-posicao' && e.texto === 'GPS SEM POSIÇÃO · 3 satélites' && !e.temDado, e);
  t('controle: o último ponto BOM continua sendo o de antes', s.ultimoBom().tWall === T0);
}

console.log('4) ordem: ponto velho nunca volta a tela');
{
  const s = criarSinalTv(); s.conexao('online');
  for (let i = 0; i <= 100; i++) s.chegou(P(T0 + i * 40), T0 + i * 40 + 100);
  const r = s.chegou(P(T0 + 50 * 40, { kmh: 222 }), T0 + 100 * 40 + 150);
  t('ponto 2 s mais velho que o exibido → maisNovo = false', r.bom && !r.maisNovo, r);
  t('controle: o exibido segue o mais novo (não o de 222 km/h)', s.ultimoBom().kmh === 120 && s.ultimoBom().tWall === T0 + 4000);
  const r2 = s.chegou(P(T0 + 101 * 40), T0 + 101 * 40 + 100);
  t('controle: ponto mais novo → maisNovo = true', r2.maisNovo);
  // depois do último novo, só chega fila velha durante 4 s
  const fim = T0 + 101 * 40 + 100;
  for (let i = 0; i < 100; i++) s.chegou(P(T0 + i * 10), fim + 100 + i * 40);
  const e = s.estado(fim + 4100);
  t('só fila velha chegando → ATRASADO … fila do notebook, sem dado novo', e.codigo === 'atrasado' && /fila do notebook/.test(e.texto) && !e.temDado, e);
  const d = s.chegou(P(T0 + 101 * 40), fim + 4200);
  t('mesmo carimbo de novo (duplicado) não é mais novo', !d.maisNovo);
}

console.log('5) idade pelo carimbo, não pela chegada');
{
  const s = criarSinalTv(); s.conexao('online');
  const ADIANTADA = 90_000;   // relógio da TV 90 s à frente do notebook
  for (let i = 0; i < 200; i++) s.chegou(P(T0 + i * 40), T0 + i * 40 + ADIANTADA + 80);
  const e = s.estado(T0 + 199 * 40 + ADIANTADA + 200);
  t('relógios divergentes 90 s, fluxo em dia → AO VIVO (não "atrasado 90 s")', e.codigo === 'ao-vivo', e);
  // rede trava 20 s; depois chega a fila inteira de uma vez, terminando num ponto 12 s velho
  const base = T0 + 199 * 40;
  const chegada = base + 20_000 + ADIANTADA;
  let ultimo;
  for (let i = 1; i <= 200; i++) { ultimo = base + i * 40; s.chegou(P(ultimo), chegada); }
  const a = s.estado(chegada + 50);
  const esperado = Math.round((chegada - ultimo - ADIANTADA - 80) / 1000);
  t('rajada da fila terminando em ponto velho → ATRASADO ' + esperado + ' s, com dado', a.codigo === 'atrasado' && a.atrasoS === esperado && a.temDado && a.classe === 'cb-wait', a);
  // a fila zera: volta a chegar em dia
  const novo = chegada + 500;
  s.chegou(P(novo - ADIANTADA - 80), novo);
  t('controle: fila zerou → volta a AO VIVO', s.estado(novo + 10).codigo === 'ao-vivo', s.estado(novo + 10));
}

console.log('6) janela do relógio esquece o passado (10 min)');
{
  const s = criarSinalTv({ janelaRelogioMs: 60_000 }); s.conexao('online');
  s.chegou(P(T0), T0 + 50);                        // ponto rápido antigo
  for (let i = 1; i <= 120; i++) s.chegou(P(T0 + i * 1000), T0 + i * 1000 + 2050);   // depois: 2 s a mais de atraso
  const e = s.estado(T0 + 120 * 1000 + 2100);
  t('após a janela, atraso fixo novo vira a referência (AO VIVO)', e.codigo === 'ao-vivo', e);
  const s2 = criarSinalTv({ janelaRelogioMs: 600_000 }); s2.conexao('online');
  s2.chegou(P(T0), T0 + 50);
  for (let i = 1; i <= 120; i++) s2.chegou(P(T0 + i * 1000), T0 + i * 1000 + 5050);
  const c = s2.estado(T0 + 120 * 1000 + 5100);
  t('controle: dentro da janela, o mesmo atraso (5 s) aparece como ATRASADO 5 s', c.codigo === 'atrasado' && c.atrasoS === 5, c);
}

console.log('7) a Vista Piloto usa a regra no modo TV (fonte)');
{
  const html = ler('_design-reference/mockup-command-box-vista-piloto.html');
  t('chave do modo TV (?tv=1 / ?canal=)', /window\.__modoTv\s*=/.test(html) && /classList\.add\('modo-tv'\)/.test(html));
  t('dono único: importa o cérebro do sinal', /import \{ criarSinalTv \} from '\/web\/command-box\/cerebro\/cerebro-tv-sinal\.js'/.test(html));
  // todos os escritores antigos do selo calados no modo TV (régua da fonte: cada função que pinta .cb-txt fora do dono)
  const setEstado = html.match(/function setEstado\(cls, txt\)\{[\s\S]{0,200}?\}/);
  t('setEstado calado no modo TV', setEstado && /if\(window\.__modoTv\) return;/.test(setEstado[0]), setEstado && setEstado[0]);
  t('tick: selo da demonstração só fora do modo TV', /else if\(_real !== _seloReal\)\{/.test(html));
  t('volta gravada DEV: rótulo vai para o dono no modo TV', /if\(rotuloDev && !window\.__modoTv\)/.test(html) && /window\.__tvGps\.rotuloDev = rotuloDev/.test(html));
  const escritores = (html.match(/querySelector\('\.cb-txt'\)/g) || []).length;
  t('régua: 4 lugares tocam o texto do selo (setEstado, tick, volta gravada, dono) — novo escritor reprova', escritores === 4, escritores);
  t('HUD no modo TV recebe GPS só pelo dono', /if\(!window\.__modoTv\) cb\.onGpsPoint\(onGps\);/.test(html));
  t('layout salvo no navegador não vale na TV', /function restore\(\)\{\s*if\(window\.__modoTv\) return false;/.test(html));
  t('controle remoto não edita', /addEventListener\('keydown', function\(e\)\{\s*if\(window\.__modoTv\) return;/.test(html));
  t('sem ponte → recarrega', /location\.reload\(\)/.test(html) && /sinal\.conexao\('sem-ponte'\)/.test(html));
  t('carro congela/some (sem relógio de demonstração)', /tv-carro-parado/.test(html) && /tv-carro-ausente/.test(html));
}

console.log('8) arquitetura: a casa está no registro');
{
  t('CONTRATO_DADOS registra cerebro-tv-sinal.js', /cerebro-tv-sinal\.js/.test(ler('docs/CONTRATO_DADOS.md')));
  t('trava de arquitetura conhece a casa', /cerebro-tv-sinal\.js/.test(ler('tests/node-smoke-arquitetura-dado.mjs')));
}

console.log(`\n${ok} ok, ${fail} falha`);
process.exit(fail ? 1 : 0);
