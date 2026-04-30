# APEX_ANALYSIS_RULES — Apex como entidade central

O apex é o ponto de ligação entre entrada e saída de uma curva. Sem apex, a análise de curva é incompleta. O sistema diferencia três conceitos de apex e os trata como entidades distintas.

## Definições

### Apex geométrico

Ponto mais interno da trajetória real (ou ideal) em relação à curva. É objetivo, mensurável, sem julgamento de mérito.

Serve para medir se o piloto:

- passou longe demais (apex perdido por fora)
- passou dentro demais (apex excessivamente interno)
- antecipou o vértice (apex cedo)
- atrasou o vértice (apex tardio)
- perdeu a referência

### Apex ideal

Ponto de referência que otimiza o tempo do trecho considerando o objetivo daquela curva. Pode ser:

- antecipado
- neutro
- tardio
- duplo (em curvas duplas, S, esses)
- sacrificado intencionalmente (ex: para defender posição)

O apex ideal depende de:

- tipo de curva (lenta, média, rápida)
- velocidade de entrada esperada
- comprimento da reta seguinte
- necessidade de priorizar saída
- aderência atual
- marcha disponível
- comportamento do carro
- sequência de curvas (curva isolada vs sequência)

Regra crítica: o apex ideal nem sempre é o ponto geometricamente mais interno. Em curvas com reta longa após, o apex tardio costuma ser o melhor.

### Apex operacional

Tradução prática para piloto e box. Texto curto + cor + áudio para o piloto; análise estruturada para o box.

Mensagens canônicas para piloto (consultar `BOX_TO_PILOT_TRANSLATION_RULES.md`):

- "apex tarde" — antecipou; mire mais tarde
- "apex cedo" — atrasou; mire mais cedo
- "mais interno" — passou longe
- "menos interno" — passou interno demais
- "priorize saída" — apex bom mas saída ruim
- "boa curva" — confirmação positiva no fim do trecho

## Classificações canônicas

Cada execução de curva recebe uma classificação:

1. Apex correto.
2. Apex antecipado.
3. Apex tardio.
4. Apex perdido por fora.
5. Apex excessivamente interno.
6. Apex duplo (sequência).
7. Apex sacrificado intencionalmente.
8. Apex prejudicando saída.
9. Apex bom, mas aceleração atrasada.
10. Entrada boa, apex ruim.
11. Apex bom, saída ruim.
12. Entrada ruim, apex comprometido.

## Métricas obrigatórias por curva

Quando há dados suficientes:

- `apex_reference` — referência (ideal ou consolidado da pista)
- `apex_actual` — onde o piloto efetivamente passou
- `apex_delta_lateral` — distância lateral em relação ao apex ideal
- `apex_delta_longitudinal` — distância ao longo do traçado em relação ao apex ideal
- `apex_classification` — uma das 12 acima
- `minimum_speed` — velocidade mínima na curva
- `apex_speed` — velocidade no apex real
- `braking_point` — ponto onde frenagem começou
- `turn_in_point` — ponto de turn-in
- `throttle_reapplication_point` — ponto de retomada do acelerador
- `exit_speed` — velocidade na saída
- `exit_delta` — delta de saída vs ref
- `time_loss_estimate` — tempo perdido estimado
- `impact_next_straight` — impacto na reta seguinte
- `consistency_lap_to_lap` — consistência do apex volta a volta

## Perguntas que o sistema deve responder sobre apex

- O piloto acertou o apex?
- O apex foi cedo demais?
- O apex foi tarde demais?
- Passou longe do apex?
- Passou interno demais?
- Sacrificou a saída?
- O apex usado melhorou ou piorou o tempo do trecho?
- Esta curva exige apex tardio, neutro, antecipado ou duplo?
- O erro foi na entrada, no apex ou na saída?
- A perda veio antes ou depois do apex?
- O piloto priorizou entrada quando deveria priorizar saída?
- O piloto está repetindo o mesmo erro volta após volta?

