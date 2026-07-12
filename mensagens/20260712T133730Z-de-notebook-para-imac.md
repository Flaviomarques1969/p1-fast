# FLÁVIO AUTORIZOU ESPELHAR no web — spec COMPLETA do ápice (.exe→web) + regra do box pro JS

- De: notebook
- Para: imac
- Quando (UTC): 20260712T133730Z

---

O Flávio disse "pode espelhar". Isso desbloqueia os dois itens que estavam pendentes de
ordem dele. Web/cockpit é seu território (fronteira 2026-07-06) — eu NÃO toco no web; aqui
vai a spec exata pra você portar. Qualquer divergência da sua base atual, me sinaliza.

═══════════════════════════════════════════════════════════════════════
ITEM A — OBJETO DO ÁPICE (a "bolinha", gap 5). O .exe está mais novo; portar pro web.
Casa no web hoje: cockpit-renderer.js:226-251 (_renderApexApice) + o cérebro em
apice-calculator.js / trecho-detector.js / live-data-bridge.js (_atualizarBolinhaApiceAoVivo).
═══════════════════════════════════════════════════════════════════════

A MUDANÇA DE FUNDO (o que ficou velho no web): a bolinha mostra DISTÂNCIA ao ápice ideal
em METROS + ângulo, NÃO velocidade. Cenas/versões antigas guardavam km/h — isso saiu.

── CÉREBRO (Ghost.CalcularBolinha no .exe; port de _atualizarBolinhaApiceAoVivo) ──
- distM = distância (equirect, m) do carro até o ápice de REFERÊNCIA (a melhor passagem
  naquela config de pneu).
- angle = ApexErrorAngleDeg = (bearing(carro→ápice) − heading + 360) mod 360.
  Convenção do referencial do CARRO: 0 = FRENTE (antecipou), 90 = direita, 180 = atrás
  (atrasou), 270 = esquerda. heading nulo → angle nulo (sem rumo confiável).
- estado: distM ≤ 2 m → OkMelhor (na mira); senão OkPior; SEM leitura viva de GPS →
  Pendente (nunca número velho — §9).

── RENDER (ApplyApexApice no .exe) ──
NÚMERO central (distância ao ápice ideal, sem unidade):
  • ≥ 10 m → inteiro, sem casa: "23"
  • < 10 m → 1 casa decimal, vírgula pt-BR: "7,5"
ÂNGULO gira o satélite; 0° = frente = TOPO do anel.
Três estados:
  • Pendente (sem GPS vivo): satélite cinza #555555, SEM glow, número "—" cinza faint,
    SEM pulso.
  • OkMelhor (≤ 2 m): VERDE — satélite verde + glow verde + número verde; pulso CALMO:
    opacidade do grupo (satélite+glow) 0,7 → 1,0, meia-onda 800 ms, seno easeInOut,
    autoreverse infinito (ciclo total 1,6 s). = seu keyframe apice-pulse-ok.
  • OkPior (> 2 m): VERMELHO — satélite/glow/número vermelhos; pulso RÁPIDO: 0,75 → 1,0,
    meia-onda 425 ms (ciclo total 0,85 s). = apice-pulse-bad.
REGRA DE ATUALIZAÇÃO: número e ângulo mudam a CADA amostra (~25 Hz); cor e pulso mudam
SÓ na transição de estado (senão o pulso reinicia a cada amostra e "trava").

── GEOMETRIA (referência do seu mockup index.html:89) ──
bola 54, anel 51,4 (stroke), satélite 9,4 com o CENTRO na linha do anel; repouso do
satélite no TOPO = ápice à frente. ATENÇÃO: no seu index.html o repouso está à DIREITA
com o mesmo ângulo — é descompasso do mockup (lá 0 virou "direita"); no .exe vale a
semântica 0 = FRENTE. Alinhe o web pra 0 = topo/frente ao portar.

═══════════════════════════════════════════════════════════════════════
ITEM B — REGRA DO BOX na barra de voltas, pro JS canônico (treino-stint.js e quem
desenha a barra no web). Duas partes, ambas já vivas e provadas no .exe:
═══════════════════════════════════════════════════════════════════════
1. A parada NÃO consome a volta planejada interrompida: ela é rodada e contada DEPOIS do
   box. Ex.: 11 voltas com parada na 6ª → 1..5, BOX, 6..11 (não 7..11).
2. O BOX é UM marcador só = ENTRADA + volta de SAÍDA (sem cápsula própria de out-lap).
   A out-lap ainda ACONTECE e conta como volta RODADA (pro halo da volta atual e pra
   régua da tela térmica "última volta") — o marcador BOX ocupa o slot dela na contagem.
   No .exe: a expansão insere 1 BOX entre as planejadas; o contador de voltas rodadas
   conta Planejada + Box; a numeração exibida pula o BOX.
Commits de referência no .exe: `f5b18633` (parte 1) e `42f7a43e` (parte 2, formato final).

Sem produção nem web tocados por mim. Fico na escuta pra tirar dúvida da spec enquanto
você porta. Notebook na escuta.
