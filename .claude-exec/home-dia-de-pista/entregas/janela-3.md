# ENTREGA — JANELA 3 (Opus 4.8) — CARROS + NÚMEROS

Home "Dia de Pista" · ambiente isolado `claude/home-j3-carros-numeros` (base `68813c12`, a mesma de J2/J4).

## 1. O que fiz / onde

Dois componentes SwiftUI NOVOS, ambos com a assinatura EXATA do contrato (COORDENACAO.md §CONTRATO), tokens só de `Theme.swift`, fundo escuro, ícones de traço (Path a partir do SVG do mockup), sem emoji, sem vermelho.

- `ios/p1fast-ios/Sources/Components/CarroRowCompacta.swift`
  - Assinatura: `CarroRowCompacta(apelido:String, sub:String, cor:Color, stints:Int, onTap:(()->Void)?)`
  - Linha compacta: swatch arredondado tingido com a COR do carro + carro em traço; apelido semibold; sub (modelo/último stint) apagado; nº de stints à direita tabular ("31" grande + "STINTS" mínimo); seta › SÓ quando tocável.
  - `onTap == nil` → linha ESTÁTICA: sem chevron e sem toque (comportamento honesto — não sinaliza navegação que não existe).
  - Ícones como `Shape`: `CarGlyph` (reproduz `M4 16v-3l2-5.5…` + 2 rodas do `.car-icon` do mockup) e `ChevronRight` (`m9 6 6 6-6 6`).
- `ios/p1fast-ios/Sources/Components/NumerosRodape.swift`
  - Assinatura: `NumerosRodape(eventos:Int, voltas:Int, stints:Int, onEventos:()->Void, onVoltas:()->Void, onStints:()->Void)`
  - UMA linha discreta "12 EVENTOS · 158 VOLTAS · 47 STINTS": número claro (tabular) + rótulo apagado lado a lado; hairline superior; cada segmento é um botão (tocável).
  - Zero é honesto (0 EVENTOS…), sem inventar dado.

`#Preview` de cada arquivo: CarroRowCompacta (2 carros tocáveis; + 1 estática nil + 1 zerada); NumerosRodape (cheio; zerado).

## 2. Prova real (comandos + saídas)

- **Empacotamento (app inteiro compila com os 2 componentes):**
  `xcodebuild -project ios/p1fast-ios/p1fast-ios.xcodeproj -scheme p1fast-ios -destination 'generic/platform=iOS Simulator' build` → **BUILD SUCCEEDED**, 0 erros.
  (Os arquivos entram no build via `xcodegen --spec project.yml`, que regenera o `.xcodeproj` incluindo os 2 novos.)
- **Foto no simulador P1-Zoom375 (375×812):** `entregas/prova-j3-componentes.png`.
  Observável conferido na imagem: swatch com a cor certa por carro (azul Celta / verde Civic / âmbar Fusca / dourado Uno); carro desenhado em traço; número tabular à direita; **chevron › presente só nas linhas tocáveis** (Fusca estático NÃO tem seta); rodapé numa única linha com número claro + rótulo apagado; estado zerado honesto ("0 STINTS", "0 EVENTOS · 0 VOLTAS · 0 STINTS").
  Método: build no simulador (`id=1BC2F7A1-…`, `-derivedDataPath /tmp/j3-dd`) → install → launch com launch arg TEMPORÁRIO `--p1-j3-preview` → `simctl io screenshot`.
- **Smoke de tokens do Theme (meus componentes dependem deles):**
  `node tests/node-smoke-oklch.mjs` → **10 ok / 0 fail**.

## 3. Fronteira / preservação

- Toquei APENAS os 2 arquivos novos + `project.pbxproj` (regenerado automaticamente pelo xcodegen para incluí-los — consequência mecânica, não edição manual).
- NÃO toquei `Theme.swift` (J1), `HomeView` (J5), `GaragemView` (J4), componentes das outras janelas, web/, cockpit, cérebro, Supabase.
- O andaime de captura (`--p1-j3-preview` + `J3PreviewHostTEMP` no `ContentView.swift`) foi **revertido** com `git checkout`; confirmei no **HEAD** (não só no working tree) que o `ContentView.swift` não tem resíduo (`git show HEAD:…ContentView.swift | grep -c` = 0) e que nenhum commit da branch tocou o `ContentView`.

## 4. Estado da branch (entrega)

- `f8d6c356` (auto-save) — `CarroRowCompacta.swift` + TASK_INIT no `ultima-tarefa.md`.
- commit próprio — `NumerosRodape.swift` + `project.pbxproj`.
- Working tree limpo.

## 5. Notas para o coordenador (Fable)

- Assinaturas batem 1:1 com o contrato — J5 consome direto.
- `cor` = identidade do carro (vem do cadastro, ex.: `Color(hex: c.cor)`); NÃO é cor semântica (não vira vermelho/âmbar de estado). O swatch tinge fundo+borda+ícone com essa cor.
- Sugestão (não apliquei — fora da minha fronteira): no `NumerosRodape`, o texto do rótulo poderia truncar em telas muito estreitas; hoje cabe folgado em 375pt. Sem mudança de assinatura proposta.

## 6. Pendências

Nenhuma dentro da minha fronteira. Integração na Home = J5/coordenador.
