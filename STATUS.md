# P1 Fast — STATUS (continuação após /clear)

**Data deste checkpoint:** 2026-05-01
**Estado:** Smart Shift Light Premium **construído e auditado mas em hibernação**. Decisão Flávio 2026-05-01: Shift Light é **Fase 2**. Fase 1 = só GPS+IMU do iPhone, foco continua em P1 Coach (trajetória). Suite `npm run test:shift-light` mantida verde (151 testes) como contrato pra ligar quando Fase 2 entrar.

> **Se você é Claude abrindo esta sessão pela primeira vez:**
> Leia este arquivo primeiro, depois `~/.claude/projects/-Users-imac-Projetos-P1-Fast/memory/MEMORY.md`.

---

## Smart Shift Light Premium — entregue (2026-05-01)

Plano: `docs/SHIFT_LIGHT_IMPLEMENTATION_PLAN.md` · Decisões: `docs/SHIFT_LIGHT_DECISIONS.md` · Progresso: `docs/SHIFT_LIGHT_PROGRESS.md`.

Blocos (todos auditados pelo `shift-light-auditor`):
- **Bloco 1** Estimativa de marcha + confiança — `src/domain/gear-{estimation,signatures,shift-detector}.js`
- **Bloco 2** Modo seguro + alvo conservador — `src/domain/{shift-target,safe-mode}.js` + `src/data/cars.js`
- **Bloco 3** Detecção de evento + persistência — `src/pipeline/shift-event-detector.js` + `src/data/{shift-events,trecho-resolver}.js` (Dexie v11)
- **Bloco 4** Cards pós-sessão Fast Coach — `src/domain/shift-analysis.js` + `src/ui/shift-cards-view.js` + `_design-reference/mockup-shift-cards.html`
- **Bloco 5** Pilot Reaction Learning — `src/domain/pilot-reaction.js` + `src/data/reaction-profiles.js` + hook em shift-target (Dexie v12)
- **Bloco 6** DYNO_CALIBRATED + UI — `src/domain/dyno-{csv-parser,target-calculator}.js` + `src/domain/tolerance-from-dyno.js` + aba Dinamômetro em `_design-reference/mockup-carro-novo.html`

Comando de regressão: `npm run test:shift-light` (6 specs em sequência, 104 testes).

---

## Decisão visual canônica (Flavio 2026-04-30)

**Padrão B · Cockpit minimalista azul** é o contrato canônico de TUDO o hub
futuro do P1 Fast (HOME, Modal Evento, Pendências cascata, modais Carro/Config/Stint
e qualquer coisa nova). Tokens, classes e princípios estão em
`~/.claude/projects/-Users-imac-Projetos-P1-Fast/memory/p1-fast-padrao-b.md`.

Arquivo canônico do padrão B no repo: `_design-reference/historico-evento/mockup-evento-B.html`.

**Cockpits NÃO seguem padrão B** — `_design-reference/mockup-cockpit-piloto.html` e
`_design-reference/mockup-cockpit-comparacao.html` mantêm DNA próprio
(preto puro, accents semânticos --bom/--erro/--foco/--sistema/--ouro,
slide 3D, halo radial). NÃO mudar.

---

## Última tarefa (2026-04-30)

**Mockups do fluxo Stint** + **Garagem / Carro** + **Pós-stint**
entregues em `_design-reference/`.

- `mockup-stint.html` — Modal Stint unificado: Configuração (piloto,
  passageiro, combustível, pneu montado, calibragem 4 rodas, setup
  avançado herdado da base) + Objetivo (input + 6 chips de tipo) +
  Aprendizado com IA (toggle Coach + fase de foco + pickers lição e
  trecho). Tudo pré-preenchido com a base do carro: piloto confirma
  tudo direto ou toca em itens específicos pra alterar só nesse stint.
  Substitui o A1 (mockup-stint-objetivo) e o B3 (mockup-stint-override)
  antigos — Flavio pediu fluxo "tudo num modal só".
- `mockup-licao-lista.html` — lista de seleção da lição específica,
  com as 7 lições MVP cadastradas em `src/data/lesson-library.js`.
  Abre a partir do picker "Lição específica" em `mockup-stint.html`.
- `mockup-trecho-lista.html` — lista de seleção do trecho específico,
  com os 8 trechos de Brasília agrupados pelas 4 parciais
  (`src/domain/seed-tracks.js`). Abre do picker "Trecho específico" em
  `mockup-stint.html`. Coach atua em todos os trechos elegíveis se
  "Sem trecho específico".
