// Smoke do delta-calculator — perda de tempo por sub-trecho.
import { calcularDelta, pontoCanonico, SUB_TRECHOS } from '../web/cockpit/delta-calculator.js';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log(`✓ ${name}`); ok++; }
  catch (e) { console.log(`✗ ${name} — ${e.message}`); fail++; }
}

// Helper: gera trajetória reta de 100m com velocidade constante
function geraReta(kmh, sub = 'freio', n = 20) {
  const passoLat = 0.001 / n; // ~111m total
  const pontos = [];
  for (let i = 0; i < n; i++) {
    pontos.push({
      lat: -15.79 + i * passoLat,
      lng: -47.89,
      kmh,
      t: i * 100,
      fracao: i / (n - 1),
      sub,
    });
  }
  return pontos;
}

t('DC-01 SUB_TRECHOS canônico tem 4 itens', () => {
  if (SUB_TRECHOS.length !== 4) throw new Error(`tem ${SUB_TRECHOS.length}`);
  for (const s of ['entrada','freio','apice','saida']) {
    if (!SUB_TRECHOS.includes(s)) throw new Error(`falta ${s}`);
  }
});

t('DC-02 referência ausente lança erro explícito', () => {
  let pegou = false;
  try { calcularDelta({ atual: null, referencia: null }); }
  catch (e) { pegou = e.message.includes('precisam ter pontos'); }
  if (!pegou) throw new Error('não lançou erro de contrato');
});

t('DC-03 passagem idêntica à referência → delta zero', () => {
  const pontos = geraReta(100, 'freio');
  const r = calcularDelta({
    atual:      { segmentId: 's1', pontos },
    referencia: { segmentId: 's1', pontos },
  });
  if (Math.abs(r.deltaTotalS) > 0.001) throw new Error(`delta=${r.deltaTotalS}`);
});

t('DC-04 atual mais lento que referência → delta positivo', () => {
  const ref   = geraReta(100, 'freio');
  const atual = geraReta(80,  'freio'); // 80km/h = mais lento
  const r = calcularDelta({
    atual:      { segmentId: 's1', pontos: atual },
    referencia: { segmentId: 's1', pontos: ref },
  });
  if (r.deltaTotalS <= 0) throw new Error(`esperava positivo, deu ${r.deltaTotalS}`);
});

t('DC-05 atual mais rápido → delta negativo', () => {
  const ref   = geraReta(80, 'freio');
  const atual = geraReta(120, 'freio'); // bem mais rápido
  const r = calcularDelta({
    atual:      { segmentId: 's1', pontos: atual },
    referencia: { segmentId: 's1', pontos: ref },
  });
  if (r.deltaTotalS >= 0) throw new Error(`esperava negativo, deu ${r.deltaTotalS}`);
});

t('DC-06 piorSubTrecho aponta corretamente para o segmento que mais perdeu', () => {
  // Atual: rápido em entrada/freio, lento em apice
  const ref = [
    ...geraReta(100, 'entrada', 10),
    ...geraReta(100, 'freio',   10),
    ...geraReta(100, 'apice',   10),
    ...geraReta(100, 'saida',   10),
  ];
  const atual = [
    ...geraReta(100, 'entrada', 10),
    ...geraReta(100, 'freio',   10),
    ...geraReta(60,  'apice',   10), // perdeu MUITO tempo no apex
    ...geraReta(100, 'saida',   10),
  ];
  // Reindexa o t pra ser monotônico
  let tCum = 0;
  for (const p of ref)   { p.t = (tCum += 50); }
  tCum = 0;
  for (const p of atual) { p.t = (tCum += 50); }
  const r = calcularDelta({
    atual:      { segmentId: 's1', pontos: atual },
    referencia: { segmentId: 's1', pontos: ref },
  });
  if (r.piorSubTrecho !== 'apice') {
    throw new Error(`pior=${r.piorSubTrecho} (esperava apice)`);
  }
});

t('DC-07 pontos com kmh quase zero (parado) são descartados sem quebrar', () => {
  const ref   = geraReta(100, 'freio');
  const atual = geraReta(100, 'freio');
  atual[5].kmh = 0;
  atual[6].kmh = 0.1;
  const r = calcularDelta({
    atual:      { segmentId: 's1', pontos: atual },
    referencia: { segmentId: 's1', pontos: ref },
  });
  if (!Number.isFinite(r.deltaTotalS)) throw new Error('NaN/Infinity em delta');
});

t('DC-08 pontoCanonico produz fracao 0..1 monotônica', () => {
  const p0 = pontoCanonico({ lat: 0, lng: 0, kmh: 50, t: 0 }, 'freio', 0, 100);
  const p5 = pontoCanonico({ lat: 0, lng: 0, kmh: 50, t: 0 }, 'freio', 50, 100);
  const p1 = pontoCanonico({ lat: 0, lng: 0, kmh: 50, t: 0 }, 'freio', 100, 100);
  if (p0.fracao !== 0)   throw new Error(`p0=${p0.fracao}`);
  if (p5.fracao !== 0.5) throw new Error(`p5=${p5.fracao}`);
  if (p1.fracao !== 1)   throw new Error(`p1=${p1.fracao}`);
});

t('DC-09 fracao clampada em [0,1] mesmo com input fora do range', () => {
  const acima = pontoCanonico({ lat: 0, lng: 0, kmh: 50, t: 0 }, 'freio', 150, 100);
  const abaixo = pontoCanonico({ lat: 0, lng: 0, kmh: 50, t: 0 }, 'freio', -10, 100);
  if (acima.fracao !== 1) throw new Error(`acima=${acima.fracao}`);
  if (abaixo.fracao !== 0) throw new Error(`abaixo=${abaixo.fracao}`);
});

t('DC-10 passagem com menos de 2 pontos é descartada com erro claro', () => {
  let pegou = false;
  try {
    calcularDelta({
      atual:      { segmentId: 's1', pontos: [{ lat: 0, lng: 0, kmh: 100, t: 0, fracao: 0, sub: 'freio' }] },
      referencia: { segmentId: 's1', pontos: geraReta(100, 'freio') },
    });
  } catch (e) { pegou = e.message.includes('menos de 2'); }
  if (!pegou) throw new Error('aceitou passagem de 1 ponto');
});

t('DC-11 ponto sem velocidade (kmh ausente) não envenena o delta com NaN', () => {
  const ref = { segmentId: 's1', pontos: geraReta(100, 'freio') };
  const pontos = geraReta(90, 'freio');
  delete pontos[5].kmh; // um furo de leitura no meio da passagem
  const r = calcularDelta({ atual: { segmentId: 's1', pontos }, referencia: ref });
  if (!Number.isFinite(r.deltaTotalS)) throw new Error('deltaTotalS=' + r.deltaTotalS);
  for (const sub of Object.keys(r.porSubTrecho)) {
    if (!Number.isFinite(r.porSubTrecho[sub].deltaS)) throw new Error(`sub ${sub} com NaN`);
  }
});

console.log(`\nDelta calculator: ${ok} ok / ${fail} fail`);
if (fail) process.exit(1);
