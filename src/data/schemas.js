/**
 * Schemas de domínio do FAM Racing — extraídos do app.js legado.
 * Sem dependência de UI. Importável em qualquer projeto novo.
 */

// ═══ SECOES (checklist 7 seções, ~46 itens) ═══
// ─── Catálogo canônico de checklist (Flavio 2026-03 — preservado) ───
// Cada item ganha `obrigatorio: true` quando faz parte do checklist SIMPLES
// (mínimo de segurança + funcional pra ir pra pista). Demais itens só aparecem
// no modo COMPLETO. Critério: segurança passiva, freios essenciais, pneus
// (calibragem + torque), catch can, combustível básico. Flavio 2026-04-26.
export const SECOES = Object.freeze([
  { id: 'motor', num: '01', titulo: 'Motor & Fluidos', itens: [
    { id: 'm1', txt: 'Verificar e esvaziar o catch can', obs: 'Esvaziar entre baterias — volume excessivo indica desgaste dos segmentos', hl: true, obrigatorio: true, badge: 'CATCH CAN' },
    { id: 'm2', txt: 'Nível de óleo do motor', obs: 'Verificar entre mínimo e máximo com motor frio', obrigatorio: true },
    { id: 'm3', txt: 'Nível e estado do líquido de arrefecimento', obs: 'Verificar no reservatório de expansão — sem vestígios de óleo', obrigatorio: true },
    { id: 'm4', txt: 'Vazamentos no motor', obs: 'Inspecionar parte inferior e mangueiras (óleo, água, combustível)' },
    { id: 'm5', txt: 'Tensão e estado das correias', obs: 'Correia dentada, alternador e A/C (se houver)' },
    { id: 'm6', txt: 'Temperatura do motor na largada', obs: 'Aguardar normalização antes da bateria' },
  ]},
  { id: 'freios', num: '02', titulo: 'Freios', itens: [
    { id: 'f1', txt: 'Nível do fluido de freio', obs: 'Usar fluido DOT compatível — trocar se escurecido', obrigatorio: true },
    { id: 'f2', txt: 'Espessura das pastilhas e discos', obs: 'Mínimo recomendado para uso em pista', obrigatorio: true },
    { id: 'f3', txt: 'Pedal de freio — firmeza e curso', obs: 'Pedal mole = ar no circuito — sangrar antes de competir', obrigatorio: true },
    { id: 'f4', txt: 'Mangueiras e ladrões de freio', obs: 'Verificar trincas, ressecamento ou vazamento' },
  ]},
  { id: 'pneus', num: '03', titulo: 'Pneus & Susp.', itens: [
    { id: 'p1', txt: 'Calibragem dos pneus', obs: 'Dianteiros: 35 PSI  |  Traseiros: 50 PSI  |  Verificar a frio', obrigatorio: true },
    { id: 'p2', txt: 'Desgaste e danos nos pneus', obs: 'Verificar desgaste irregular, bolhas ou cortes', obrigatorio: true },
    { id: 'p3', txt: 'Torque dos parafusos de roda', obs: '95 N·m em cruz com torquímetro', obrigatorio: true },
    { id: 'p4', txt: 'Folgas na suspensão e direção', obs: 'Verificar terminais, buchas e amortecedores' },
    { id: 'p5', txt: 'Alinhamento e camber visual', obs: 'Verificar se não houve alteração após última sessão' },
  ]},
  { id: 'eletrica', num: '04', titulo: 'Elétrica', itens: [
    { id: 'e1', txt: 'Bateria — carga e terminais', obs: 'Terminais limpos e apertados — fixação firme', obrigatorio: true },
    { id: 'e2', txt: 'Velas de ignição', obs: 'Verificar folga e estado — trocar conforme intervalo de corrida' },
    { id: 'e3', txt: 'Cabos de vela', obs: 'Sem trincas ou ressecamento — bem conectados' },
    { id: 'e4', txt: 'Chicotes e conectores expostos', obs: 'Verificar proteção e fixação dos cabos no motor' },
  ]},
  { id: 'seg', num: '05', titulo: 'Segurança', itens: [
    { id: 's1', txt: 'Cinto de segurança — fixação e fivela', obs: 'Testar abertura e travamento de emergência', obrigatorio: true },
    { id: 's2', txt: 'Capacete — limpeza e viseira', obs: 'Viseira sem arranhados — fixação da jugular ok', obrigatorio: true },
    { id: 's3', txt: 'Extintor — carga e fixação', obs: 'Acessível ao piloto — prazo de validade em dia', obrigatorio: true },
    { id: 's4', txt: 'Gaiola / estrutura de segurança', obs: 'Verificar solda e fixação de todos os pontos', obrigatorio: true },
  ]},
  { id: 'torques', num: '06', titulo: 'Torques Susp.', itens: [
    { id: 't1', txt: 'Amortecedor dianteiro — porca do coxim', obs: '50–60 N·m' },
    { id: 't2', txt: 'Amortecedor dianteiro — parafuso inferior', obs: '80–90 N·m' },
    { id: 't3', txt: 'Terminal de direção — porca', obs: '35–45 N·m' },
    { id: 't4', txt: 'Barra estabilizadora — buchas / link', obs: '20–25 N·m' },
    { id: 't5', txt: 'Bandeja / braço inferior no chassi', obs: '80–100 N·m' },
    { id: 't6', txt: 'Eixo de torção traseiro no chassi', obs: '80–100 N·m' },
    { id: 't7', txt: 'Amortecedor traseiro — base inferior', obs: '60–70 N·m' },
    { id: 't8', txt: 'Amortecedor traseiro — coxim superior', obs: '40–50 N·m' },
  ]},
  { id: 'comb', num: '07', titulo: 'Combustível', itens: [
    { id: 'c1', txt: 'Nível de combustível', obs: 'Calcular autonomia para a bateria + retorno ao box', obrigatorio: true },
    { id: 'c2', txt: 'Mangueiras de combustível', obs: 'Sem vazamentos, trincas ou dobras' },
    { id: 'c3', txt: 'Filtro de ar / coletor de admissão', obs: 'Limpo, sem obstruções — fixação do coletor verificada' },
    { id: 'c4', txt: 'Mangueiras do catch can conectadas', obs: 'Respiro → catch can → saída para admissão' },
  ]},
]);

