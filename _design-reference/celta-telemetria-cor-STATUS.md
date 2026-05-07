# Celta Telemetria-Cor · STATUS & CONTINUIDADE

**Data:** 2026-05-07 · **Branch:** `claude/clear-session-fRVm4`

Doc para retomar trabalho após `/clear`. Leia este arquivo PRIMEIRO antes de mexer.

---

## O que estamos fazendo

Construindo um **visual recolorível de telemetria** do Celta #16 (carro do Flávio, fam RACING). A imagem mostra o carro em **exploded view** (body em cima, chassis embaixo). Cada peça monitorada (pneus, motor, câmbio, suspensão, radiador) **muda de cor sutilmente** conforme a telemetria ao vivo:

- **Frio (~60°C):** tint azul
- **Ideal (~90°C):** sem tint (foto pura)
- **Atenção (~110°C):** tint amarelo
- **Quente (~130°C):** tint vermelho/laranja

Princípio crítico do Flávio: **"o objeto vira o dado, não bolinha em cima"**. A peça em si muda de cor, preservando o look fotográfico.

---

## Arquivos no repo

```
assets/
  celta_exploded.png                       # foto original do exploded view (Gemini, 6.3 MB)
  celta_exploded_partmap.svg               # SVG: foto base + 14 polígonos por peça (8.7 MB, photo embedded base64)
  _previews/
    AUDIT-parts.png                        # grid 4×4 — cada peça destacada em magenta para verificação
    celta-phase-b-COMPARISON.png           # primeira comparação (6 cenários)
    celta-phase-b-COMPARISON-FULL.png      # comparação 9 cenários cobrindo todas métricas

_design-reference/
  celta-telemetria-cor-phase-b.html        # demo interativo com sliders por peça (8.7 MB com SVG inline)
  celta-telemetria-cor-STATUS.md           # ESTE arquivo
```

---

## Estado das 14 peças mapeadas

| Peça | Status | Posição | Observação |
|------|--------|---------|------------|
| `tire-FL` | ✅ correto | chassis lower-left, auto-detected blob preto | Pneu dianteiro-esquerdo claramente visível |
| `tire-FR` | ⚠️ aproximado | ellipse manual em (560, 1410), atrás do motor | **Hidden** pelo motor — não há pneu visível ali. Próximo passo: translucidez |
| `tire-RL` | ⚠️ aproximado | ellipse manual em (1290, 1530) | Parcialmente visível atrás dos bancos |
| `tire-RR` | ✅ correto | chassis far-right, auto-detected | Pneu traseiro-direito visível |
| `spring-FL` | ⚠️ aproximado | polígono em (540-680, 1320-1530) | Strut dianteiro-esquerdo **hidden** pelo motor |
| `spring-FR` | ⚠️ aproximado | polígono em (680-840, 1300-1500) | Strut dianteiro-direito **hidden** |
| `spring-RL` | ✅ correto | polígono em (1075-1240, 970-1245) | Coilover traseiro-esquerdo claramente visível |
| `spring-RR` | ✅ correto | polígono em (1280-1450, 990-1235) | Coilover traseiro-direito claramente visível |
| `engine` | ✅ correto | combinação de blobs prata em chassis upper-left | Bloco do motor visível |
| `gearbox` | ✅ refinado | polígono em (770-920, 1380-1620) | Transaxle ao lado do motor (FWD = câmbio integrado, fica perto do motor, NÃO no traseiro) |
| `radiator` | ✅ correto | polígono em (380-920, 1820-1990) | Front bumper / mesh prata visível |
| `body-paint` | ✅ correto | auto-detected blob amarelo grande | Parte amarela frente body |
| `body-paint-2` | ✅ correto | auto-detected blob amarelo médio | Parte amarela traseira body |
| `body-roof` | ✅ correto | auto-detected blob verde | Teto verde + laterais |

**Peças hidden (4 de 14):** tire-FR, spring-FL, spring-FR, e parcialmente tire-RL. Estas precisam da próxima etapa.

---

## Decisões já fechadas (NÃO reabrir)

1. **NÃO vetorizar a imagem inteira em paths fragmentados.** Phase A fez isso (vtracer stacked mode), virou blocos sólidos quando recoloria — Flávio reprovou ("absolutamente péssimo"). A abordagem certa é foto base + overlays por peça (multiply blend).

2. **NÃO usar `var(--xxx)` em fill/opacity de SVG** — cairosvg não engole. Usar atributos `fill=` e `opacity=` diretos, modificados via JS no demo HTML.

3. **NÃO depender de raw.githack.com / htmlpreview.github.io** — repo é privado, retornam 403/404. Usuário tem que baixar HTML local OU eu mando PNG estático.

4. **Photo está EMBUTIDA no SVG como base64 data URI** — torna o partmap self-contained (8.7 MB), mas garante render em qualquer lugar sem path resolution.

5. **Body do mockup principal (Direction D Command Box) já está pronto** em `assets/command-box/premium-styles/direction-D-live.svg`. Esse trabalho de telemetria-cor é **paralelo**, não substitui o command box.

