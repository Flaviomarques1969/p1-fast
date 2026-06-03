# Plano da noite — Função Manutenção (gatilho "go")

**Data:** 2026-05-18 (madrugada)
**Disparo:** Flávio dá `/clear` e digita `go`.
**Executor:** Claude autônomo, do início ao fim, enquanto Flávio dorme.
**Ambiente:** `infallible-snyder-198a08` (ambiente isolado de trabalho).
**Produção:** NÃO será tocada. Banco oficial Supabase não recebe nada.

---

## 1. Escopo da noite (decidido honestamente)

Vou plantar **4 dos 9 blocos** da apresentação premium. Os 4 que formam o miolo lógico — sem visto visual obrigatório, e que carregam o sistema todo daqui pra frente:

| Bloco | Conteúdo | Tempo estimado |
|---|---|---|
| **1 · Fundação** | Tabelas no banco local · enum de áreas reusando o que Estoque já tem · lista fixa de itens trocáveis por área · aba "Manutenção" no painel do carro · sub-aba "Especificação padrão" pronta pra preencher | ~1 h |
| **2 · Lançamento manual com foto simples** | Formulário de nova troca (data · carro · área · item · marca · modelo · spec · km · observação · foto opcional via fotos do iPhone) · abate −1 do Estoque quando há vínculo · lista cronológica | ~1,5 h |
| **4 · Periodicidade que entende pista** | Regra por item (km de rua / km de pista peso 3× / horas / data) · defaults sugeridos · cálculo da próxima troca · gera pendência automática usando a função Pendências que JÁ existe | ~1,5 h |
| **5 · Módulo de inteligência aprendente** | Contador vivo desde a última troca (km · voltas por pista) · histórico do que cada troca durou · média por pista ("óleo dura X km em Brasília") · refinamento da previsão (não confia mais no manual) · detecção simples de anomalia | ~1,5 h |

**Total:** ~5,5 h de trabalho real. Manhã chega com base sólida instalada no iPhone.

---

## 2. O que NÃO vou fazer (e por quê)

| Bloco premium adiado | Por que adiar |
|---|---|
| **3 · Foto inteligente plena** (leitor avançado + modelo de visão na nuvem + catálogo aprendido) | Precisa de chave de serviço pago + seu visto explícito por foto. Custa dinheiro, ainda que pouco. Sem o gestor acordado, não posso autorizar custo recorrente. |
| **6 · Painel "Pronto pra pista" com semáforo** | É a tela mais visível e premium. Sem seu olho durante a noite, corro o risco de entregar diferente do que você imaginou. Melhor com você ali pra ajustes finos. |
| **7 · Pneu por nº de série** | Cadastro de 4 pneus por posição (DD/DE/TD/TE), rotação, vida estimada — interface complexa. Merece desenho com você. |
| **8 · Plano pré-evento automático** | Depende de calendário de eventos real e mecânica de "consumo previsto". Precisa de validação contra eventos verdadeiros (Brasília 23/05, etc.). |
| **9 · Backup automático no iCloud** | Precisa configurar permissão da Apple (capability iCloud) e isso exige conta paga ativa + teste com o seu Apple ID. Não dá no escuro. |

Quando você acordar e aprovar, esses 5 entram em sequência — 4 a 5 sessões adicionais.

---

## 3. Outras travas absolutas

- **NÃO** vou alterar produção (banco oficial Supabase, painel Vercel, DNS, autenticação, integrações).
- **NÃO** vou subir as 3 tabelas novas pro servidor Supabase — ficam SÓ no banco local do iPhone, mesma decisão que aplicamos ao Estoque ontem.
- **NÃO** vou apagar nada do banco do iPhone. Os dados de teste atuais (Subaru, Bolinha, eventos, stints, peças do Estoque) ficam intactos.
- **NÃO** vou tocar no cockpit do piloto, no mapa de Brasília oficial v2 (495 pontos congelados), nem na função Estoque entregue ontem.
- **NÃO** vou criar nada novo fora desse escopo de Manutenção.

---

## 4. Ordem técnica detalhada

### Antes de começar (5 min)

1. Confirmar que estou no ambiente isolado `infallible-snyder-198a08`.
2. `swift run p1fast-smoke` pra garantir que partida está verde (testes automáticos passam).
3. `xcrun devicectl device list` pra confirmar que o iPhone do Flávio está pareado (sim, pareamento de empacotamento funciona — só `idevicescreenshot` está quebrado).
4. `git status` pra ver se não tem nada solto.

### Bloco 1 — Fundação (1h)

