#!/usr/bin/env python3
"""
Builds _design-reference/celta-telemetria-cor-phase-b.html — the interactive
demo that lets you slide each part's telemetry value and watch the photo
recolor.

Reads paths + embedded photo from assets/celta_exploded_partmap.svg.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SVG_PATH  = ROOT / "assets/celta_exploded_partmap.svg"
OUT_HTML  = ROOT / "_design-reference/celta-telemetria-cor-phase-b.html"

# Order in the control panel (and parts that are interactive)
TIRES   = ["tire-FL", "tire-FR", "tire-RL", "tire-RR"]
SPRINGS = ["spring-FL", "spring-FR", "spring-RL", "spring-RR"]
POWER   = ["engine", "gearbox", "radiator"]
BODY    = ["body-paint", "body-roof"]
HIDDEN  = {"tire-FR", "tire-RL", "spring-FL", "spring-FR", "gearbox"}

ALL_PARTS = TIRES + SPRINGS + POWER + BODY


def extract_svg_pieces():
    txt = SVG_PATH.read_text(encoding="utf-8")
    img_match = re.search(r'<image\s[^>]*?/>', txt)
    defs_match = re.search(r'<defs>.*?</defs>', txt, re.S)
    vis_match  = re.search(r'<g class="visible-parts".*?</g>', txt, re.S)
    hid_match  = re.search(r'<g class="hidden-parts".*?</g>',  txt, re.S)
    if not all((img_match, defs_match, vis_match, hid_match)):
        raise SystemExit("SVG missing expected blocks (image / defs / groups)")
    return (img_match.group(0), defs_match.group(0),
            vis_match.group(0), hid_match.group(0))


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Celta · Telemetria-Cor · Phase B v3</title>
  <style>
    :root {{
      --bg: #0F1216; --tile: #171C25; --border: #1F252E;
      --text: #E8EBF0; --text-dim: #6E7681; --accent: #FFCC1A;
      --hidden-edge: #B6E3FF;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ background: var(--bg); color: var(--text);
      font-family: Inter, -apple-system, system-ui, sans-serif;
      min-height: 100vh; padding: 24px;
      display: grid; grid-template-columns: 1fr 360px; gap: 24px; }}
    .header {{ grid-column: 1 / -1; display: flex;
      justify-content: space-between; align-items: baseline;
      padding-bottom: 14px; border-bottom: 1px solid var(--border); }}
    .header h1 {{ font-size: 17px; font-weight: 500; }}
    .header h1 span {{ color: var(--accent); }}
    .header .meta {{ color: var(--text-dim); font-size: 11px;
      letter-spacing: 1.5px; text-transform: uppercase; }}

    .car-stage {{ background: var(--tile); border: 1px solid var(--border);
      border-radius: 4px; padding: 16px; display: flex;
      align-items: center; justify-content: center; min-height: 600px;
      position: sticky; top: 24px; max-height: calc(100vh - 48px); }}
    .car-stage svg {{ max-width: 100%; max-height: 720px; }}

    .controls {{ display: flex; flex-direction: column; gap: 12px; }}
    .group {{ background: var(--tile); border: 1px solid var(--border);
      border-radius: 4px; padding: 12px 14px; }}
    .group h2 {{ font-size: 10px; font-weight: 700; letter-spacing: 2px;
      color: var(--accent); text-transform: uppercase;
      margin-bottom: 8px; display: flex; justify-content: space-between;
      align-items: center; }}
    .group h2 button {{ background: transparent; color: var(--text-dim);
      border: 1px solid var(--border); padding: 2px 8px;
      font-size: 9px; font-family: inherit; cursor: pointer;
      letter-spacing: 1px; transition: all 0.15s; }}
    .group h2 button:hover {{ border-color: var(--accent); color: var(--accent); }}

    .slider-row {{ display: grid; grid-template-columns: 70px 1fr 70px;
      align-items: center; gap: 10px; margin: 8px 0; font-size: 11px; }}
    .slider-row .lbl {{ color: var(--text); font-weight: 500;
      letter-spacing: 0.5px; }}
    .slider-row .lbl.is-hidden {{ color: var(--hidden-edge); }}
    .slider-row .val {{ font-family: 'JetBrains Mono', monospace;
      font-size: 11px; text-align: right; font-weight: 600; }}
    .slider-row input[type=range] {{ width: 100%; -webkit-appearance: none;
      appearance: none; height: 4px; border-radius: 2px;
      background: linear-gradient(to right, #1B5BFF 0%, #5DD18C 35%, #FFCC1A 65%, #FF5A1F 100%); }}
    .slider-row input[type=range]::-webkit-slider-thumb {{
      -webkit-appearance: none; width: 13px; height: 13px;
      border-radius: 50%; background: #fff; cursor: pointer;
      border: 2px solid #0F1216; }}
    .slider-row input[type=range]::-moz-range-thumb {{
      width: 13px; height: 13px; border-radius: 50%;
      background: #fff; cursor: pointer; border: 2px solid #0F1216; }}

    .presets {{ background: var(--tile); border: 1px solid var(--border);
      border-radius: 4px; padding: 12px 14px; }}
    .presets h2 {{ font-size: 10px; font-weight: 700; letter-spacing: 2px;
      color: var(--accent); text-transform: uppercase; margin-bottom: 8px; }}
    .presets button {{ background: transparent; color: var(--text);
      border: 1px solid var(--border); padding: 6px 10px;
      font-family: inherit; font-size: 11px; cursor: pointer;
      width: 100%; margin-bottom: 4px; text-align: left; transition: all 0.15s; }}
    .presets button:hover {{ border-color: var(--accent); color: var(--accent); }}
    .presets button:last-child {{ margin-bottom: 0; }}

    .verify {{ background: var(--tile); border: 1px solid #FFCC1A40;
      border-radius: 4px; padding: 12px 14px; }}
    .verify h2 {{ font-size: 10px; font-weight: 700; letter-spacing: 2px;
      color: var(--accent); text-transform: uppercase; margin-bottom: 8px; }}
    .verify p {{ font-size: 11px; color: var(--text-dim); margin-bottom: 8px;
      line-height: 1.5; }}
    .verify .verify-grid {{ display: grid;
      grid-template-columns: repeat(2, 1fr); gap: 4px; }}
    .verify button {{ background: transparent; color: var(--text);
      border: 1px solid var(--border); padding: 5px 8px;
      font-family: inherit; font-size: 10px; cursor: pointer;
      letter-spacing: 0.5px; transition: all 0.15s; }}
    .verify button:hover {{ border-color: var(--accent); color: var(--accent); }}
    .verify button.active {{ border-color: var(--accent);
      background: rgba(255, 204, 26, 0.15); color: var(--accent); }}
    .verify button.is-hidden {{ color: var(--hidden-edge);
      border-color: rgba(182, 227, 255, 0.30); }}

    .legend {{ background: var(--tile); border: 1px dashed rgba(182, 227, 255, 0.4);
      border-radius: 4px; padding: 10px 12px; font-size: 11px;
      color: var(--text-dim); line-height: 1.5; }}
    .legend strong {{ color: var(--hidden-edge); font-weight: 600; }}
  </style>
</head>
<body>
  <div class="header">
    <h1>Celta &middot; <span>Telemetria-Cor</span> &middot; Phase B v3 · translucidez</h1>
    <div class="meta">P1 FAST &middot; PER-PART OVERLAYS</div>
  </div>

  <div class="car-stage">
    {SVG_INLINE}
  </div>

  <div class="controls">
    <div class="verify">
      <h2>Verificar mapeamento</h2>
      <p>Clique para destacar a peça (visíveis em magenta · ocultas em ciano).</p>
      <div class="verify-grid">
        {VERIFY_BUTTONS}
      </div>
    </div>

    <div class="group">
      <h2>Pneus &middot; temp <button onclick="resetGroup('tires')">RESET</button></h2>
      {TIRE_ROWS}
    </div>

    <div class="group">
      <h2>Suspensão (carga estimada via accelerômetros) <button onclick="resetGroup('springs')">RESET</button></h2>
      {SPRING_ROWS}
    </div>

    <div class="group">
      <h2>Powertrain <button onclick="resetGroup('power')">RESET</button></h2>
      {POWER_ROWS}
    </div>

    <div class="presets">
      <h2>Cenários</h2>
      <button onclick="preset('cold')">Carro frio (todos azuis)</button>
      <button onclick="preset('ideal')">Janela ideal (sem tint)</button>
      <button onclick="preset('hot-tire-RR')">Pneu RR superaquecendo</button>
      <button onclick="preset('hidden-FR-overheat')">Pneu FR (oculto) superaquecendo</button>
      <button onclick="preset('overheat-engine')">Motor superaquecendo</button>
      <button onclick="preset('gearbox-hot')">Câmbio (oculto) quente</button>
      <button onclick="preset('reset')">Resetar tudo</button>
    </div>

    <div class="legend">
      <strong>Translucidez</strong> · peças hidden (FR/RL/molas dianteiras/câmbio)
      mostram contorno tracejado ciano discreto. Em alarme, o glow vaza
      através da obstrução com a cor da temperatura.
    </div>
  </div>

<script>
const HIDDEN_PARTS = new Set({HIDDEN_JSON});
const ALL_PARTS = {ALL_PARTS_JSON};

// --- color/temperature helpers ---
function lerpColor(a, b, t) {{
  const ah = parseInt(a.slice(1), 16), bh = parseInt(b.slice(1), 16);
  const ar = (ah>>16)&0xff, ag = (ah>>8)&0xff, ab = ah&0xff;
  const br = (bh>>16)&0xff, bg = (bh>>8)&0xff, bb = bh&0xff;
  return '#' + (((Math.round(ar+(br-ar)*t))<<16)|((Math.round(ag+(bg-ag)*t))<<8)|(Math.round(ab+(bb-ab)*t))).toString(16).padStart(6,'0');
}}
function tempColor(t) {{
  if (t < 0.35) return lerpColor('#1B5BFF', '#5DD18C', t/0.35);
  if (t < 0.65) return lerpColor('#5DD18C', '#FFCC1A', (t-0.35)/0.30);
  return lerpColor('#FFCC1A', '#FF5A1F', (t-0.65)/0.35);
}}
const opacityFromT = t => Math.abs(t - 0.5) * 1.1;
const fmtTemp = (t, lo, hi) => Math.round(lo + t*(hi-lo)) + '\\u00B0C';
const labelLoad = t => t<0.30?'EST.':t<0.65?'OK':'CARR.';
const fmtPct = t => Math.round(t*100)+'%';

function applyPart(partId, t) {{
  const path = document.getElementById(partId);
  if (!path) return;
  const c = tempColor(t);
  const dev = Math.abs(t - 0.5);
  if (HIDDEN_PARTS.has(partId)) {{
    // Hidden = ghost stays drawn; alarm intensity drives stroke color, fill,
    // and gaussian-blur radius on its dedicated filter.
    const strokeOp = 0.30 + dev * 0.65;     // 0.30 quiet, ~0.95 hot
    const fillOp   = Math.min(0.30, dev * 0.55);
    const blurR    = dev * 22;              // 0..~12px
    path.setAttribute('stroke', dev < 0.05 ? '#FFFFFF' : c);
    path.setAttribute('stroke-opacity', strokeOp.toFixed(2));
    path.setAttribute('fill', c);
    path.setAttribute('fill-opacity', fillOp.toFixed(2));
    const filter = document.querySelector(`#glow-${{partId}} feGaussianBlur`);
    if (filter) filter.setAttribute('stdDeviation', blurR.toFixed(1));
    // Hidden parts keep opacity=1 (the stroke/fill carry the message).
    path.setAttribute('opacity', '1');
  }} else {{
    path.setAttribute('fill', c);
    path.setAttribute('opacity', opacityFromT(t).toFixed(2));
  }}
}}

function setupSlider(partId, valFmt) {{
  const sl = document.getElementById('s-' + partId);
  const valEl = document.getElementById('v-' + partId);
  if (!sl || !valEl) return;
  function update() {{
    const t = sl.value / 100;
    applyPart(partId, t);
    valEl.textContent = valFmt(t);
    valEl.style.color = tempColor(t);
  }}
  sl.addEventListener('input', update);
  update();
}}

{TIRES_JS}.forEach(p => setupSlider(p, t => fmtTemp(t, 60, 130)));
{SPRINGS_JS}.forEach(p => setupSlider(p, labelLoad));
setupSlider('engine', t => fmtTemp(t, 70, 120));
setupSlider('gearbox', t => fmtTemp(t, 60, 110));
setupSlider('radiator', t => fmtTemp(t, 60, 110));
setupSlider('body-paint', fmtPct);
setupSlider('body-roof', fmtPct);

function setSlider(id, val) {{
  const sl = document.getElementById('s-'+id);
  if (!sl) return;
  sl.value = val;
  sl.dispatchEvent(new Event('input'));
}}
function resetGroup(g) {{
  const map = {{tires: {TIRES_JS}, springs: {SPRINGS_JS},
                power: ['engine','gearbox','radiator']}};
  (map[g]||[]).forEach(p => setSlider(p, 50));
}}

function preset(p) {{
  const all50 = {{}}; ALL_PARTS.forEach(x => all50[x]=50);
  const presets = {{
    cold: Object.fromEntries(ALL_PARTS.map(x => [x, 12])),
    ideal: all50,
    'hot-tire-RR': {{...all50, 'tire-RR': 95}},
    'hidden-FR-overheat': {{...all50, 'tire-FR': 92}},
    'overheat-engine': {{...all50, engine: 92, gearbox: 78, radiator: 80}},
    'gearbox-hot': {{...all50, gearbox: 88}},
    reset: all50,
  }};
  const v = presets[p]; if (!v) return;
  Object.keys(v).forEach(k => setSlider(k, v[k]));
}}

// --- highlight ---
let highlightTimer = null, highlightedEl = null, savedAttrs = {{}};
function clearHighlight() {{
  if (highlightTimer) {{ clearInterval(highlightTimer); highlightTimer = null; }}
  if (highlightedEl) {{
    Object.entries(savedAttrs).forEach(([k, v]) => {{
      if (v == null) highlightedEl.removeAttribute(k);
      else highlightedEl.setAttribute(k, v);
    }});
    highlightedEl = null; savedAttrs = {{}};
  }}
  document.querySelectorAll('.verify button').forEach(b => b.classList.remove('active'));
}}
function highlight(partId, evt) {{
  clearHighlight();
  const el = document.getElementById(partId);
  if (!el) return;
  highlightedEl = el;
  const isHidden = HIDDEN_PARTS.has(partId);
  ['fill','opacity','stroke','stroke-width','fill-opacity','stroke-opacity']
    .forEach(k => savedAttrs[k] = el.getAttribute(k));
  let i = 0;
  const tone = isHidden ? '#9EE9FF' : '#FF1CC8';
  highlightTimer = setInterval(() => {{
    const phase = (i % 16) / 16;
    const op = 0.55 + 0.35 * Math.sin(phase * Math.PI * 2);
    el.setAttribute('fill', tone);
    el.setAttribute('fill-opacity', op.toFixed(2));
    el.setAttribute('opacity', '1');
    el.setAttribute('stroke', tone);
    el.setAttribute('stroke-width', '6');
    el.setAttribute('stroke-opacity', '1');
    i++;
  }}, 60);
  if (evt && evt.target) evt.target.classList.add('active');
}}
</script>
</body>
</html>
"""


