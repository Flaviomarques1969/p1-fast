// Casa da conta de DELTA por trecho do cockpit — a conta mora num lugar NEUTRO
// (src/domain/delta-calculator.js), pro cockpit do piloto (notebook) e o cérebro
// da nuvem (Command Box) usarem a MESMA. Este arquivo só reexporta: quem importa
// de './delta-calculator.js' continua funcionando igual.
export * from '../../src/domain/delta-calculator.js';