**Arquivos a criar:**
- `ios/p1fast-core/Sources/P1FastCore/Persistence/Models.swift` — estende com `Manutencao`, `ManutencaoEspecificacao`, `ManutencaoPeriodicidade`, enum `ManutencaoItem` (lista fixa por área usando o `PecaArea` existente).
- `ios/p1fast-core/Sources/P1FastCore/Persistence/Migrations.swift` — `v27_manutencoes` adiciona 3 tabelas + campo opcional `manutencao_referencia` em `pecas`.
- `ios/p1fast-ios/Sources/Persistence/ManutencaoRepository.swift` — novo, ~250 linhas (CRUD básico + busca por carro).
- `ios/p1fast-ios/Sources/Views/CarroDashboardView.swift` — adicionar aba "Manutenção" vazia (estado de boas-vindas).
- `ios/p1fast-ios/Sources/Views/ManutencaoViews.swift` — novo, abriga todas as telas dessa função.

**Critério de sucesso:** abrir o aplicativo no iPhone, ir em Garagem → tocar Subaru → ver a aba "Manutenção" → ver "Você ainda não registrou nenhuma troca" + botão "+ Registrar primeira troca".

### Bloco 2 — Lançamento manual com foto simples (1,5h)

**Arquivos:**
- `ManutencaoViews.swift` — adicionar `ManutencaoFormView` (formulário).
- `ManutencaoRepository.swift` — método `criar(...)` + abate no `PecaRepository` quando há vínculo.

**Campos:**
- Data (default hoje)
- Carro (default = o carro que abriu)
- Área (lista das 14 áreas que já existem no Estoque)
- Item (lista por área — óleo, filtro, vela, etc.)
- Marca, modelo, especificação (campos livres por enquanto — sessão 3 vai automatizar)
- Quilometragem do carro
- Foto opcional (PhotosPicker padrão do iOS — sem OCR ainda)
- Observação livre

**Critério:** registrar uma troca de óleo do Subaru pelo aplicativo, ver entrando na lista cronológica.

### Bloco 4 — Periodicidade que entende pista (1,5h)

**Lógica nova em `ManutencaoRepository.swift`:**
- Tipo `PeriodicidadeRegra`: `.porKmRua(Int)` / `.porKmPista(Int, peso: Double = 3.0)` / `.porHoras(Int)` / `.porData(Int meses)` / `.combinacao([...], operador: .qualquer | .todas)`.
- Função `calcularProximaTroca(item:, carro:, baseHistorico:)`.
- Função `gerarPendenciasVencidas()` — chamada no boot do app e quando uma sessão de stint termina; cria pendências via `PendenciaRepository.criar(...)` (já existe).

**Defaults sugeridos (catálogo embarcado):**
- Óleo motor sintético: 5.000 km **ou** 6 meses (o que vencer primeiro).
- Filtro de óleo: junto com o óleo.
- Filtro de ar: 10.000 km.
- Velas convencionais: 20.000 km.
- Fluido de freio: 24 meses.
- Líquido arrefecimento: 24 meses ou 40.000 km.
- Correia dentada: 60.000 km ou 5 anos.
- Pastilha freio: "por desgaste" (sem prazo automático).
- (10–15 itens default no total.)

**Critério:** registrar troca antiga (12 meses atrás) → ver pendência aparecer automaticamente na lista de Pendências do carro.

### Bloco 5 — Módulo de inteligência aprendente (1,5h)

**Lógica:**
- Função `historicoItemPorCarro(item:, carro:)` — retorna todas as trocas daquele item, na ordem.
- Função `calcularDuracaoMedia(item:, carro:)` — pega 2 trocas em sequência e calcula quanto a anterior durou em km / voltas / horas / dias.
- Função `voltasDePistaEntre(carro:, dataA:, dataB:)` — soma voltas registradas em stints entre as duas datas, agrupando por autódromo.
- Função `contadorDesdeUltimaTroca(item:, carro:)` — retorna o que rodou desde a última troca (km total + voltas por pista + horas + dias).
- Função `previsaoProximaTroca` — se já existe histórico, USA a média aprendida em vez do default do manual.
- Função `detectarAnomalia(troca:)` — se essa troca durou menos de 60% da média aprendida do mesmo item, marca a próxima como anômala.

**Telas:**
- `ManutencaoItemDetalheView` — ao tocar num item da lista de trocas, abre a ficha com:
  - "Desde a última troca: X km · Y voltas em Brasília · Z voltas em Velocitta"
  - "Esse item, nesse carro, dura em média: A km · B voltas (média de N trocas registradas)"
  - "Próxima troca prevista: ..." (já aprendida, não chutada).