// Conta itens conforme modo (simples = só obrigatorio, completo = todos)
function totalItensModo(modo = 'completo') {
  return SECOES.reduce((acc, s) =>
    acc + s.itens.filter(i => modo === 'completo' || i.obrigatorio).length, 0);
}
function secoesPorModo(modo = 'completo') {
  return SECOES.map(s => ({
    ...s,
    itens: s.itens.filter(i => modo === 'completo' || i.obrigatorio),
  })).filter(s => s.itens.length > 0);
}

// ═══ SEED_OBJETIVO_TIPOS (5 tipos canônicos) ═══
// ─── Tipos canônicos de objetivo de stint (Flavio 2026-04-27 + handoff 04-28) ───
// Estratégia/objetivo é POR STINT (`feedback_fam_objetivo_por_stint`). Os 5
// tipos vêm da raceops PRE_EVENT_CHECKLIST etapa 4 (lowercase no doc; aqui
// capitalizo pro select ler natural em PT-BR). Lista é mutável em runtime —
// o usuário pode "+ NOVO TIPO" pelo modal de stint, persiste em
// DB.dados.objetivoTipos. Match de duplicata é case-insensitive.
export const SEED_OBJETIVO_TIPOS = Object.freeze([
  'Aquecimento',
  'Ataque',
  'Consistência',
  'Teste',
  'Livre',
]);

