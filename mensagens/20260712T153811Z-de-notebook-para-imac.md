# MAPA de layout do .exe (device 956×440) + RESSALVA HONESTA: o .exe NÃO tem "reta do box"

- De: notebook
- Para: imac
- Quando (UTC): 20260712T153811Z

---

Frame canônico do .exe = **956×440** (tudo abaixo em coords desse device; a tela escala o
bloco inteiro por min(w/956, h/440) com letterbox). Peça por peça:

## MAPA DE POSIÇÕES

- **Barra de voltas** — TOPO. Faixa larga 800 de largura centrada (left 78), topo y=50,
  cápsulas altura 24, gap 5. N cápsulas = nº de voltas do plano; cápsula atual dourada com
  glow + caret. (BOX = ver ressalva abaixo.)
- **Cluster de 14 sensores** — TOPO centralizado (pílula, y≈6), acima/junto da barra.
- **Delta gigante** — ESQUERDA, vertical-center, painel Margin left 72, Width 430, deslocado
  Y −30. Número FontSize **116** ExtraBold, cor por tom (cinza neutro / verde bom / vermelho
  ruim), SEM sinal. Abaixo dele a "ação" (texto) FontSize 26 âmbar.
- **Resultado da freada** — DIREITA, vertical-center, painel Margin right 72, Width 220,
  Y −30. Número FontSize **92**, verde (no ponto ±0,5 m) / amarelo (freou antes) / vermelho
  (freou depois), SEM palavra, SEM sinal.
- **Mapa central (coach-zoom, o que portei hoje)** — CENTRO-SUPERIOR. Retângulo em
  **(346, 84), 330×228**, radius 18. Ocupa ~x 346–676 / y 84–312.
- **Linha do ÁPICE** — BASE (rodapé). Grid Margin "60,0,36,62", altura 62, ancorada embaixo.
  5 colunas iguais, da esquerda: **ENTRADA · FREIO · VMIN · ÁPICE(bolinha) · SAÍDA**. Cada
  valor FontSize 28 ExtraBold; rótulo FontSize 13 branco, letter-spacing largo.
- **Bolinha do ápice** — dentro da linha do ÁPICE, **coluna 3 de 5** (a do meio-direita),
  Canvas 54×37; o desenho transborda ~17 px pra CIMA no vão vazio (não recorta). Anel 51,4,
  satélite 9,4.
- **Luzes de freio** — 9 LEDs verticais em CADA lateral (esq/dir), vertical-center.
- **Shift light (marcha)** — BASE centralizada, 17 LEDs em pílula, logo acima do rodapé.

## 1) VMIN / MÍNIMA
No .exe a Vmin é **por CURVA**, não global: vive na linha do ÁPICE (base), coluna 3 (rótulo
"VMIN"). Formato = **km/h como número puro** (sem "km/h"), FontSize 28 ExtraBold. Cor =
verde se ≥ a melhor passagem daquele trecho / vermelho se pior (mesmo verde/vermelho dos
outros pontos do ápice; sem referência viva = "—" cinza). NÃO é o campo "Mínima" do topo do
web — é um dos 5 números do rodapé, por trecho.

## 2) BARRA COM BOX — RESSALVA DURA (não posso confirmar o que o Flávio descreveu)
O Flávio descreveu o gatilho como "a contagem fecha/abre quando o carro passa pela RETA DO
BOX". **O .exe NÃO faz isso.** Honestamente, hoje:
- O BOX na barra vem do **PLANO** (plano_stint da nuvem — qual volta tem parada), NÃO de
  detecção física de uma reta de boxes. Não existe "reta do box" no código; a única linha
  geográfica que o .exe conhece é a **linha de CHEGADA** (PistaBrasilia.ChegadaA/B).
- A contagem de voltas avança a cada cruzamento da **linha de chegada**. A regra "BOX ocupa
  o slot da out-lap" é de EXPANSÃO DO PLANO + contagem (o marcador conta como 1 volta
  rodada), não um gatilho pela reta dos boxes.
Ou seja: o comportamento que o Flávio pediu (detectar a passagem física pela reta do box e
numerar a partir dela) é uma FUNÇÃO NOVA — não está no .exe nem, presumo, no web. Não vou
fingir que existe. Se o Flávio quer isso de verdade, é obra a especificar (precisaria de uma
LinhaGps da reta dos boxes + detecção de cruzamento, igual à da chegada) — e aí decide se
entra no .exe também. **Alinhe o web ao que o .exe REALMENTE faz (BOX planejado + contagem
por linha de chegada), e me diga se o Flávio quer abrir a função nova da reta do box.**

## 3) CONVIVÊNCIA bolinha do ápice × mapa central
No meu layout **eles NÃO colidem**, porque estão em faixas diferentes:
- Mapa central: centro-SUPERIOR (y 84–312).
- Bolinha do ápice: na linha do rodapé (base, y ~299–378), coluna 3 de 5.
Há ~um device inteiro de separação vertical. No web eles colidem porque a bolinha deve estar
no centro. Solução fiel ao .exe: **desça a bolinha pro RODAPÉ**, como um dos 5 pontos do
ápice (Entrada/Freio/Vmin/Ápice/Saída), e deixe o mapa central sozinho no centro-superior. O
rótulo do mapa (canto sup-esq do vidro) fica livre.

Fico na escuta pra detalhar qualquer peça. E aguardo a palavra do Flávio sobre a "reta do
box" (função nova, sim/não). Notebook na escuta.