**Critério:** registrar 2 trocas de óleo do Subaru com datas separadas e voltas de stint no meio → ver na ficha do óleo que o sistema aprendeu quanto durou e ajustou a previsão.

### Após cada bloco

1. `swift run p1fast-smoke` — teste automático precisa continuar verde.
2. `xcodebuild` (empacotamento Debug iPhone) — precisa retornar `** BUILD SUCCEEDED **`.
3. `xcrun devicectl device install app` — instala no iPhone do Flávio.
4. `xcrun devicectl device process launch` — abre o aplicativo.
5. Atualizar `.claude-exec/ultima-tarefa.md` com TASK_DONE do bloco.
6. Próximo bloco.

### No fim de tudo

1. Atualizar memória do projeto com o que foi entregue, no padrão das memórias anteriores.
2. Atualizar `MEMORY.md` no topo com selo ⏰ "Manutenção noturna entregue 2026-05-18".
3. Deixar mensagem clara em `ultima-tarefa.md` listando o que Flávio deve testar quando acordar.

---

## 5. Como vou verificar sem você acordado

Sem `idevicescreenshot` funcionando (pareamento legado quebrou, conforme memória), tenho 3 formas de validar:

1. **Testes automáticos** (`swift run p1fast-smoke`) — precisam continuar 100% verdes.
2. **Empacotamento + instalação + abertura sem erro de carregamento** (sintoma de crash ao abrir).
3. **Puxar o banco do iPhone** (`xcrun devicectl device copy from --domain-type appDataContainer ...`) e inspecionar diretamente a tabela `manutencoes` pra confirmar que minha troca de teste foi gravada.

Vou registrar troca de teste programaticamente no Bloco 2 pra validar o pipeline e depois apagar ela do banco — você não deve ver lixo no aplicativo de manhã.

---

## 6. Se algo travar

- Trava num bloco → paro NESSE bloco, sem partir pro próximo.
- Registro no `ultima-tarefa.md` exatamente onde travei e por quê.
- Empacoto e instalo o que ESTÁ pronto antes da trava.
- Salvo memória detalhada do ponto exato pra retomada de manhã.
- **NÃO** desfaço trabalho dos blocos anteriores.
- **NÃO** apago nada.
- **NÃO** chuto solução pra contornar — paro e reporto.

---

## 7. Como Flávio retoma de manhã

1. Pega o iPhone, abre o P1 Fast.
2. Menu de baixo → Garagem → toca Subaru.
3. Vê a aba **Manutenção** nova.
4. Lista mostra a(s) troca(s) que eu deixei como exemplo (ou vazia, se eu apagar as de teste — vai estar registrado no `ultima-tarefa.md`).
5. Toca em **+ Registrar troca** → preenche óleo motor de hoje.
6. Volta pra ficha do óleo motor → vê o contador vivo aparecer.
7. Se já tiver 2 trocas registradas, vê a inteligência calcular média.
8. Vai em **Pendências** (já existe na Home) → verifica se nasceram pendências automáticas pra itens vencidos.
9. Sub-aba **Especificação padrão** dentro de Manutenção: pode preencher qual é o óleo padrão do Subaru.

---

## 8. Como Flávio dispara o trabalho

Depois do `/clear`, digita simplesmente: **`go`**.

A memória `p1-fast-comando-go-manutencao-2026-05-18.md` faz o gatilho. O Claude que receber o "go" lê:

1. Essa memória dedicada.
2. Esse arquivo de plano (`PLANO_NOITE_MANUTENCAO_GO.md`).
3. `STATUS.md` + `CLAUDE.md` do projeto + `~/.claude/CLAUDE.md` (protocolo Flávio).
4. Começa o Bloco 1.

Sem perguntas. Sem cards. Sem confirmação. Só executa.

---

## 9. Checklist de prontidão (pra eu marcar antes de dormir)

- [ ] Esse arquivo `PLANO_NOITE_MANUTENCAO_GO.md` salvo no projeto.
- [ ] Memória `p1-fast-comando-go-manutencao-2026-05-18.md` criada.
- [ ] `MEMORY.md` atualizado no topo com referência ao gatilho.
- [ ] `ultima-tarefa.md` registrada com TASK_INIT do plano noturno.
- [ ] iPhone do Flávio pareado pra empacotamento (testar `devicectl device list`).
- [ ] Testes automáticos partindo verde (`swift run p1fast-smoke`).
- [ ] Auto-save (hook) ativo pra preservar trabalho a cada poucos minutos.
