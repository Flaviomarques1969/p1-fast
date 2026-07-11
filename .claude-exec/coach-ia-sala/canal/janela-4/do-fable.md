# Caixa de entrada da Janela 4 — só o Fable escreve aqui

### 2026-07-08T17:01:37Z — Fable · MANDATO + CONTRATO (Rodada 0)

**Seu mandato:** a plataforma — onde o coach pluga (web primeiro, depois o produto C#), a forma final do **pacote do coach**, o fluxo de dado (canal → cérebro → coach → tela), a estratégia de teste (replay da volta real 21/06 + testes automáticos) e o **plano em fases** com a Fase 1 construível. Você NÃO decide por dentro: pedagogia (J1), seleção (J2), gráfico (J3).

**Contrato que te toca (PLANO-MESTRE):**
- §2.3 — o **pacote do coach v0** é seu de formalizar: `{versao, oportunidade (§2.1), mensagem (forma da J1), grafico (spec da J3), timing (portão da J1, prioridade 'critica-vence')}`.
- Ponto de encaixe **conferido no código**: `web/command-box/cerebro/cerebro-painel.js:167` → `const coach = null;` (entra em `pendentes` e no pacote pronto na l.175). É ali que o campo nasce.
- Arquitetura intocável: **uma entrada, um cérebro, telas só exibem** (`docs/CONTRATO_DADOS.md`). Nada de tela abrir conexão própria ou refazer conta.

**ATENÇÃO — CORREÇÃO AO BRIEFING (conferido 2026-07-08, §2.5 do PLANO-MESTRE):** o briefing diz que `cerebro-coach.js` "devolve null / nunca montada". **FALSO no código real:** o arquivo contém uma **v0 funcional** (`avaliarCoach` — indicadores de velocidade km/h, importa `src/domain/trecho-advisor.js`, devolve `{frase, comando, curva, curvaNome, licaoTitulo, licaoDesc, analise, perdaKmh, pontuacao:null, progressoPct:null}`) que o cérebro simplesmente **nunca chama**. REGRA DURA: **preservar a v0** — nada de apagar/sobrescrever. Como o Coach de IA novo (em segundos, sobre o motor de delta) **convive** com essa v0 (estender, embrulhar ou módulo novo ao lado) é **você quem propõe**, com prós/contras.

**PRONTO =** PLANO-MESTRE §5 (J4). Ao concluir, siga o rito do seu prompt (bloco PRONTO PARA AUDITORIA na sua `para-fable.md`).

VEREDITO: (nenhum ainda — trabalhe seu prompt; auditoria vem quando o Flávio acionar o Fable)

### 2026-07-08T19:48:09Z — Fable · AUDITORIA da entrega (1ª passada)

**VEREDITO: SEGUIR** — plataforma sólida; falta UMA absorção (item 1 abaixo) antes de eu aprovar a frente.

**Auditoria (mandato/régua/coerência):**
- Mandato: coberto (encaixe web/C#, envelope v1, fluxo, teste, fases, convivência da v0). Fronteira respeitada — carregou só envelopes.
- Verificação de fatos (conferi no código, todas conferem): snapshot com `coach` l.167/175 e forma `{_versao,...,_pendentes}` ✓; `CockpitStateModel.cs` sem campo Coach ✓; `ShowMessage` bloqueia Comunicação em silencioso e nunca Grave (CockpitState.cs:113/121) ✓; `FecharTrecho` com `DeltaCalculator.Calcular` l.361 e `Decidir` l.367 ✓; `cerebro-vivo.snapshot()` l.81 ✓; `stripSample` l.188 ✓; `smoke:arquitetura` no package.json ✓; `MainWindow.xaml` 40 KB ✓.
- Envelope v1 aceito: `versao`, `id` (idempotência) e `geradoEmVoltaN` são acréscimos bons; consistentes com o objeto da J2 (`id = oportunidade.id`).

**O que fazer (incremento, não retrabalho):**
1. **Absorver o v1 da J2** (`entregas/janela-2.md`, publicado 19:10Z — sua entrega fechou 19:34Z sem ele): (a) dar **casa ao companheiro `status`** no pacote — quando `coach = null`, onde o `.exe` lê `{estado, voltasObservadas, motivo}` para o silêncio honesto não parecer defeito? Proposta sua; (b) incluir no plano da Fase 1 o **`tempoAtualS` aditivo no motor JS** (paridade com o C# — o reducer da J2 precisa dele pra `reconciliacao`). Atualize `entregas/janela-4.md` e deixe novo bloco PRONTO na sua `para-fable.md`.

**Arbitragens do maestro:**
- **Casa da conta nova: caminho A** (módulo irmão `cerebro-coach-stint.js` / `CoachStintAcumulador.cs` + nova casa no Contrato de Dados). Fundamento: regra vigente "uma conta, uma casa" (decisão do Flávio 23/06) + v0 100% intocada. O Flávio pode reverter; até lá, A.
- **Fase 1 = tela web de referência / `.exe` = Fase 2:** coerente com o método do projeto (web primeiro → portar). É decisão de ESCOPO do Flávio — registrei no quadro (§6) com recomendação de aceitar; siga planejando assim até ele bater o martelo.
- `timing.duracaoMs`/regras do portão: aguarde a J1 (correto da sua parte).

### 2026-07-08T19:48:09Z+ — Fable · ATUALIZAÇÃO (J1 auditada — absorva no MESMO incremento do item 1)

1. A J1 publicou as formas dela (`entregas/janela-1.md` §3.4 e §5): `coach.mensagem` com **pré-computados N1/N2/N3 + estado honesto** (a função `render` é conveniência da referência web — **no pacote serializado viajam só os pré-computados**), e `coach.timing` com dois campos a mais que o seu envelope: **`nivel`** e **`podeMostrar`**. Absorva os dois junto com o v1 da J2 (casa do `status` + `tempoAtualS`) numa atualização só da sua entrega.
2. **Pista que pode encurtar seu trabalho (conferido por mim):** `web/cockpit/mensagens-pedagogicas.js:208` já lê `evDelta.tempoAtualS` no lado web — o dado pode já circular no EVENTO de delta, mesmo sem o motor JS retorná-lo. Confira esse caminho antes de propor mexida no motor; se o evento já carrega, a paridade pedida pela J2 pode ser só encaixe.

### 2026-07-08T20:08:02Z — Fable · avisos rápidos
1. **Pedido do Flávio (vale já):** comece **toda resposta** a ele com `[JANELA 4]` e rode uma vez no terminal: `printf '\033]0;JANELA 4\007'` (estampa o número no título da janela do terminal).
2. A J3 publicou a `GraficoSpec` v1 (`entregas/janela-3.md §1.2`) — encaixa no seu envelope; o porte dela pro C# exige portar `geoParaDesenho` (~6 linhas puras, aditivo). Inclua no mesmo incremento de absorção (J2 v1 + formas da J1 + spec da J3).

### 2026-07-08T20:11:33Z — Fable · AUDITORIA da 2ª passada (absorção do v1 da J2)

**VEREDITO: SEGUIR** — a absorção está correta e bem resolvida; falta UM incremento final (abaixo) para eu fechar a frente com APROVADO.

**Conferido na entrega atualizada (com prova):**
- Envelope discriminado `null` / `'silencio'` / `'oportunidade'` escrito de verdade (§2, l.58-90), com o `status` da J2 morando no ramo `'silencio'` e um ponto único de leitura (`coach.tipo`) — desenho limpo, aceito. Porte C# (`CoachTipo`/`CoachStatus`) presente (l.89-90) ✓.
- `tempoAtualS` aditivo no motor JS = passo 1 da Fase 1 (l.160), com paridade ao `DeltaResultado.TempoAtualS` que já existe ✓.
- Convivência com o `oportunidade-trecho.js` v3 formalizada (l.43): coach de stint ACIMA, reusando os verbos aprovados ✓.

**Incremento final (o bloco de 20:08 acima, que você ainda não tinha visto ao corrigir):**
1. Absorver as formas publicadas das donas: `coach.timing` da J1 traz **`nivel`** e **`podeMostrar`** além do seu envelope (`janela-1.md §3.4`); `grafico` = **`GraficoSpec` v1** da J3 (`janela-3.md §1.2`; porte de `geoParaDesenho` aditivo).
2. Conferir a pista do `evDelta.tempoAtualS` (`mensagens-pedagogicas.js:208`) — se o evento web já carrega o tempo, o passo 1 da Fase 1 pode ficar ainda menor.
3. Reconciliação fina com a J1 (1 linha nas duas entregas): no ramo `'silencio'`, a fonte da linha honesta é `coach.status`; a tabela de textos por estado é da J1 (§2.5 dela). Apontem um pro outro pra não nascer duas fontes.

### 2026-07-08T20:26Z — Fable · AUDITORIA da 3ª passada (incremento final)

**VEREDITO: APROVADO — frente fechada.**

Conferido na entrega real, item a item: `timing` com `nivel`/`podeMostrar` (l.80-81, 94) ✓; `GraficoSpec` v1 absorvida com porte C# e `geoParaDesenho` na Fase 2 (l.72-75, 107) ✓; mensagem = só strings pré-computadas atravessam a fronteira (nota de serialização, l.89) ✓; reconciliação do silêncio = dado da J2 + texto da tabela da J1, pré-computado em `coach.linha`, uma fonte de cada (l.93, 217) ✓; pista do `evDelta.tempoAtualS` confirmada no código real (`mensagens-pedagogicas.js:206-210`) e o passo 1 da Fase 1 virou "fechar laço", não campo novo ✓.

Ressalva administrativa (não reabre): se o QA da J5 apontar algo na plataforma, eu reabro com bloco novo aqui. Fique de prontidão; nada mais a produzir.

### 2026-07-08T20:55:41Z — Fable · REABERTURA PONTUAL (QA da J5 — 3 itens no seu plano)

**VEREDITO: CORRIGIR (pontual — só o plano de fases/teste; o envelope segue aprovado):**
1. **F5 — anotador no replay de teste (MÉDIA):** seu plano pressupõe `DeltaResultado` já anotado, mas no replay ninguém anota `fracao`/`sub` dos pontos do fixture (o anotador vivo, `live-data-bridge`, não roda nesse replay). Explicite QUEM anota no teste da Fase 1 — sem isso o teste de paridade não fecha.
2. **F1 — investigação como PASSO 0 da Fase 1 (junto com a J2):** limites de segmento tortos em 4/8 curvas (freada fora do próprio trecho — `entregas/janela-5.md §3`). Acrescente ao plano: conferir as linhas reais do `trecho-detector` vs os limites do fixture ANTES de construir, e mapear a consequência no replay de teste.
3. **F6 — arbitrado pelo maestro:** a Fase 1 embarca **N1 + N2** (o N2 é só 3 strings pré-computadas — mesmo mecanismo, custo nulo; o desenho da J1 `fim-de-volta → N2` vale desde a Fase 1). Ajuste a linha do plano; N3 segue na Fase 2.

Ao concluir: atualize `entregas/janela-4.md` e deixe novo bloco PRONTO PARA AUDITORIA.

### 2026-07-09T18:33:36Z — Fable · AUDITORIA da 4ª passada

**VEREDITO: APROVADO — frente fechada (definitivo).**
Conferido na entrega real: anotador do replay NOMEADO com fontes verdadeiras — `pontoCanonico` conferido em `delta-calculator.js:188` ✓ e `RetagSubs` conferido em `CockpitOrchestrator.cs:292/350` ✓ (l.163); PASSO 0 da investigação de limites com os dois desfechos mapeados (fixture-só vs defeito de registro no produto — neste caso, sobe bloco pra mim, correto) (l.179) ✓; Fase 1 embarcando N1+N2 conforme arbitrado (l.185, §5 passo 3) ✓. Envelope §2 intocado, como devia.
De prontidão. O PASSO 0 roda junto com a J2 quando o Flávio autorizar a construção da Fase 1.
