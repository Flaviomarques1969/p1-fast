# E2b — mapa dos blocos da TV × GPS (27/10/2026, agente só leitura; H = _design-reference/mockup-command-box-vista-piloto.html)

Pedido do Flávio (27/10 ~17h20): "trail braking, freio, aceleração, tempo de volta, quantidade de voltas, comparativos de gráfico
de frenagem e aceleração, etc. tudo dá para ver no tv box a partir do gps."

## Achado central
NENHUM bloco coberto recebe o GPS ao vivo. frenagem/passagem/vmin/coach = contas reais sobre a GRAVAÇÃO DE MAIO
(passagens-bubi-brasilia.v1.json, GPS ~1 Hz); a posição ao vivo só escolhe a curva. carro/pneus/fuel/delta-acum/stint-bar/checklist
= FAKE_LAPS ou listas fixas. cerebro-gps-tv já tem voltas, tempos, setores, trechos (entrada/mín/saída), melhores, consistência —
só desenhado dentro do bloco mapa (camada TV-GPS H:8360-8652).

## Peças
- cerebro-gps-tv.js: criarCerebroGpsTv(opts){feedGps,snapshot}; aceita o ponto da ponte (264-290); `guardarVoltas` (152) guarda perfil
  {t,p,d,kmh,x,y,gl,ga,z} por ponto (319-321; SEM lat/lng, distância em `d`). snapshot: voltas[], voltaAtual{n,decorridoS,trechoAtual,setoresS},
  ultimaVolta.trechos[i]{tempoS,kmhEntrada,kmhMin,minX,minY,kmhSaida} (237-242), trechos.melhoresS / perdasUltima (415-434),
  melhorVolta, deltaUltimaS (427-430), consistencia, pancadas, trocas (449-454), traseira.
- frenagem-real.js frenagemFrxParaPassagem({pontos,refPontos}) → {live[18],ref[18],minimaFreando,soltou,freioMin,fonteFreio:'simulado-fisica',deltaM};
  usa freio-trecho.js simularFreioPelaFisica (v² pela distância, NÃO usa gLong) e metricasTrail (150-178). Espera pontos {lat,lng,kmh} ou distM.
- passagem-real.js passagemRealParaCorner(passagem,ref) (forma do pacote "corner"; barra ±1 m = null fixo :149).
- vmin-curvas-reais.js construirVminRealPorCurva → {live,ghost,vminKmh,vminConfiavel,label,tone,delta}; exige tipo_pneu.
- cerebro-coach.js avaliarCoach(passagens,ordemCurvas) (passagens com pontos[{kmh}]); vFreada/vPace null (:41-42).
- cerebro-vivo.js criarOrquestradorVivo().feedSample(gps) aceita GPS (fix≥3, acc<50) mas NÃO aplica pontoGpsAceito.
- cerebro-pagina-volta.js compararVoltas(va,vb) → serie km/h + trechos + setores; NÃO alinha G (gl/ga) de duas voltas.

## Bloco a bloco
| bloco | do GPS? | o que liga | o que fica "—"/coberto |
|---|---|---|---|
| passagem | SIM | entrada/mín/saída por trecho da última volta × melhor passagem do trecho, Δ s | barra ±1 m do ápice (nenhuma casa) |
| frenagem | SIM | G longitudinal MEDIDO (gl do perfil) da volta × melhor: ponto de freada (m), pico, freio residual na mínima (trail), soltou progressivo/degrau; aceleração na saída | — |
| vmin | SIM | série km/h × distância do trecho (perfil) × melhor; número kmhMin | tipo de pneu (config) |
| stint | PARCIAL | volta N, tempos, decorrido, ritmo/melhor do stint | total/duração do plano, stint nº, PB histórico, alvo (app) |
| stint-bar | PARCIAL | voltas feitas + tempo + melhor do stint | plano (voltas, box), PB histórico |
| delta-acum | PARCIAL | Δ por volta × melhor da sessão | "vs PB all-time"; delta AO VIVO dentro da volta (nenhuma casa) |
| coach | PARCIAL | lição pelos km/h (+ freada/saída pelo gl) | nota, progresso, preditivo de temperatura |
| carro, pneus, fuel-gauge, shift-light, checklist | NÃO | — | cobertos (motor/sensor/app) |
| video | E3 | — | — |

Achados extras: stint ao vivo nunca liga só com RaceBox (`ultimoLive` só renova por onSample/onEvento, H:8212-8219);
curva "atual" calculada NA TELA (getCornerPhase H:6716 com CURVES fixas) embora o cérebro dê voltaAtual.trechoAtual (413);
NÃO verificado: se "curva N" da tela (CURVES H:6367) = trecho N do cérebro (trechos-brasilia.js).

## Desenho da E2b (decisão técnica minha)
1. Casa NOVA pura `web/command-box/cerebro/cerebro-tv-blocos-gps.js`: entra o snapshot do cerebro-gps-tv (com guardarVoltas) →
   sai pacote por bloco {stint, stintBar, deltaAcum, passagem[trecho], frenagem[trecho], vmin[trecho], coach}. Frenagem pelo gl MEDIDO
   (não pela física de 1 Hz). Registrar em docs/CONTRATO_DADOS.md + trava de arquitetura.
2. TV: um cerebro-gps-tv só (o da camada TV-GPS, guardarVoltas ligado) alimenta a casa nova; DO_RACEBOX ganha passagem, frenagem,
   vmin, stint, stint-bar, delta-acum, coach; campos sem fonte = "—"; curva mostrada = trechoAtual do cérebro; massa de maio e
   FAKE_LAPS desligados no modo TV.
3. Catraca tests/node-smoke-tv-blocos-gps.mjs (gravação real 21/06 → voltas/trechos/frenagem; controles) + prova Chrome com lote.
