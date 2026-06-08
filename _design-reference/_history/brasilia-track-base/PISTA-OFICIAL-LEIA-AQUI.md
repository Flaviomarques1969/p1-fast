# MAPA OFICIAL DE BRASÍLIA — DEFINITIVO (2026-05-17 23h35)

## REGRA DURA

Este é **O MAPA OFICIAL E DEFINITIVO** de Brasília no sistema P1 Fast. Flávio aprovou em 2026-05-17 23h35 dizendo literalmente "ficou top" + "salva a versão deste mapa como definitiva para usarmos sempre que precisarmos".

## Documento canônico (fonte de verdade)

**`MAPA-BRASILIA-DEFINITIVO.json`** — guardado em 3 lugares para garantia:
1. `_design-reference/MAPA-BRASILIA-DEFINITIVO.json`
2. `_design-reference/_history/brasilia-track-base/MAPA-BRASILIA-DEFINITIVO.json`
3. `ios/p1fast-core/Sources/P1FastCore/MAPA-BRASILIA-DEFINITIVO.json`

Esse JSON tem TUDO: desenho da pista (referência ao arquivo .txt), 8 curvas + 4 retas com nomes e centroides, 25 marcações de Entrada/Saída/Ápice em coordenadas decimais, 4 parciais, 2 marcos (largada/chegada), 2 âncoras geográficas (GPS → tela).

Se alguma vez algum lugar do sistema perder o estado da pista, este JSON é a fonte para restaurar.

**Não aplique nenhum filtro automático em cima deste desenho** (Douglas-Peucker, média ponderada, Catmull-Rom, B-spline ou similar). Já tentamos suavização Laplaciana e foi rejeitada porque criava degraus em vez de melhorar. O Flávio prefere os pontos EXATAMENTE onde ele colocou.

## Origem do desenho

- Base: v1 original (134 pontos, calibrado da volta 5 do Flávio em 2026-05-01).
- Triplicado para 495 pontos por ressampleamento uniforme na página de edição.
- Corrigido manualmente pelo Flávio em 2026-05-17, arrastando ponto por ponto na página `_design-reference/mapa-brasilia-editor.html`, foco principal: tirar micro-curvas falsas da Curva da Bruxa.
- v3 (suavização Laplaciana 2 passes) foi **REVERTIDA** por decisão do Flávio.

## Quantidade de pontos: 495 (path fechado)

## Caixa de desenho

```
viewBox: 823 × 799
linha de chegada: x1=415 y1=695  →  x2=415 y2=720
```

## Onde este desenho está guardado (4 lugares)

1. **Código vivo do aplicativo iOS** — `ios/p1fast-core/Sources/P1FastCore/SeedBrasilia.swift` linha 34 (`public static let svgPath`).
2. **Backup completo do arquivo Swift** — `_design-reference/_history/brasilia-track-base/SeedBrasilia.swift.backup-v2-20260517`.
3. **Texto puro perto do código** — `ios/p1fast-core/Sources/P1FastCore/PISTA-OFICIAL-brasilia.txt`.
4. **Texto puro na raiz da pasta de design** — `_design-reference/PISTA-OFICIAL-brasilia.txt`.
5. **Texto puro no histórico** — `_design-reference/_history/brasilia-track-base/PISTA-OFICIAL-brasilia-flavio-aprovado.txt`.

## Onde o desenho é renderizado no sistema P1 Fast

1. **Aplicativo iOS** — toda renderização da pista (Mapa do autódromo, modal ampliado, miniatura no card, trecho ampliado, relatórios, página de marcação E/S/A).
2. **Vista Piloto do Command Box** — `_design-reference/mockup-command-box-vista-piloto.html`.
3. **PAce Torque Delivery Advisor** — `_design-reference/mockup-command-box-engenharia-pace.html`.
4. **Lambda Track State Advisor** — `_design-reference/mockup-command-box-engenharia-lambda.html`.
5. **Monitores de cockpit** — referência em `web/cockpit/`.
6. **Página de edição de pontos** — `_design-reference/mapa-brasilia-editor.html`.
7. **Página de marcação E/S/A** — `_design-reference/mapa-brasilia-marcacao-pontos.html`.

## Como fazer ajustes futuros (regra OBRIGATÓRIA)

Quando Flávio quiser refinar o desenho:

1. Abrir o editor (`_design-reference/mapa-brasilia-editor.html`).
2. Ele arrasta pontos (com brush de 7 pontos juntos — aprovado em 2026-05-17 23h00).
3. Clica em "Salvar caminho corrigido" e copia o resultado.
4. Cola no chat e diz "aplica isso".
5. Eu substituo nos 4 lugares listados acima E atualizo o backup.
6. **NÃO rodar nenhum filtro automático em cima.** Aplicar exatamente o que ele mandou.

## Como reverter para versões anteriores

- **v1 original 134 pontos:** `_history/brasilia-track-base/SeedBrasilia.swift.backup-v1-20260517` + `brasilia-track-v1-20260517.md`.
- **v3 descartado (suavizado, deu errado):** o markdown `brasilia-track-v3-20260517-final-suavizado.md` continua arquivado pra histórico, mas NÃO usar.

---

**Selo de aprovação:** Flávio Marques · 2026-05-17 23h15 · "Use essa como padrão, mas não perca ela."
