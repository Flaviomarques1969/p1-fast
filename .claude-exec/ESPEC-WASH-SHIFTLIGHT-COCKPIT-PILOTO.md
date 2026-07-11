# ESPECIFICAÇÃO — Wash do Shift Light (Cockpit do Piloto)

Fonte canônica: `_design-reference/mockup-cockpit-piloto.html`
CSS: linhas 235-332 · HTML: linhas 869-902 · JS (gatilho): linhas 1183-1245

## O que é
Evento **FIRE** ("TROCA AGORA"): no momento da troca de marcha, o shift light dá
**3 pulsos branco-azuis a ~10 Hz, em 300ms, uma vez** (disparo único, não fica repetindo).
Três camadas sincronizadas: (1) LED central, (2) moldura do shift light, (3) **wash da TELA
INTEIRA** (overlay `.fire-overlay`). Existe também o estado OVERREV (vermelho, contínuo,
150ms) = "passou da hora" — NÃO é o wash.

## Números
- Duração total: 300ms (0,30s), uma vez por troca.
- 3 pulsos brancos a ~10 Hz (acende em 3%, 43%, 80%; apaga em 33%, 71%; decai em 100%).
- Cor: branco-azulado (oklch ~96% L, hue 230-245). Diferente do verde/amarelo/vermelho da subida.
- Wash mais forte no topo da tela, espalhando pra baixo, com brilho na borda.

## CSS (cole igual)
```css
/* FIRE — LED central + 3 pulsos brancos 10Hz, 300ms */
.shift-light[data-state="fire"] .shift-light__dot{
  background:radial-gradient(circle at 35% 28%,
    oklch(100% 0 0) 0%,
    oklch(98% 0.04 230) 55%,
    oklch(86% 0.12 240) 100%);
  box-shadow:
    inset 0 1px 0 oklch(100% 0 0 / 1),
    inset 0 0 0 1px oklch(96% 0.05 230),
    0 0 16px oklch(100% 0 0 / 1),
    0 0 36px oklch(96% 0.06 230 / .95),
    0 0 70px oklch(88% 0.13 240 / .75),
    0 0 130px oklch(78% 0.16 245 / .45);
  animation: shiftFire 300ms linear forwards;
}
.shift-light[data-state="fire"]{
  animation: shiftHousingFire 300ms linear forwards;
}
@keyframes shiftFire{
  0%   { opacity: 0; transform: scale(0.85); }
  3%   { opacity: 1; transform: scale(1.24); }
  28%  { opacity: 1; transform: scale(1.22); }
  33%  { opacity: 0; transform: scale(1.0);  }
  39%  { opacity: 0; transform: scale(1.0);  }
  43%  { opacity: 1; transform: scale(1.22); }
  65%  { opacity: 1; transform: scale(1.20); }
  71%  { opacity: 0; transform: scale(1.0);  }
  76%  { opacity: 0; transform: scale(1.0);  }
  80%  { opacity: 1; transform: scale(1.20); }
  92%  { opacity: 1; transform: scale(1.18); }
  100% { opacity: .55; transform: scale(1.10); }
}
@keyframes shiftHousingFire{
  0%, 100% { box-shadow:
    inset 0 1px 0 oklch(22% 0 0 / .8),
    inset 0 -1px 0 oklch(0% 0 0 / .9),
    inset 0 0 0 1px oklch(15% 0 0),
    0 2px 6px oklch(0% 0 0 / .6),
    0 8px 24px oklch(0% 0 0 / .35); }
  3%, 28%, 43%, 65%, 80%, 92% { box-shadow:
    inset 0 1px 0 oklch(60% 0.08 230 / .9),
    inset 0 -1px 0 oklch(0% 0 0 / .9),
    inset 0 0 0 1px oklch(82% 0.12 235),
    0 0 0 1.5px oklch(94% 0.08 230 / .65),
    0 2px 6px oklch(0% 0 0 / .6),
    0 0 70px oklch(92% 0.10 235 / .65); }
  33%, 39%, 71%, 76% { box-shadow:
    inset 0 1px 0 oklch(22% 0 0 / .8),
    inset 0 -1px 0 oklch(0% 0 0 / .9),
    inset 0 0 0 1px oklch(15% 0 0),
    0 2px 6px oklch(0% 0 0 / .6),
    0 8px 24px oklch(0% 0 0 / .35); }
}

/* WASH DA TELA INTEIRA — overlay branco-azul sincronizado com os 3 pulsos */
.fire-overlay{
  position:absolute;inset:0;border-radius:inherit;
  pointer-events:none;
  z-index:200;
  background:
    radial-gradient(ellipse 110% 65% at 50% 0%,
      oklch(96% 0.10 235 / .55) 0%,
      oklch(88% 0.14 240 / .25) 35%,
      oklch(72% 0.16 245 / .06) 65%,
      transparent 85%),
    linear-gradient(180deg,
      oklch(94% 0.10 235 / .35) 0%,
      transparent 22%);
  box-shadow:
    inset 0 0 0 2px oklch(94% 0.08 230 / .55),
    inset 0 0 60px oklch(92% 0.10 235 / .35);
  opacity:0;
}
.device[data-shift-fire="active"] .fire-overlay{
  animation: deviceFireFlash 300ms linear forwards;
}
@keyframes deviceFireFlash{
  0%   { opacity: 0; }
  3%   { opacity: 1; }
  28%  { opacity: 1; }
  33%  { opacity: 0; }
  39%  { opacity: 0; }
  43%  { opacity: 1; }
  65%  { opacity: 1; }
  71%  { opacity: 0; }
  76%  { opacity: 0; }
  80%  { opacity: 1; }
  92%  { opacity: .9; }
  100% { opacity: 0; }
}
```

## HTML (estrutura mínima)
```html
<div class="device" id="device" data-shift-fire="idle">
  <div class="fire-overlay"></div>
  <!-- ... resto do cockpit ... -->
  <div class="shift-light" id="shiftLight" data-state="off">
    <span class="shift-light__dot" data-tier="1"></span>
    <span class="shift-light__dot" data-tier="2"></span>
    <span class="shift-light__dot" data-tier="3"></span>
    <span class="shift-light__dot" data-tier="4"></span>
    <span class="shift-light__dot" data-tier="5"></span>
    <span class="shift-light__dot" data-tier="6"></span>
    <span class="shift-light__dot" data-tier="7"></span>
    <span class="shift-light__dot" data-tier="8"></span>
    <span class="shift-light__dot" data-tier="9"></span>
    <span class="shift-light__dot" data-tier="8"></span>
    <!-- as laterais espelham; a tier 9 (central) só acende no FIRE -->
  </div>
</div>
```

## JS — como DISPARAR o wash (1 troca)
```js
const shiftLight = document.getElementById('shiftLight');
const device     = document.getElementById('device');

function dispararWashTroca(){
  shiftLight.dataset.state = 'fire';
  // re-arma a animação do overlay: desliga e religa no próximo quadro
  device.dataset.shiftFire = 'idle';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { device.dataset.shiftFire = 'active'; });
  });
  // volta sozinho em 300ms (animation ... forwards). Pra repetir, chamar de novo.
}
```

## Cuidado
NÃO confundir com OVERREV (passou do ponto): `shiftLight.dataset.state = 'overrev'`,
todos os LEDs piscam **vermelho**, 150ms, **contínuo** até a rotação cair. É alarme, não troca.
