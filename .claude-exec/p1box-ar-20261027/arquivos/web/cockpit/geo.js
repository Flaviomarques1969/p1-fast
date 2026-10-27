// Casa da matemática de GPS do cockpit — a conta mora num lugar NEUTRO
// (src/domain/geo.js), pra o cockpit e o cérebro usarem a MESMA. Este arquivo só
// reexporta: quem importa de './geo.js' continua funcionando igual.
export * from '../../src/domain/geo.js';
export { default } from '../../src/domain/geo.js';
