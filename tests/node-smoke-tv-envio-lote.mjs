// node-smoke-tv-envio-lote.mjs — CATRACA da E2 "TV do box ao vivo" (27/10/2026): como o notebook
// do carro envia pro box. O laço da nuvem (MainWindow.Live.cs) é WinUI e não compila no Mac, então
// a ordem das peças é conferida pelo TEXTO, e cada regra se prova com um controle (a mesma conferência
// num texto mutado TEM que reprovar). A lógica em si (lote, janela de 10 s, reenvio, letreiro) tem
// prova de verdade nos testes C# do Domain (GpsLivePublisherTests, LivePublisherTests, LetreiroAoVivoTests).
// Offline, sem rede.
import { readFileSync } from 'node:fs';

let ok = 0, fail = 0;
const t = (nome, cond) => { if (cond) { ok++; console.log('  ok ', nome); } else { fail++; console.log('  FAIL', nome); } };
const ler = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const LIVE = ler('windows/cockpit/P1Fast.Cockpit.UI/MainWindow.Live.cs');
const GPS = ler('windows/cockpit/P1Fast.Cockpit.Domain/GpsLivePublisher.cs');
const MOTOR = ler('windows/cockpit/P1Fast.Cockpit.Domain/LivePublisher.cs');

// Corpo de um método: da assinatura até a próxima assinatura de método "private" no mesmo nível.
function corpo(src, assinatura) {
  const i = src.indexOf(assinatura);
  if (i < 0) return '';
  const resto = src.slice(i + assinatura.length);
  const j = resto.search(/\n    (private|public|internal) /);
  return j < 0 ? resto : resto.slice(0, j);
}

// ── Regras do laço da nuvem ────────────────────────────────────────────────
function regrasLaco(src) {
  const c = corpo(src, 'private async Task LacoNuvemAsync(');
  const religa = c.indexOf('religacao.GarantirAsync(');
  const gps = c.indexOf('gpsPub.DrenarAsync(');
  const motor = c.indexOf('pub.DrenarAsync(', gps + 1);
  const motorAntes = c.search(/[^s]pub\.DrenarAsync\(/);
  const letreiro = c.indexOf('letreiro.Atualizar(');
  const espera = c.indexOf('Task.Delay(40');
  return {
    achouLaco: c.length > 0,
    religaAntesDasDrenagens: religa >= 0 && gps > religa && motor > religa,
    gpsAntesDoMotor: gps >= 0 && motorAntes > gps,
    letreiroNoGiro: letreiro > motorAntes && letreiro < espera,
    letreiroPintaStatus: /_statusCanal\s*=\s*texto/.test(c) && /RenderStatus\(\)/.test(c),
  };
}

// ── Regras da varredura de subida da gravação ──────────────────────────────
function regrasVarredura(src) {
  const c = corpo(src, 'private Task VarrerPendentesAsync(');
  return {
    achouVarredura: c.length > 0,
    vigiaODiaTodo: /while\s*\(\s*!ct\.IsCancellationRequested\s*\)/.test(c) && !/rodada\s*<\s*6/.test(c),
    naoEncerraSemPendencia: !/pend\.Count\s*==\s*0\)\s*return/.test(c),
    soComCarroParado: /idAtual is not null\)\s*\{\s*espera/.test(c),
  };
}

const L = regrasLaco(LIVE);
t('laço da nuvem encontrado no MainWindow.Live.cs', L.achouLaco);
t('religação ANTES das drenagens (pedido da janela «P1FAST - GPS TV modo RaceBox»)', L.religaAntesDasDrenagens);
t('GPS drena ANTES do motor (achado N3)', L.gpsAntesDoMotor);
t('letreiro de saúde atualizado a cada giro, depois das drenagens (achado N4)', L.letreiroNoGiro);
t('letreiro escreve no status do cockpit', L.letreiroPintaStatus);

const V = regrasVarredura(LIVE);
t('varredura de subida encontrada', V.achouVarredura);
t('varredura vigia o dia todo (sem o teto de 6 rodadas do boot, achado N5)', V.vigiaODiaTodo);
t('nada pendente não encerra a varredura', V.naoEncerraSemPendencia);
t('só sobe com o carro parado (5G da pista é do ao vivo)', V.soComCarroParado);

// ── Contrato do envio (constantes que a TV espera) ─────────────────────────
t('GPS: lote de 200 ms (5 mensagens/s)', /IntervaloLoteMsDefault\s*=\s*200;/.test(GPS));
t('GPS: ao vivo só os últimos 10 s', /JanelaAoVivoMsDefault\s*=\s*10_000;/.test(GPS));
t('GPS: chave aditiva "lote" no topo da mensagem', /topo\["lote"\]\s*=/.test(GPS));
t('motor: ao vivo só os últimos 10 s', /JanelaAoVivoMs\s*=\s*10_000/.test(MOTOR));

// ── CONTROLES: a mesma conferência em texto mutado TEM que reprovar ────────
const trocar = (src, a, b) => { if (!src.includes(a)) throw new Error('controle sem âncora: ' + a); return src.replace(a, b); };
{
  // motor volta a drenar antes do GPS
  const m = LIVE.replace('gpsPub.DrenarAsync(', '@@G@@').replace(/([^s])pub\.DrenarAsync\(/, '$1gpsPub.DrenarAsync(').replace('@@G@@', 'pub.DrenarAsync(');
  t('CONTROLE: motor antes do GPS → reprova', regrasLaco(m).gpsAntesDoMotor === false);
}
{
  const m = trocar(LIVE, 'await religacao.GarantirAsync(nuvem, ct).ConfigureAwait(false);', '');
  t('CONTROLE: sem religação antes das drenagens → reprova', regrasLaco(m).religaAntesDasDrenagens === false);
}
{
  const m = trocar(LIVE, 'letreiro.Atualizar(', 'letreiroX(');
  t('CONTROLE: letreiro desligado → reprova', regrasLaco(m).letreiroNoGiro === false);
}
{
  const m = trocar(LIVE, 'while (!ct.IsCancellationRequested)\n            {\n                TimeSpan espera;',
    'for (int rodada = 0; rodada < 6 && !ct.IsCancellationRequested; rodada++)\n            {\n                TimeSpan espera;');
  t('CONTROLE: varredura de volta ao teto de 6 rodadas → reprova', regrasVarredura(m).vigiaODiaTodo === false);
}
{
  const m = trocar(LIVE, 'else if (idAtual is not null) { espera', 'else if (false) { espera');
  t('CONTROLE: sobe com o carro andando → reprova', regrasVarredura(m).soComCarroParado === false);
}

console.log(`\nnode-smoke-tv-envio-lote: ${ok} ok, ${fail} falha`);
process.exit(fail ? 1 : 0);
