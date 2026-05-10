# Cockpit Display — PDM-10.5T

Especificações da tela 10,5" externa que o piloto olha na corrida. Dado
de hardware fechado em 2026-05-10 quando o Flávio fotografou a caixa.

> **Contexto arquitetural:** ADR-023 amendment 5. Notebook hospeda o app
> WinUI 3; esta tela é o display 2 (externo, montado de cabeça pra
> baixo no painel, rotação 180° via Windows Display Settings).

## Specs do fabricante

| Item | Valor |
|---|---|
| Modelo | **PDM-10.5T** (Portable Monitor 10.5") |
| Tamanho | 10,5 polegadas |
| Resolução nativa | **1920 × 1280** (H × V) |
| Aspect ratio | **3:2** (1.5:1) |
| Brilho típico | **500 cd/m²** — adequado pra leitura em luz forte de pista |
| Contraste típico | 2000:1 |
| Cores | 16,7 M (8-bit) |
| Ângulo de visão | 178° H / 178° V (CR > 10) |
| NTSC gamut | 100% NTSC |
| HDR / FreeSync | Sim |
| Input 1 | **2× USB-C full-featured** (alt mode video + power delivery) |
| Input 2 | **1× HDMI 1.4** |
| Output | USB-A 2.0 + 3.5 mm audio |
| Speakers | 2× integrados |
| Dimensões físicas | 23,3 × 16,5 × 1,05 cm |
| Origem | Made in China |

## O que isso decide

### 1. Viewport alvo do cockpit

- **Resolução de target:** 1920 × 1280 nativos.
- **Aspect ratio:** 3:2 (≠ do mockup atual). O mockup canônico
  `_design-reference/mockup-cockpit-piloto.html` está em 956 × 440
  (~2,17:1, mais panorâmico). Na tela 10,5" 3:2:
  - Escala uniforme 2× → 1912 × 880 (sobra ~200 px topo + ~200 px base).
  - Decisão de produto (MS-13.2): centralizar com letterbox vertical
    preto, ou esticar o wrapper externo pra ocupar 1920 × 1280
    completo (mantendo proporções internas).
- **Densidade visual:** 1920 / 956 ≈ 2× → tudo do mockup vira o dobro
  no port XAML. Tipografia + LEDs + halo + apex pontos ficam grandes
  o suficiente pra leitura periférica de pilotagem.

### 2. Cabeamento

A tela tem **2× USB-C full-featured + 1× HDMI 1.4**. Recomendo USB-C
como cabo único (vídeo + áudio + alimentação no mesmo fio). Exige só
que o notebook tenha USB-C com DP Alt Mode (esperado em qualquer
notebook moderno). HDMI fica como fallback.

### 3. Rotação 180°

A tela é montada de cabeça pra baixo no painel. Rotação configurada
**em Windows Display Settings → Monitor 2 → Orientação = 180°**, NÃO
no código do app. Razões em ADR-023 amendment 5.

### 4. Brilho

500 cd/m² é suficiente pra cockpit em pista durante o dia. Compare:
- iPhone 16 Pro Max: ~1000 cd/m² indoor / ~2000 outdoor (bem mais).
- Telas de carro de série: 400-600 cd/m².
- Notebooks comuns: 250-350 cd/m².

A tela serve, mas em sol forte direto pode ficar borderline. Se virar
problema em field test, opções:
- Usar viseira/sombrinha simples no painel.
- Trocar por uma tela industrial de 1000+ cd/m² no futuro (não
  prioritário).

## Checklist de instalação no carro

(Versão expandida do checklist de 5 passos da ADR-023 amendment 5.)

1. **Físico:**
   - [ ] Fixar a tela 10,5" no painel **invertida** (cabeça pra baixo).
   - [ ] Passar cabo USB-C (ou HDMI) até o notebook, evitando torção.
   - [ ] Conectar fonte de alimentação na tela (se via HDMI; USB-C
         tipicamente alimenta pelo mesmo cabo se o notebook tiver
         Power Delivery suficiente).

2. **Sistema operacional Windows:**
   - [ ] Plugar a tela 10,5".
   - [ ] Settings → System → Display.
   - [ ] Identificar a tela 10,5" como **Display 2**.
   - [ ] Modo: **Estender estes monitores**.
   - [ ] Selecionar Display 2 → **Display orientation = Landscape (flipped)** (= 180°).
   - [ ] Resolução: **1920 × 1280** (nativa).
   - [ ] Scale: 100%.
   - [ ] Posicionar Display 2 "à direita" do Display 1 nas
         configurações (independente do físico, importa pra cursor
         mapping).

3. **App cockpit:**
   - [ ] Rodar `P1Fast.Cockpit.UI.exe --display-index 2`.
   - [ ] Confirmar que abriu **fullscreen** na tela 10,5".
   - [ ] Confirmar que o **piloto vê a imagem em pé** (rotação 180°
         do Windows compensou a montagem invertida).
   - [ ] Confirmar que o **display 1 do notebook** continua livre
         pra o engenheiro/instalador.

4. **Operação:**
   - [ ] Atalho na área de trabalho do notebook que abre o cockpit
         direto no display 2 (`shortcut → C:\...\P1Fast.Cockpit.UI.exe --display-index 2`).
   - [ ] Documentar pro piloto/equipe como abrir e fechar.

## Pendências

- **Field test inicial:** confirmar que 500 cd/m² aguenta sol direto
  durante stint real. Se não, decisão de produto: adicionar viseira
  ou trocar por tela industrial.
- **Touch:** a especificação não menciona touch. Se for touch
  (alguns PDM-10.5T têm), o input precisa ser remapeado depois da
  rotação 180° (Windows faz isso automaticamente quando configurado
  via Display Settings).
- **HDR / FreeSync:** suportados, mas não usamos. Cockpit é
  conteúdo SDR, framerate constante 60 Hz suficiente.