## Mensagens corretas para piloto (catálogo apex)

Sempre 2-3 palavras, sempre da biblioteca canônica:

- "apex cedo" — antecipou
- "apex tarde" — atrasou
- "mais interno" — passou longe
- "menos interno" — passou interno demais
- "priorize saída" — apex bom, saída ruim
- "boa curva" — confirmação positiva

## Cor da mensagem (cockpit do piloto)

A cor da mensagem do ápice é função apenas da DISTÂNCIA entre o apex efetivo (`apex_actual`) e o apex ideal (`apex_reference`). A direção (cedo/tarde, interno/externo) está no TEXTO; a cor expressa o tamanho do erro.

| Distância ao apex ideal | Cor    | Token CSS    | Severidade |
|-------------------------|--------|--------------|------------|
| ≤ tolerância detectada  | Verde  | `--bom`      | `BOM`      |
| > tolerância e ≤ 2m     | Amarelo| `--atencao`  | `ATENCAO`  |
| > 2m                    | Vermelho| `--erro`    | `ERRO`     |

A "distância" é a maior absoluta entre `apex_delta_lateral` e `apex_delta_longitudinal`, em metros, no plano horizontal.

Regra estabelecida por Flavio em 2026-04-24. A cor é determinada pelo detector e passada como `severidade` no `setAcao(msg, severidade)` — o cockpit display **não infere cor**; apenas renderiza a severidade que recebeu.

## Mensagens corretas para box (catálogo apex)

Frases longas, estruturadas:

- "Piloto antecipa apex em média 7m na Curva 3, gerando abertura precoce e atraso de aceleração de 0,4s."
- "Apex correto, mas retomada do acelerador 0,4s depois da melhor volta."
- "Perda não está no apex; está na saída e na transição para a reta."
- "Curva exige apex tardio porque a reta seguinte tem 380m."
- "Erro recorrente: piloto carrega velocidade de entrada, perde apex e compromete saída."

## Reprovação automática

Reprovar análise de curva que:

- não classifica o apex (uma das 12)
- avalia a curva apenas pela velocidade de entrada
- mistura entrada, apex e saída em uma única métrica de "qualidade da curva"
- recomenda ajuste de pilotagem em apex sem antes verificar se a curva exige apex tardio
- recomenda ajuste de setup baseado em apex sem excluir erro de pilotagem
- usa termos genéricos ("pilotou bem", "ficou ruim") sem decompor por ponto

## Regra crítica

A curva é avaliada pela sequência:

```
Entrada → Frenagem → Turn-in → Apex → Retomada do acelerador → Saída → Delta na reta seguinte
```

O apex é o ponto de ligação entre entrada e saída. Se a saída da curva compromete uma reta longa, o apex tardio é mais importante que a velocidade mínima.

Detalhe sequencial em `CORNER_ANALYSIS_RULES.md`.

## Cadastro de apex no Track

Para cada `TrackSegment` com `ehTrecho=true`:

- `apexReference` — coordenada do apex ideal (latitude/longitude no traçado)
- `apexClassification` — tipo da curva (lenta/média/rápida) + (interna/externa/dupla)
- `apexStrategy` — antecipado/neutro/tardio/duplo (definido no cadastro do autódromo)
- `nextStraightLength` — comprimento da reta seguinte (orienta a estratégia)

Sem cadastro, a análise opera em modo degradado: detecta apex geométrico real, mas não pode classificar como "correto" sem referência.

## Aprendizado

Conforme o piloto roda mais voltas no mesmo carro/pista:

- O sistema consolida `apexReference` empírico (média ponderada das melhores execuções).
- A `apexStrategy` cadastrada é confrontada com o consolidado — se conflita, o sistema sinaliza no box para revisão manual do cadastro.
- O `apex_classification` por execução alimenta `error-classifier.js` para detectar padrões repetitivos.
