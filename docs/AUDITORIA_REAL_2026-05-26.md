# Auditoria honesta do P1 Fast — 2026-05-26

> Foi pedida pelo Flávio (madrugada 26/05) durante sessão autônoma. Esse documento descreve o estado real do projeto no momento, sem inflar, em linguagem de gestor. Não é plano. É retrato.

## Em uma frase

O P1 Fast tem MUITO código pronto, mas espalhado em **159 linhas de trabalho separadas** (branches), **10 submissões abertas** (PRs), **15 ambientes isolados ativos** (worktrees) e dezenas de mockups que nunca foram incorporados à versão oficial. O risco real não é "falta código" — é **perder código que já existe**.

## O que está em produção (versão oficial, ar)

| Componente | Onde | Estado |
|---|---|---|
| Página de captura T3000 + painel ao vivo | `p1t4000.vercel.app` | ✓ no ar (submissão #214 incorporada hoje) |
| Decodificador T3000 v2 (30+ sensores) | `web/cockpit/t3000-usb-parser.js` | ✓ versão oficial, 21 testes verdes |
| Painel canônico web (HTML/CSS/JS) | `web/cockpit/` (8 arquivos, ~1.500 linhas) | ✓ pronto |
| Cérebro do cockpit em C# (Windows) | `windows/cockpit/` (34 arquivos `.cs`) | ✓ 129 testes verdes |
| Programa de captura crua T4000 (.exe) | `windows/cockpit/P1Fast.Cockpit.T4000Capture/` | ✓ no ar (artefato GitHub Actions) |
| Banco Supabase com 22 migrações | `supabase/migrations/` | ✓ aplicadas |
| 10 rotas de servidor (Edge Functions) | `supabase/functions/` | ✓ no ar |
| App iOS (66 arquivos núcleo + 69 da tela) | `ios/p1fast-core/` + `ios/p1fast-ios/` | ✓ instalado no iPhone do Flávio |
| Mockup canônico do **cockpit do piloto** | `_design-reference/mockup-cockpit-piloto.html` | ✓ aprovado, no projeto |

## O que está PRESO em linhas de trabalho separadas (nunca incorporado)

### Mockups Command Box — aprovados, fora da versão oficial

| Item | Linha de trabalho | Submissão | Idade |
|---|---|---|---|
| **Mockup Command Box vista Engenheiro** (7.435 linhas HTML) | `claude/command-box-mockup-recovery` | **#201 aberta** | 13 dias |
| **Mockup Command Box vista Piloto polida + dúvidas Vmin + dúvidas frenagem + comparação pneus** | `feat/mockups-command-box-piloto` | **#205 aberta** | 13 dias |

Estes mockups foram desenhados, aprovados em sessões anteriores, mas nunca incorporados. **Quem abrir uma sessão nova do Claude no projeto não acha esses mockups via versão oficial.** Só achei agora porque rastreei as submissões abertas.

### Outras submissões abertas (10 ao todo)

| # | Tema | Idade |
|---|---|---|
| #205 | Mockups Command Box vista piloto polido | 13 dias |
| #204 | Fix navegação menu inferior | 13 dias |
| #203 | Regularização estrutural + ADR-025 | 13 dias |
| #202 | F4 — triagem de vídeo volta-por-volta | 13 dias |
| #201 | Command Box vista Engenheiro | 13 dias |
| #193 | Rodada 1 de ajustes (24 mudanças, 8 entregas) | mais antiga |
| #166 | Rotação 180° controlada pelo app | bem antiga |
| #97 | docs STATUS pré-MS-2.1/2.2 | muito antiga |
| #94 | docs P1 Coach Vision arquivada | muito antiga |
| #51 | App icon master upscaled | antiquíssima |

**Risco:** essas submissões podem nunca ser incorporadas e o trabalho fica órfão. Em maio você cobrou exatamente isso (memória `regra-dura-incorporar-versoes-finais`).

## Pendências escondidas (impedem o produto andar)

### 1. Envio do iPhone pra nuvem QUEBRADO (cobrado 25/05 noite)

- **Sintoma:** 102 mil amostras de telemetria do iPhone presas no celular, não sobem pra nuvem.
- **Causa-raiz registrada na memória `p1-fast-envio-nuvem-investigacao-2026-05-25`:** banco SQLite do iPhone corrompeu (`SQLite error 11`), foi reparado, mas o esquema do banco da nuvem está MUITO atrás do app:
  - `eventos.data_fim` está NOT NULL na nuvem (opcional no app)
  - `evento_pendencias.template_id` é UUID na nuvem (TEXT no app)
  - `evento_pendencias` na nuvem não tem colunas `quantidade` + `nota`
- **Decisão pendente do gestor:** dizer literalmente "MIGRAR PARA PRODUÇÃO: schema eventos + evento_pendencias" pra eu rodar a migração que destrava.
- **Impacto:** sem isso, força G + GPS + voltas do iPhone NÃO entram no painel do piloto e NÃO viram análise.

### 2. T3000 hoje no carro, mas spec é T4000

- O aparelho plugado no Bubi é **INJEPRO T3000**. A documentação do projeto inteira fala "T4000".
- Toda a engenharia decifrada hoje (decodificador v2) foi feita lendo o software T LINE que serve toda a família T-Series (T3000/T4000/T5000/T10000). Sensores comuns provavelmente batem. Mas quando você migrar pra T4000, validar.
- **Decisão pendente:** vai trocar a central pra T4000 quando?

### 3. Não há ponte Notebook → Nuvem ainda

- A página `p1t4000.vercel.app` lê a T3000 e mostra no painel local — **mas os dados não sobem pra nuvem**.
- Sem isso, NENHUMA das telas do Command Box pode consumir esses dados.
- **É o gargalo arquitetural pra fechar o laço que você descreveu** (T4000 → nuvem → análise central → cockpit + Command Box).

### 4. Análise pedagógica existe mas está isolada

- O projeto tem peças prontas e testadas isoladamente:
  - `Detector` (cruza linha de chegada, identifica trechos)
  - `ErrorClassifier` (16 tipos de erro de pilotagem)
  - `PedagogicalDecider` (decide qual frase aplicar)
  - `CoachPhrases` (36 frases pré-aprovadas em português)
- **Nunca foram plugados num pipeline completo com fonte real.** Cada um vive nos próprios testes automáticos, sem ninguém os usando junto.

### 5. 159 branches remotas (entulho potencial)

- Projeto tem 159 linhas de trabalho separadas no GitHub.
- Muitas são auto-saves de sessões antigas (`claude/competent-volhard-b272c8`, `claude/hardcore-nightingale-d1a1b8`, etc).
- 15 ambientes isolados ativos no disco local (`.claude/worktrees/`).
- **Não dá pra limpar sem auditoria minuciosa, porque algum delas pode ter trabalho final não incorporado** (como aconteceu com a Mola Helicoidal, Vista Piloto v04, Lambda Final — registrados na memória `regra-dura-incorporar-versoes-finais`).

### 6. App iOS ainda não testou stint real válido

- Primeiro stint real (2026-05-23) saiu cego: `carro_id` vazio, IA desligada, detector de trecho não armado, sem câmera.
- 10 voltas registradas eram sintéticas, criadas todas no mesmo segundo no encerramento.
- 5 pendências operacionais + 3 técnicas listadas pra próximo dia de pista.

## Calibração específica do Bubi

| Parâmetro | Valor | Origem | Aplicado? |
|---|---|---|---|
| Redline | 6.300 rpm (não passar de 6.350) | Dinamômetro Lenza 2026-05-18 | ✓ no decodificador hoje |
| Pico de potência | 122,8 HP @ 6.050 rpm (corrigido SAE) / 106 HP roda Brasília | Dinamômetro | Documentado |
| Pico de torque | 162,1 N·m @ 5.200 rpm | Dinamômetro | Documentado |
| Tipo motor | Onix 1.4 preparado | Adriana | Documentado |
| Tipo câmbio | Celta 1.0 (5 marchas) | Adriana | Documentado |

## O que decidir nas próximas horas/dias

Em ordem de impacto:

1. **Incorporar mockups Command Box (#201 + #205) à versão oficial.** Caso contrário ficam órfãos. Tempo: 5 minutos meus (com sua autorização "vai").
2. **Autorizar "MIGRAR PARA PRODUÇÃO: schema eventos + evento_pendencias"** pra destravar as 102 mil amostras do iPhone. Tempo: 30 minutos meus.
3. **Validação visual do MVP T3000 com motor ligado (5 minutos seus).** Confirma que cada sensor mapeado bate com a vida real. Pode ser hoje mesmo, em casa.
4. **Construir ponte Notebook → Nuvem.** 4-6 horas meus, faço sozinho. Destrava arquitetura.
5. **Plugar análise existente em fonte real.** Quando os dados chegarem na nuvem, fazer o pipeline funcionar ponta a ponta com dados sintéticos primeiro, depois reais.
6. **Limpeza progressiva das 159 branches.** Não fazer hoje — pode descartar trabalho válido sem auditoria. Plano: cada branch que aparecer em sessão, decidir incorporar ou descartar.

## O que NÃO precisa ser feito agora

- Validar todas as 10 PRs antigas (#97, #94, #51) — muitas devem ser entulho real, mas requer leitura caso a caso.
- Implementar Command Box vista Mecânico / Chefe / Convidado — mockups ainda não desenhados pra estes papéis.
- Migrar T3000 → T4000 — depende de você comprar e instalar a central nova.
- Bluetooth da Injepro — descartado, fica como última opção.

## Honestidade técnica

O que aconteceu nesta noite (26/05 madrugada):
- ✓ Decodificador T3000 v1 (4 sensores) → v2 (30+ sensores) via engenharia reversa do software oficial.
- ✓ 21 testes automáticos verdes (era 10).
- ✓ Painel HUD atualizado mostrando 12 indicadores ao vivo.
- ✓ Submissões #213 e #214 incorporadas à versão oficial.

O que NÃO foi feito (e talvez devesse):
- ✗ Não validei NENHUM sensor novo com motor ligado real. Os 21 testes usam fixtures sintéticas baseadas no mapeamento extraído do software original. Pode haver pequenos erros de divisor (÷10 vs ÷100) que só aparecem com motor de verdade.
- ✗ Não toquei nas pendências escondidas. Esta auditoria existe pra você decidir.
- ✗ Não testei a página `p1t4000.vercel.app` v2 num navegador real desde o deploy. O Vercel respondeu HTTP 200 com o conteúdo certo, mas isso não substitui ver acontecendo no Edge/Chrome.
