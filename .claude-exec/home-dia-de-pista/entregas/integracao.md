# Integração — Home "Dia de Pista" (branch claude/home-integracao)

Data: 2026-07-11 · Base: 68813c12 · Worktree: `.claude/worktrees/home-integracao`
Nenhum merge na main. Tudo nesta linha de integração.

## Ordem dos merges

1. `claude/home-j1-heroi` — fast-forward (HeroEventoCard.swift). Sem conflito.
2. `claude/home-j2-volta-aovivo` — merge limpo (AoVivoRow.swift, MelhorVoltaCard.swift). Sem conflito.
3. `claude/home-j3-carros-numeros` — 2 conflitos:
   - `.claude-exec/ultima-tarefa.md`: mantidos AMBOS os conteúdos (removidos só os marcadores de conflito).
   - `ios/p1fast-ios/p1fast-ios.xcodeproj/project.pbxproj`: aceito o lado da J3 e depois REGENERADO com `xcodegen generate --spec project.yml` (fonte da verdade é o project.yml).
4. `claude/garagem-ferramentas-teste` — merge limpo (GaragemView, HubMockLauncher, fotos J4).
5. `claude/home-j5-estrutura` — merge limpo (HomeView, ContentView, HomeDiaDePistaStubs).

## Pós-merge

- Removido `ios/p1fast-ios/Sources/Views/HomeDiaDePistaStubs.swift`. As 5 peças reais (HeroEventoCard, MelhorVoltaCard, AoVivoRow, CarroRowCompacta, NumerosRodape) já existiam em `Sources/Components/` com as mesmas assinaturas — o HomeView compilou direto, sem ajuste de assinatura. `HeroSemEvento` já estava definido como struct privado dentro do próprio HomeView.swift (a J5 não o deixou só nos stubs), então não houve nada a mover.
- Ajuste aprovado: em `HeroEventoCard.swift` (AnelProntidao), quando `pct >= 100` o arco do anel e o texto do % passam de âmbar (`Color.atencao`) para verde (`Color.bom`, token real do Theme.swift, alias de `Color.success`). Mudança mínima: propriedade `corAnel` + cor condicional no texto.
- Ajuste mínimo no HomeView.swift (SÓ-DEV, mesmo padrão do `--p1-scroll-ferramentas` da J4): launch arg `--p1-scroll-home-fim` rola a Home até o fim para a prova por foto do rodapé. Sem efeito no app real. Motivo: cliques/drags sintéticos (cliclick) não chegam ao Simulator nesta máquina (sem grant de Acessibilidade pro processo).

## Build (prova)

```
xcodegen generate --spec project.yml  → Created project at .../p1fast-ios.xcodeproj
xcodebuild -project p1fast-ios.xcodeproj -scheme p1fast-ios \
  -destination 'platform=iOS Simulator,id=1BC2F7A1-222E-44A5-A117-1314F6FA2623' \
  -derivedDataPath /tmp/home-int-dd build
** BUILD SUCCEEDED **
```

(derivedData em /tmp/home-int-dd, fora do repositório.)

## Fotos (simulador P1-Zoom375, app instalado do build acima)

`.claude-exec/home-dia-de-pista/entregas/fotos-integracao/`
- `1-home-cheia.png` — Home estado cheio (`--p1-hub-mock --p1-home`): herói Brasília 64% âmbar, selo HOJE, pendências, Iniciar Stint, Ao vivo, Sua melhor volta.
- `2-home-rodape.png` — Home rolada até o fim (`--p1-scroll-home-fim`): Seus carros (Celta 31 stints, Civic 16) + rodapé "12 EVENTOS · 158 VOLTAS · 47 STINTS".
- `3-garagem-ferramentas.png` — Garagem com a seção FERRAMENTAS DE TESTE (Teste ao vivo, Gravar telemetria) via `--p1-garagem-ferramentas --p1-scroll-ferramentas`.

## Desvios / pendências

- O estado 100% (anel verde) não foi fotografado: o mock `--p1-home` semeia 64% e não há launch arg de 100%; a mudança de cor está coberta pelo preview "100%" do próprio HeroEventoCard e compila. Se o coordenador quiser foto, é preciso um mock com prontidão 100.
- Nenhum toque em web/, cockpit, cérebro ou Supabase. Main intocada.

## Ajuste 2026-07-11 — selo duplicado removido
- `MelhorVoltaCard.swift`: removida a eyebrow interna "SUA MELHOR VOLTA" (duplicava o cabeçalho de seção "SUA MELHOR VOLTA · Histórico" da Home); traçado, tempo, contexto e evolução intactos.
- Prova: BUILD SUCCEEDED (xcodegen + xcodebuild, sim 1BC2F7A1) e `1-home-cheia.png` refotografada — no lugar do selo interno, o cartão abre direto no traçado + 1:42.3 sob o cabeçalho único da seção.
