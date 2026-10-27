// ============================================================================
// CÉREBRO — Velocidade pelo GPS (Flávio 19/06: "velocidade vem do GPS, igual à
// frenagem"). A CONTA agora mora numa casa NEUTRA (src/domain/velocidade.js),
// pro cockpit e o cérebro usarem a MESMA — sem cópia. Este arquivo só REEXPORTA:
// quem importa daqui (velocidadesDaVolta / distanciaM) continua funcionando igual.
// ============================================================================
import { velocidadesDaVolta } from '../../../src/domain/velocidade.js';
import { distanciaCoords as distanciaM } from '../../../src/domain/geo.js';

export { velocidadesDaVolta, distanciaM };
export default { velocidadesDaVolta, distanciaM };
