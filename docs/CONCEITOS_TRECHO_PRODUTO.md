# Conceitos do produto — ditado pelo Flávio em 2026-06-09

> Registro fiel do conceito central do P1 Fast, ditado pelo Flávio (gestor e dono do produto).
> Este documento é REFERÊNCIA DE PRODUTO. Em contradição com docs técnicos, este vence —
> exceto onde houver decisão fechada mais específica (ver "Relação com decisões fechadas").

## O foco

O piloto analisa e melhora **com foco nos trechos**. Trecho é o conceito básico do sistema.

## O que é um trecho

Trecho é sempre um local onde o piloto **precisa pisar no freio** — normalmente uma curva.
Elementos de um trecho (todos georreferenciados por GPS):

1. **Linha de ENTRADA** — em que ponto da linha o carro passou + a velocidade ao cruzar.
2. **Ponto de FRENAGEM** — ponto GPS onde freou, registrado como **distância em metros
   desde a linha de entrada**.
3. **VMIN** — a velocidade mínima naquele trecho (registrada com o local).
4. **ÁPICE (apex)** — o ponto mais interno da curva que o carro pode passar.
   Padrão = 1 ápice; pode ter 2; em curvas excepcionais até 3.
5. **PAce — ponto de ACELERAÇÃO** — onde o piloto inicia a aceleração. Pode ser ANTES ou
   DEPOIS do ápice, dependendo do tipo da curva. Registrado no GPS.
6. **Linha de SAÍDA** — como a entrada: ponto da linha + velocidade.

## A comparação (lógica central)

Todo desempenho é comparado com a **melhor passagem histórica daquele carro, naquela
configuração, na história dele — pilotado por QUALQUER piloto**.

## O ritmo das informações pro piloto (durante a volta) — coreografia fechada 09/06

A tela do cockpit alterna entre DOIS estados, em ciclo, trecho a trecho:

1. **Da linha de SAÍDA até a METADE da reta** → **painel padrão** (o cockpit canônico:
   shift light, delta, widgets), mostrando o desempenho do trecho que acabou de fazer.
2. **Da METADE da reta até a ENTRADA do próximo trecho** → **tela de orientação**
   ("Oportunidade do Trecho", contrato v3): o que ele deve fazer no trecho que vem —
   curva na visão do piloto, vermelho = onde fez, verde = onde fazer, verbo + dado
   (número de lugar ou gráfico de pressão do pedal).
3. **Dentro do trecho** (entrada → saída) → painel padrão ao vivo (delta, shift light,
   mensagens críticas — que têm prioridade SEMPRE, em qualquer estado).
4. **Exceção — reta MAIS LONGA (em tempo) do autódromo** → primeiro o desempenho do
   trecho anterior; depois, por um tempo, o **desempenho da VOLTA**; e então a orientação
   do próximo trecho na metade final.

## O que o painel do piloto tem

- Delta do trecho + informações de parte desses elementos.
- **Shift light** — calibrado pra troca no ponto de máxima entrega (cruzamento da força na
  roda entre marchas, pela curva real do motor).
- **Mensagens críticas** e **mensagens de orientação**.
- **Ghost** — o piloto ativa: o delta vai mais à esquerda e aparece o **mapa só do trecho**,
  pra ele acompanhar e tentar seguir o desenho da melhor passagem.
- **Marcações das voltas** do planejamento do stint: volta de entrada no box (se planejada),
  volta de **warmup** e volta de **cooldown** (resfriamento).

## Oportunidade do trecho (a partir da 2ª volta) — REVISADO pelo Flávio na mesma noite

Depois que o piloto **completa a primeira volta**, o sistema passa a mostrar a maior
possibilidade de ganho — **por trecho, no momento em que aquele trecho se aproxima**.
SEM ranking da volta toda ("vamos esquecer o conceito do melhor trecho da volta" — Flávio):
- Passou da **metade da reta** (depois de ver o desempenho do trecho anterior) → aparece a
  tela da **oportunidade DO TRECHO QUE VEM AÍ**: em qual componente/disciplina daquele trecho
  (entrada, frenagem, Vmin, ápice, aceleração, saída) ele pode ganhar tempo.
- O piloto **bate o olho e entende** — sem texto longo. Quando corrige aquele componente,
  na volta seguinte o sistema mostra o próximo componente daquele mesmo trecho.
- Melhoria contínua em cada lugar, trecho a trecho.

Tela desenhada (proposta ultra prêmio, 09/06): `_design-reference/mockup-oportunidade-trecho-ultra.html`
— curva REAL do mapa oficial + zona dourada no componente-alvo + marca VOCÊ × MELHOR + número
gigante do ganho + régua "como fazer" da melhor passagem com o alvo aceso.

## Treinos de técnica (futuro, com IA)

No planejamento do stint, o piloto pode escolher **assessoria de IA pra desenvolver uma
técnica** (ex.: **trail braking**). A tela é formatada pro acompanhamento daquela técnica
(no trail braking: visão de frenagem + aceleração dentro dos conceitos do trecho).
Muitos tipos de treinamento serão cadastrados ao longo do tempo. **Ainda não construído.**

## Relação com decisões fechadas (não conflita, complementa)

- Painel = só ações; Vmin não é widget permanente do painel (decisão 26/05). O Vmin aparece
  na **prévia "como fazer" na metade da reta** — momento diferente, compatível.
- Mensagens do painel: máximo 2 palavras (decisão 27/05) — vale pras mensagens; a prévia
  do trecho e o resumo de volta são blocos visuais, não mensagens.
- Comparação por trecho vs melhor histórica (memória `p1fast_logica_central`) — idêntico.