// ═══ SEED_PEND_TIPOS (6 tipos) ═══
// ─── Tipos canônicos de PENDÊNCIA (Flavio 2026-04-28) ───
// Pendência ganhou taxonomia por tipo pra agrupar na tela do evento ("o que
// falta de FERRAMENTA", "o que falta de COMBUSTÍVEL"). Lista é mutável —
// piloto pode "+ NOVO TIPO" no modal de pendência, persiste em
// DB.dados.pendTipos. Match de duplicata é case-insensitive.
export const SEED_PEND_TIPOS = Object.freeze([
  'Ferramenta',
  'Combustível',
  'Mecânica',
  'Segurança',
  'Documentação',
  'Logística',
]);

// ═══ SEED_EVENTO_TIPOS (7 tipos) ═══
// ─── Tipos canônicos de EVENTO (Flavio 2026-04-28) ───
// Vocabulário consultado no Technical Director Gate (PRE_EVENT_CHECKLIST.md
// linha 3): "track day, treino, validação, sessão de testes". Adicionei
// "Corrida" (Flavio mencionou explicitamente), "Treino de largada" (idem) e
// "Prática livre" (rodagem solta sem objetivo de tempo — comum na operação
// brasileira amadora). Mutável em runtime via "+ NOVO TIPO" no modal evento.
export const SEED_EVENTO_TIPOS = Object.freeze([
  'Track Day',
  'Treino',
  'Treino de Largada',
  'Corrida',
  'Validação',
  'Sessão de Testes',
  'Prática Livre',
]);

// ═══ SEED_CARRO_CATEGORIAS ═══
// ─── Categoria de CARRO (Flavio 2026-04-28) ───
// Categorias mais comuns no automobilismo amador brasileiro. Lista mutável
// (DB.dados.carroCategorias). Usado no campo "categoria" do carro (antes
// era input texto livre).
export const SEED_CARRO_CATEGORIAS = Object.freeze([
  'Turismo',
  'Pista',
  'GT',
  'Stock',
  'Marcas',
  'Sedan',
  'Hatch',
  'Fórmula',
  'Kart',
  'Picape',
]);

// ═══ SEED_ITENS_EVENTO (45 itens canônicos) ═══
// ─── Catálogos EVENTO e STINT (Flavio 2026-04-26 — Rodada 2) ───
// Cada item tem `obrigatorio: true|false`. SIMPLES = só obrigatórios.
// Lista plana (sem seções) — checklists curtos, foco operacional.

