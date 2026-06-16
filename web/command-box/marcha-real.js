// marcha-real.js — ADAPTADOR: liga a barra de marcha (shift light) do Command Box
// no MESMO cérebro do cockpit do piloto. NÃO duplica lógica: importa o
// orquestrador de produção (web/cockpit/shift-light-orquestrador.js), que:
//   - infere a MARCHA atual pela razão rpm/velocidade (gear-detector-online.js);
//   - mira o ponto de troca na POTÊNCIA MÁXIMA do motor (Bubi 6.050 rpm),
//     refinado por aprendizado de tempo de passagem quando há dado de pista.
//
// SEGURANÇA: não chamamos setIdentificacao (piloto/carro ficam nulos), então a
// persistência do orquestrador fica INERTE — ZERO escrita no banco. O Command Box
// só CONSOME telemetria ao vivo (leitura). O gráfico da barra (12 luzes) é do
// próprio Command Box e NÃO muda — decisão Flávio 15/06 (Command Box ≠ painel do piloto).
//
// Padrão de módulo igual ao da frenagem (frenagem-curvas-reais.js): ES module
// puro, sem DOM e sem rede própria; quem assina o canal e desenha é o mockup.

import { criarShiftLightOrquestrador } from '../cockpit/shift-light-orquestrador.js';

export function criarCerebroMarcha({ dynoCurve = [] } = {}) {
  // cockpitState "de mentirinha": o orquestrador escreveria aqui o % de aprendizado.
  // O Command Box não tem barra de aprendizado, então absorvemos as chamadas sem efeito.
  const cockpitStateStub = {
    setAprendizado() {},
    setFlashIa() {},
    get() { return { aprendizado: { pct: 0 } }; },
  };

  // Sem dynoCurve, o orquestrador usa o pico de potência do perfil Bubi (6.050).
  const orq = criarShiftLightOrquestrador({ cockpitState: cockpitStateStub, dynoCurve });

  return {
    // Ingere uma amostra de telemetria ao vivo. rpm e kmh precisam ser válidos
    // (o detector de marcha só trabalha com o carro andando).
    ingest(rpm, kmh, ts) {
      if (!Number.isFinite(rpm) || !Number.isFinite(kmh)) return;
      orq.ingestSample({ rpm, kmh, ts: Number.isFinite(ts) ? ts : (typeof performance !== 'undefined' ? performance.now() : Date.now()) });
    },

    // Marcha atual inferida (1..5) ou null enquanto o cérebro ainda não travou a marcha.
    getMarcha() {
      const m = orq.getEstado().marchaAtual;
      return (typeof m === 'number') ? m : null;
    },

    // RPM onde a luz deve acender (MESMA lógica do cockpit): ponto antecipado pelo
    // tempo de reação; cai na semente (potência máxima 6.050) enquanto não há marcha.
    getRpmTroca() {
      const luz = orq.getRpmVisualLuz();
      if (luz && Number.isFinite(luz.rpmVisual)) return luz.rpmVisual;
      const otimo = orq.getRpmOtimoTroca();
      if (Number.isFinite(otimo)) return otimo;
      return orq.getAlvoSemente(); // 6.050 (Bubi)
    },

    // 'aprendido' (ponto por tempo de passagem) | 'semente' (potência máxima) | 'indisponivel'
    getFonte() { return orq.getFonteRpmOtimo(); },

    _orq: orq,
  };
}
