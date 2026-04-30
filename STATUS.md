# P1 Fast — STATUS (continuação após /clear)

**Data deste checkpoint:** 2026-04-30
**Estado:** repo standalone criado a partir do FAM Racing `_export/`. Smokes 71 ok / 0 fail.

> **Se você é Claude abrindo esta sessão pela primeira vez:**
> Leia este arquivo primeiro, depois `~/.claude/projects/-Users-imac-Projetos-P1-Fast/memory/MEMORY.md`.

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

## Tarefa em andamento quando Flavio deu /clear

**Refazer 3 mockups do hub no padrão B** + criar `mockup-evento.html` canônico
(cópia do B sem o BC) + apagar `mockup-evento-BC.html` obsoleto.

Detalhes em `~/.claude/projects/-Users-imac-Projetos-P1-Fast/memory/p1-fast-tarefa-pendente.md`.

Ordem operacional:

```bash
cd "/Users/imac/Projetos/P1 Fast/_design-reference"

# 1. Promover B → canônico
cp historico-evento/mockup-evento-B.html mockup-evento.html
rm mockup-evento-BC.html

# 2. Reescrever 3 mockups do hub no padrão B (estrutura e conteúdo
#    preservados, mas tokens/cores/componentes substituídos pelo B)
#    - mockup-home-cheio.html
#    - mockup-home-vazio.html
#    - mockup-pendencias-cascata.html

# 3. Atualizar _design-reference/README.md
#    - Remover mockup-evento-BC, adicionar mockup-evento
#    - Substituir bloco "Tokens BC compartilhados" pelos tokens do padrão B

# 4. Validar visualmente cada mockup no preview MCP server p1-fast :8767

# 5. Commit
```

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

# Mockups do hub (refazer no padrão B):
# http://localhost:8767/_design-reference/mockup-home-cheio.html
# http://localhost:8767/_design-reference/mockup-home-vazio.html
# http://localhost:8767/_design-reference/mockup-pendencias-cascata.html

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

**Último commit antes do /clear:** `067e172`
**Próximo commit esperado:** alinhamento dos 3 mockups do hub no padrão B
