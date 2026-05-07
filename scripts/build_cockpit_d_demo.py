#!/usr/bin/env python3
"""Phase F v2 — versão COMPACTA do cockpit Direction D."""
from pathlib import Path

ROOT = Path("/home/user/p1-fast")
SRC_SVG = ROOT / "assets/command-box/premium-styles/direction-D-live.svg"
CELTA_PATHS = Path("/tmp/celta_vector_paths.txt")
OUT = ROOT / "_design-reference/celta-cockpit-D.html"

W, H = 520, 460
CAR_X, CAR_Y, CAR_W, CAR_H = 170, 110, 180, 260
CAR_CX = CAR_X + CAR_W // 2

# Wheel dots — at the actual wheel positions on a top-down Celta.
DOTS = {
    "FL": (CAR_X +  20, CAR_Y +  72),
    "FR": (CAR_X + 160, CAR_Y +  72),
    "RL": (CAR_X +  20, CAR_Y + 200),
    "RR": (CAR_X + 160, CAR_Y + 200),
}
# Câmbio = transaxle integrated with engine, slightly off-center on FWD.
GBOX_DOT = (CAR_X + CAR_W // 2 + 16, CAR_Y + 50)

# Callouts hug the car edges. Left callouts are RIGHT-aligned (text grows
# leftward, never enters car); right callouts LEFT-aligned (text grows
# rightward, never enters car).
CALLOUT = {
    "FL": (CAR_X - 14,         CAR_Y +  62),
    "FR": (CAR_X + CAR_W + 14, CAR_Y +  62),
    "RL": (CAR_X - 14,         CAR_Y + 190),
    "RR": (CAR_X + CAR_W + 14, CAR_Y + 190),
}
GBOX_LABEL = (CAR_X + CAR_W + 14, CAR_Y +  36)


def get_paths():
    if CELTA_PATHS.exists():
        return CELTA_PATHS.read_text()
    src = SRC_SVG.read_text()
    a = src.index('<svg x="200" y="88"')
    a = src.index(">", a) + 1
    b = src.index("</svg>", a)
    s = src[a:b].strip()
    CELTA_PATHS.write_text(s)
    return s


def wheel_block(c, dot, label, anchor, alarm=False):
    """Premium callout: hairline leader from wheel dot to text block.
    LEFT callouts are right-aligned (text-anchor=end); RIGHT are left-aligned.
    Value + suffix on same line via tspan so the rightmost glyph sits at lx.
    """
    dx, dy = dot
    lx, ly = label
    color = "#FFCC1A" if alarm else "#5DD18C"
    # text-anchor: text always extends AWAY from the car, never into it
    ta = 'end' if anchor == 'left' else 'start'
    halo_anim = ('<animate attributeName="r" values="6;9;6" dur="2.4s" repeatCount="indefinite"/>'
                 if alarm else '')
    label_suffix = ' · ATENÇÃO' if alarm else ''
    psi_default = {'FL':'28.4','FR':'28.5','RL':'29.1','RR':'29.0'}[c]
    temp_default = {'FL':'84','FR':'86','RL':'91','RR':'98'}[c]
    return f'''  <g>
    <circle id="halo-tire-{c}" cx="{dx}" cy="{dy}" r="6" fill="{color}" fill-opacity="0.18">{halo_anim}</circle>
    <circle id="dot-tire-{c}"  cx="{dx}" cy="{dy}" r="2.5" fill="{color}"/>
    <line x1="{dx}" y1="{dy}" x2="{lx}" y2="{dy}" stroke="{color}" stroke-width="0.6" stroke-opacity="0.5" stroke-linecap="round"/>
  </g>
  <g transform="translate({lx}, {ly})" text-anchor="{ta}" font-family="'JetBrains Mono', ui-monospace, monospace">
    <text font-family="Inter, sans-serif" font-size="8" font-weight="700" letter-spacing="1.6" fill="{color}">PNEU {c}{label_suffix}</text>
    <text y="18" font-size="17" font-weight="500" fill="#E8EBF0" letter-spacing="-0.3"><tspan id="v-tire-{c}-psi">{psi_default}</tspan><tspan font-size="8" fill="#6E7681" dx="3" letter-spacing="0">psi</tspan></text>
    <text id="t-tire-{c}-temp" y="32" font-size="11" fill="#E8EBF0" letter-spacing="-0.2"><tspan id="v-tire-{c}-temp">{temp_default}</tspan><tspan font-size="8" fill="#6E7681" dx="2" letter-spacing="0">°C</tspan></text>
  </g>
'''


def main():
    paths = get_paths()
    dx, dy = GBOX_DOT
    lx, ly = GBOX_LABEL

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet">
  <defs>
    <linearGradient id="tile" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="#171C25" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#10141B" stop-opacity="0.95"/>
    </linearGradient>
  </defs>
  <rect width="{W}" height="{H}" rx="3" ry="3" fill="url(#tile)" stroke="#1F252E" stroke-width="1"/>
  <g font-family="Inter, -apple-system, sans-serif">
    <text x="14" y="22" font-size="9" font-weight="700" letter-spacing="2" fill="#6E7681">CARRO · #16 · BRUNO M.</text>
    <text x="14" y="38" font-size="11" font-weight="500" fill="#E8EBF0">Telemetria sobreposta · top-down</text>
  </g>
  <g transform="translate({W-14}, 22)" text-anchor="end" font-family="'JetBrains Mono', ui-monospace, monospace">
    <text y="0" font-size="9" font-weight="500" fill="#5DD18C">TIER 1 · 12Hz · 184ms</text>
    <text y="14" font-size="8" fill="#6E7681">INJEPRO T4000 · BLE</text>
  </g>
  <g transform="translate(0, 56)" font-family="'JetBrains Mono', ui-monospace, monospace">
    <g transform="translate({W//2 - 90}, 0)">
      <text font-family="Inter, sans-serif" font-size="8" font-weight="700" letter-spacing="1.5" fill="#5DD18C">T.MOTOR</text>
      <text y="16" font-size="14" font-weight="500" fill="#E8EBF0"><tspan id="v-engine-temp">92</tspan><tspan font-size="9" fill="#6E7681" dx="2">°C</tspan></text>
    </g>
    <g transform="translate({W//2}, 0)" text-anchor="middle">
      <text font-family="Inter, sans-serif" font-size="8" font-weight="700" letter-spacing="1.5" fill="#5DD18C">T.ÓLEO</text>
      <text y="16" font-size="14" font-weight="500" fill="#E8EBF0"><tspan id="v-oil-temp">108</tspan><tspan font-size="9" fill="#6E7681" dx="2">°C</tspan></text>
    </g>
    <g transform="translate({W//2 + 90}, 0)" text-anchor="end">
      <text font-family="Inter, sans-serif" font-size="8" font-weight="700" letter-spacing="1.5" fill="#5DD18C">P.ÓLEO</text>
      <text y="16" font-size="14" font-weight="500" fill="#E8EBF0"><tspan id="v-oil-press">4.2</tspan><tspan font-size="9" fill="#6E7681" dx="2">bar</tspan></text>
    </g>
  </g>
  <line x1="{W//2}" y1="78" x2="{CAR_CX}" y2="{CAR_Y + 38}" stroke="#5DD18C" stroke-width="0.6" stroke-opacity="0.4" stroke-linecap="round"/>

  <svg x="{CAR_X}" y="{CAR_Y}" width="{CAR_W}" height="{CAR_H}" viewBox="0 0 2048 2048" preserveAspectRatio="xMidYMid meet">
    {paths}
  </svg>

'''
    svg += wheel_block('FL', DOTS['FL'], CALLOUT['FL'], 'left')
    svg += wheel_block('FR', DOTS['FR'], CALLOUT['FR'], 'right')
    svg += wheel_block('RL', DOTS['RL'], CALLOUT['RL'], 'left')
    svg += wheel_block('RR', DOTS['RR'], CALLOUT['RR'], 'right', alarm=True)
    svg += f'''  <g>
    <circle id="halo-gearbox" cx="{dx}" cy="{dy}" r="5" fill="#FFCC1A" fill-opacity="0.25"/>
    <circle id="dot-gearbox"  cx="{dx}" cy="{dy}" r="2.5" fill="#FFCC1A"/>
    <line x1="{dx}" y1="{dy}" x2="{lx-2}" y2="{dy}" stroke="#FFCC1A" stroke-width="0.6" stroke-opacity="0.55"/>
    <line x1="{lx-2}" y1="{dy}" x2="{lx-2}" y2="{ly-12}" stroke="#FFCC1A" stroke-width="0.6" stroke-opacity="0.55"/>
  </g>
  <g transform="translate({lx}, {ly})" font-family="'JetBrains Mono', ui-monospace, monospace">
    <text font-family="Inter, sans-serif" font-size="8" font-weight="700" letter-spacing="1.5" fill="#FFCC1A">T.CÂMBIO</text>
    <text y="14" font-size="13" font-weight="500" fill="#E8EBF0"><tspan id="v-gearbox-temp">78</tspan><tspan font-size="9" fill="#6E7681" dx="2">°C</tspan></text>
  </g>
  <line x1="14" y1="{H-50}" x2="{W-14}" y2="{H-50}" stroke="#1F252E" stroke-width="1"/>
  <g transform="translate(14, {H-22})" font-family="'JetBrains Mono', ui-monospace, monospace">
    <text font-family="Inter, sans-serif" font-size="8" font-weight="700" letter-spacing="2" fill="#FFCC1A" y="0">TANQUE</text>
    <rect x="50" y="-10" width="140" height="12" fill="none" stroke="#2A3140" stroke-width="1"/>
    <rect x="50" y="-10" width="63" height="12" fill="#FFCC1A" fill-opacity="0.85" id="v-tank-bar"/>
    <text x="200" y="0" font-size="13" font-weight="500" fill="#E8EBF0"><tspan id="v-tank-pct">45</tspan><tspan font-size="9" fill="#6E7681">%</tspan></text>
    <text x="234" y="0" font-size="9" fill="#6E7681">~21L · ~12 voltas</text>
  </g>
  <g transform="translate({W-14}, {H-22})" text-anchor="end" font-family="'JetBrains Mono', ui-monospace, monospace">
    <text font-family="Inter, sans-serif" font-size="8" font-weight="700" letter-spacing="2" fill="#6E7681" y="-12">Δ TEAM BEST</text>
    <text id="t-delta" y="0" font-size="16" font-weight="600" fill="#FF5A1F">+0.42<tspan font-size="9" fill="#6E7681" dx="3">s</tspan>
      <animate attributeName="fill-opacity" values="1;0.6;1" dur="2.4s" repeatCount="indefinite"/>
    </text>
  </g>
</svg>
'''
    # Read HTML template from existing file
    template_html = '''<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<title>Celta · Cockpit Direction D · Compact</title>
<style>
:root{--bg:#0F1216;--tile:#171C25;--border:#1F252E;--text:#E8EBF0;--text-dim:#6E7681;--accent:#FFCC1A}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:Inter,system-ui,sans-serif;min-height:100vh;padding:24px;display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:24px}
.header{grid-column:1/-1;display:flex;justify-content:space-between;align-items:baseline;padding-bottom:14px;border-bottom:1px solid var(--border)}
.header h1{font-size:17px;font-weight:500} .header h1 span{color:var(--accent)}
.header .meta{color:var(--text-dim);font-size:11px;letter-spacing:1.5px;text-transform:uppercase}
.stage{background:linear-gradient(160deg,#12161D 0%,#0A0D12 100%);border:1px solid var(--border);border-radius:4px;padding:18px;display:flex;align-items:center;justify-content:center;min-height:600px;position:sticky;top:24px}
.stage svg{max-width:100%;max-height:720px}
.stage svg circle,.stage svg [id^="v-tire"],.stage svg [id^="t-tire"]{transition:fill 280ms ease}
.controls{display:flex;flex-direction:column;gap:12px}
.group{background:var(--tile);border:1px solid var(--border);border-radius:4px;padding:12px 14px}
.group h2{font-size:10px;font-weight:700;letter-spacing:2px;color:var(--accent);text-transform:uppercase;margin-bottom:8px}
.row{display:grid;grid-template-columns:90px 1fr 60px;align-items:center;gap:10px;margin:8px 0;font-size:11px}
.row .lbl{font-weight:500} .row .val{font-family:'JetBrains Mono',monospace;text-align:right;font-weight:600;font-size:11px}
.row input[type=range]{width:100%;-webkit-appearance:none;appearance:none;height:4px;border-radius:2px;background:linear-gradient(to right,#1B5BFF 0%,#5DD18C 35%,#FFCC1A 65%,#FF5A1F 100%)}
.row input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:#fff;cursor:pointer;border:2px solid #0F1216}
.presets button{background:transparent;color:var(--text);border:1px solid var(--border);padding:6px 10px;font-family:inherit;font-size:11px;cursor:pointer;width:100%;margin-bottom:4px;text-align:left}
.presets button:hover{border-color:var(--accent);color:var(--accent)}
</style></head><body>
<div class="header"><h1>Celta · <span>Cockpit · Direction D · Compact</span></h1><div class="meta">P1 FAST · TILE 520x460 · LEADERS CURTOS</div></div>
<div class="stage">__SVG__</div>
<div class="controls">
<div class="group"><h2>Powertrain</h2>
<div class="row"><span class="lbl">T.MOTOR</span><input type="range" id="s-engine-temp" min="60" max="120" value="92"><span class="val" id="d-engine-temp">--</span></div>
<div class="row"><span class="lbl">T.ÓLEO</span><input type="range" id="s-oil-temp" min="60" max="150" value="108"><span class="val" id="d-oil-temp">--</span></div>
<div class="row"><span class="lbl">P.ÓLEO</span><input type="range" id="s-oil-press" min="0" max="10" step="0.1" value="4.2"><span class="val" id="d-oil-press">--</span></div>
<div class="row"><span class="lbl">T.CÂMBIO</span><input type="range" id="s-gearbox-temp" min="40" max="120" value="78"><span class="val" id="d-gearbox-temp">--</span></div>
</div>
<div class="group"><h2>Pneus · pressão (psi)</h2>
<div class="row"><span class="lbl">FL</span><input type="range" id="s-tire-FL-psi" min="20" max="40" step="0.1" value="28.4"><span class="val" id="d-tire-FL-psi">--</span></div>
<div class="row"><span class="lbl">FR</span><input type="range" id="s-tire-FR-psi" min="20" max="40" step="0.1" value="28.5"><span class="val" id="d-tire-FR-psi">--</span></div>
<div class="row"><span class="lbl">RL</span><input type="range" id="s-tire-RL-psi" min="20" max="40" step="0.1" value="29.1"><span class="val" id="d-tire-RL-psi">--</span></div>
<div class="row"><span class="lbl">RR</span><input type="range" id="s-tire-RR-psi" min="20" max="40" step="0.1" value="29.0"><span class="val" id="d-tire-RR-psi">--</span></div>
</div>
<div class="group"><h2>Pneus · temperatura (°C)</h2>
<div class="row"><span class="lbl">FL</span><input type="range" id="s-tire-FL-temp" min="50" max="130" value="84"><span class="val" id="d-tire-FL-temp">--</span></div>
<div class="row"><span class="lbl">FR</span><input type="range" id="s-tire-FR-temp" min="50" max="130" value="86"><span class="val" id="d-tire-FR-temp">--</span></div>
<div class="row"><span class="lbl">RL</span><input type="range" id="s-tire-RL-temp" min="50" max="130" value="91"><span class="val" id="d-tire-RL-temp">--</span></div>
<div class="row"><span class="lbl">RR</span><input type="range" id="s-tire-RR-temp" min="50" max="130" value="98"><span class="val" id="d-tire-RR-temp">--</span></div>
</div>
<div class="group"><h2>Combustível</h2>
<div class="row"><span class="lbl">TANQUE</span><input type="range" id="s-tank" min="0" max="100" value="45"><span class="val" id="d-tank">--</span></div>
</div>
<div class="group presets"><h2>Cenários rápidos</h2>
<button onclick="preset('start')">Início de stint · tudo verde</button>
<button onclick="preset('rr-warn')">Pneu RR atenção</button>
<button onclick="preset('engine-hot')">Motor superaquecendo</button>
<button onclick="preset('low-fuel')">Tanque baixando</button>
<button onclick="preset('all-clear')">Tudo na janela ideal</button>
</div></div>
<script>
const COLOR={ok:'#5DD18C',warn:'#FFCC1A',crit:'#FF5A1F'};
const cls=(v,a,b)=>v<a?'ok':v<b?'warn':'crit';
const clsGbox=c=>cls(c,90,105);
const clsTirePsi=p=>{const d=Math.abs(p-29.0);return d<1.5?'ok':d<3.0?'warn':'crit'};
const clsTireTemp=c=>cls(c,95,110);
const worst=(...xs)=>{const r=['ok','warn','crit'];return r[Math.max(...xs.map(x=>r.indexOf(x)))]};
const $=id=>document.getElementById(id);
const setText=(id,v)=>{const e=$(id);if(e)e.textContent=v};
const setFill=(id,h)=>{const e=$(id);if(e)e.setAttribute('fill',h)};
function tickAll(){
  const t=+$('s-engine-temp').value,o=+$('s-oil-temp').value,p=parseFloat($('s-oil-press').value),g=+$('s-gearbox-temp').value;
  setText('v-engine-temp',t);setText('d-engine-temp',t+'°C');
  setText('v-oil-temp',o);setText('d-oil-temp',o+'°C');
  setText('v-oil-press',p.toFixed(1));setText('d-oil-press',p.toFixed(1)+' bar');
  setText('v-gearbox-temp',g);setText('d-gearbox-temp',g+'°C');
  const gh=COLOR[clsGbox(g)];setFill('dot-gearbox',gh);setFill('halo-gearbox',gh);
  ['FL','FR','RL','RR'].forEach(c=>{
    const psi=parseFloat($('s-tire-'+c+'-psi').value),temp=+$('s-tire-'+c+'-temp').value;
    setText('v-tire-'+c+'-psi',psi.toFixed(1));setText('d-tire-'+c+'-psi',psi.toFixed(1)+' psi');
    setText('v-tire-'+c+'-temp',temp);setText('d-tire-'+c+'-temp',temp+'°C');
    const h=COLOR[worst(clsTirePsi(psi),clsTireTemp(temp))];
    setFill('dot-tire-'+c,h);setFill('halo-tire-'+c,h);
    setFill('v-tire-'+c+'-psi',h);setFill('t-tire-'+c+'-temp',h);
  });
  const v=+$('s-tank').value;setText('v-tank-pct',v);setText('d-tank',v+'%');
  const bar=$('v-tank-bar');if(bar)bar.setAttribute('width',(v/100*140).toFixed(1));
}
document.querySelectorAll('input[type=range]').forEach(s=>s.addEventListener('input',tickAll));tickAll();
function preset(name){
  const P={
    start:{'engine-temp':78,'oil-temp':88,'oil-press':4.5,'gearbox-temp':72,'tire-FL-psi':29,'tire-FR-psi':29,'tire-RL-psi':29,'tire-RR-psi':29,'tire-FL-temp':65,'tire-FR-temp':65,'tire-RL-temp':65,'tire-RR-temp':65,tank:95},
    'rr-warn':{'engine-temp':92,'oil-temp':108,'oil-press':4.2,'gearbox-temp':78,'tire-FL-psi':28.4,'tire-FR-psi':28.5,'tire-RL-psi':29.1,'tire-RR-psi':29.0,'tire-FL-temp':84,'tire-FR-temp':86,'tire-RL-temp':91,'tire-RR-temp':98,tank:45},
    'engine-hot':{'engine-temp':113,'oil-temp':128,'oil-press':3.4,'gearbox-temp':96,'tire-FL-psi':29.8,'tire-FR-psi':29.8,'tire-RL-psi':30.2,'tire-RR-psi':30.0,'tire-FL-temp':92,'tire-FR-temp':95,'tire-RL-temp':96,'tire-RR-temp':102,tank:30},
    'low-fuel':{'engine-temp':95,'oil-temp':110,'oil-press':4.0,'gearbox-temp':82,'tire-FL-psi':29.4,'tire-FR-psi':29.4,'tire-RL-psi':29.6,'tire-RR-psi':29.5,'tire-FL-temp':88,'tire-FR-temp':89,'tire-RL-temp':92,'tire-RR-temp':94,tank:8},
    'all-clear':{'engine-temp':88,'oil-temp':100,'oil-press':4.5,'gearbox-temp':80,'tire-FL-psi':29,'tire-FR-psi':29,'tire-RL-psi':29,'tire-RR-psi':29,'tire-FL-temp':80,'tire-FR-temp':80,'tire-RL-temp':82,'tire-RR-temp':82,tank:70},
  };
  const v=P[name];if(!v)return;
  Object.entries(v).forEach(([k,x])=>{const s=$('s-'+k);if(s)s.value=x});tickAll();
}
</script></body></html>
'''
    OUT.write_text(template_html.replace('__SVG__', svg), encoding='utf-8')
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size//1024} KB)")

main()
