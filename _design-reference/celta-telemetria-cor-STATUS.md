# Celta Telemetria-Cor · STATUS & CONTINUIDADE

**Data:** 2026-05-07 · **Branch:** `claude/clear-session-fRVm4`
**Estado:** PIVOT CONCEITUAL — Phase B (polígonos) descartado pelo Flávio.
Próximo passo é Phase C: paint per-pixel via máscaras binárias.

Doc para retomar trabalho após `/clear`. Leia este arquivo PRIMEIRO antes de mexer.

---

## ⚠️ PIVOT decidido em 2026-05-07 (sessão `claude/clear-session-fRVm4`)

**O que o Flávio rejeitou (Phase B inteira, todas as variantes A/B v1/v2/v3/v3.1):**
"a peça TEM de ser a peça, não um polígono, não um quadrado. Há um erro conceitual."

Polígono SVG por cima da foto + mix-blend-mode multiply = sempre vai parecer overlay
pintado. Não é o que ele quer.

**O que ele quer (Phase C):** *"vc deve mapear o objeto e criar a capacidade de
pintá-los conforme padrão de informação. Os amortecedores estão em vermelho e
preto... eles poderiam ficar azuis em situação normal... e somente as molas em
vermelho se tiverem problemas... os pneus ficariam na cor que estão... se super
aquecerem ficariam vermelhos... mas tem de ser a peça."*

**Tradução técnica:**

1. **Granularidade muito maior.** Cada coilover não é uma peça — é duas:
   - corpo do amortecedor (cilindro metálico)
   - espiral da mola (wrap)
   Cada uma pinta independente. Ex: amortecedor azul ok, mola vermelha alarme.

2. **Mapa de pixels, não polígono.** Cada sub-peça vira uma máscara binária
   PNG do mesmo tamanho da foto. Branco = pixel pertence à peça, preto = não.

3. **Recolor por HSL shift dos pixels da máscara**, preservando luminância
   da foto (textura, highlights, sombras). Não substituir por cor sólida.

4. **Renderização em `<canvas>`** no demo HTML:
   - desenha a foto
   - pra cada sub-peça em alarme, lê os pixels da máscara, aplica HSL shift
     no destino, escreve de volta
   - resultado: a peça em si muda de cor, foto intacta no resto

5. **Sub-peças prováveis (a confirmar com o Flávio):**
   - 4 borrachas (tire-FL/FR/RL/RR)
   - 4 rodas/cubos (rim-FL/FR/RL/RR)  ← talvez separar
   - 4 corpos de amortecedor (shock-FL/FR/RL/RR)
   - 4 espirais (coil-FL/FR/RL/RR)
   - bloco do motor + intake + escapamento (3 sub-peças)
   - body amarelo (lower) + body verde (upper) + faróis + grade
   Total ~ 22 sub-peças. Algumas hidden (mesmas que antes: front shocks,
   front coils, far-side tires, gearbox).

---

## Por que Phase B falhou (notas pro próximo Claude)

- Polígono é geometria, não fotografia. Mesmo apertando contorno
  (Phase B v3.1: tire-FL 213x151, springs ~76x200), continuou parecendo
  overlay porque a tinta é uniforme dentro do polígono.
- Mix-blend-mode multiply em yellow body + blue alarm = dark olive,
  não yellow-com-tint-azul. Esticar opacity baixa não resolve, vira muito
  sutil sem ler como informação.
- Hidden parts via stroke tracejado + glow ficou OK conceitualmente
  mas é workaround pro fato de que polígono não consegue mostrar a peça
  física. Phase C resolve naturalmente: se peça está hidden, ela não
  tem máscara → não pinta. Pode ter glow auxiliar separado.
- Flávio ficou frustrado em 4+ iterações. NÃO insistir em variações da
  abordagem polygon — ele já decidiu que é conceitualmente errado.

---

## Plano Phase C (próxima sessão deve começar daqui)

### Passo 1: validar sub-peças com o Flávio
Listar as ~22 sub-peças propostas, confirmar se é o nível certo de granularidade.
Pode ser que ele queira mais (separar farol esquerdo do direito) ou menos.

### Passo 2: gerar máscaras
Pra cada sub-peça visível, pipeline:
- abrir foto, criar máscara binária 2048x2048 PNG
- usar combinação de: cor (HSV), região (ROI), e contour refinement
- salvar em `assets/masks/<part-id>.png`

Sub-peças hidden ficam sem máscara (ou com máscara vazia).

### Passo 3: renderer canvas no demo
- canvas 2048x2048 (ou redimensionado)
- `getImageData` da foto
- pra cada peça em alarme, leia `getImageData` da máscara, mescle:
  ```
  if mask[i] > 0:
    photo[i] = hsl_shift(photo[i], target_hue, sat_factor)
  ```
- `putImageData` de volta

### Passo 4: estática (PNG comparison)
Mesma lógica em Python + PIL: aplica HSL shift por máscara, gera
PNG de cada cenário.

