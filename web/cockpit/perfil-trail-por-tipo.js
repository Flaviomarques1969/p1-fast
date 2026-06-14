// perfil-trail-por-tipo.js — dado o TIPO da curva (T0–T5/SF/ND), devolve o PERFIL-ALVO de
// trail-braking: carga inicial (% na pancada), COMO solta (distribuição) e ATÉ ONDE vai o
// residual em relação ao Vmin / ápice. Módulo PURO (sem DOM, sem rede).
//
// HONESTIDADE (NÃO INVENTAR — verificado): sem sensor de pedal e com a telemetria preservada
// a ~1 Hz, a carga exata (%) e a soltura fina NÃO são medíveis. Os números aqui são o ALVO
// PRESCRITO de cada tipo (a régua teórica), reescrevendo em forma estruturada o `formato`
// canônico que já mora em classificador-trecho.js (TIPOS[tipo].formato). NUNCA são medição —
// `medivel: false` em todos. Onde o formato não dá um número, a carga fica `null` + descrição
// qualitativa (não se inventa percentual).
//
// FONTE das formas y(x) (curvaExemplo): _design-reference/
// mockup-cockpit-treino-trail-braking-VIVO-2026-06-11.html
//   ALVOS.classico = 100% na pancada + soltura gradativa até o ápice
//   ALVOS.residual = pancada parcial (65%) + residual constante (45%) + soltura curta no fim
//
// `cargaPicoPct` e `residualPct` são faixas {min,max} quando o formato dá faixa, número único
// quando o formato crava (ex.: T1 = 100), ou null quando o formato é qualitativo.

import { TIPOS } from './classificador-trecho.js';

function faixa(min, max) { return { min, max }; }

// referencia: a que marco da passagem a soltura/residual se ancora.
//   'apice'  = solta até o ápice;  'vmin' = até o raio mínimo (velocidade mínima);
//   'troca'  = além do Vmin, até a troca de direção (próxima curva);  null = sem residual.
export const PERFIL_POR_TIPO = {
  T0: {
    temFreio: true,
    cargaPicoPct: null,                 // formato não crava número p/ a média clássica
    cargaTexto: 'pancada inicial (forte)',
    soltura: 'gradual-constante',
    solturaTexto: 'solta de forma suave e constante',
    residualPct: null,
    ateOnde: 'até o ápice',
    referencia: 'apice',
    curvaExemplo: 'classico',
    medivel: false,
  },
  T1: {
    temFreio: true,
    cargaPicoPct: 100,
    cargaTexto: '100%',
    soltura: 'gradual-profunda',
    solturaTexto: 'solta profundo e devagar (o freio ajuda a girar o carro)',
    residualPct: null,
    ateOnde: 'até o ápice',
    referencia: 'apice',
    curvaExemplo: 'classico',
    medivel: false,
  },
  T2: {
    temFreio: true,
    cargaPicoPct: faixa(60, 75),
    cargaTexto: '60–75%',
    soltura: 'residual-ate-vmin',
    solturaTexto: 'mantém um residual constante e solta curto só no fim',
    residualPct: faixa(35, 50),
    ateOnde: 'até o raio mínimo (Vmin)',
    referencia: 'vmin',
    curvaExemplo: 'residual',
    medivel: false,
  },
  T3: {
    temFreio: true,                     // mínimo: toque curto OU só alívio do acelerador
    cargaPicoPct: faixa(0, 40),
    cargaTexto: 'até 40% (ou só tirar o pé)',
    soltura: 'toque',
    solturaTexto: 'toque curto só pra assentar a dianteira — não reduz a velocidade',
    residualPct: null,
    ateOnde: '—',
    referencia: null,
    curvaExemplo: null,
    medivel: false,
  },
  T4: {
    temFreio: true,
    cargaPicoPct: null,                 // formato é qualitativo na carga inicial
    cargaTexto: 'parcial',
    soltura: 'manter-ate-troca',
    solturaTexto: 'mantém o residual até a troca de direção (prioriza a próxima curva)',
    residualPct: null,
    residualMantido: true,
    ateOnde: 'até a troca de direção',
    referencia: 'troca',
    curvaExemplo: 'residual',
    medivel: false,
  },
  T5: {
    temFreio: true,
    cargaPicoPct: null,                 // formato é qualitativo ("trail curto")
    cargaTexto: 'trail curto',
    soltura: 'curta',
    solturaTexto: 'ápice cedo, trail curto e já acelera cedo',
    residualPct: null,
    ateOnde: 'ápice cedo',
    referencia: 'apice',
    curvaExemplo: 'classico',
    medivel: false,
  },
  SF: {
    temFreio: false,
    cargaPicoPct: 0,
    cargaTexto: 'sem freio',
    soltura: 'nenhuma',
    solturaTexto: 'curva de pé embaixo — sem prescrição de freio',
    residualPct: null,
    ateOnde: '—',
    referencia: null,
    curvaExemplo: null,
    medivel: false,
  },
  ND: {
    temFreio: null,                     // indeterminado: o dado não permite afirmar
    cargaPicoPct: null,
    cargaTexto: '—',
    soltura: 'indeterminado',
    solturaTexto: 'o dado atual não permite afirmar o formato — ver ressalvas',
    residualPct: null,
    ateOnde: '—',
    referencia: null,
    curvaExemplo: null,
    medivel: false,
  },
};

// Junta o perfil estruturado com rotulo + formato canônicos (fonte única em classificador-trecho.js).
// Tipo desconhecido cai em ND (honesto), nunca estoura.
export function perfilDeTrail(tipo) {
  const chave = PERFIL_POR_TIPO[tipo] ? tipo : 'ND';
  const base = PERFIL_POR_TIPO[chave];
  const meta = TIPOS[chave] || TIPOS.ND;
  return { tipo: chave, rotulo: meta.rotulo, formato: meta.formato, ...base };
}

// String curta pra tela: "100% • até o ápice" / "60–75% + residual 35–50% • até o raio mínimo (Vmin)".
export function resumoTrail(tipo) {
  const p = perfilDeTrail(tipo);
  if (p.temFreio === false) return 'Sem freada';
  if (p.temFreio === null) return 'Indeterminado';
  let s = p.cargaTexto;
  if (p.residualPct) s += ` + residual ${p.residualPct.min}–${p.residualPct.max}%`;
  if (p.ateOnde && p.ateOnde !== '—') s += ` • ${p.ateOnde}`;
  return s;
}