def slider_row(part_id, label_text, fmt_unit_label):
    is_hidden = part_id in HIDDEN
    cls = " is-hidden" if is_hidden else ""
    return (f'      <div class="slider-row">'
            f'<span class="lbl{cls}">{label_text}</span>'
            f'<input type="range" id="s-{part_id}" min="0" max="100" value="50">'
            f'<span class="val" id="v-{part_id}">--</span>'
            f'</div>')


def main():
    img_tag, defs, vis_g, hid_g = extract_svg_pieces()
    svg_inline = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048" '
        f'preserveAspectRatio="xMidYMid meet">\n'
        f'  {img_tag}\n  {defs}\n  {vis_g}\n  {hid_g}\n</svg>'
    )

    short = {
        "tire-FL":"PNEU FL", "tire-FR":"PNEU FR", "tire-RL":"PNEU RL", "tire-RR":"PNEU RR",
        "spring-FL":"MOLA FL", "spring-FR":"MOLA FR", "spring-RL":"MOLA RL", "spring-RR":"MOLA RR",
        "engine":"MOTOR", "gearbox":"CÂMBIO", "radiator":"RADIADOR",
        "body-paint":"BODY", "body-roof":"ROOF",
    }

    tire_rows   = "\n".join(slider_row(p, short[p], "°C") for p in TIRES)
    spring_rows = "\n".join(slider_row(p, short[p], "%")  for p in SPRINGS)
    power_rows  = "\n".join(slider_row(p, short[p], "°C") for p in POWER) + "\n" + \
                  "\n".join(slider_row(p, short[p], "%")  for p in BODY)

    verify_buttons = "\n".join(
        f'        <button class="{("is-hidden" if p in HIDDEN else "")}" '
        f'onclick="highlight(\'{p}\', event)">{short[p]}{(" · oculto" if p in HIDDEN else "")}</button>'
        for p in ALL_PARTS
    )

    import json
    html = HTML_TEMPLATE.format(
        SVG_INLINE=svg_inline,
        VERIFY_BUTTONS=verify_buttons,
        TIRE_ROWS=tire_rows,
        SPRING_ROWS=spring_rows,
        POWER_ROWS=power_rows,
        HIDDEN_JSON=json.dumps(sorted(HIDDEN)),
        ALL_PARTS_JSON=json.dumps(ALL_PARTS),
        TIRES_JS=json.dumps(TIRES),
        SPRINGS_JS=json.dumps(SPRINGS),
    )

    OUT_HTML.write_text(html, encoding="utf-8")
    print(f"wrote {OUT_HTML}  ({OUT_HTML.stat().st_size/1024/1024:.2f} MB)")


if __name__ == "__main__":
    main()