---

## O que foi feito antes do pivot (vai pra `_archive/`)

Arquivos a arquivar quando começar Phase C:
- `assets/celta_exploded_partmap.svg`
- `_design-reference/celta-telemetria-cor-phase-b.html`
- `scripts/refine_celta_partmap.py`
- `scripts/render_audit_grid.py`
- `scripts/render_comparison.py`
- `scripts/build_phase_b_demo.py`
- `assets/_previews/AUDIT-parts.png`
- `assets/_previews/celta-phase-b-COMPARISON.png`

Mover pra `_archive/phase-b-polygon-approach/` pra preservar histórico
sem confundir.

---

---

## O que estamos fazendo

Visual recolorível de telemetria do Celta #16. A imagem mostra o carro em **exploded view** (body + chassis). Cada peça monitorada **muda de cor sutilmente** conforme telemetria ao vivo. Princípio do Flávio: *"o objeto vira o dado, não bolinha em cima"*. A peça em si tinta — preserva o look fotográfico.

---

## Arquivos no repo

```
assets/
  celta_exploded.png                           foto original (Gemini, 6.3 MB)
  celta_exploded_partmap.svg                   foto + 13 contornos por peça (8.3 MB, photo embutida base64)
  _previews/
    AUDIT-parts.png                            grid 4×4: cada peça destacada (magenta=visível, ciano=oculta)
    celta-phase-b-COMPARISON.png               6 cenários (frio, ideal, hot tires, hot motor, hot oculta)

_design-reference/
  celta-telemetria-cor-phase-b.html            demo interativo com sliders por peça (8.3 MB)
  celta-telemetria-cor-STATUS.md               este arquivo

scripts/
  refine_celta_partmap.py                      gera o partmap SVG (OpenCV mask + contour por peça)
  render_audit_grid.py                         gera AUDIT-parts.png a partir do SVG
  render_comparison.py                         gera o COMPARISON.png (cenários telemétricos)
  build_phase_b_demo.py                        gera o HTML demo a partir do SVG
```

Reprodução completa do pipeline:
```bash
python3 scripts/refine_celta_partmap.py
python3 scripts/render_audit_grid.py
python3 scripts/build_phase_b_demo.py
python3 scripts/render_comparison.py
```

---

## Estado das 13 peças mapeadas

**Visíveis (8) — contornos extraídos por OpenCV de máscaras de cor:**

| Peça | Máscara | Resultado |
|---|---|---|
| `tire-FL` | preto + baixa saturação | ótimo |
| `tire-RR` | preto + baixa saturação | ótimo |
| `spring-RL` | vermelho HSV alargado + close 35×35 | ótimo (cobre coilover inteiro) |
| `spring-RR` | vermelho HSV alargado + close 35×35 | ótimo |
| `engine` | silver+dark combinado | ótimo |
| `radiator` | polígono manual (front bumper) | ótimo |
| `body-paint` | amarelo HSV | ótimo (frente + rocker) |
| `body-roof` | verde HSV | ótimo (teto + laterais) |

**Ocultas (5) — silhuetas hand-tuned com translucidez:**

| Peça | Posição | Tratamento |
|---|---|---|
| `tire-FR` | atrás do motor | contorno tracejado branco (op 0.30), glow cresce com alarme |
| `tire-RL` | atrás dos bancos | idem |
| `spring-FL` | strut dianteiro esquerdo | idem |
| `spring-FR` | strut dianteiro direito | idem |
| `gearbox` | transaxle abaixo do motor | idem |

(`body-paint-2` foi removido — auto-detect do v2 não cobria área visualmente útil.)

---

## Como a translucidez funciona

Cada peça oculta tem:

1. **Sempre visível:** `<path>` com `stroke="#FFFFFF" stroke-opacity="0.30" stroke-dasharray="14 9"` — contorno fantasma sutil
2. **Em alarme:** o stroke ganha cor da temperatura (`tempColor(t)`), opacidade do stroke sobe pra ~0.95, fill ganha alpha até 0.30, e o filtro `<filter id="glow-${id}">` recebe `feGaussianBlur stdDeviation` proporcional ao desvio do ideal (até 22 px)
3. **`mix-blend-mode: screen`** no grupo das peças hidden — o glow ilumina através da obstrução em vez de escurecer (multiply seria errado pra peça hidden)
4. **Contorno tracejado** ciano sutil no background pra usuário sempre saber "tem peça aqui atrás"

Demo HTML drive todos os atributos via JS (`applyPart` em `_design-reference/celta-telemetria-cor-phase-b.html`).

---

## Decisões já fechadas (NÃO reabrir)

