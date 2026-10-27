// ═══════════════════════════════════════════════════════════
// CATRACA da E4 (TV do box ao vivo, 27/10/2026) — atalho TESTE AO VIVO
// ═══════════════════════════════════════════════════════════
// Trava o que a E4 consertou, para não voltar:
//  - o ensaio NUNCA vai ao ar: TESTE-AO-VIVO.cmd sobe o cockpit --live SEM --producao;
//  - abre o RELEASE recém-compilado (nunca o Debug) e não sobe 2ª cópia (RaceBox é de um programa só);
//  - a página de vídeo ouve o canal do endereço (?canal=), o MESMO onde o cockpit sem --producao publica
//    (antes ela ouvia fixo cockpit-bubi-live e o GPS do ensaio nunca chegava ao vídeo);
//  - sem ?canal (ou nome fora da regra) a página continua em produção, como sempre;
//  - os 2 ícones apontam para .cmd que existem.
// Cada regra tem controle (o caso que TEM de dar o oposto).
// Roda com: node tests/node-smoke-teste-ao-vivo.mjs   (e dentro de npm run smoke)
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

let ok = 0, fail = 0;
function t(nome, cond, det = '') { if (cond) { ok++; console.log('  ok ', nome); } else { fail++; console.log('  FAIL', nome, det ? '— ' + det : ''); } }
const raiz = new URL('../', import.meta.url);
const ler = (f) => readFileSync(new URL(f, raiz), 'utf8');
// Peça faltando ou seção que quebra = FAIL com o nome (nunca sai calada nem para as seções seguintes).
async function secao(nome, fn) { try { await fn(); } catch (e) { t(`seção inteira: ${nome}`, false, String(e.message).split('\n')[0]); } }

// Linhas que o cmd.exe EXECUTA (fora de REM/::) — comentário pode citar --producao à vontade.
const linhasVivas = (s) => s.split(/\r?\n/).filter((l) => !/^\s*(@?rem\b|::)/i.test(l));
const producaoFora = (s) => linhasVivas(s).some((l) => /--producao\b/i.test(l));
// Parênteses de bloco: ignora o que está entre aspas e o escapado (^( ^)); nunca fecha antes de abrir.
function parentesesOk(s) {
  let n = 0;
  for (const l of linhasVivas(s)) {
    let aspas = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (c === '^') { i++; continue; }
      if (c === '"') { aspas = !aspas; continue; }
      if (aspas) continue;
      if (c === '(') n++;
      else if (c === ')') { n--; if (n < 0) return false; }
    }
  }
  return n === 0;
}

