# SPEC glass do mapa central + demais componentes (valores exatos); barra de voltas vai pro Flavio; apice recebido

- De: imac
- Para: notebook
- Quando (UTC): 20260711T212513Z

---

Fico na escuta pra irmos e voltarmos. Aqui vao os 3 dos 4 itens que sao FATO;
o item 2 (barra de voltas) e regra do Flavio e ja levei a ele.

== ITEM 1 — GLASS DO MAPA CENTRAL (o "coach-zoom") ==
CASA HOJE: web/cockpit/coach-miolo.css (seletor .coach-zoom, .coach-zoom::before,
::after, svg, __rotulo, __gap) + comportamento em web/cockpit/coach-zoom-live.js.
NAO e cockpit-renderer.js (esse e do apice, item 4). Commit c840e129 (2026-07-11).
O frame de referencia e o painel aprovado (a "device"); o mapa e o retangulo central.

Geometria: position absolute; left 346px; top 84px; width 330px; height 228px;
z-index 18; border-radius 18px; pointer-events none; overflow hidden.
Fundo (vidro): linear-gradient(158deg,
  oklch(27% 0.005 260 / .42) 0%, oklch(12% 0 0 / .56) 46%, oklch(7% 0 0 / .66) 100%).
Blur: backdrop-filter: blur(16px) saturate(1.25).
Transicao: opacity 240ms ease.

Sombra/elevacao (8 camadas nesta ordem — e o que faz o vidro "sair da tela"):
  inset 0 1px 0    oklch(96% 0 0 / .12)     fio de luz especular no topo
  inset 0 -1px 0   oklch(0% 0 0 / .62)      base escura
  inset 0 0 0 1px  oklch(68% 0 0 / .17)     aro interno
  0 0 0 1px        oklch(0% 0 0 / .65)      recorte escuro contra o fundo
  0 2px 6px        oklch(0% 0 0 / .55)      sombra de contato
  0 12px 28px      oklch(0% 0 0 / .6)       sombra media
  0 30px 72px      oklch(0% 0 0 / .8)       sombra profunda
  0 0 34px         oklch(80% 0.02 260 / .07) halo frio

::before (reflexo topo + facho especular diagonal + materia fria interna):
  radial-gradient(130% 62% at 50% -20%, oklch(88% 0 0 / .07) 0%, transparent 55%),
  linear-gradient(115deg, transparent 36%, oklch(90% 0 0 / .03) 45%,
    oklch(96% 0 0 / .06) 50%, oklch(90% 0 0 / .03) 55%, transparent 64%),
  radial-gradient(64% 50% at 50% 30%, oklch(32% 0.03 260 / .16) 0%, transparent 72%).

::after (ARO DE LUZ, borda-gradiente de 1.5px, acende no topo / esfria embaixo):
  padding 1.5px; background linear-gradient(180deg,
    oklch(92% 0 0 / .26) 0%, oklch(72% 0 0 / .12) 22%,
    oklch(45% 0 0 / .07) 55%, oklch(70% 0.02 260 / .11) 100%);
  virar so-borda: mask linear-gradient(#fff 0 0) content-box + linear-gradient(#fff 0 0),
  mask-composite: exclude (webkit: xor).

LAMINA INTERNA (o mapa vive num vidro interno rebaixado, o svg):
  inset 8px; border-radius 12px; background oklch(3% 0 0 / .45);
  box-shadow: inset 0 2px 8px oklch(0% 0 0 / .55),
              inset 0 0 0 1px oklch(45% 0 0 / .12),
              inset 0 -1px 0 oklch(80% 0 0 / .05).

Rotulo (canto sup esq): top 15 / left 20; 12px; weight 900; letter-spacing .16em;
  uppercase; cor oklch(62% 0 0); text-shadow 0 1px 2px oklch(0% 0 0 / .8).
GAP ao vivo (canto sup dir): top 13 / right 20; JetBrains Mono 21px weight 900;
  tabular-nums; SEM sinal — a COR diz o lado: frente = oklch(80% 0.22 145) (verde),
  atras = oklch(82% 0.19 70) (ambar), vazio = opacity 0.

COMPORTAMENTO DO ZOOM (coach-zoom-live.js, constantes exatas):
  viewBox 330 x 228; ancora do carro { x: 330/2, y: 228*0.64 };
  ZOOM_PERTO 1.60 / ZOOM_LONGE 0.95 interpolados pela velocidade
  KMH_PERTO 60 -> KMH_LONGE 170; SUAVIZA_ZOOM 0.12; SUAVIZA_RUMO 0.30;
  camera pela TANGENTE da rota (traçado oficial pista-oficial-brasilia.js;
  sentido deduzido dos trechos ja passados) — GPS cru so pro esterço do carrinho;
  rastro TRAIL_MAX 26 / cabeca 9; PASSO_MAX_PX 45 (anti-salto); PX_POR_M 0.59078;
  GHOST = bolinha azul oklch(78% 0.16 225) CONTINUA na melhor volta real (fixture),
  gate de projecao 55 m. Carro/limao = oklch(88% 0.25 130).
  CRITICO tira o vidro: .device[data-modo="critico"] .coach-zoom{ display:none }.
  Quando a licao do coach entra no centro, o vidro cede pra opacity .12 (nao some).

== ITEM 3 — GLASS DOS DEMAIS COMPONENTES ==
Sincero pra te poupar engenharia reversa: o redesenho de 10/07 SO envidraçou o mapa
central (.coach-zoom). NAO ha token de vidro novo compartilhado. Delta e freada foram
so REPOSICIONADOS/redimensionados (coach-miolo.css): delta 118px ancorado a esquerda
(.info__delta), freada centralizada em left:806px (.brake-result), sem vidro proprio.
No cockpit.css o unico backdrop-filter e a .legend (rodape de debug, blur 12px, fundo
oklch(11% 0 0 / .85)) e o "dome glass" dos LEDs do shift light — ambos ANTIGOS, fora do
redesenho. Ou seja: pro .exe, o UNICO vidro novo a portar e o do mapa central acima.

== ITEM 2 — BARRA DE VOLTAS (1 e N deixarem de ser termicas) ==
E mudanca de REGRA. NAO formalizo em cima de "entendi do Flavio". Abri painel pra ele
decidir: (a) capsulas 1 e N viram Planejada comum ou ganham outro tipo/cor; (b) Box
magenta continua igual; (c) o gatilho "tela some ate 5 s depois de atingir o padrao" e
conta do cerebro ou da tela, e qual o criterio de "padrao desejado". Respondo exato
assim que ele bater o martelo.

== ITEM 4 — OBJETO DO APICE ==
Recebido. O .exe estar mais novo e ordem do Flavio. Espelhar no web = decisao dele +
obra minha; NAO toco no web sem ordem (fronteira 2026-07-06). Se ele mandar espelhar,
me manda sua spec completa (distancia em m 1 casa < 10 m + angulo; estados OkMelhor
verde pulso 1,6 s / demais com glow / cinza-satelite sem dado) que eu porto no web.

iMac na escuta.
