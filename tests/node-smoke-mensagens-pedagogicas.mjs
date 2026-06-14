// Smoke das 17 mensagens pedagógicas aprovadas em 27/05/2026.

import {
  PEDAGOGICA,
  decidirMensagemPedagogica,
  listarMensagens,
  criarEmpurradorDeMensagens,
} from '../web/cockpit/mensagens-pedagogicas.js';
import { CockpitState, MsgTipo } from '../web/cockpit/cockpit-state.js';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log(`✓ ${name}`); ok++; }
  catch (e) { console.log(`✗ ${name} — ${e.message}`); fail++; }
}

t('MP-01 listarMensagens devolve 13 itens (01-13)', () => {
  const lista = listarMensagens();
  if (lista.length !== 13) throw new Error(`tem ${lista.length}`);
});

t('MP-02 sem referência → REGISTRANDO', () => {
  const r = decidirMensagemPedagogica({ primeiraPassagem: true });
  if (r.codigo !== '13' || r.texto !== 'REGISTRANDO') throw new Error(JSON.stringify(r));
});

t('MP-03 delta total grande negativo → RECORDE', () => {
  const r = decidirMensagemPedagogica({
    resultadoDelta: {
      deltaTotalS: -0.30,
      piorSubTrecho: 'freio', piorDeltaS: 0.1,
      porSubTrecho: { entrada: { deltaS: 0 }, freio: { deltaS: 0.1 }, apice: { deltaS: 0 }, saida: { deltaS: 0 } },
    },
  });
  if (r.codigo !== '09') throw new Error(`r=${r.codigo}`);
});

t('MP-04 delta zero → BUSCAR LIMITE', () => {
  const r = decidirMensagemPedagogica({
    resultadoDelta: {
      deltaTotalS: 0.02,
      piorSubTrecho: 'freio', piorDeltaS: 0,
      porSubTrecho: { entrada: { deltaS: 0 }, freio: { deltaS: 0 }, apice: { deltaS: 0 }, saida: { deltaS: 0 } },
    },
  });
  if (r.codigo !== '12') throw new Error(`r=${r.codigo}`);
});

t('MP-05 ganho pequeno → MANTEVE LINHA', () => {
  const r = decidirMensagemPedagogica({
    resultadoDelta: {
      deltaTotalS: -0.08,
      piorSubTrecho: 'freio', piorDeltaS: 0,
      porSubTrecho: { entrada: { deltaS: 0 }, freio: { deltaS: 0 }, apice: { deltaS: 0 }, saida: { deltaS: 0 } },
    },
  });
  if (r.codigo !== '10') throw new Error(`r=${r.codigo}`);
});

t('MP-06 pior no freio + chegou rápido na entrada → FREOU TARDE', () => {
  const r = decidirMensagemPedagogica({
    resultadoDelta: {
      deltaTotalS: 0.20,
      piorSubTrecho: 'freio', piorDeltaS: 0.18,
      porSubTrecho: {
        entrada: { deltaS: -0.05 },  // chegou mais rápido
        freio:   { deltaS: 0.18 },
        apice:   { deltaS: 0.04 },
        saida:   { deltaS: 0.03 },
      },
    },
  });
  if (r.codigo !== '02' || r.texto !== 'FREOU TARDE') throw new Error(JSON.stringify(r));
});

t('MP-07 pior no freio + entrada normal → FREOU CEDO', () => {
  const r = decidirMensagemPedagogica({
    resultadoDelta: {
      deltaTotalS: 0.20,
      piorSubTrecho: 'freio', piorDeltaS: 0.18,
      porSubTrecho: {
        entrada: { deltaS: 0.02 },
        freio:   { deltaS: 0.18 },
        apice:   { deltaS: 0 },
        saida:   { deltaS: 0 },
      },
    },
  });
  if (r.codigo !== '01' || r.texto !== 'FREOU CEDO') throw new Error(JSON.stringify(r));
});

t('MP-08 pior na entrada → PISOU POUCO', () => {
  const r = decidirMensagemPedagogica({
    resultadoDelta: {
      deltaTotalS: 0.30,
      piorSubTrecho: 'entrada', piorDeltaS: 0.25,
      porSubTrecho: {
        entrada: { deltaS: 0.25 }, freio: { deltaS: 0.05 }, apice: { deltaS: 0 }, saida: { deltaS: 0 },
      },
    },
  });
  if (r.codigo !== '08' || r.texto !== 'PISOU POUCO') throw new Error(JSON.stringify(r));
});

t('MP-09 pior na saída → ACELEROU TARDE', () => {
  const r = decidirMensagemPedagogica({
    resultadoDelta: {
      deltaTotalS: 0.30,
      piorSubTrecho: 'saida', piorDeltaS: 0.25,
      porSubTrecho: { entrada: { deltaS: 0 }, freio: { deltaS: 0 }, apice: { deltaS: 0 }, saida: { deltaS: 0.25 } },
    },
  });
  if (r.codigo !== '05' || r.texto !== 'ACELEROU TARDE') throw new Error(JSON.stringify(r));
});