// SEED do catálogo EVENTO (Flavio 2026-04-28). Lista canônica dos 45 itens
// que ele leva pra um track day. A lista REAL fica em DB.dados.itensEvento
// (mutável, CRUD-editável via UI). Este SEED só é usado na primeira carga
// ou quando o usuário pede "restaurar padrão".
export const SEED_ITENS_EVENTO = Object.freeze([
  { id: 'ev-extintor', txt: 'Extintor', obrigatorio: true },
  { id: 'ev-macaco', txt: 'Macaco', obrigatorio: true },
  { id: 'ev-oleo', txt: 'Óleo', obrigatorio: true },
  { id: 'ev-graxa', txt: 'Graxa', obrigatorio: true },
  { id: 'ev-bateria', txt: 'Bateria', obrigatorio: true },
  { id: 'ev-compressor', txt: 'Compressor de ar', obrigatorio: true },
  { id: 'ev-medidor-pressao', txt: 'Medidor de pressão dos pneus', obrigatorio: true },
  { id: 'ev-protetor-pescoco', txt: 'Protetor de pescoço', obrigatorio: true },
  { id: 'ev-desembacador', txt: 'Desembaçador', obrigatorio: true },
  { id: 'ev-rodas-sobressalentes', txt: 'Rodas sobressalentes', obrigatorio: true },
  { id: 'ev-oleo-motor', txt: 'Óleo motor', obrigatorio: true },
  { id: 'ev-oleo-cambio', txt: 'Óleo câmbio', obrigatorio: true },
  { id: 'ev-bacia-oleo', txt: 'Bacia de óleo', obrigatorio: true },
  { id: 'ev-funil', txt: 'Funil', obrigatorio: true },
  { id: 'ev-pano', txt: 'Pano', obrigatorio: true },
  { id: 'ev-wd', txt: 'WD', obrigatorio: true },
  { id: 'ev-tiedup', txt: 'Tie-down (cintas de amarração)', obrigatorio: true },
  { id: 'ev-cabo-rebocar', txt: 'Cabo para rebocar o Celta', obrigatorio: true },
  { id: 'ev-extensao', txt: 'Extensão elétrica', obrigatorio: true },
  { id: 'ev-luz-led', txt: 'Luz LED', obrigatorio: true },
  { id: 'ev-capa-carro', txt: 'Capa do carro', obrigatorio: true },
  { id: 'ev-mesa-apoio', txt: 'Mesa de apoio', obrigatorio: true },
  { id: 'ev-cadeiras', txt: 'Cadeiras pra sentar', obrigatorio: true },
  { id: 'ev-cooler', txt: 'Cooler', obrigatorio: true },
  { id: 'ev-jacks', txt: 'Jacks (cavaletes)', obrigatorio: true },
  { id: 'ev-carro-transporte', txt: 'Carro de transporte', obrigatorio: true },
  { id: 'ev-rolo-pano', txt: 'Rolo de pano para limpeza', obrigatorio: true },
  { id: 'ev-carregador-celular', txt: 'Carregador de telefone', obrigatorio: true },
  { id: 'ev-powerbank', txt: 'Powerbank para carregar bateria', obrigatorio: true },
  { id: 'ev-caixa-ferramentas', txt: 'Caixa de ferramentas', obrigatorio: true },
  { id: 'ev-luz-reserva-freio', txt: 'Luz reserva de freio', obrigatorio: true },
  { id: 'ev-fio-eletrico', txt: 'Fio de ligação elétrica', obrigatorio: true },
  { id: 'ev-terminal-eletrico', txt: 'Terminal de ligação elétrica', obrigatorio: true },
  { id: 'ev-ferro-solda', txt: 'Ferro de solda', obrigatorio: true },
  { id: 'ev-lampada-traseira', txt: 'Lâmpada traseira', obrigatorio: true },
  { id: 'ev-lampada-teste', txt: 'Lâmpada de teste', obrigatorio: true },
  { id: 'ev-fusivel', txt: 'Fusível sobressalente', obrigatorio: true },
  { id: 'ev-camera-re-caminhao', txt: 'Limpar câmera de ré do caminhão', obrigatorio: true },
  { id: 'ev-tv', txt: 'TV', obrigatorio: true },
  { id: 'ev-suporte-tv', txt: 'Suporte da TV', obrigatorio: true },
  { id: 'ev-caixa-ferramentas-pequena', txt: 'Caixa de ferramentas pequena', obrigatorio: true },
  { id: 'ev-armario-ferramentas', txt: 'Armário de ferramentas', obrigatorio: true },
  { id: 'ev-combustivel-motos', txt: 'Combustível motos — tanque amarelo', obrigatorio: true },
  { id: 'ev-combustivel-carro', txt: 'Combustível carro — tanque vermelho 50L + barril 50L', obrigatorio: true },
  { id: 'ev-medidor-temperatura', txt: 'Medidor de temperatura', obrigatorio: true },
]);


// ═══ ITENS_STINT (8 itens pré-stint) ═══

