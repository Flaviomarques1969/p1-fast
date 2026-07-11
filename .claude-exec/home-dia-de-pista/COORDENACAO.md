# HOME "DIA DE PISTA" — coordenação (Fable 5 = coordenador) — PLANO DE 5 JANELAS SIMULTÂNEAS (replanejado 2026-07-11 a pedido do Flávio)

Decisão do Flávio 2026-07-11 (painel `p1fast-home-conceito-1444`):
1. Nova Home = **Conceito A — Dia de Pista** (referência visual: `_design-reference/propostas-home-2026-07-11/proposta-a-dia-de-pista.html`).
2. Ferramentas de teste **saem da Home** e ganham área "Ferramentas de teste" **dentro da Garagem** (nada é apagado).

## Formato de execução — 5 janelas Opus 4.8 SIMULTÂNEAS
- Cada janela: sessão NOVA/limpa, diretório `/Users/imac/Projetos/P1 Fast`, modelo **Opus 4.8**, e o mandato é a PRIMEIRA coisa colada.
- Cada janela trabalha em ambiente isolado (worktree — ADR-021), linha própria; NUNCA incorpora à versão oficial.
- Entregas em `.claude-exec/home-dia-de-pista/entregas/janela-<n>.md`.
- Coordenador (esta janela, Fable 5): audita cada entrega quando o Flávio disser "janela N ok", resolve conflito e monta a integração final para aprovação do Flávio.

### As 5 construtoras em PARALELO (sem nenhum arquivo em comum)
- **J1 — HERÓI DO EVENTO** (`PROMPT-J1-HEROI.md`): componente novo `HeroEventoCard.swift` (evento + selo EM N DIAS + anel de prontidão + linha de pendências + botão Iniciar Stint) e os tokens novos no `Theme.swift` (só a J1 toca o Theme).
- **J2 — MELHOR VOLTA + AO VIVO** (`PROMPT-J2-VOLTA-AOVIVO.md`): componentes novos `MelhorVoltaCard.swift` (mini traçado + tempo) e `AoVivoRow.swift`.
- **J3 — CARROS + NÚMEROS** (`PROMPT-J3-CARROS-NUMEROS.md`): componentes novos `CarroRowCompacta.swift` e `NumerosRodape.swift`.
- **J4 — GARAGEM** (`PROMPT-J4-GARAGEM.md`): área "Ferramentas de teste" dentro da `GaragemView`.

### J5 também executa JÁ (revisado 2026-07-11 — ordem do Flávio: as 5 saem juntas)
- **J5 — ESTRUTURA DA HOME** (`PROMPT-J5-MONTADORA.md`): reescreve o estado cheio da `HomeView.swift` contra o CONTRATO, com peças provisórias em `HomeDiaDePistaStubs.swift`; liga o dado real e remove os botões de teste da Home.
- **MONTAGEM FINAL + AUDITORIA = COORDENADOR (Fable)**: a cada "janela N ok" do Flávio, o coordenador audita a entrega; ao final, troca os provisórios pelos componentes reais das J1–J3, integra a J4, roda no simulador e apresenta ao Flávio.

## CONTRATO DOS COMPONENTES (onda 1 constrói contra isto; J5 consome isto)
Todos em `ios/p1fast-ios/Sources/Components/`, SwiftUI, tokens só de `Theme.swift`, com `#Preview` funcionando:
- `HeroEventoCard(pista:String, dataISO:String, pistaOficial:String?, horario:String?, diasAte:Int, prontidaoPct:Int?, pendenciasAbertas:Int, onPendencias:()->Void, onStint:()->Void)` — `diasAte==0` = "HOJE" azul; `prontidaoPct nil` = sem anel (estado honesto).
- `MelhorVoltaCard(melhorMs:Int?, contexto:String?, evolucaoMs:Int?, onTap:()->Void)` — `melhorMs nil` → "—"; evolução verde SÓ se `evolucaoMs` real.
- `AoVivoRow(aoVivoAgora:Bool, subtitulo:String?, onTap:()->Void)` — ponto verde discreto; SEM borda vermelha.
- `CarroRowCompacta(apelido:String, sub:String, cor:Color, stints:Int, onTap:(()->Void)?)`.
- `NumerosRodape(eventos:Int, voltas:Int, stints:Int, onEventos:()->Void, onVoltas:()->Void, onStints:()->Void)`.
Mudança de assinatura SÓ com aprovação do coordenador (escreva a proposta na sua entrega e pare).

## Regras que valem para as 5 janelas
- Fundo escuro; PROIBIDO emoji (só ícone de traço); vermelho SÓ crítico, atenção = âmbar; tratamento "você"; largura toda; ação óbvia no 1º toque.
- Preservar tudo que existe; nada de apagar tela; dado real primeiro ("—" honesto).
- Prova obrigatória por janela: empacotamento verde + foto (`#Preview`/simulador **P1-Zoom375** 375×812) + testes existentes verdes + relatório com comandos e saídas REAIS.
- TASK_INIT/TASK_DONE no `ultima-tarefa.md` (preservando histórico) + registro-correcoes se corrigir erro.
- PRODUÇÃO PROTEGIDA: nada vai ao ar; nada de incorporar à versão oficial.

## Fronteiras duras (colisão = reprovado)
- J1: só `HeroEventoCard.swift` (novo) + `Theme.swift`. — J2: só os 2 arquivos novos dela. — J3: só os 2 arquivos novos dela.
- J4: só `GaragemView` (+ fiação mínima que ela precisar, declarada na entrega). — J5: `HomeView.swift` + integração.
- NINGUÉM toca web/, cockpit, cérebro, Supabase, `cockpit-app.html`.

## Estado
- [x] J1 entregou+AUDITADA ✅ (2026-07-11; fronteira mínima — nem o Theme precisou mudar, âmbar já existia; 4 estados provados em foto; NOTA p/ montagem: avaliar anel VERDE quando 100% pronto) · [x] J2 entregou+AUDITADA ✅ (2026-07-11; AoVivoRow estava fora do registro — coordenador registrou a6556b0d) · [x] J3 entregou+AUDITADA ✅ (2026-07-11, fronteira limpa, assinaturas 1:1, foto conferida) · [x] J4 entregou+AUDITADA ✅ (2026-07-11; coordenador removeu cache build-sim do registro e passou a ignorar a pasta; DEPENDÊNCIA: J5 preserva casos .testeAoVivo/.telemetriaDemo e o builder telemetriaDevView na HomeView) · [x] J5 entregou+AUDITADA ✅ (2026-07-11; estrutura fiel ao conceito A, dado real, fotos ok; fiação do ContentView estava fora do registro — coordenador registrou)
- [x] Auditorias do coordenador: 5/5 aprovadas (2026-07-11)
- [x] Montagem final CONCLUÍDA 2026-07-11 (linha `claude/home-integracao`, commit de4221d3): 5 linhas incorporadas, provisórios apagados, anel verde a 100%, título duplicado da melhor volta removido; BUILD SUCCEEDED 3×; fotos em entregas/fotos-integracao/
- [ ] Integração à versão oficial (só com ordem do Flávio)
