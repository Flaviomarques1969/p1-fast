# Caixa da Janela 4 → Fable — só a Janela 4 escreve aqui

> Sempre ACRESCENTE blocos com hora (`date -u +%FT%TZ`); nunca sobrescreva. O bloco final obrigatório é o `PRONTO PARA AUDITORIA` do seu prompt.

### 2026-07-08T19:34:56Z — Janela 4 · PRONTO PARA AUDITORIA
Entrega: entregas/janela-4.md (completa)
Resumo (até 5 linhas):
- Encaixe conferido: web `cerebro-painel.js:167 const coach=null` (Fase 1 = trocar por `avaliarCoachStint(...)`, null honesto preservado); C# = novo `CoachPacote?` em `CockpitStateModel` + `SetCoach/HideCoach` espelhando `ShowMessage` (silencioso bloqueia comunicação, GRAVE vence), alimentado em `CockpitOrchestrator.FecharTrecho:361` onde o `DeltaResultado` já é calculado.
- Pacote coach v1 formalizado: envelope `{versao, id(idempotência), oportunidade[J2], mensagem[J1], grafico[J3], timing{portao,duracaoMs,prioridade:'critica-vence'}, geradoEmVoltaN}`; J4 trava só o envelope + null honesto.
- Fluxo: canal→cloud-bridge→cérebro(delta)→ACUMULADOR DE STINT (peça nova, casa própria)→pacote→tela. Portão de timing reusa o mecanismo silencioso/GRAVE existente.
- Convivência da v0 (pedido do Fable): recomendo caminho **A** — módulo irmão `cerebro-coach-stint.js` + nova casa no Contrato; v0 `avaliarCoach` (km/h, Command Box) intacta. B = 2ª função no mesmo arquivo; C rejeitado.
- Plano: Fase 1 = acumulador web + pacote v1 + cartão no miolo do painel aprovado (soma por cima) + testes (replay 21/06, null honesto, portão). Fase 2 = port C#/.exe + ensino escalonado + gráfico rico.
Consumi: contratos §2.1-2.3 do PLANO-MESTRE (v0) + código real (cerebro-coach/painel/vivo, delta-calculator, cloud-bridge, DeltaCoach, CockpitState(Model), Enums, CockpitOrchestrator) · Produzi: pacote do coach v1 + encaixe web/C# + fluxo + teste + plano de fases + proposta de convivência.
Autoconferência da régua: preto · sem-emoji · você · 956×440 · número-sem-sinal · só-dado-real · timing-seguro · ganho-em-s · painel-preservado — todos cobertos no envelope (§6 da entrega).
Dúvidas/decisões ao maestro: (1) casa da conta nova A vs B (recomendo A); (2) confirmar Fase 1 = painel WEB e .exe = Fase 2; (3) `timing.duracaoMs`/regras do portão são da J1 — aguardo a forma; (4) formas finais de oportunidade/mensagem/gráfico ainda em v0 (entregas J1/J2/J3 não publicadas) — o envelope acomoda.

### 2026-07-08T20:01:12Z — Janela 4 · CORRIGIDO (absorção do v1 da J2) · PRONTO PARA AUDITORIA (2ª passada)
Entrega: entregas/janela-4.md (atualizada)
Apliquei o VEREDITO SEGUIR (19:48Z), item 1:
- (a) CASA DO `status`: o campo `coach` virou um envelope DISCRIMINADO por `tipo` — 3 estados honestos: `null` (onda não ligada, fica em _pendentes) · `{versao,tipo:'silencio',status:{estado,voltasObservadas,motivo}}` (ligado, sem oportunidade agora — silêncio honesto, NÃO em _pendentes) · `{versao,tipo:'oportunidade',id,oportunidade,mensagem,grafico,timing,geradoEmVoltaN}`. O `status` da J2 mora DENTRO do ramo 'silencio' → a tela tem um ponto único de leitura (coach.tipo) e nunca confunde "onda não existe" com "nada a dizer". Porte C# atualizado (enum CoachTipo + record CoachStatus + CoachPacote com ramos nullable).
- (b) `tempoAtualS` ADITIVO no motor JS: entrou como PASSO 1 da Fase 1 (§5). Confirmado no código: DeltaResultado C# já tem TempoAtualS (DeltaCoach.cs:31); calcularDelta JS não retorna (delta-calculator.js:168-174). Mudança aditiva, paridade com o C#, destrava a reconciliacao do reducer da J2.
Também formalizei (J2 §6.3 pediu): convivência com oportunidade-trecho.js v3 — o coach de stint fica ACIMA dele, reusa os verbos aprovados, não duplica a prescrição.
Arbitragens do maestro incorporadas: casa = A; Fase 1 = web / .exe = Fase 2 (sigo até o Flávio bater o martelo).
Autoconferência da régua: preto · sem-emoji · você · 956×440 · número-sem-sinal · só-dado-real · timing-seguro · ganho-em-s · painel-preservado.
Dúvidas/decisões ao maestro: nenhuma nova. Aberto e correto: timing.duracaoMs/portão (J1) e sub-formas mensagem(J1)/grafico(J3) — o envelope acomoda; aguardo as donas.