export const ITENS_STINT = Object.freeze([
  { id: 'st1', txt: 'Cinto travado e ajustado', obs: '4 ou 5 pontos — testado abertura/travamento', obrigatorio: true },
  { id: 'st2', txt: 'Capacete fechado, jugular travada', obs: 'Viseira limpa, sem embaçar', obrigatorio: true },
  { id: 'st3', txt: 'Volante encaixado / conferido', obs: 'Se removível, travar; se fixo, sem folga', obrigatorio: true },
  { id: 'st4', txt: 'Pressão dos pneus conferida', obs: 'A frio, conforme setup do carro', obrigatorio: true },
  { id: 'st5', txt: 'Combustível ok pra autonomia do stint', obs: 'Pra todas voltas planejadas + retorno ao box', obrigatorio: true },
  { id: 'st6', txt: 'Telemetria iniciada (cockpit-mobile)', obs: 'Cockpit no berço, GPS+IMU verdes' },
  { id: 'st7', txt: 'Briefing rápido: bandeiras + box-call', obs: 'Quem chama box, sinais de bandeira azul/amarela' },
  { id: 'st8', txt: '"OK" do auxiliar antes de sair do box', obs: 'Auxiliar confere que tudo livre + libera saída' },
]);

// ═══ Ghost-map (Flavio 2026-05-01) — 5 campos novos ═══
// Decisões UX do mockup canônico ghost-map (22 decisões fechadas em 2026-05-01,
// ver memory `project_p1_ghost_map`). Estes shapes documentam os campos não-
// indexados que sessoes/configuracoes/carros ganham + duas tabelas novas.
// Dexie só lista index keys no schema string; valores ficam no doc shape.

// Plano de stint — quantas voltas o piloto planejou rodar antes do briefing.
// Nullable: stint sem plano fica null (modo livre). Inteiro positivo quando set.
export const SESSAO_GHOST_FIELDS = Object.freeze({
  voltas_planejadas: { type: 'integer', nullable: true, min: 1 },
});

// Faixa térmica ideal por canal. Usado pelo coach pra alertar quando motor/pneu
// sai da janela. Nullable = sem range definido (não emite alerta térmico).
export const CONFIGURACAO_GHOST_FIELDS = Object.freeze({
  temperatura_ideal_range: {
    type: 'json',
    nullable: true,
    shape: { motor: { min: 'number', max: 'number' }, pneu: { min: 'number', max: 'number' } },
  },
});

// De qual canal o ghost-map lê a fase térmica do carro. `motor` = só leitura
// motor; `pneu` = só pneu (pirômetro); `ambos` = pior dos dois (mais conservador).
// Default `motor` porque é o canal universal (todo carro tem; pirômetro não).
export const FONTE_TEMPERATURA = Object.freeze(['motor', 'pneu', 'ambos']);
export const CARRO_GHOST_FIELDS = Object.freeze({
  fonte_temperatura: { type: 'enum', values: FONTE_TEMPERATURA, default: 'motor' },
});

// Marco = ponto de evento na pista (não-trecho). Inclui pit-in/pit-out além
// dos tipos legados (largada, chegada, sinalização). Tabela nova v13.
export const MARCO_TIPOS = Object.freeze([
  'largada', 'chegada', 'pit-in', 'pit-out', 'sinalizacao', 'box',
]);
export const MARCO_FIELDS = Object.freeze({
  id: { type: 'uid', required: true },
  layoutId: { type: 'string', required: true },
  tipo: { type: 'enum', values: MARCO_TIPOS, required: true },
  posicao: { type: 'json', shape: { x: 'number', y: 'number' }, required: true },
  label: { type: 'string', nullable: true },
  criadoEm: { type: 'integer', required: true },
});

// Reta especial = segmento (já existente em trackSegments) marcado como reta
// "rápida" relevante pra ghost-map. Tabela nova v13 com flag auto_detectada
// pra distinguir retas marcadas pelo usuário das detectadas heuristicamente
// pelo pipeline (futuro). Justificativa em ADR-019.
export const RETA_ESPECIAL_FIELDS = Object.freeze({
  id: { type: 'uid', required: true },
  trackId: { type: 'string', required: true },
  segmentId: { type: 'string', required: true },
  tempoMedioMs: { type: 'integer', nullable: true },
  autoDetectada: { type: 'boolean', default: false },
  criadoEm: { type: 'integer', required: true },
});