- `mockup-carro.html` — Modal Carro: cadastro (apelido, modelo,
  categoria, cor) + setup base com os 14 overrides canônicos
  (`src/data/override-schemas.js`) em 5 grupos: PNEUS, ALINHAMENTO,
  SUSPENSÃO, FREIOS, MOTOR · TRANSMISSÃO. É a "base" que o Modal
  Stint herda quando você inicia um stint.
- `mockup-garagem.html` — Tab Garagem do hub: lista de carros com
  swatch de cor, apelido, modelo + categoria, tags de status (próximo
  evento / sem evento / em manutenção) e contagem de stints. Header com
  eyebrow + summary 3-stats. FAB "Novo carro" + bottom-nav com Garagem ativa.
- `mockup-pos-stint.html` — debrief do piloto após encerrar o stint:
  hero da melhor volta (1:42.318 com gaps vs PB do dia / pessoal), card
  de objetivo cumprido, lição praticada (V-Min, 12 mensagens, sucesso
  ALTA), trecho-foco (Curva da Junção, +1.8 km/h em V-min) e sugestão
  pro próximo (saída na Curva do Placar, lição Acelerador Progressivo).

**Sub-modais do Modal Stint** (cada picker do `mockup-stint.html` abre um):

- `mockup-setup-avancado.html` — 11 ajustes herdados da base (cambagem,
  caster, convergência, mola, amort C/E, altura, barra, bias, mapa,
  diferencial). Campos alterados destacados em accent + badge "Alterado";
  campos não alterados com botão pequeno "Da base" pra resetar.
- `mockup-piloto-lista.html` — 4 pilotos cadastrados (Flavio Marx,
  Bruno Marx, Luiz Bresser, Alain Mesquita) com altura/peso/idade.
- `mockup-pneu-lista.html` — estado vazio (pneus são cadastrados ao
  cadastrar/editar o carro). Bullets explicam que cada pneu fica com
  histórico próprio (voltas, km) pra comparar duração entre marcas.
- `mockup-combustivel-lista.html` — Álcool (padrão do Celta) + Gasolina
  + CTA "Cadastrar outro tipo" pra outros combustíveis.
- `mockup-passageiro-lista.html` — passageiro cadastrado na hora do
  stint, salva pro próximo (escolha por nome).

**Forms de cadastro** (cada CTA "Cadastrar X" abre um):

- `mockup-piloto-cadastro.html` — nome + altura + peso + idade.
- `mockup-passageiro-cadastro.html` — nome + altura + peso.
- `mockup-combustivel-cadastro.html` — nome do tipo + observação opcional.
- `mockup-pneu-cadastro.html` — marca/composto + medida + tipo
  (Radial/Slick/Rua) + apelido opcional.
- `mockup-carro-novo.html` — apelido + modelo + categoria + cor.
  Form mínimo: setup base e pneus cadastra depois pelo Modal Carro.

**Modal Carro refeito** (`mockup-carro.html`) — campo único "Composto /
marca" virou seção "Pneus cadastrados" com lista (cada pneu mostra
medida + saídas + voltas) + CTA "Adicionar pneu". Bate com a regra de
que cada pneu é entidade separada com histórico próprio.

**Eventos** (tab + detalhe):

- `mockup-eventos-lista.html` — tab Eventos do hub. Próximo (Brasília
  02/05 destacado em accent) + Passados (Brasília 25/04 com 4 stints /
  47 voltas / 1:42.318; Brasília 28/03 com 3 stints / 32 voltas /
  1:43.847). FAB "Novo evento" + bottom-nav com Eventos ativo.
- `mockup-evento-detalhe.html` — tela de evento (Brasília 25/04). Top
  bar com "‹ Eventos" / "Editar". Summary 4-stats (4 stints / 47
  voltas / 1:42.3 em ouro / 100% pronto). 4 stints listados com
  piloto, lição praticada e tags (PB do dia em ouro, Desvio &lt; 0.4s
  em verde). CTA "Novo stint" dashed inline.

## Realidade canônica (2026-05-01)

- Carro: **Celta 1.4 turismo** (Chevrolet). Refletido em todos os
  mockups (Honda Civic Si retirado).
