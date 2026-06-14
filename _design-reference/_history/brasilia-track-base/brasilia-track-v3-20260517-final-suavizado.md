# DESENHO v3 — DESCARTADO em 2026-05-17 23h15

**ATENÇÃO: ESTA VERSÃO FOI DESCARTADA.** O desenho oficial agora é o v2 (sem suavização). Veja `PISTA-OFICIAL-LEIA-AQUI.md` na mesma pasta.

A suavização Laplaciana de 2 passes que eu apliquei sobre o v2 criou degraus em vez de melhorar. O Flávio rejeitou e pediu pra reverter para o desenho que ele tinha aprovado (v2). Este arquivo fica como histórico do erro para não repeti-lo.

---

## Conteúdo original (mantido só pra histórico)

Versão DEFINITIVA do desenho do circuito de Brasília. Substitui v1 (original com micro-curvas falsas) e v2 (corrigido manualmente pelo Flávio mas com pequenos micro-degraus).

Este é o desenho oficial do P1 Fast a partir de 2026-05-17 noite — congelado por Flávio em 22h45 depois de validação no iPhone Pro Max.

## Como foi gerado

1. Base: v1 original (134 pontos, calibrado da volta 5 do Flávio).
2. Triplicado para 495 pontos por ressampleamento uniforme (a cada 8 pixels de distância).
3. Corrigido manualmente pelo Flávio na página de edição (`_design-reference/mapa-brasilia-editor.html`), arrastando pontos um a um — principal foco: tirar as micro-curvas falsas da Curva da Bruxa.
4. Suavizado por 2 passes de média ponderada 1-2-1 (cada ponto puxado pra média dos vizinhos imediatos).
5. Filtro Douglas-Peucker desativado no aplicativo (estava descartando as correções).

## Quantidade de pontos: 495 (path fechado)

## Caixa de desenho (viewBox)

```
largura = 823
altura  = 799
```

## Linha de chegada (sem alteração desde v1)

```
x1 = 415   y1 = 695
x2 = 415   y2 = 720
```

## Onde este desenho aparece no sistema P1 Fast

1. **Aplicativo iOS** — toda renderização da pista (Mapa do autódromo, modal ampliado, miniatura no card, trecho ampliado, relatórios).
2. **Vista Piloto do Command Box** — `_design-reference/mockup-command-box-vista-piloto.html`.
3. **PAce Torque Delivery Advisor** — `_design-reference/mockup-command-box-engenharia-pace.html`.
4. **Lambda Track State Advisor** — `_design-reference/mockup-command-box-engenharia-lambda.html`.
5. **Monitores de cockpit (notebook + tela 10,5")** — referência executável em `web/cockpit/`.

## Como reverter para v1 ou v2

- v1 (original): `_history/brasilia-track-base/brasilia-track-v1-20260517.md` + `SeedBrasilia.swift.backup-v1-20260517`.
- v2 (correções manuais Flávio sem suavização): `_history/brasilia-track-base/brasilia-track-v2-20260517-flavio-corrigido.md` + `SeedBrasilia.swift.backup-v2-20260517`.

## Onde o caminho SVG completo está

No próprio código do aplicativo: `ios/p1fast-core/Sources/P1FastCore/SeedBrasilia.swift` linha 34 (`public static let svgPath`).
Também duplicado por segurança em `/tmp/brasilia-suavizado.txt` na máquina do Flávio (apaga ao reiniciar — não é fonte oficial).

---

**Congelado por Flávio em 2026-05-17 noite após validação visual no iPhone Pro Max.**