await secao('1) TESTE-AO-VIVO.cmd nunca vai ao ar', () => {
  const cmd = ler('windows/cockpit/TESTE-AO-VIVO.cmd');
  const vivas = linhasVivas(cmd);
  t('.cmd só com ASCII (o cmd.exe lê em OEM; acento vira lixo)', /^[\x00-\x7f]*$/.test(cmd));
  t('nenhuma linha executada leva --producao', !producaoFora(cmd), vivas.filter((l) => /--producao/i.test(l)).join(' | '));
  t('controle: o detector ACHA --producao no P1FAST-AO-VIVO.cmd (o de produção)', producaoFora(ler('windows/cockpit/P1FAST-AO-VIVO.cmd')));
  const sobeExe = vivas.filter((l) => /^\s*start\b.*%EXE%/i.test(l));
  t('sobe o cockpit uma vez só, com --live', sobeExe.length === 1 && /%EXE%"?\s+--live\b/i.test(sobeExe[0]), sobeExe.join(' | '));
  const exe = (vivas.find((l) => /^\s*set\s+"EXE=/i.test(l)) || '');
  t('o .exe é o RELEASE (\\Release\\) e nunca o Debug', /\\Release\\/.test(exe) && !/\\Debug\\/i.test(exe), exe.trim());
  t('compila o RELEASE antes de abrir (dotnet build -c Release)', vivas.some((l) => /dotnet build\b.*-c Release\b/i.test(l)));
  const iTask = vivas.findIndex((l) => /^\s*tasklist\b/i.test(l));
  const iStart = vivas.findIndex((l) => /^\s*start\b/i.test(l));
  const iBuild = vivas.findIndex((l) => /dotnet build\b/i.test(l));
  t('trava de 2ª cópia (tasklist) vem antes de compilar e de subir qualquer coisa', iTask >= 0 && iTask < iBuild && iTask < iStart, `tasklist ${iTask}, build ${iBuild}, start ${iStart}`);
  t('parênteses de bloco fecham certo (echo com ")" solto derruba o if)', parentesesOk(cmd));
  t('controle: o contador acusa ")" solto', !parentesesOk('if 1==1 (\n  echo quebrou (sim)\n)\necho )\n'));
  t('sem rótulo/goto (o .cmd é LF, como os irmãos; rótulo em LF falha no cmd.exe)', !vivas.some((l) => /^\s*:[a-z]|\bgoto\b|\bcall\s+:/i.test(l)));
});

await secao('2) mesmo canal nas duas pontas (fonte: MainWindow.Live.cs)', () => {
  const cmd = ler('windows/cockpit/TESTE-AO-VIVO.cmd');
  const cs = ler('windows/cockpit/P1Fast.Cockpit.UI/MainWindow.Live.cs');
  const canalCs = (cs.match(/LiveCanalTeste\s*=\s*"([^"]+)"/) || [])[1];
  const canalCmd = (cmd.match(/^\s*set\s+"CANAL=([^"]+)"/im) || [])[1];
  t('o cockpit (fonte) tem canal de teste', !!canalCs);
  t('CANAL do .cmd == LiveCanalTeste do cockpit (onde ele publica sem --producao)', !!canalCmd && canalCmd === canalCs, `${canalCmd} × ${canalCs}`);
  t('controle: o canal de teste não é o de produção', canalCs !== 'cockpit-bubi-live');
  t('o vídeo abre com ?canal=%CANAL%', /^\s*start\s+""\s+"http:\/\/localhost:8765\/\?canal=%CANAL%"/im.test(cmd));
});

await secao('3) página de vídeo ouve o canal do endereço', () => {
  const html = ler('web/teste-aparelhos/index.html');
  const m = html.match(/\/\/ CANAL-DA-PAGINA:INICIO\n([\s\S]*?)\/\/ CANAL-DA-PAGINA:FIM/);
  t('trecho CANAL-DA-PAGINA existe na página', !!m);
  const ctx = { URLSearchParams };
  vm.runInNewContext((m ? m[1] : '') + '\nthis.f = typeof canalDaPagina === "function" ? canalDaPagina : null;', ctx);
  const f = ctx.f;
  t('canalDaPagina é função', typeof f === 'function');
  if (typeof f !== 'function') return;
  const cs = ler('windows/cockpit/P1Fast.Cockpit.UI/MainWindow.Live.cs');
  const canalCs = (cs.match(/LiveCanalTeste\s*=\s*"([^"]+)"/) || [])[1];
  t('?canal=<canal de teste do cockpit> → ouve o teste', f('?canal=' + canalCs) === canalCs, f('?canal=' + canalCs));
  t('sem ?canal → produção (P1FAST-AO-VIVO.cmd não muda)', f('') === 'cockpit-bubi-live' && f(undefined) === 'cockpit-bubi-live');
  t('controle: nome fora da regra → produção', f('?canal=outro') === 'cockpit-bubi-live');
  t('controle: maiúscula fora da regra → produção', f('?canal=cockpit-bubi-LIVE') === 'cockpit-bubi-live');
  t('controle: nome comprido demais → produção', f('?canal=cockpit-bubi-' + 'a'.repeat(41)) === 'cockpit-bubi-live');
  t('a página usa o canal do endereço', /const CHANNEL_NAME\s*=\s*canalDaPagina\(location\.search\)/.test(html));
  t('controle: não sobrou canal fixo de produção na página', !/const CHANNEL_NAME\s*=\s*'cockpit-bubi-live'/.test(html));
  // Mesma regra da ponte da TV (web/cockpit/cloud-bridge.js): a TV e a página de vídeo aceitam os mesmos nomes.
  const ponte = ler('web/cockpit/cloud-bridge.js');
  const regraPonte = (ponte.match(/CANAL_VALIDO\s*=\s*(\/[^\n]+\/);/) || [])[1];
  const regraPagina = m && (m[1].match(/(\/\^cockpit-bubi-[^/]*\/)\.test/) || [])[1];
  t('regra do nome do canal IGUAL à da ponte da TV (cloud-bridge.js)', !!regraPonte && regraPonte === regraPagina, `${regraPagina} × ${regraPonte}`);
  t('selo diz TESTE quando o canal é de teste', /CANAL_TESTE \? 'NUVEM · TESTE ✓/.test(html));
});

await secao('4) ícones', () => {
  const ic = ler('windows/cockpit/INSTALAR-ICONE.cmd');
  const citados = [...new Set([...ic.matchAll(/'([A-Za-z0-9-]+\.cmd)'/g)].map((x) => x[1]))];
  t('instala os 2 ícones (AO VIVO e TESTE AO VIVO)', citados.includes('P1FAST-AO-VIVO.cmd') && citados.includes('TESTE-AO-VIVO.cmd'), citados.join(','));
  for (const c of citados) t(`ícone aponta para .cmd que existe: ${c}`, existsSync(new URL('windows/cockpit/' + c, raiz)));
  t('desenho do ícone vem do RELEASE, Debug só de reserva', /\\Release\\[^']*'\);\s*if\(-not \(Test-Path \$exe\)\)\{ \$exe=[^}]*\\Debug\\/.test(ic));
  t('.cmd só com ASCII', /^[\x00-\x7f]*$/.test(ic));
  t('parênteses de bloco fecham certo', parentesesOk(ic));
});

console.log(`\nteste-ao-vivo: ${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