1. **NÃO vetorizar foto inteira** — Phase A reprovado pelo Flávio.
2. **NÃO usar `var(--xxx)` em fill/opacity de SVG** — cairosvg não engole. Atributos diretos modificados via JS.
3. **NÃO depender de raw.githack.com / htmlpreview.github.io** — repo é privado.
4. **Photo está EMBUTIDA no SVG como base64** — self-contained.
5. **Repo é PRIVADO** (`flaviomarques1969/p1-fast`). Pra previews use PNG via blob URL do GitHub.
6. **Indicadores que pilotam cor** — confirmados em `docs/hardware/T4000_CAN_SPEC.md` (15 canais via CAN 0x7FB) + TPMS (4 temp + 4 pressão) + RaceBox-derived nas molas (carga estimada por transferência de peso, ver §"Molas" abaixo).
7. **Sem barras antitorção no desenho** — citação do Flávio era só contexto sobre dinâmica, não escopo do mockup.

---

## Mapeamento peça → indicador (lock)

| Peça | Indicador principal (cor) | Indicador secundário (label/badge futuro) |
|---|---|---|
| `engine` | Temp óleo · Temp água · Pressão óleo (mín) | RPM · MAP · TPS · Lambda · EGT |
| `radiator` | Temp água · Temp ar | — |
| `gearbox` | Temp óleo (compartilhada) | Marcha |
| `tire-FL/FR/RL/RR` | Temp pneu (TPMS) | Pressão pneu |
| `spring-FL/FR/RL/RR` | Carga vertical estimada via accLong + accLat (RaceBox) | — |
| `body-paint`, `body-roof` | Tensão bateria (tint sutil) ou Erro ECU (pulso) | — |

### Molas (suspensão) — fórmula

RaceBox tem `accLong`, `accLat`, `accVert`, `gyroX`, `gyroY` a 100 Hz. A cor de cada mola usa carga vertical estimada por transferência de peso clássica:

```
load_FL = +0.5·accLong  -0.5·accLat
load_FR = +0.5·accLong  +0.5·accLat
load_RL = -0.5·accLong  -0.5·accLat
load_RR = -0.5·accLong  +0.5·accLat
```

É **inferência**, não medição direta. 3 camadas conceituais sobre os mesmos sensores:

1. **Estado instantâneo** — cor da mola agora (camada implementada no demo)
2. **Comparação com baseline** — desvio vs assinatura "carro novo" (snapshot pós-oficina) → tela de tendência (não implementada)
3. **Coach de setup** — recomendação pós-stint ("apertar traseira") → texto/voz (não implementada)

Camadas 2 e 3 ficam como roadmap, não entram no mockup atual.

---

## Próximo passo (próxima sessão)

Phase B v3 entrega o visual base. Próximo bloco lógico:

- **Etiquetas/badges** mostrando o valor numérico ao lado de cada peça quando alarmar (ex: "TF · 132°C" ao lado de tire-FR oculto)
- **Pulso animado** no body inteiro pra Erro ECU (bitfield != 0)
- **UX de baseline** pra suspensão (camada 2 de molas) — registro do snapshot pós-oficina
- **Port nativo Swift** do detector ao vivo (ADR confirmou JS aposentado)

---

## Preferências do Flávio (estilo)

- **Conciso.** Detesta paredes de texto. Prefere "faço X, ok?" → execução.
- **NÃO oferecer múltiplos caminhos.** Decida e execute.
- **Mostre resultado, não processo.** PNG renderizado > diagrama ASCII > descrição.
- **Um link só, ele clica.** Não dar 5 URLs alternativos.
- **"Ficou péssimo" = refazer.** Sem desculpas longas.
- **Alguns clears no caminho.**

---

## Comandos rápidos

```bash
# Auditoria visual (grid das 13 peças)
open https://github.com/flaviomarques1969/p1-fast/blob/claude/clear-session-fRVm4/assets/_previews/AUDIT-parts.png

# Comparação cenários telemétricos
open https://github.com/flaviomarques1969/p1-fast/blob/claude/clear-session-fRVm4/assets/_previews/celta-phase-b-COMPARISON.png

# Demo interativo (baixar e abrir no browser)
git show claude/clear-session-fRVm4:_design-reference/celta-telemetria-cor-phase-b.html > /tmp/demo.html
open /tmp/demo.html

# IDs das peças
grep 'id=' assets/celta_exploded_partmap.svg | grep -oE 'id="[^"]+"'
```

---

## Histórico das fases

- **Phase A** (descartado): vetorização inteira em paths fragmentados → blocos sólidos coloridos. Reprovado.
- **Phase B v1**: foto base + overlays auto-detectados por OpenCV. Funcionou pra 10 peças, ruim em 4.
- **Phase B v2**: refinamento manual com polígonos custom. Estado intermediário.
- **Phase B v3 (ATUAL):** pipeline OpenCV reformulado com máscaras de cor + morph close por peça, ROIs ajustados. Translucidez SVG + JS pra hidden parts.

---

**FIM DO STATUS.** Quando retomar: leia este doc, abra o COMPARISON.png no GitHub, e ataque o próximo passo da seção acima.
