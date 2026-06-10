// Smoke da CoreografiaVolta — o QUANDO de cada tela (coreografia fechada 09/06).
import { CoreografiaVolta } from '../web/cockpit/coreografia-volta.js';

let ok = 0, fail = 0;
function t(nome, cond, extra) {
  if (cond) { ok++; console.log('✓ ' + nome); }
  else { fail++; console.log('✗ ' + nome + (extra ? ' — ' + extra : '')); }
}

// 3 segmentos em linha no equador: gaps de ~111 m (s1→s2), ~333 m (s2→s3, RETA LONGA), ~111 m (s3→s1)
function linha(lng) { return { a: { lat: 0.0001, lng }, b: { lat: -0.0001, lng } }; }
// entrada do s1 fica logo após a saída do s3 (fechamento do circuito curto, ~22 m)
const segs = [
  { id: 's1', entradaLine: linha(0.0072), saidaLine: linha(0.001), apicePoint: { lat: 0, lng: 0.0005 } },
  { id: 's2', entradaLine: linha(0.002), saidaLine: linha(0.003), apicePoint: { lat: 0, lng: 0.0025 } },
  { id: 's3', entradaLine: linha(0.006), saidaLine: linha(0.007), apicePoint: { lat: 0, lng: 0.0065 } },
];
const gps = lng => ({ lat: 0, lng });

function montar() {
  const log = [];
  const c = new CoreografiaVolta(segs, {
    onPainel: () => log.push('painel'),
    onResumoVolta: () => log.push('resumo'),
    onOrientacao: (seg, prog) => log.push('orientacao:' + seg.id + ':' + prog.toFixed(2)),
  });
  return { c, log };
}

// CV-01: reta mais longa identificada (s2→s3)
{
  const { c } = montar();
  t('CV-01 reta mais longa = depois de s2', c.retaMaisLonga().deSegId === 's2');
}

// CV-02: saiu do trecho → painel padrão (desempenho do trecho feito)
{
  const { c, log } = montar();
  c.evento({ type: 'saida-cruzou', segmentId: 's1' });
  t('CV-02 pós-saída → painel', log[log.length - 1] === 'painel');
}

// CV-03: antes da metade da reta → NADA de orientação
{
  const { c, log } = montar();
  c.evento({ type: 'saida-cruzou', segmentId: 's1' });
  c.gps(gps(0.0012)); // ~20% da reta s1→s2
  t('CV-03 20% da reta → sem orientação', !log.some(l => l.startsWith('orientacao')));
}

// CV-04: passou da metade → orientação do PRÓXIMO trecho
{
  const { c, log } = montar();
  c.evento({ type: 'saida-cruzou', segmentId: 's1' });
  c.gps(gps(0.0016)); // ~60%
  const ult = log[log.length - 1];
  t('CV-04 60% da reta → orientação do s2', ult && ult.startsWith('orientacao:s2'), ult);
}

// CV-05: progresso da régua cai conforme chega na entrada
{
  const { c, log } = montar();
  c.evento({ type: 'saida-cruzou', segmentId: 's1' });
  c.gps(gps(0.0016));
  c.gps(gps(0.0019)); // ~90%
  const progs = log.filter(l => l.startsWith('orientacao:s2')).map(l => Number(l.split(':')[2]));
  t('CV-05 régua esvazia', progs.length >= 2 && progs[progs.length - 1] < progs[0], JSON.stringify(progs));
}

// CV-06: entrou no trecho → painel ao vivo (orientação sai)
{
  const { c, log } = montar();
  c.evento({ type: 'saida-cruzou', segmentId: 's1' });
  c.gps(gps(0.0016));
  c.evento({ type: 'entrada-cruzou', segmentId: 's2' });
  t('CV-06 entrada → painel', log[log.length - 1] === 'painel');
}

// CV-07/08/09: reta LONGA → painel, depois RESUMO DA VOLTA, depois orientação
{
  const { c, log } = montar();
  c.evento({ type: 'saida-cruzou', segmentId: 's2' }); // entra na reta longa s2→s3
  c.gps(gps(0.0033)); // ~10%
  t('CV-07 começo da reta longa → ainda painel', !log.some(l => l !== 'painel'));
  c.gps(gps(0.0044)); // ~47% → fase resumo (35–66%)
  t('CV-08 meio da reta longa → resumo da volta', log[log.length - 1] === 'resumo');
  c.gps(gps(0.0052)); // ~73% → orientação do s3
  const ult = log[log.length - 1];
  t('CV-09 fim da reta longa → orientação do s3', ult && ult.startsWith('orientacao:s3'), ult);
}

// CV-10: GPS fora de estado de reta não dispara nada
{
  const { c, log } = montar();
  c.gps(gps(0.0016));
  t('CV-10 GPS sem saída antes → silêncio', log.length === 0);
}

console.log(`\nCoreografiaVolta: ${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
