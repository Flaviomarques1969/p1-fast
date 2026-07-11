# ENTREGA — JANELA 2 — Melhor Volta + Ao Vivo

Papel travado: **JANELA 2** (trava atômica `travas/janela-2`).
Ambiente isolado: worktree `claude/home-j2-volta-aovivo` a partir da versão oficial LOCAL (`main`, commit 68813c12). NÃO incorporado à versão oficial.

## O que foi feito e onde

Dois componentes SwiftUI novos, com a assinatura EXATA do contrato, usando só tokens de `Theme.swift`:

1. `ios/p1fast-ios/Sources/Components/MelhorVoltaCard.swift`
   - `MelhorVoltaCard(melhorMs:Int?, contexto:String?, evolucaoMs:Int?, onTap:()->Void)`
   - Eyebrow "SUA MELHOR VOLTA" (reusa `Eyebrow` de `EyebrowHeader.swift`).
   - Mini traçado da pista em traço fino azul — **reutiliza `PistaBrasiliaMapa`** (desenho oficial medido/aprovado de `PistaBrasilia.swift`), 54×46, espessura 1.8.
   - Tempo grande tabular (monospaced), formato `1:42.3` (décimo menor/apagado). `melhorMs == nil` → "—" honesto, sem evolução.
   - Linha de contexto (pista · carro · mês) via `contexto`; oculta se `nil`/vazio.
   - Evolução verde `↓ −0,8s` (vírgula PT-BR, sinal U+2212) **só quando `evolucaoMs` vem de verdade**. Seta desenhada com `Path` (traço fino), sem emoji.

2. `ios/p1fast-ios/Sources/Components/AoVivoRow.swift`
   - `AoVivoRow(aoVivoAgora:Bool, subtitulo:String?, onTap:()->Void)`
   - Cartão fino. Ponto **verde** discreto (glow suave) só quando `aoVivoAgora`; desligado → anel vazio neutro, título "Ao vivo" apagado, ação em tom fraco (estado honesto).
   - Título "Ao vivo agora"/"Ao vivo", subtítulo opcional, ação "Assistir ›" à direita (chevron desenhado com `Path`).
   - **Borda neutra — NUNCA vermelha** (regra do Flávio: vermelho só crítico). Confirmado nas 3 fotos.

3. `#Preview` de cada um cobrindo os estados: com dado / sem dado ("—") / só tempo; ao vivo com e sem subtítulo / desligado.

## Prova real (comandos e saídas)

**Empacotamento (simulador iPhone 17) — VERDE:**
```
cd .claude/worktrees/home-j2-volta-aovivo/ios/p1fast-ios
cp <main>/Config/.env.xcconfig Config/.env.xcconfig      # arquivo não-versionado, copiado da oficial
xcodegen generate --spec project.yml
xcodebuild build -project p1fast-ios.xcodeproj -scheme p1fast-ios \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -derivedDataPath /tmp/p1fast-dd-j2 CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO
→ ** BUILD SUCCEEDED **
```

**Testes existentes (núcleo) — sem regressão:**
```
cd ios/p1fast-core && swift run p1fast-smoke
→ 575 ok / 1 fail
```
A única falha é `PERSIST-03` (tabela `evento_pendencias_extra` sem `synced_at`) — **pré-existente**, documentada como baseline; nada a ver com esta entrega (só toquei UI). Sem regressão.

**Fotos dos previews (ImageRenderer, fundo escuro, 375pt):**
- `fotos-j2/melhor-volta.png` — 3 estados (com evolução / só tempo / sem dado "—").
- `fotos-j2/ao-vivo.png` — 3 estados (no ar c/ subtítulo / no ar s/ subtítulo / desligado).
- Renderizados por renderizador isolado no scratchpad (fora do repositório) a partir dos arquivos-fonte REAIS — não adicionou arquivo ao repositório.

## Fronteira dura — respeitada
Só criei os 2 arquivos novos. NÃO toquei `Theme.swift` (todos os tokens que precisei já existem na base: `accent`, `success`, `text`, `textMuted`, `textFaint`, `border`, `surface`, `surfaceRaised`, `Radius`, `Spacing`). NÃO toquei HomeView, GaragemView, web/, cockpit, cérebro, Supabase.

Único arquivo extra tocado no worktree: `Config/.env.xcconfig` — arquivo de ambiente NÃO versionado, copiado da oficial só para o empacotamento (padrão documentado em `RETOMAR-LOGIN-E-CONVITE.md`). Não é entregável e não vai à oficial.

## Notas para o coordenador (montagem final)
- `MelhorVoltaCard` traz a eyebrow "SUA MELHOR VOLTA" DENTRO do card (conforme o mandato). Se a J5/montagem preferir a eyebrow como cabeçalho de seção separado (padrão `.section` do mockup, com link "Histórico" à direita), é só posicionar a seção acima e a eyebrow interna pode ser removida — avise que eu ajusto. Não mudei a assinatura.
- `AoVivoRow` e `MelhorVoltaCard` já vêm com fundo/borda próprios (cartões fechados) — encaixam direto no stack da Home.

## Pendências reais
Nenhuma. Contrato cumprido, empacotamento verde, fotos conferidas a olho, testes na baseline.
