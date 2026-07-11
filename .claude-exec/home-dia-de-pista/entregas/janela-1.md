# ENTREGA — JANELA 1 — Construtora do Herói do Evento

**Data:** 2026-07-11 · **Modelo:** Opus 4.8 · **Ambiente:** desenvolvimento (isolado, produção intocada)
**Linha de trabalho isolada:** `claude/home-j1-heroi` (worktree `.claude/worktrees/home-j1-heroi`, a partir de `main` local `68813c12`)

## O que foi feito
Componente novo **`HeroEventoCard.swift`** — o cartão-herói do topo da nova Home "Dia de Pista"
(Conceito A aprovado pelo Flávio 2026-07-11), espelhando o bloco `.hero` da referência visual aprovada
`_design-reference/propostas-home-2026-07-11/proposta-a-dia-de-pista.html`.

### Onde
`ios/p1fast-ios/Sources/Components/HeroEventoCard.swift` (arquivo NOVO — 1 arquivo, dentro da fronteira).

### Assinatura — EXATA do contrato (COORDENACAO.md §CONTRATO), sem desvio
```
HeroEventoCard(
  pista: String, dataISO: String, pistaOficial: String?, horario: String?,
  diasAte: Int, prontidaoPct: Int?, pendenciasAbertas: Int,
  onPendencias: () -> Void, onStint: () -> Void
)
```

### Conteúdo entregue (item por item do mandato)
- **Eyebrow** "PRÓXIMO EVENTO" (vira "ATIVO · HOJE" quando `diasAte == 0`).
- **Pista grande** (título 22pt bold) + **data + autódromo** (`dataISO` → "2 de maio"; autódromo só se `pistaOficial` real).
- **Selo âmbar "EM N DIAS"** (`Color.atencao`) → **azul "HOJE"** (`Color.accent`) quando `diasAte == 0`.
  Guardas: `diasAte == 1` → "Em 1 dia" (singular); `diasAte < 0` → "Em andamento" (nunca "em -N dias").
- **Anel de prontidão**: arco fino âmbar com % no centro; **SOME quando `prontidaoPct == nil`** (estado honesto).
- **Linha de pendências tocável** ("N pendências antes da pista" com chevron); **SOME quando `pendenciasAbertas == 0`**;
  singular/plural correto ("1 pendência" / "3 pendências").
- **Botão primário largo "Iniciar Stint"** (gradiente azul cheio `accent → accentDeep`, ícone de traço `play.fill`).

### Tokens no Theme.swift
**Nenhum token novo foi necessário** — o âmbar já existe como `Color.atencao` (`#fab72a`) e todo o resto usa tokens
existentes (`accent`, `accentDeep`, `onAccent`, `atencao`, `text`, `textMuted`, `textFaint`, `border`, `surface`).
**Portanto NÃO toquei o `Theme.swift`** (fronteira mínima; nada sobrescrito). O gradiente escuro do fundo do hero
é inline (cores do mockup que não são token nomeado), sem alterar a paleta oficial.

### Padrões respeitados
Fundo escuro; **zero emoji** (todos ícones são SF Symbols de traço); **vermelho não usado** (âmbar = atenção, azul = ação —
regra Flávio 2026-07-09); tratamento implícito "você"; largura toda (`maxWidth: .infinity`); ação óbvia no 1º toque.

## Prova real
- **`#Preview` com 4 estados** exigidos: (1) em N dias completo, (2) HOJE selo azul, (3) sem prontidão (anel some),
  (4) sem pendências (linha some).
- **Empacotamento verde** — build REAL do alvo do app inteiro (não só do arquivo), incluindo os 4 previews:
  ```
  xcodebuild -project p1fast-ios.xcodeproj -scheme p1fast-ios \
    -destination 'id=1BC2F7A1-222E-44A5-A117-1314F6FA2623' (P1-Zoom375) -configuration Debug build
  → ** BUILD SUCCEEDED **
  ```
  (Os diagnósticos "Color has no member accent" do editor eram falso-positivo de análise isolada sem o contexto
  do alvo — o build conjunto compila com a extensão do Theme e passa.)
- **Fotos no simulador P1-Zoom375 (375×812)** — host descartável no scratchpad renderizando os arquivos REAIS
  (md5 conferido: cópia == original). Os 4 estados renderizados batem com o mockup:
  - `provas-j1/hero-estados-1e2.png` — estado 1 (selo âmbar "EM 2 DIAS", anel 64%, 3 pendências) e estado 2
    (eyebrow "ATIVO · HOJE", selo AZUL "HOJE", anel 88%, "1 pendência" singular).
  - `provas-j1/hero-estados-3e4.png` — estado 3 (Interlagos, "EM 12 DIAS", **sem anel**) e estado 4
    (Brasília 100%, **sem linha de pendências**; `pistaOficial nil` → só "2 de maio", sem autódromo).
- **Testes existentes verdes:** não há alvo XCTest no iOS (o `scheme.test` não lista alvo de teste; nenhum
  `import XCTest` no `ios/`). Os "testes" do repo são smokes node (web/lógica), que este componente iOS não toca.
  Como **não alterei o Theme.swift**, rodei o smoke que guarda os tokens: `node tests/node-smoke-oklch.mjs → 10 ok / 0 fail`.

## Fronteira
Toquei **só** `ios/p1fast-ios/Sources/Components/HeroEventoCard.swift` (novo). NÃO toquei HomeView, GaragemView,
componentes das outras janelas, web/, cockpit, cérebro nem Supabase. O `project.pbxproj` foi regenerado pelo
`xcodegen` (mecânico, esperado — o app é gerado por spec). O `Theme.swift` ficou intacto (git status confirma).

## Pendências / notas para o coordenador (Fable)
- Contrato atendido sem mudança de assinatura — **nada a decidir** da minha parte.
- O componente está pronto para a J5 consumir no lugar do provisório. A ação dos botões (`onStint`/`onPendencias`)
  é injetada por quem monta a Home — aqui os previews usam closures vazias.
