# PROPOSTA v1 — Classificador de trecho + tipo de trail braking proposto
Data: 2026-06-12 · Autor: Claude (rodada 18 do ditado do cockpit-treino) · STATUS: EM AUDITORIA

Pergunta do Flávio: "como você vai classificar o trecho e propor o melhor tipo de trail
braking para ele?"

## Princípio inegociável (decisão já tomada, não reabrir)
O ALVO do treino continua sendo a CURVA REAL DA MELHOR PASSAGEM daquele trecho
(carro + configuração) — a régua canônica. O classificador NÃO substitui a régua.
Ele existe para três usos:
(a) BOOTSTRAP — propor um formato-alvo teórico enquanto o trecho ainda não tem melhor
    passagem confiável (período de calibração, 2 primeiras passagens);
(b) PEDAGOGIA — nomear o erro com o vocabulário do TIPO da curva;
(c) COERÊNCIA — alertar quando o formato da melhor passagem real diverge do tipo da
    curva (sinal de que o teto atual ainda é baixo; a IA sugere foco, nunca impõe).

## Insumos REAIS por trecho (cada um com a fonte verificada)
1. GEOMETRIA — trajeto canônico de Brasília (920 pontos GPS limpos, arquivo
   `_design-reference/TRAJETO-LIMPO-BRASILIA-FLAVIO-2026-05-27.json`) + as 8 curvas
   aprovadas com linhas de entrada/saída (`PONTOS-TRECHOS-BRASILIA-2026-05-28.json` e
   banco `track_segments`). Disso se CALCULA (matemática sobre os pontos, sem sensor
   novo): raio ponto a ponto (círculo por 3 pontos espaçados + suavização), raio
   mínimo, perfil do raio (decrescente/constante/crescente), ângulo total, comprimento,
   e o que vem depois do trecho (reta longa ou curva encadeada).
2. DINÂMICA REAL — telemetria por passagem já capturada hoje: velocidade de entrada,
   Vmin, velocidade de saída; distância do início da freada desde a linha de entrada
   (evento `freada-iniciou` com `distFromEntradaM`, código real em
   `web/cockpit/trecho-detector.js:281-287`); perfil de freio % estimado pela FÍSICA DO
   GPS (desaceleração → %), módulo `freio-trecho.js` (29 testes verdes, no ambiente
   isolado revisao-treino-freio) — SEMPRE rotulado como estimativa até o sensor chegar.
3. SENSOR DE PRESSÃO DE FREIO — instala segunda/terça 15-16/06. O decodificador já lê:
   pedal de freio % e pressão em bar (`t3000-usb-parser.js` — pedal offset 54,
   pressão offset 268 ÷100 → bar). Quando ligar, o perfil de freio vira MEDIDA.
4. TEORIA — manual de pilotagem FWD com 20 técnicas (PDF real em
   `docs/research/tecnicas-pilotagem-fwd-touring-2026-06-10/`) — fonte dos formatos
   teóricos por tipo de curva.

## Classificação proposta (4 tipos)
Variáveis: R_min (raio mínimo), perfil do raio, razão Ve/Vmin (entrada ÷ mínima),
contexto de saída (reta ou curva).

- T1 — LENTA PÓS-RETA (grampo/freada pesada): Ve/Vmin alta + raio mínimo pequeno +
  reta antes. Trail proposto: 100% na pancada inicial, soltura GRADATIVA profunda até
  o ápice (o freio gira o carro — rotação na entrada).
- T2 — MÉDIA DE RAIO DECRESCENTE: o raio APERTA ao longo da curva. Trail proposto:
  pancada PARCIAL (60-75%) + RESIDUAL CONSTANTE (35-50%) até o ponto de raio mínimo,
  soltura curta no fim. (É o formato do 5º cenário do mockup.)
- T3 — RÁPIDA: Ve/Vmin baixa + raio grande. Trail proposto: toque curto (≤40%) ou só
  alívio do acelerador, residual leve e curto — objetivo é assentar a dianteira, não
  reduzir.
- T4 — ENCADEADA (saída do trecho é entrada de outra curva): trail orientado a
  POSICIONAMENTO — residual mantido até a troca de direção; a prioridade não é a
  velocidade de saída deste trecho, é a entrada do próximo.

LIMIARES INICIAIS (Ve/Vmin ≥1,6 = lenta; ≤1,15 = rápida; etc.) são PONTO DE PARTIDA
ARBITRÁRIO — calibrar com as voltas reais do Bubi em Brasília (7 voltas reais
preservadas + as futuras). Declarado: até calibrar, são chute educado.

## Onde aparece pro piloto/gestor
- Tela de box "Revisão do Treino" (já construída no ambiente isolado): por trecho,
  mostrar TIPO da curva + formato proposto + formato da melhor passagem real.
- No cockpit ao vivo NADA muda: o alvo desenhado continua a melhor passagem.

## O que o sistema NÃO tem hoje (sem fingir)
- Inclinação da pista (banking), aderência por composto/temperatura, ângulo de volante
  (sem sensor de esterço), massa/transferência medida. A classificação usa SÓ
  geometria + velocidade. Se algum desses chegar um dia, o classificador melhora;
  sem eles, segue funcionando com o que tem.
- Freio % por GPS é estimativa (rotulada). Pressão real chega seg/ter 15-16/06.
- Nenhuma curva de Brasília foi classificada ainda — a tabela de tipos por trecho sai
  da PRIMEIRA rodada do classificador sobre o trajeto canônico, e o Flávio valida.