### 2026-07-08T20:24:49Z — Janela 4 · INCREMENTO FINAL (formas de J1 + J3 + reconciliação) · PRONTO PARA AUDITORIA (3ª passada)
Entrega: entregas/janela-4.md (atualizada). Apliquei os blocos 19:48Z+ / 20:08Z / 20:11Z:
- coach.mensagem = PRÉ-COMPUTADOS N1/N2/N3 + estado (J1 §2.2). Nota de serialização (decisão J4): o pacote atravessa a fronteira, então viajam só STRINGS prontas — nunca a função renderMensagem (conveniência web). Garante paridade web↔C# sem lógica de mensagem na tela.
- coach.timing ganhou nivel + podeMostrar (J1 §3.4), além de portao/duracaoMs/prioridade.
- coach.grafico = GraficoSpec v1 da J3 (§1.2): versao/segmentId/rotulo/acento/recorte/camadas/recorrencia/degradado. Porte C# exige geoParaDesenho (~6 linhas puras, aditivo) — entrou na Fase 2.
- Reconciliação do silêncio (item 3): ramo 'silencio' = DADO coach.status (J2) + TEXTO coach.linha pré-computado pela tabela §2.5 da J1. Uma fonte de cada, apontadas uma pra outra.
- tempoAtualS (Fase 1 passo 1): CONFIRMADA a pista do Fable — já é lido em mensagens-pedagogicas.js:206 e existe no C# (DeltaCoach.cs:31); falta só o produtor calcularDelta emitir (delta-calculator.js:168-174). É fechar laço, não campo novo — encaixe pequeno.
Porte C# atualizado: CoachTipo, CoachStatus, CoachLinha, NivelMensagem, MensagemCoach, TimingCoach, GraficoSpec, CoachPacote (ramos nullable).
Autoconferência da régua: preto · sem-emoji · você · 956×440 · número-sem-sinal · só-dado-real · timing-seguro · ganho-em-s · painel-preservado.
Dúvidas/decisões ao maestro: nenhuma de plataforma. Aberto: timing.duracaoMs (J1) e preferências das donas já marcadas pro Flávio (cor J1 §2.6; colisão de layout J3 §2.2 caminho b).

### 2026-07-08T22:04:50Z — Janela 4 · CORRIGIR pontual (QA da J5, 3 itens no plano) · PRONTO PARA AUDITORIA (4ª passada)
Entrega: entregas/janela-4.md (§4 e §5 atualizados; envelope §2 intocado — segue APROVADO). Apliquei o bloco 20:55Z:
- F5 (anotador no replay): nomeei QUEM anota os pontos crus do fixture no teste — fracao por pontoCanonico (delta-calculator.js:188) + sub pela lógica de marcos do trecho-detector.js (paridade com RetagSubs do C#). Onde os marcos não caem no segmento (4/8 curvas tortas), sub fica null → subTrecho:null honesto. Sem isso o teste de paridade não fecha. (§4, item 1.)
- F1 (limites de trecho): virou PASSO 0 da Fase 1, junto com a J2 — conferir as linhas reais do trecho-detector vs os limites do fixture ANTES de construir; mapear no replay: se linhas ao vivo boas = problema só do fixture (teste espera subTrecho:null nas 4 curvas); se iguais = defeito de registro no produto, escalar ao Fable. (§5, passo 0.)
- F6 (arbitrado): Fase 1 agora embarca N1 + N2 (N2 = 3 strings pré-computadas, custo nulo; fim-de-volta→N2 vale desde a Fase 1). N3 fica na Fase 2. (§5, passo 3.)
Curvas tortas (J5 §3): RETA OPOSTA, JUNÇÃO, BRUXA, VITÓRIA — freada fora do trecho nomeado.
Autoconferência da régua: preto · sem-emoji · você · 956×440 · número-sem-sinal · só-dado-real · timing-seguro · ganho-em-s · painel-preservado.
Dúvidas ao maestro: o PASSO 0 pode achar defeito de registro no produto (linhas de trecho); se for o caso, subo bloco. Nada de plataforma pendente.
