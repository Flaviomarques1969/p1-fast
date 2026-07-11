# Janela 4 — Plataforma do Coach de IA + Plano em Fases

> Frente: a **plataforma** que encaixa as outras frentes (J1 mensagem, J2 oportunidade, J3 gráfico) e o **plano de construção**. Tudo aqui foi conferido no código real do projeto (citações com arquivo:linha). Onde uma forma é de outra janela, carrego só o **envelope** — o conteúdo é dono dela.

---

## 0. Escopo desta entrega (o que é meu / o que não é)

**Meu (J4):** onde o coach pluga (web → C#), a **forma do pacote do coach** (o envelope), o **fluxo de dado** (canal → cérebro → coach → tela), a **estratégia de teste**, o **plano em fases** e a **proposta de convivência** com a v0 (pedido explícito do Fable, `canal/janela-4/do-fable.md`).

**Não é meu:** a pedagogia da mensagem (J1), a inteligência que elege a oportunidade (J2), o desenho do gráfico (J3). Eu não escrevo o conteúdo desses três — só garanto o encaixe que os recebe sem quebrar o painel nem o contrato de dados.

---

## 1. ONDE TUDO PLUGA — o ponto de encaixe

### 1.1 Web (referência executável) — o campo `coach` nasce aqui
Conferido: `web/command-box/cerebro/cerebro-painel.js:167` → `const coach = null;`. Esse valor entra em `pendentes` (l.167) e no objeto que `snapshot()` devolve (l.170-179): `{ _versao, _geradoComVoltas, stint, ritmo, coach, meta, preditivo, _pendentes }`. É o **PainelPronto** que a tela só exibe.

O encaixe de Fase 1 é **uma troca de valor**: `const coach = null;` vira `const coach = avaliarCoachStint(...);`, **preservando o padrão de null honesto** — quando não há oportunidade confiável, o coach volta a ser `null` e `'coach'` continua em `_pendentes`. Nada mais no `snapshot()` muda.

> O `snapshot()` é consumido pelo orquestrador ao vivo `web/command-box/cerebro/cerebro-vivo.js` (`snapshot()` l.81), que já funila `sample`/`volta` do canal. O coach herda esse funil — não abre fonte nova.

### 1.2 Produto C# (.exe do cockpit 10,5") — onde o coach entra no estado e na tela
- **Estado:** `windows/cockpit/P1Fast.Cockpit.Domain/CockpitStateModel.cs` — o record de estado tem `TrechoStatus, Shift, Message, Delta, Acao, Apex, Silencioso, NoBox, Aprendizado, FlashIa, Freio, Chuva`. **Não há campo `Coach` hoje.** A Fase 2 acrescenta um `CoachPacote? Coach` (propriedade `init`, default `null` — mesmo padrão dos campos adicionados sem quebrar o construtor posicional, l.23-44).
- **Setter:** `CockpitState.cs` — espelhar `ShowMessage`/`HideMessage` (l.113-136) num `SetCoach(CoachPacote)` / `HideCoach()`. Reusar a disciplina que já existe: `ShowMessage` bloqueia `MsgTipo.Comunicacao` em modo silencioso mas **nunca** bloqueia `MsgTipo.Grave` (l.119-121). O cartão do coach é nível-comunicação: **modo crítico/silencioso o esconde; alerta GRAVE sempre vence.**
- **Quem alimenta:** `CockpitOrchestrator.cs`, método `FecharTrecho` (l.340-399). Ele **já** calcula o `DeltaResultado` por curva ao fechar o trecho (`DeltaCalculator.Calcular`, l.361) e já decide a frase de 2 palavras via `MensagensPedagogicas.Decidir` → `SetAcao` (l.367-370). É exatamente aqui que o **acumulador de stint** (§3.1) recebe cada `delta` + `tempoAtualS` + `segId` e, no portão de timing, chama `SetCoach(...)`.
- **Tela:** `windows/cockpit/P1Fast.Cockpit.UI/MainWindow.xaml` (existe, 40 KB) renderiza o cartão no **miolo livre** do palco 956×440. Some inteiro no portão/crítico. Não move sensores/shift/ápice/delta/freada.

### 1.3 Convivência com a v0 do `cerebro-coach.js` (PROPOSTA — pedido do Fable)
**Fato (conferido):** `cerebro-coach.js` **não está vazio**. Tem uma v0 funcional — `avaliarCoach(passagens, ordemCurvas)` (l.86-114) — que elege a pior curva por **indicadores de velocidade (km/h**, tolerância 0,15, l.24) e devolve `{frase, comando, curva, curvaNome, licaoTitulo, licaoDesc, analise, perdaKmh, pontuacao:null, progressoPct:null}`. Foi feita para o **Command Box** (TV do box) e o cérebro **nunca a chama**. O Coach de IA novo trabalha em **segundos** sobre o motor de delta e é para o **cockpit 10,5"**. São **duas contas diferentes** (métrica diferente, consumidor diferente).

Três caminhos para os dois conviverem:

| | Caminho | Prós | Contras |
|---|---|---|---|
| **A** (recomendado · **arbitrado pelo Fable 19:48Z**) | **Módulo irmão novo** — `web/command-box/cerebro/cerebro-coach-stint.js` (web) + `CoachStintAcumulador.cs` (C#). v0 **intacta**. Registrar como **nova casa** no `docs/CONTRATO_DADOS.md`. | Preserva a v0 **100%** (zero toque no arquivo que já funciona). Conta diferente → casa própria (respeita "uma casa por conta"). Nome próprio (`-stint`) deixa claro que é a conta em segundos. | +1 linha no Contrato de Dados e na trava `smoke:arquitetura`. Dois arquivos "coach" (mitigado pelo sufixo `-stint`). |
| **B** | **Segunda função no mesmo arquivo** — `avaliarCoachStint(...)` dentro de `cerebro-coach.js`, ao lado de `avaliarCoach`. v0 intacta. | Uma casa só de coach; menor mexida no Contrato. | Mistura duas contas (Command Box km/h + Cockpit s) no mesmo arquivo; arquivo cresce misturando consumidores; risco de confusão futura. |
| **C** | **Estender/embrulhar `avaliarCoach`** | — | **Rejeitado.** Métrica e consumidor diferentes; embrulhar a v0 a contamina e fere a regra "só somar por cima, nunca sobrescrever". |

**Recomendação: A (módulo irmão).** Preserva a v0 sem risco e dá casa própria à conta nova, que já é peça nova nos dois lados (web e C#). **B** é o plano de menor churn se o Flávio preferir uma casa só. Qual das duas é **decisão de arquitetura → Fable/Flávio**; C está fora. **(Arbitrado: A — Fable 19:48Z.)**

**Convivência com o `oportunidade-trecho.js` (v3 aprovado por Flávio 09/06 — a J2 §6.3 pediu que a J4 formalize):** esse módulo já prescreve, por **cada** trecho, o que fazer em segundos (verbos aprovados: FREIA DEPOIS/ANTES, FECHA A CURVA, ACELERA ANTES). O coach de stint **fica ACIMA dele**, não o duplica: o `oportunidade-trecho.js` diz a oportunidade de todo trecho; o coach de stint **elege a ÚNICA a ensinar** na volta/stint e **reusa o contrato de verbos** desse módulo (ex.: `oportunidade.tecnica:'freia-depois'`, `oportunidade.apice` alimentando o "FECHA A CURVA X m"). Nada de inventar vocabulário concorrente — a prescrição continua na casa que já existe; o coach só escolhe e embrulha.

---

## 2. A FORMA DO PACOTE DO COACH (v1 formalizado)

Consolido §2.1 (oportunidade, dona J2) + §2.2 (mensagem, dona J1) + §2.3 (base do Fable) do PLANO-MESTRE **e absorvo o v1 da J2** (`entregas/janela-2.md §1`, publicado 19:10Z), que trouxe o objeto-companheiro `status` para o "silêncio honesto". O que **J4 trava** é o **envelope**; as três sub-formas (oportunidade/mensagem/gráfico) são das donas.

**Decisão de integração (J4): o campo `coach` é um envelope DISCRIMINADO por `tipo`, com três estados honestos** — porque "onda ainda não construída" e "onda rodando, mas sem nada a dizer agora" são coisas diferentes e a tela não pode confundir uma com a outra (senão o silêncio legítimo da J2 vira cara de defeito):

```js
coach:
    null                                       // (1) ONDA NÃO LIGADA (boot / Fase 1 ainda não plugada).
                                               //     '_pendentes' carrega 'coach'. É o valor de HOJE (cerebro-painel.js:167).
  | { versao: 1, tipo: 'silencio',             // (2) LIGADO, sem oportunidade confiável agora — silêncio honesto.
      status: {                                //     DADO (o "porquê") — objeto-companheiro da J2 (janela-2.md §1)
        estado,          // 'coletando-dados' | 'no-teto' | 'sem-referencia' | 'stint-curto'
        voltasObservadas,// quantas voltas voadoras já entraram
        motivo           // texto curto honesto ("2 voltas — junto mais dado antes de apontar")
      },
      linha: { texto, cor }                    //     TEXTO pré-computado pela J1 (§2.5), keyed por status.estado
    }                                          //     NÃO entra em '_pendentes' (a onda EXISTE). Tela: miolo limpo, sem erro.
  | { versao: 1, tipo: 'oportunidade',         // (3) LIGADO e COM a maior oportunidade a ensinar.
      id,                // = oportunidade.id — IDEMPOTÊNCIA: a tela sabe se é o MESMO cartão (não repinta à toa)
      oportunidade,      // <objeto J2 §1> a UNA maior oportunidade, ganhoVoltaS em SEGUNDOS
      mensagem: {        // <forma J1 §2.2> — PRÉ-COMPUTADA (ver nota de serialização abaixo)
        n1, n2, n3,      //   cada nível = { linhas:[string], acento:'ambar'|'vermelho'|'verde', ganhoTxt }
        estado           //   estado honesto quando aplicável
      },
      grafico: {         // <GraficoSpec v1 — J3 §1.2>
        versao, segmentId, rotulo, acento,
        recorte: { espaco, viewBox, contextoIdx },
        camadas: { pistaContexto, linhaReferencia, linhaPiloto, apice, destaqueSub, fitaMetrica },
        recorrencia, degradado
      },
      timing: {          // <forma J1 §3.4>
        portao,          //   'reta' | 'fim-de-volta' | 'box'
        nivel,           //   'N1' | 'N2' | 'N3'  — decorre do portão (reta→N1, fim-de-volta→N2, box→N3)
        podeMostrar,     //   boolean — TODAS as travas de segurança da J1 passaram
        duracaoMs,       //   dwell alvo; teto = tempo até o próximo entrada-cruzou
        prioridade: 'critica-vence'   // TRAVADO: modo crítico/GRAVE do painel sempre esconde o cartão
      },
      geradoEmVoltaN     // = oportunidade.geradaNaVolta — telemetria/replay/teste
    }
```

**Nota de serialização (decisão de integração da J4):** o pacote **atravessa a fronteira** (cérebro → tela; e o porte web → `.exe`). Por isso viajam só **dados pré-computados — nunca uma função**. A `renderMensagem(oportunidade, nivel)` da J1 (§2.2) é conveniência da **referência web** para GERAR os níveis; o que entra em `coach.mensagem` são as **strings prontas** (`n1/n2/n3`). Idem `grafico`: é **spec de desenho** (dados), a tela desenha. Essa regra é o que garante paridade web↔C# sem lógica de mensagem/gráfico do lado da tela.

**O que J4 trava no envelope** (não muda sem o Fable):
- `tipo` como discriminador — a tela lê **`coach.tipo`** e nunca adivinha: `null` = onda não existe (bloco "aguardando", como hoje); `'silencio'` = onda viva, miolo limpo; `'oportunidade'` = mostra o cartão.
- **Casa do `status` + reconciliação com a J1 (item 3 do Fable):** no ramo `'silencio'`, o **dado** vem de `coach.status` (J2, o porquê) e o **texto exibido** vem da **tabela §2.5 da J1** (uma linha + cor por `status.estado`), já **pré-computado** em `coach.linha`. Uma fonte de dado (J2), uma fonte de texto (J1) — apontam uma para a outra, não nascem duas.
- `timing` traz **`nivel`** e **`podeMostrar`** (J1 §3.4) além de portao/duracaoMs/prioridade — quem calcula os dois é a J1; a J3 desenha no mesmo portão (aparecem/somem juntos). J4 só garante `prioridade:'critica-vence'`.
- `id` — idempotência (só no ramo `'oportunidade'`): a tela troca o cartão só quando o `id` muda (mesma lógica de early-return dos setters do `CockpitState`, ex. `ShowMessage` l.124).
- **null honesto preservado:** o ramo `'silencio'` É o null honesto de runtime — a tela **não fabrica** cartão; `oportunidade` só existe no ramo `'oportunidade'`.
- O cartão **aparece e some inteiro** (gráfico + mensagem juntos), sob **um** portão — contrato §2.2 do Fable.

**Porte C# do pacote** (`P1Fast.Cockpit.Domain` — tudo aditivo):
```csharp
public enum CoachTipo { Silencio, Oportunidade }
public sealed record CoachStatus(string Estado, int VoltasObservadas, string Motivo);
public sealed record CoachLinha(string Texto, string Cor);                 // silêncio: texto pré-computado (J1 §2.5)
public sealed record NivelMensagem(IReadOnlyList<string> Linhas, string Acento, string GanhoTxt);
public sealed record MensagemCoach(NivelMensagem? N1, NivelMensagem? N2, NivelMensagem? N3, string? Estado);
public sealed record TimingCoach(string Portao, string Nivel, bool PodeMostrar, int DuracaoMs, string Prioridade);
// GraficoSpec + sub-records: porte da J3 (§1.2). Exige portar geoParaDesenho p/ C# (~6 linhas puras,
// pista-oficial-brasilia.js:22-27) — aditivo; entra na Fase 2 (§5).
public sealed record CoachPacote(
    int Versao, CoachTipo Tipo,
    // ramo 'oportunidade' (null quando Tipo=Silencio):
    string? Id, Oportunidade? Oportunidade, MensagemCoach? Mensagem, GraficoSpec? Grafico, TimingCoach? Timing, int? GeradoEmVoltaN,
    // ramo 'silencio' (null quando Tipo=Oportunidade):
    CoachStatus? Status, CoachLinha? Linha);
```
No estado: `CoachPacote? Coach` em `CockpitStateModel` (`Coach == null` = onda não ligada; raro no `.exe` pós-Fase 2).

---

## 3. FLUXO DE DADO (canal → cérebro → coach → tela)

```
[1] ENTRADA (uma só)         cockpit-bubi-live  ──ponte única──►  cloud-bridge.js
    web/cockpit/cloud-bridge.js  eventos: 'sample' (motor+pilotagem+cronômetro), 'gps' (lat,lng,kmh,tWall)
    Nenhuma tela abre conexão. Nenhum dado fora do stripSample (l.188-225).
        │
        ▼
[2] CÉREBRO                  cerebro-vivo.js funila sample/volta ; o MOTOR DE DELTA
    (delta-calculator.js / C# DeltaCoach) devolve DeltaResultado por curva ao FECHAR o trecho.
    No C#, isso já acontece: CockpitOrchestrator.FecharTrecho:361  →  var ghost = DeltaCalculator.Calcular(...)
        │  (DeltaResultado: {segmentId, deltaTotalS, porSubTrecho:{entrada,freio,apice,pace,saida}, piorSubTrecho, piorDeltaS})
        ▼
[3] COACH (peça NOVA — o acumulador de stint)      §3.1
    consome cada DeltaResultado ao longo da VOLTA e do STINT
      → J2 elege a UNA maior oportunidade (objeto §2.1, ganho em SEGUNDOS)
      → J1 gera a mensagem ; J3 gera a spec do gráfico
      → J4 embrulha no pacote v1 e decide QUANDO soltar (portão de timing, §3.2)
        │
        ▼
[4] TELA (só exibe)          web: snapshot().coach   ·   C#: CockpitState.Coach → MainWindow.xaml (miolo)
    Some inteiro no portão/crítico. Não move nada do painel aprovado.
```

### 3.1 O acumulador de stint (a peça genuinamente nova)
Nem o web (`cerebro-vivo`) nem o C# guardam hoje o histórico de deltas do stint para o coach — o `FecharTrecho` calcula o delta de **uma** curva e descarta. O acumulador é a peça nova que **junta**: guarda o `DeltaResultado` de cada curva por volta, soma no stint, e entrega a matéria-prima para a J2 eleger. É a **conta** do coach novo (casa própria, §1.3 caminho A).

- **Entrada:** stream de `DeltaResultado` por trecho (já existe) + referência histórica (no C#, `_refTempos`/`_referencias` de `FecharTrecho`; no web, carregada do fixture no replay).
- **Saída:** o pacote coach v1 (§2), ou `null`.
- **Onde vive:** `cerebro-coach-stint.js` (web) / `CoachStintAcumulador.cs` (C#) — caminho A.

### 3.2 O portão de timing (aparece/some inteiro; crítico vence)
- O cartão só é **solto** num portão seguro (reta / fim de volta / box / baixa carga) — regras da J1. **Nunca no meio de curva.** É J4 quem garante o envelope; J1 preenche as regras.
- **Crítico sempre vence:** reuso o mecanismo que já existe. No C#, `SetCoach` respeita `Silencioso` como `ShowMessage` faz com `Comunicacao` (`CockpitState.cs:119-121`), e o orquestrador **esconde** o coach quando sobe um `MsgTipo.Grave` ou o modo crítico. Shift light e luz de freio nunca são cobertos (contrato §2.2).

### 3.3 Paridade web → C# (método do projeto)
Escrever primeiro no **web** (`cerebro-coach-stint.js`), validar com o **replay da volta real 21/06** no navegador, e **depois portar** para C# (`CoachStintAcumulador.cs` + `CoachPacote` + `SetCoach`, ligado em `FecharTrecho`), coberto por xUnit — exatamente como `delta-calculator.js` ↔ `DeltaCoach.cs` já andam em paridade.

---

## 4. ESTRATÉGIA DE TESTE

1. **Replay da volta real 21/06** — fixture `web/command-box/fixtures/passagens-bubi-brasilia.v1.json` (stint real do Bubi: 8 curvas × 7 voltas). Alimenta o acumulador **no mesmo formato** do canal; confere que a oportunidade eleita e o pacote batem com a análise numérica que J2/J5 validam. Sem tocar o banco nem o canal.
   - **Quem ANOTA os pontos no replay (F5 — QA da J5):** o fixture guarda pontos **crus** `{lat,lng,kmh,t}` — **sem `fracao`/`sub`**; ao vivo quem anota é o coletor + `trecho-detector` (no `.exe`, `FecharTrecho`→`RetagSubs`), que **não roda** neste replay. Então o harness de teste anota explicitamente: `fracao` por **`pontoCanonico`** (`delta-calculator.js:188`, distância cumulativa) e `sub` pela **mesma lógica de marcos do `trecho-detector.js`** (paridade com o `RetagSubs` do C#). **Onde os marcos não caem dentro do segmento (as 4/8 curvas tortas — J5 §3), o ponto fica sem `sub` confiável → o acumulador cai no `subTrecho:null` honesto** (não fabrica "onde"). Sem esse anotador nomeado, o teste de paridade não fecha.
2. **Testes automáticos C#** (xUnit — o projeto já roda 255 verdes; o coach entra nesse padrão):
   - **determinismo:** mesmo fixture → mesmo pacote coach.
   - **null honesto:** cold start / sem referência / ruído acima do gate → `coach == null`, sem fabricar cartão.
   - **idempotência:** mesmo `id` não repinta o cartão.
   - **portão/segurança:** nunca solta em curva; `MsgTipo.Grave`/modo crítico esconde o cartão; silencioso bloqueia (paridade `ShowMessage`).
   - **paridade web↔C#:** mesmo fixture, mesma saída nos dois lados.
3. **Trava de arquitetura** — `npm run smoke:arquitetura` (`tests/node-smoke-arquitetura-dado.mjs`): a tela do coach só **exibe** `.coach`, não conecta nem calcula. Se caminho A (§1.3), **registrar a nova casa** no `docs/CONTRATO_DADOS.md` para a trava não reprovar por "casa-de-conta sumiu".

---

## 5. PLANO DE CONSTRUÇÃO EM FASES

### FASE 1 — o mínimo que já entrega valor na tela do piloto (WEB, referência)
Alvo: no **fim da volta**, o piloto vê **um** cartão com a **maior oportunidade** (gráfico + mensagem N1/N2), que some sozinho e cede ao crítico. Construível a partir deste documento:

0. **PASSO 0 — investigação de limites de trecho, junto com a J2 (F1 — QA da J5).** ANTES de construir: conferir as **linhas reais do `trecho-detector.js`** (as 4 âncoras de cada curva) contra os **limites do fixture** (23-24/05). A J5 (§3) achou que em **4/8 curvas** a freada física cai **fora** do trecho nomeado (RETA OPOSTA, JUNÇÃO, BRUXA, VITÓRIA) — o "onde-fino" de freio/entrada fica inatribuível ali. **Mapear a consequência no replay de teste:** se as linhas ao vivo forem as boas, o problema é só do fixture → o teste marca essas curvas como `subTrecho:null` esperado (o sistema silencia o "onde", não quebra); se forem as mesmas do fixture, é **defeito de registro no produto** → escalar ao Fable, não mascarar. Isso usa o mesmo anotador do teste (§4, item 1).
1. **`tempoAtualS` — fechar o laço que JÁ existe** (não é campo novo, é encaixe). Conferido no código: o consumidor web **já lê** `evDelta.tempoAtualS` (`web/cockpit/mensagens-pedagogicas.js:206`) e o record C# **já tem** `DeltaResultado.TempoAtualS` (`DeltaCoach.cs:31`). O que falta é o **produtor** web: `calcularDelta` (`web/cockpit/delta-calculator.js:168-174`) não inclui o campo na saída. Encaixe **aditivo**: incluir `tempoAtualS` (tempo do trecho da volta atual, vindo do coletor da passagem) na saída do `calcularDelta`, fechando produtor↔consumidor. Como o campo já circula no evento, é encaixe pequeno — não mexida estrutural no motor. (Pista do Fable 19:48Z+ confirmada.)
2. **Acumulador de stint no web** — `cerebro-coach-stint.js` (caminho A, arbitrado pelo Fable), consumindo os `DeltaResultado` (agora com `tempoAtualS`) do replay 21/06. É o **reducer da J2** (guarda a memória do stint que o motor não tem).
3. **Pacote coach v1** montado nos três ramos (§2): no ramo `'oportunidade'`, os **pré-computados de N1 E N2** da mensagem (F6 — arbitrado: o N2 são só 3 strings a mais, mesmo mecanismo, custo nulo; o desenho `fim-de-volta → N2` da J1 vale desde a Fase 1) + a `GraficoSpec` mínima da J3 (recorte do trecho: linha do piloto vs referência) + `timing` com `portao='fim-de-volta'/'reta'`, `nivel` (N1 na reta, N2 no fim-de-volta), `podeMostrar`; no ramo `'silencio'`, `status` (J2) + `linha` pré-computada (J1 §2.5). **N3 (revisão de box) fica na Fase 2.**
4. **Ligar o campo** em `cerebro-painel.js:167` — `const coach = null;` → `const coach = avaliarCoachStint(...)`, devolvendo `null` / ramo `'silencio'` / ramo `'oportunidade'` conforme §2, **preservando `_pendentes`**.
5. **Render mínimo** do cartão no miolo livre do painel web aprovado (`cockpit-volta-real.html`) — lê `coach.tipo` e desenha o pré-computado; **soma por cima**, não move nada, some inteiro no portão (o gancho de "um cede ao outro" que o painel já tem — J3 §2.2 caminho b).
6. **Testes** — replay 21/06 (com o anotador nomeado, §4 item 1) + as 4 curvas tortas caindo em `subTrecho:null` esperado (passo 0) + silêncio honesto (ramo `'silencio'`, linha da J1) + idempotência (`id`) + portão (§4).

**Dependência dura da Fase 1:** o objeto-oportunidade da **J2** — já fechado no v1 real (`entregas/janela-2.md §1`), consumido aqui, não o v0 provisório.

### FASE 2 — o produto real e o ensino rico (depois)
- **Port C#** (o `.exe`): `CoachPacote` (+ `CoachStatus`/`CoachLinha`/`MensagemCoach`/`NivelMensagem`/`TimingCoach`/`GraficoSpec`) + `CockpitStateModel.Coach` + `SetCoach`/`HideCoach` + ligar em `FecharTrecho` + render no `MainWindow.xaml` + xUnit de paridade.
- **Portar `geoParaDesenho` para C#** (~6 linhas puras — `web/cockpit/pista-oficial-brasilia.js:22-27`, aditivo) — o `GraficoSpec` da J3 precisa dele no `.exe` para o recorte/zoom. J4 trata o porte (J3 §1.2).
- **Mensagem escalonada N2/N3** (ensino/revisão) quando o piloto tem folga (fim-de-volta/box) — J1.
- **Gráfico rico** (Fase 2 opt-in `fitaMetrica`: freio/vmin/saída — J3 §3.2 caminho D).
- **Evolução da lição** ao longo do stint (do erro grosso ao ajuste fino) — J1/J2.

### Ordem, dependências e riscos
- **Ordem:** J2 destrava tudo → acumulador web (Fase 1) → validação no replay → port C# (Fase 2).
- **Risco 1 — porte cego:** o acumulador é peça nova nos dois lados. **Validar no web com o replay ANTES de portar** para C#.
- **Risco 2 — tocar o cérebro do Command Box:** `cerebro-painel.js:167` é do Command Box. Na Fase 1, **só o valor do campo `coach` muda** (de `null` para a chamada), preservando `_pendentes` e o null honesto; o resto do `snapshot()` fica intacto.
- **Risco 3 — contaminar a v0:** caminho A mantém `cerebro-coach.js` **sem toque**.

---

## 6. Autoconferência da régua dura
- **preto / sem-emoji / você / 956×440:** o envelope não viola; são do render (J1/J3), que herdam o palco aprovado intocado.
- **número-sem-sinal / ganho-em-s:** vêm do objeto-oportunidade (J2, já travado §2.1 — `ganhoVoltaS` positivo em segundos, cor dá direção).
- **timing-seguro:** o portão (§3.2), `prioridade:'critica-vence'` travado no envelope.
- **só-dado-real:** null honesto — sem oportunidade confiável, `coach = null`; nada fabricado.
- **painel-preservado:** o coach **soma por cima** no miolo livre; o campo `coach` já existia esperando; nenhum elemento do painel se move ou é coberto (crítico/shift/freio sempre vencem).

---

## 7. Arbitragens aplicadas / pendências
**Arbitrado pelo Fable (19:48Z) — já incorporado nesta entrega:**
- **Casa da conta nova = caminho A** (módulo irmão `cerebro-coach-stint.js` / `CoachStintAcumulador.cs` + nova casa no Contrato). Fundamento do Fable: regra "uma conta, uma casa" (Flávio 23/06) + v0 100% intocada. Flávio pode reverter; até lá, A.
- **Fase 1 = painel WEB de referência / `.exe` = Fase 2** — coerente com "web primeiro → portar". É decisão de ESCOPO do Flávio; o Fable registrou no quadro (§6) com recomendação de aceitar. Sigo planejando assim até o Flávio bater o martelo.
- **Absorção do v1 da J2** (pedido do Fable): (a) `status` ganhou casa **dentro** do envelope `coach`, no ramo `tipo:'silencio'` (§2); (b) o **`tempoAtualS`** entrou como **passo 1 da Fase 1** (§5) — confirmado como laço já existente (consumido em `mensagens-pedagogicas.js:206`, falta o produtor emitir).
- **Absorção das formas de J1 e J3** (incremento final, blocos 19:48Z+ e 20:08Z do Fable): `coach.mensagem` = **pré-computados N1/N2/N3 + estado** (só strings viajam — nota de serialização §2); `coach.timing` ganhou **`nivel`** e **`podeMostrar`** (J1 §3.4); `coach.grafico` = **`GraficoSpec` v1** da J3 (§1.2), com o porte de `geoParaDesenho` na Fase 2 (§5).
- **Reconciliação do silêncio com a J1 (item 3 do Fable):** no ramo `'silencio'`, **dado = `coach.status`** (J2) e **texto = tabela §2.5 da J1**, pré-computado em `coach.linha`. Uma fonte de cada — apontadas uma para a outra (esta entrega ↔ `janela-1.md §2.5`).

**Ainda aberto (aguardo as donas / o Flávio — não invento a forma):**
- **`timing.duracaoMs`** e o afinamento das regras do portão são da J1 (o envelope já carrega o campo).
- **Preferências marcadas para o Flávio** nas entregas das donas (ex.: semântica de cor da J1 §2.6; a colisão de layout do cartão da J3 §2.2, caminho b) — decisões de escopo/preferência, não de plataforma. Sigo com as recomendações delas até o martelo.
