# Histórico de decisões — Reformulação dos Autódromos

## Rodada 1 — 6 decisões iniciais (2026-05-17 14:17)

Respondidas por Flávio via HTML `20260517-110700-autodromos-funcao.html`.

### A — Origem dos pontos do trecho
**Escolha: HÍBRIDO ESPECÍFICO (não foi o A3 puro do HTML — texto livre na resposta).**

Texto completo do Flávio:
> "É a opção A3, só que ajustada para a realidade. Porque o ponto de entrada, o ápice e o ponto de saída são três elementos desses seis que são marcados por GPS. O ponto de entrada e o ponto de saída é uma faixa, pode ser em qualquer trecho da pista, em qualquer parte daquela marcação, pode ser mais para o lado de fora. Então, é como se fosse uma faixa. E o ápice, que pode ser mais de um ápice dependendo do tipo de curva, mas normalmente apenas um, ele é diferente porque ele é apenas um ponto específico na pista. Então ele normalmente é o ponto mais dentro da pista naquele trecho. Estes pontos vão ser marcados primeiramente automaticamente, por isso que a resposta é A3, ele é híbrido. Mas os pontos PAce, V-min e ponto de frenagem, eles vão ser marcados de forma dinâmica a partir das melhores voltas naquele carro com aquela configuração. Configuração de um carro é o carro, o motor, os pneus, os tipos de pneus, o câmbio. Para esse conjunto de elementos nós temos então essas marcações. Se mudar um desses elementos, parte dessas marcações já muda e cria outro critério para aquela configuração nova. Então resumindo, pontos de entrada, pontos de saída, e ápice são pontos definidos pelo GPS na pista. Os pontos V-min, pontos de frenagem e PAce, eles são dinâmicos e são baseados no resultado a partir da marcação, a partir da melhor passagem naquele trecho."

**Implicações:**
- Pontos GEOGRÁFICOS (cadastrados, não mudam por carro): entrada (faixa) · saída (faixa) · ápice (ponto, pode ter mais de 1).
- Pontos DINÂMICOS (calculados por configuração do carro): V-min · ponto de frenagem · PAce.
- Conceito NOVO: "CONFIGURAÇÃO" = carro + motor + pneus + tipos de pneus + câmbio. Cadastro a criar.

### B — Entrada na tela do autódromo
**Escolha: `recordes-primeiro` (B2).** Tela do autódromo abre com recordes do time. Carro vira filtro no topo.

### C — Carros simultâneos
**Escolha: `um-por-vez` (C1).** Foco em 1 carro por vez. Comparação fica pra rodada futura.

### D — PAce (ponto de aceleração)
**Escolha: `calcular-auto` (D1).** Calcular automaticamente das voltas reais usando o critério "instante depois do ápice em que aceleração longitudinal volta a ser positiva".

### E — Card do autódromo
**Escolha: OUTRA (texto livre).**

Texto completo:
> "A resposta do E1 é só adicionar o total de quilômetros rodados pelo piloto naquele autódromo. Quando clicar no carro, mostra o total de quilômetros rodados pelo carro e aí os dados do carro. Quando é do piloto, aí mostra a velocidade máxima do piloto naquele autódromo."

**Implicações:**
- Card do autódromo (lista): cidade + nº trechos + melhor volta histórica + vmax histórica + **km rodados pelo piloto-logado naquele autódromo**.
- Ao tocar no CARRO dentro do autódromo: **km do carro naquele autódromo** + dados do carro.
- Vmax do piloto naquele autódromo: aparece em algum lugar (tela do autódromo ou tela do carro dentro do autódromo).

### F — Melhor volta + velocidade máxima
**Escolha: `so-carro` (F2).** Mostra só do carro escolhido. Sem recorde do time misturado.

---

## Rodada 2 — questionário aprofundado (em aberto)

19 decisões em 6 blocos. HTML em `.claude-perguntas/pendentes/20260517-115500-autodromos-aprofundamento.html`.

Aguardando resposta do Flávio.

## Conceitos firmados até aqui

- **Configuração do carro** é um cadastro NOVO. Vai precisar de tabela própria + tela própria + vinculação às voltas gravadas.
- **Pontos geográficos do trecho** (entrada/saída/ápice) precisam ser cadastrados no Autódromo (não no carro). Pode usar editor visual no aplicativo OU ser pré-cadastrado pelo Claude.
- **Pontos dinâmicos do trecho** (V-min/frenagem/PAce) precisam ser CALCULADOS a partir das voltas gravadas com aquela configuração específica. Vai precisar de função de cálculo + cache pra não recalcular toda hora.
- **Recordes do autódromo** precisam ser puxados das voltas gravadas. Pra isso, voltas precisam estar vinculadas a (carro, configuração, autódromo, trecho).
