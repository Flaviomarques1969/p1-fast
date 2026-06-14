// Gera o manual diagramado pra impressão (A4) a partir dos capítulos redigidos e auditados.
// Uso: node gerar-manual.mjs <capitulos.json> <saida.html>
import fs from 'node:fs'

const [, , entrada, saida] = process.argv
const { capitulos, qa } = JSON.parse(fs.readFileSync(entrada, 'utf8'))

// Correção aplicada por determinação do auditor final (contradição do cap. 12 com o método do manual)
const c12 = capitulos.find(c => c.numero === 12)
c12.execucao = c12.execucao.map(p =>
  p.includes('o ápice é onde o esterço chega ao máximo')
    ? 'Passe pela Vmin (a velocidade mínima da curva) com o trabalho de virar já feito; o esterço máximo acontece na fase de entrada, antes do ápice — no ápice o volante já está quase reto e abrindo, e continua a desvirar na saída antes de acelerar.'
    : p
)

const PARTES = [
  { nome: 'Parte I — Fundamentos Físicos', desc: 'O orçamento de aderência do pneu e a balança de peso do carro. Tudo que vem depois é aplicação destes dois capítulos.', caps: [1, 2] },
  { nome: 'Parte II — Frenagem', desc: 'Onde o carro de tração dianteira ganha tempo e constrói a curva. Da freada bruta em reta à soltura fina que gira o carro.', caps: [3, 4, 5, 6, 7] },
  { nome: 'Parte III — Curva e Rotação', desc: 'Apontar o carro pra saída antes do ápice. A assinatura da pilotagem rápida em tração dianteira.', caps: [8, 9, 10, 11, 12] },
  { nome: 'Parte IV — Aceleração e Tração', desc: 'A disciplina do pé direito: uma aplicação só, no momento certo — e o reflexo que salva o carro quando a traseira escapa.', caps: [13, 14, 15] },
  { nome: 'Parte V — Gestão de Pneus', desc: 'Os pneus dianteiros fazem todo o trabalho. Quem os preserva no começo da prova tem carro no fim.', caps: [16, 17] },
  { nome: 'Parte VI — Corpo a Corpo', desc: 'Ultrapassar, defender e dividir curva. A corrida que acontece quando há outro carro na foto.', caps: [18, 19, 20] },
]

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const li = arr => arr.map(x => `<li>${esc(x)}</li>`).join('\n')

const badge = st => st === 'auditada'
  ? '<span class="badge b-aud">Auditada 3&times;0 na pesquisa</span>'
  : '<span class="badge b-exp">Consenso de escola de pilotagem</span>'

const capHtml = c => `
<article class="chapter">
  <div class="ch-head">
    <div class="ch-num">${String(c.numero).padStart(2, '0')}</div>
    <div>
      <h3>${esc(c.titulo)}</h3>
      <div class="ch-en">${esc(c.ingles)} &middot; ${badge(c.status)}</div>
    </div>
  </div>

  <p class="def">${esc(c.definicao)}</p>

  <div class="box fwd"><h4>Por que importa na tração dianteira</h4><p>${esc(c.porque_fwd)}</p></div>

  <div class="box"><h4>Execução na pista</h4><ol>${li(c.execucao)}</ol></div>

  <div class="box"><h4>Erros comuns</h4><ul>${li(c.erros)}</ul></div>

  <div class="box"><h4>Como treinar</h4><ul>${li(c.treino)}</ul></div>

  <div class="sinais">
    <div class="s-certo"><h4>Está certo quando</h4><p>${esc(c.sinais.certo)}</p></div>
    <div class="s-errado"><h4>Está errado quando</h4><p>${esc(c.sinais.errado)}</p></div>
  </div>

  ${c.aviso ? `<div class="box aviso"><h4>Atenção</h4><p>${esc(c.aviso)}</p></div>` : ''}
</article>`

const partesHtml = PARTES.map(p => `
<section class="part">
  <div class="part-inner">
    <h2>${esc(p.nome)}</h2>
    <p>${esc(p.desc)}</p>
  </div>
</section>
${p.caps.map(n => capHtml(capitulos.find(c => c.numero === n))).join('\n')}`).join('\n')