- Pilotos: **Flavio Marx · Bruno Marx · Luiz Bresser · Alain Mesquita**.
- Combustível: álcool padrão + gasolina alternativa.

Antes de A1..A3 + B2 (commit `eef0c0d`): 4 mockups do hub alinhados ao
padrão B (`mockup-evento.html` canônico + `mockup-home-cheio.html` +
`mockup-home-vazio.html` + `mockup-pendencias-cascata.html`).

---

## Como rodar pra validar

```bash
cd "/Users/imac/Projetos/P1 Fast"

# Smokes (já validados em 71 ok / 0 fail)
npm run smoke

# Server pros mockups
# Configurado em /Users/imac/Projetos/FAM Racing/.claude/launch.json (entry "p1-fast")
# Subir via Claude Preview MCP:
#   tool: mcp__Claude_Preview__preview_start name="p1-fast"
#   → http://localhost:8767/

# Mockups do hub (padrão B):
# http://localhost:8767/_design-reference/mockup-evento.html
# http://localhost:8767/_design-reference/mockup-home-cheio.html
# http://localhost:8767/_design-reference/mockup-home-vazio.html
# http://localhost:8767/_design-reference/mockup-pendencias-cascata.html
# http://localhost:8767/_design-reference/mockup-stint.html
# http://localhost:8767/_design-reference/mockup-licao-lista.html
# http://localhost:8767/_design-reference/mockup-trecho-lista.html
# http://localhost:8767/_design-reference/mockup-carro.html
# http://localhost:8767/_design-reference/mockup-garagem.html
# http://localhost:8767/_design-reference/mockup-pos-stint.html
# http://localhost:8767/_design-reference/mockup-setup-avancado.html
# http://localhost:8767/_design-reference/mockup-piloto-lista.html
# http://localhost:8767/_design-reference/mockup-pneu-lista.html
# http://localhost:8767/_design-reference/mockup-combustivel-lista.html
# http://localhost:8767/_design-reference/mockup-passageiro-lista.html
# http://localhost:8767/_design-reference/mockup-piloto-cadastro.html
# http://localhost:8767/_design-reference/mockup-passageiro-cadastro.html
# http://localhost:8767/_design-reference/mockup-combustivel-cadastro.html
# http://localhost:8767/_design-reference/mockup-pneu-cadastro.html
# http://localhost:8767/_design-reference/mockup-carro-novo.html
# http://localhost:8767/_design-reference/mockup-eventos-lista.html
# http://localhost:8767/_design-reference/mockup-evento-detalhe.html

# Mockups dos cockpits (NÃO MEXER):
# http://localhost:8767/_design-reference/mockup-cockpit-piloto.html
# http://localhost:8767/_design-reference/mockup-cockpit-comparacao.html

# Histórico das 7 linhas A-G (referência apenas):
# http://localhost:8767/_design-reference/historico-evento/mockup-evento-A.html .. G.html
# http://localhost:8767/_design-reference/historico-evento/mockup-evento-B.html ← CANÔNICO

# Comparativo:
# http://localhost:8767/_design-reference/historico-evento/mockups-evento-comparacao.html
```

---

## Histórico de commits

```
067e172 feat: resgata historico das 7 linhas exploradas do Modal Evento
5cc2071 feat: resgatar 6 mockups canônicos como _design-reference/
9eed981 init: P1 Fast — pacote de telemetria + domínio + backends
```

---

## Princípios duráveis (todos em memória)

1. **Mockup canônico é contrato imutável** — copiar 1:1, sem inventar
   token/gap/!important/aliases. (`feedback_canonico_eh_contrato.md`)
2. **Tratamento "você"** — nunca "tu/te/ti/contigo/teu/tua".
   (`feedback_tratamento_voce.md`)
3. **Sem ícones decorativos** — texto puro em botões/labels/títulos.
   (`feedback_sem_icones.md`)
4. **Cockpits NÃO seguem padrão do hub** — DNA próprio.
   (`p1-fast-padrao-b.md` §"Cockpits NÃO seguem padrão B")
5. **Se a estrutura do mockup não couber no consumidor JS, ADAPTE O JS,
   NÃO O MOCKUP.** Reescrever o consumidor é a opção certa.
   Aliasing/wrappers preservados é drift.
   (`feedback_canonico_eh_contrato.md`)

---

**Último commit nomeado:** `eef0c0d` (alinhamento dos 4 mockups do hub no padrão B)