6. **Repo é PRIVADO** (`flaviomarques1969/p1-fast`). Não tente CDN público. Para previews, sempre PNG via GitHub blob URL (que renderiza imagens nativamente).

---

## Próximo passo imediato: TRANSLUCIDEZ ELEGANTE

**Pedido literal do Flávio:** *"para a questão da limitação do pneu que está escondido no FR, assim como nos outros, as outras parções, cria uma abordagem de transparência, de translucidez elegante."*

### O problema
4 das 14 peças (tire-FR, spring-FL, spring-FR, e tire-RL parcial) estão **fisicamente escondidas** atrás do motor/bancos no exploded view 3D. Não dá pra "tintar" algo que não está visível.

### A solução elegante
Tipo **raio-X** ou **frosted glass**: a peça hidden tem indicador SUTIL sempre presente mostrando "tem peça aqui atrás", e quando há alarme de telemetria, **glow translúcido** emana do local através da obstrução.

### Implementação proposta

**Para peças hidden (`data-hidden="true"`):**
1. **Sempre visível:** outline pontilhado/tracejado branco a 25% opacity, mostrando "a peça está aqui (oculta)"
2. **Em alarme:** o polígono interno ganha fill translúcido (opacity max ~40% em vez dos 55% das peças visíveis), com `mix-blend-mode: screen` em vez de `multiply` para "iluminar através" do obstáculo
3. **Glow externo:** filter `drop-shadow` com a cor do alarme + blur ~15px, dá sensação de "vazamento" do alarme através da obstrução
4. **Tag textual sutil:** label tipo "FR · oculto" ao lado do polígono, fonte pequena monospace, opacity ~50%

**Para peças visíveis:** mantém abordagem atual (multiply blend, opacity proporcional ao desvio do ideal).

### Mudanças no SVG
```svg
<path id="tire-FR" data-part="tire-FR" data-hidden="true"
      d="..." fill="#000" opacity="0"
      stroke="#FFFFFF" stroke-opacity="0.25" stroke-width="3" stroke-dasharray="20 12"
      filter="url(#hidden-glow)"/>
```

E no `<defs>`:
```svg
<filter id="hidden-glow" x="-50%" y="-50%" width="200%" height="200%">
  <feGaussianBlur stdDeviation="0" result="blur"/>
  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
```

(O `stdDeviation` muda dinamicamente via JS quando há alarme.)

### Visual esperado
- **Default (sem alarme):** peças hidden mostram contorno tracejado fantasma sutil — usuário sabe "tem peça aqui atrás"
- **Alarme leve:** o contorno ganha cor + glow leve
- **Alarme forte:** glow intenso "vazando" através da obstrução, label "FR · OCULTO" mais visível

---

## Preferências do Flávio (estilo de comunicação)

- **Conciso.** Detesta paredes de texto e múltiplas perguntas. Prefere "faço X, ok?" → execução.
- **NÃO oferecer múltiplos caminhos.** Decida e execute. Ele corrige se errar.
- **Mostre resultado, não processo.** PNG renderizado > diagrama ASCII > descrição.
- **Um link só, ele clica.** Não dar 5 URLs alternativos.
- **Evitar pedidos de "qual abordagem você quer?"** — ele quer que eu use meu poder pra fazer certo, não delegar decisão.
- **Erros frustram, mas tudo bem rodar de novo.** "Ficou péssimo" = refazer com outra abordagem, não pedir desculpas longas.
- **Alguns clears no caminho.** Ele vai limpar contexto pra reorganizar.

---

## Comandos rápidos para retomar

```bash
# Ver o estado atual
cat _design-reference/celta-telemetria-cor-STATUS.md

# Auditoria visual
open https://github.com/flaviomarques1969/p1-fast/blob/claude/clear-session-fRVm4/assets/_previews/AUDIT-parts.png

# Comparação completa atual
open https://github.com/flaviomarques1969/p1-fast/blob/claude/clear-session-fRVm4/assets/_previews/celta-phase-b-COMPARISON-FULL.png

# Reabrir o partmap pra editar
$EDITOR assets/celta_exploded_partmap.svg

# Ver os IDs das 14 peças
grep 'id=' assets/celta_exploded_partmap.svg | grep -oE 'id="[^"]+"'
```

---

## Histórico das fases (resumo)

- **Phase A** (descartado): vetorização inteira em paths fragmentados → blocos sólidos coloridos. Reprovado.
- **Phase B v1**: foto base + overlays auto-detectados por OpenCV (color masks + connected components). Funcionou, mas mapeamento ruim em 4 peças.
- **Phase B v2**: refinamento manual com polígonos custom para tire-FR, gearbox, springs, radiator. Estado atual.
- **Phase B v3 (PRÓXIMO):** translucidez elegante para hidden parts.

---

**FIM DO STATUS.** Quando retomar: leia este doc, abra o `AUDIT-parts.png` no GitHub, depois ataque o Phase B v3.
