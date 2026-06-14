# PROPOSTA — Classificador de trecho + tipo de trail braking proposto
Data: 2026-06-12 · Autor: Claude (rodada 18) · STATUS: v2 — AUDITADA (4 auditores, 4× aprovado com ressalvas; correções incorporadas na seção final)

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

---

## v2 — CORREÇÕES INCORPORADAS DA AUDITORIA (12/06, 4 auditores independentes)
Vereditos: engenharia, dados, regras canônicas e viabilidade — todos APROVADO COM
RESSALVAS. Tudo que citei como real foi verificado (29 testes rodados de novo: 29/29;
arquivos abertos; 8 curvas confirmadas no banco; 7 voltas contadas no backup). Furos
encontrados e corrigidos:

1. TIPOS FALTANTES — a tabela vira 6 tipos + 1 classe:
   T0 MÉDIA CLÁSSICA de raio constante (o caso canônico do manual; formato = trail
   progressivo do cap. 4; é o DEFAULT e dono da faixa Ve/Vmin 1,15–1,6) ·
   T1 LENTA PÓS-RETA · T2 RAIO DECRESCENTE (residual) · T3 RÁPIDA · T4 ENCADEADA ·
   T5 RAIO CRESCENTE (ápice cedo, trail curto, acelera cedo — ouro de saída em FWD) ·
   SF SEM FREADA (kink, Ve/Vmin≈1, sem evento de freada → não prescrever freio).
2. FONTE DOS FORMATOS, declarada com honestidade: o manual FWD sustenta T0/T1/T3 e os
   princípios (círculo de tração, soltura = rotação). T2 e T4 vêm do DITADO do Flávio
   (rodada 16) + engenharia de prova — sem capítulo específico no manual. O QA interno
   do manual tem 1 contradição pendente (cap. 12, definição de ápice) — resolver ou
   manter declarada antes de tratá-lo como fonte canônica.
3. GEOMETRIA FINA: o trajeto canônico de 920 pontos tem 24–44 m entre pontos dentro
   das curvas (multi-volta) — raio ponto a ponto e perfil do raio NÃO saem confiáveis
   só dele. Fonte correta: pontos_json das melhores passagens (~6 leituras/s ≈ 4–5 m),
   que a tela Revisão do Treino já carrega. Trajeto canônico fica pro contexto macro.
   Alternativa de upgrade: regravar trajeto com RaceBox Mini S a 25 Hz (já testado).
4. VARIÁVEIS BARATAS ADICIONADAS (todas computáveis hoje): g lateral no Vmin
   (Vmin²/R_min) · desaceleração de pico (freio-trecho.js já calcula) · distância
   numérica saída→próxima entrada (critério objetivo de "encadeada") · sentido da
   curva (esq/dir) pra detectar troca de direção.
5. FRONTEIRA DO BOOTSTRAP (regra canônica preservada): o formato teórico aparece SÓ
   na tela de box, rotulado TEÓRICO; durante a calibração (2 passagens) NENHUMA
   passagem é julgada (células seguem cinza); o alvo teórico NUNCA vai pro cockpit.
6. IMPLEMENTAÇÃO: módulo novo puro `classificador-trecho.js` (padrão do freio-trecho,
   com teste automático). NÃO sobrescrever a coluna `tipo` existente de track_segments
   (reta/curva — o flash da IA depende dela); usar coluna/dicionário próprio
   (`tipo_curva`). Canal do pedal (offset 54) está anotado como "pode ser freio" no
   decodificador — confirmar identidade na instalação do sensor (15-16/06) antes de
   promover a medida.
7. RESSALVAS DE PILOTAGEM no T3 (do manual): toque de freio com pé esquerdo só em
   curva SEM redução de marcha; alívio de acelerador medido, nunca brusco. No T4:
   vence a curva que despeja na reta mais longa.

PRIMEIRA ENTREGA (sem depender do sensor): script que classifica as 8 curvas de
Brasília com os dados reais existentes + página pro Flávio validar tipo a tipo.
Esforço: pequeno (1 sessão). Persistência + bootstrap/coerência: médio, depois do OK.
