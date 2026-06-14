// Smoke do classificador-vivo-bridge — liga passagem-fechada (ao vivo) -> classifica -> estado vivo.
// Cobre: passagem fechada classifica e empilha; proposta NASCE uma vez (não repete); decidir aplica;
// segmento desconhecido é ignorado; store injetado é chamado; snapshot traz estado + tendência.
import { criarClassificadorVivo } from '../web/cockpit/classificador-vivo-bridge.js';

let ok = 0, fail = 0;
function t(nome, cond, extra) {
  if (cond) { ok++; console.log('✓ ' + nome); }
  else { fail++; console.log('✗ ' + nome + (extra ? ' — ' + extra : '')); }
}

const R2D = 180 / Math.PI, D2R = Math.PI / 180, R = 6378137;
// passagem reta com velocidades dadas (km/h), pontos a passoM metros (igual ao smoke do classificador).
function passagem(kmhs, passoM = 30) {
  const lat0 = -15.77, lng0 = -47.90, cos0 = Math.cos(lat0 * D2R);
  let tt = 1_000_000;
  return kmhs.map((kmh, i) => {
    const x = i * passoM;
    const lng = lng0 + (x / (R * cos0)) * R2D;
    if (i > 0) { const vMs = Math.max(1, (kmhs[i - 1] + kmh) / 2 / 3.6); tt += (passoM / vMs) * 1000; }
    return { lat: lat0, lng, kmh, t: tt };
  });
}
const PASS_T1 = [150, 130, 105, 90, 92];   // classifica como T1 (freada forte)
const PASS_SF = [142, 142, 144, 146];      // classifica como SF (quase constante, vmin alto)

// store injetado (conta chamadas) + captura de propostas
let salvos = 0, ultimoSnapshot = null;
const store = { salvar(s) { salvos++; ultimoSnapshot = s; } };
const propostas = [];
const vivo = criarClassificadorVivo({
  segmentos: [{ id: 'seg1', nome: 'CURVA TESTE', ordem: 1, distProximaM: 999, tipoAprovado: 'T0' }],
  onProposta: (info) => propostas.push(info),
  store,
});

// ── segmento desconhecido é ignorado ──
t('segmento fora do conjunto é ignorado (retorna null)', vivo.aoFecharPassagem({ segmentId: 'XXX', pontos: passagem(PASS_T1) }) === null);
t('passagem curta demais é ignorada', vivo.aoFecharPassagem({ segmentId: 'seg1', pontos: [{ lat: 0, lng: 0, kmh: 1, t: 0 }] }) === null);

// ── 1ª passagem T1: classifica, ainda sem proposta ──
const r1 = vivo.aoFecharPassagem({ segmentId: 'seg1', pontos: passagem(PASS_T1), contexto: { volta: 1 } });
t('passagem fechada classifica como T1', r1 && r1.classificacao.tipo === 'T1');
t('1 passagem só: ainda sem proposta', r1 && r1.propostaPendente === null);
t('store.salvar foi chamado ao fechar a passagem', salvos >= 1);

// ── 2ª e 3ª passagem T1: proposta NASCE no 3º (T0 -> T1), onProposta chamado UMA vez ──
vivo.aoFecharPassagem({ segmentId: 'seg1', pontos: passagem(PASS_T1), contexto: { volta: 2 } });
const r3 = vivo.aoFecharPassagem({ segmentId: 'seg1', pontos: passagem(PASS_T1), contexto: { volta: 3 } });
t('3 passagens T1 fazem nascer a proposta T0 -> T1', r3 && r3.propostaPendente && r3.propostaPendente.de === 'T0' && r3.propostaPendente.para === 'T1');
t('onProposta foi chamado exatamente 1 vez (proposta nasce, não repete)', propostas.length === 1 && propostas[0].segmentId === 'seg1');

// ── 4ª passagem T1: proposta já aberta, NÃO dispara onProposta de novo ──
vivo.aoFecharPassagem({ segmentId: 'seg1', pontos: passagem(PASS_T1), contexto: { volta: 4 } });
t('proposta já aberta não dispara onProposta de novo', propostas.length === 1);

// ── decidir aprovar aplica o tipo novo ──
const estApos = vivo.decidir('seg1', 'aprovar');
t('decidir(aprovar) muda o tipo aprovado para T1', estApos && estApos.tipoAprovado === 'T1' && estApos.propostaPendente === null);
t('decidir em segmento desconhecido retorna null', vivo.decidir('XXX', 'aprovar') === null);

// ── snapshot traz estado + tendência ──
const snap = vivo.snapshot();
t('snapshot traz o segmento com estado e tendência', Array.isArray(snap) && snap.length === 1 && snap[0].segmentId === 'seg1' && snap[0].estado.tipoAprovado === 'T1' && 'tendencia' in snap[0]);
t('store recebeu o snapshot mais recente após decidir', Array.isArray(ultimoSnapshot) && ultimoSnapshot[0].estado.tipoAprovado === 'T1');

// ── sem store, funciona em memória (não quebra) ──
const semStore = criarClassificadorVivo({ segmentos: [{ id: 's', nome: 'C', ordem: 1, tipoAprovado: 'SF' }] });
const rs = semStore.aoFecharPassagem({ segmentId: 's', pontos: passagem(PASS_SF) });
t('funciona sem store (só memória)', rs && rs.classificacao.tipo === 'SF');

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