t('MP-10 pior no apex + ápice à direita do carro (≈90°) → VIROU POUCO', () => {
  const r = decidirMensagemPedagogica({
    resultadoDelta: {
      deltaTotalS: 0.30,
      piorSubTrecho: 'apice', piorDeltaS: 0.20,
      porSubTrecho: { entrada: { deltaS: 0 }, freio: { deltaS: 0 }, apice: { deltaS: 0.20 }, saida: { deltaS: 0.10 } },
    },
    contextoApice: { angleDeg: 90 },
  });
  if (r.codigo !== '03' || r.texto !== 'VIROU POUCO') throw new Error(JSON.stringify(r));
});

t('MP-11 pior no apex + ápice à esquerda (≈270°) → VIROU MUITO', () => {
  const r = decidirMensagemPedagogica({
    resultadoDelta: {
      deltaTotalS: 0.30,
      piorSubTrecho: 'apice', piorDeltaS: 0.20,
      porSubTrecho: { entrada: { deltaS: 0 }, freio: { deltaS: 0 }, apice: { deltaS: 0.20 }, saida: { deltaS: 0.10 } },
    },
    contextoApice: { angleDeg: 270 },
  });
  if (r.codigo !== '04' || r.texto !== 'VIROU MUITO') throw new Error(JSON.stringify(r));
});

t('MP-12 pior no apex + ápice à frente (≈0°) → VIROU CEDO', () => {
  const r = decidirMensagemPedagogica({
    resultadoDelta: {
      deltaTotalS: 0.30,
      piorSubTrecho: 'apice', piorDeltaS: 0.20,
      porSubTrecho: { entrada: { deltaS: 0 }, freio: { deltaS: 0 }, apice: { deltaS: 0.20 }, saida: { deltaS: 0.10 } },
    },
    contextoApice: { angleDeg: 0 },
  });
  if (r.codigo !== '07' || r.texto !== 'VIROU CEDO') throw new Error(JSON.stringify(r));
});

t('MP-13 pior no apex + ápice atrás (≈180°) → VIROU TARDE', () => {
  const r = decidirMensagemPedagogica({
    resultadoDelta: {
      deltaTotalS: 0.30,
      piorSubTrecho: 'apice', piorDeltaS: 0.20,
      porSubTrecho: { entrada: { deltaS: 0 }, freio: { deltaS: 0 }, apice: { deltaS: 0.20 }, saida: { deltaS: 0.10 } },
    },
    contextoApice: { angleDeg: 180 },
  });
  if (r.codigo !== '06' || r.texto !== 'VIROU TARDE') throw new Error(JSON.stringify(r));
});

t('MP-14 piorDeltaS abaixo do limiar (< 0.05) → null (nada importante)', () => {
  const r = decidirMensagemPedagogica({
    resultadoDelta: {
      deltaTotalS: 0.10,
      piorSubTrecho: 'freio', piorDeltaS: 0.02,
      porSubTrecho: { entrada: { deltaS: 0.02 }, freio: { deltaS: 0.02 }, apice: { deltaS: 0.02 }, saida: { deltaS: 0.02 } },
    },
  });
  if (r !== null) throw new Error(`r=${JSON.stringify(r)}`);
});

t('MP-15 todas as mensagens têm tipo válido COMUNICACAO', () => {
  const cenarios = [
    { primeiraPassagem: true },
    { resultadoDelta: { deltaTotalS: -0.5, piorSubTrecho: 'freio', piorDeltaS: 0, porSubTrecho: {entrada:{deltaS:0},freio:{deltaS:0},apice:{deltaS:0},saida:{deltaS:0}} } },
    { resultadoDelta: { deltaTotalS: 0,    piorSubTrecho: 'freio', piorDeltaS: 0, porSubTrecho: {entrada:{deltaS:0},freio:{deltaS:0},apice:{deltaS:0},saida:{deltaS:0}} } },
  ];
  for (const c of cenarios) {
    const r = decidirMensagemPedagogica(c);
    if (r && r.tipo !== MsgTipo.COMUNICACAO) {
      throw new Error(`tipo=${r.tipo}`);
    }
  }
});

t('MP-16 empurrador: delta-calculado disparado → CockpitState.message preenchido', () => {
  const cs = new CockpitState();
  const empurrar = criarEmpurradorDeMensagens({ cockpitState: cs });
  empurrar({
    segmentId: 's1',
    deltaTotalS: 0.30,
    piorSubTrecho: 'freio', piorDeltaS: 0.18,
    porSubTrecho: {
      entrada: { deltaS: 0 }, freio: { deltaS: 0.18 }, apice: { deltaS: 0 }, saida: { deltaS: 0 },
    },
  });
  const msg = cs.get().message;
  if (!msg || msg.texto !== 'FREOU CEDO') throw new Error(JSON.stringify(msg));
});

t('MP-17 empurrador.emitirRegistrando → REGISTRANDO chega no painel', () => {
  const cs = new CockpitState();
  const empurrar = criarEmpurradorDeMensagens({ cockpitState: cs });
  empurrar.emitirRegistrando();
  const msg = cs.get().message;
  if (!msg || msg.texto !== 'REGISTRANDO') throw new Error(JSON.stringify(msg));
});

console.log(`\nMensagens pedagógicas: ${ok} ok / ${fail} fail`);
if (fail) process.exit(1);