const sumario = PARTES.map(p => `
  <div class="sum-parte">${esc(p.nome)}</div>
  ${p.caps.map(n => { const c = capitulos.find(k => k.numero === n); return `<div class="sum-cap"><span class="sum-n">${String(c.numero).padStart(2, '0')}</span> ${esc(c.titulo)} <span class="sum-en">${esc(c.ingles)}</span></div>` }).join('\n')}`).join('\n')

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Manual de Pilotagem — Turismo Tração Dianteira</title>
<style>
  @page { size: A4; margin: 17mm 16mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1c2330; font-size: 11.5pt; line-height: 1.5; }

  .cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; border-left: 4mm solid #b08a2e; padding-left: 14mm; }
  .cover .kicker { text-transform: uppercase; letter-spacing: 3px; font-size: 10pt; color: #b08a2e; font-weight: 700; }
  .cover h1 { font-size: 34pt; line-height: 1.15; margin: 8mm 0 6mm; letter-spacing: -.5pt; }
  .cover .sub { font-size: 13pt; color: #4a5568; max-width: 130mm; }
  .cover .meta { margin-top: 16mm; font-size: 9.5pt; color: #718096; text-transform: uppercase; letter-spacing: 1.5px; line-height: 2; }

  .page { page-break-before: always; }
  h2.sec { font-size: 13pt; text-transform: uppercase; letter-spacing: 2.5px; color: #b08a2e; border-bottom: 1.5pt solid #1c2330; padding-bottom: 3mm; margin-bottom: 7mm; }

  .intro p { margin-bottom: 4mm; }
  .regra-mae { border: 1.5pt solid #1c2330; border-left: 4mm solid #b08a2e; padding: 5mm 6mm; margin: 6mm 0; }
  .regra-mae b { color: #8a6a1e; }
  .leg { font-size: 10pt; color: #4a5568; margin-top: 5mm; }

  .sum-parte { font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; font-size: 10pt; color: #8a6a1e; margin: 6mm 0 2mm; }
  .sum-cap { padding: 1.2mm 0; border-bottom: .5pt dotted #cbd5e0; font-size: 11pt; }
  .sum-n { display: inline-block; width: 9mm; font-weight: 700; color: #b08a2e; }
  .sum-en { color: #718096; font-style: italic; font-size: 9.5pt; }

  .part { page-break-before: always; height: 250mm; display: flex; align-items: center; }
  .part-inner { border-left: 4mm solid #b08a2e; padding-left: 12mm; }
  .part h2 { font-size: 24pt; letter-spacing: -.3pt; margin-bottom: 5mm; }
  .part p { font-size: 12.5pt; color: #4a5568; max-width: 125mm; }

  .chapter { page-break-before: always; }
  .ch-head { display: flex; gap: 6mm; align-items: flex-start; border-bottom: 2pt solid #1c2330; padding-bottom: 4mm; margin-bottom: 5mm; }
  .ch-num { font-size: 30pt; font-weight: 800; color: #b08a2e; line-height: 1; }
  .ch-head h3 { font-size: 18pt; line-height: 1.2; }
  .ch-en { color: #718096; font-style: italic; font-size: 10pt; margin-top: 1.5mm; }
  .badge { font-style: normal; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; padding: .8mm 3mm; border-radius: 8mm; font-weight: 700; vertical-align: middle; }
  .b-aud { border: 1pt solid #2f855a; color: #2f855a; }
  .b-exp { border: 1pt solid #2b6cb0; color: #2b6cb0; }

  .def { font-size: 12pt; margin-bottom: 5mm; }
  .box { margin-bottom: 4.5mm; break-inside: avoid; }
  .box h4 { font-size: 9.5pt; text-transform: uppercase; letter-spacing: 1.8px; color: #8a6a1e; margin-bottom: 2mm; }
  .box ol, .box ul { padding-left: 6mm; }
  .box li { margin-bottom: 1.6mm; }
  .box.fwd { background: #f7f3e8; border-left: 3pt solid #b08a2e; padding: 4mm 5mm; }
  .box.fwd h4 { color: #8a6a1e; }
  .box.aviso { border: 1.5pt solid #c53030; padding: 4mm 5mm; }
  .box.aviso h4 { color: #c53030; }

  .sinais { display: flex; gap: 5mm; margin-bottom: 4.5mm; break-inside: avoid; }
  .sinais > div { flex: 1; padding: 4mm 5mm; }
  .s-certo { background: #ecf5ee; border-left: 3pt solid #2f855a; }
  .s-certo h4 { color: #2f855a; }
  .s-errado { background: #fbeeee; border-left: 3pt solid #c53030; }
  .s-errado h4 { color: #c53030; }
  .sinais h4 { font-size: 9.5pt; text-transform: uppercase; letter-spacing: 1.8px; margin-bottom: 2mm; }
  .sinais p { font-size: 10.5pt; }

  .fontes ol { padding-left: 6mm; font-size: 10pt; color: #4a5568; }
  .fontes li { margin-bottom: 1.5mm; word-break: break-all; }
  .metodo p { font-size: 10.5pt; color: #4a5568; margin-bottom: 3mm; }
</style>
</head>
<body>

<div class="cover">
  <div class="kicker">Manual do Piloto</div>
  <h1>Pilotagem de Carros de Turismo de Tração Dianteira</h1>
  <div class="sub">As 20 técnicas que o piloto precisa dominar — o que é cada uma, como executar na pista, os erros que custam tempo e os exercícios pra treinar. Escrito pra realidade de um turismo de tração dianteira com câmbio manual.</div>
  <div class="meta">Edição 1 &middot; Junho de 2026<br>Baseado em pesquisa com 18 fontes e auditoria independente de cada afirmação central<br>20 capítulos &middot; 6 partes</div>
</div>

<div class="page intro">
  <h2 class="sec">Como usar este manual</h2>
  <div class="regra-mae"><b>A regra-mãe da tração dianteira:</b> os pneus da frente fazem três trabalhos ao mesmo tempo — frear, virar e acelerar — enquanto a traseira anda leve, quase de carona. Todas as 20 técnicas deste manual existem pra administrar essa sobrecarga: ou tirando trabalho dos pneus da frente, ou usando a traseira leve a favor do piloto.</div>
  <p>Cada capítulo tem a mesma estrutura: <b>o que é</b> a técnica, <b>por que importa</b> na tração dianteira, <b>execução</b> passo a passo na ordem real dentro da curva, <b>erros comuns</b> com a consequência de cada um, <b>como treinar</b> com critério observável de evolução, e os <b>sinais no banco</b> — como você percebe, pilotando, que está certo ou errado.</p>
  <p>A ordem das partes é a ordem de aprendizado: fundamentos físicos primeiro, depois frenagem, rotação, aceleração, gestão de pneus e, por último, corpo a corpo. As técnicas das partes II e III se constroem umas sobre as outras — trail braking alimenta a soltura do freio, que alimenta a rotação antes do ápice, que culmina no estilo "jogar e segurar".</p>
  <p class="leg"><b>Etiquetas de confiança:</b> "Auditada 3&times;0 na pesquisa" = a técnica foi confirmada por três verificadores independentes contra fontes de pilotos profissionais e escolas de pilotagem. "Consenso de escola de pilotagem" = técnica consagrada no ensino de competição, vinda das mesmas fontes, sem a rodada formal de verificação tripla.</p>
</div>

<div class="page">
  <h2 class="sec">Sumário</h2>
  ${sumario}
</div>

${partesHtml}

<div class="page metodo fontes">
  <h2 class="sec">Método e fontes</h2>
  <p><b>Como este manual foi produzido:</b> a pergunta ("quais técnicas o piloto de turismo de tração dianteira precisa dominar?") foi decomposta em 5 ângulos de busca; 18 fontes foram lidas na íntegra; 88 afirmações técnicas foram extraídas e as 25 centrais passaram por auditoria adversarial — cada uma atacada por 3 verificadores independentes instruídos a refutá-la. 20 afirmações sobreviveram (3&times;0) e 5 foram derrubadas, entre elas "frear com o pé esquerdo é sempre mais rápido" e "tração dianteira não subesterça por natureza, é só acerto de carro". Os 20 capítulos foram então redigidos individualmente, revisados um a um por revisor técnico e submetidos a uma auditoria final de consistência do conjunto — que apontou uma contradição no capítulo 12, corrigida nesta edição.</p>
  <p><b>O que ficou de fora de propósito:</b> técnicas exclusivas de tração traseira que não se aplicam — girar a traseira com o acelerador (sobre-esterço de potência, base do drift) e o reflexo de correção "aliviar e contraesterçar", que na tração dianteira agrava o escorregão (ver capítulo 14).</p>
  <h2 class="sec" style="margin-top:8mm">Fontes principais</h2>
  <ol>
    <li>Speed Secrets (Ross Bentley) — speedsecrets.com/q-how-should-i-adapt-my-driving-to-a-front-wheel-drive-car</li>
    <li>Speed Secrets / Winding Road — windingroad.com/articles/features/speed-secrets-fwd-vs-rwd</li>
    <li>Grassroots Motorsports — conselhos de piloto profissional para FWD — grassrootsmotorsports.com/articles/make-your-front-wheel-drive-car-faster-advice-pro-</li>
    <li>Randy Pobst sobre subesterço em FWD — grassrootsmotorsports.com/articles/randy-pobst-front-wheel-drive-understeer</li>
    <li>Driver61 — freio com pé esquerdo — driver61.com/uni/left-foot-braking</li>
    <li>Driver61 — pilotando carros FWD — driver61.com/sim-racing/sim-fwd-cars</li>
    <li>The Physics of Racing — círculo de tração — miata.net/sport/Physics/07-Circle.html</li>
    <li>NASA Speed News — gestão de pneus de corrida — nasaspeed.news/tech/suspension/tire-management</li>
    <li>Blayze — corpo a corpo avançado — blayze.io/blog/car-racing/racecraft-201-advanced-wheel-to-wheel-racing</li>
    <li>Blayze — defesa de posição — blayze.io/blog/car-racing/defend-your-position-on-track</li>
  </ol>
</div>

</body>
</html>`

fs.writeFileSync(saida, html)
console.log('OK:', saida, html.length, 'caracteres', '| capitulos:', capitulos.length, '| problemas de auditoria aplicados:', qa.problemas.length)
