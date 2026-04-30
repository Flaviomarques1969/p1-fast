# CORNER_ANALYSIS_RULES — Regras de análise de curva

A análise de curva é sequencial. Nunca se reduz a um único número.

## Sequência canônica

```
Entrada → Frenagem → Turn-in → Apex → Retomada do acelerador → Saída → Delta na reta seguinte
```

Cada ponto da sequência é avaliado individualmente E em relação ao seguinte. Erros podem nascer em um ponto e se manifestar em outro.

## Estrutura conceitual `CornerAnalysis`

A entidade conceitual `CornerAnalysis` cobre os campos:

```
corner_id
corner_name                    (real ou identificador técnico provisório)
lap_id
braking_point                  (posição no traçado consolidado)
braking_delta                  (delta vs referência, em metros e ms)
turn_in_point                  (posição)
turn_in_delta                  (delta vs ref)
apex_reference                 (do cadastro)
apex_actual                    (medido)
apex_delta_lateral             (m)
apex_delta_longitudinal        (m)
apex_classification            (uma das 12 — ver APEX_ANALYSIS_RULES.md)
minimum_speed                  (km/h)
apex_speed                     (km/h)
throttle_reapplication_point   (posição)
throttle_reapplication_delta   (delta vs ref)
exit_speed                     (km/h)
exit_delta                     (km/h vs ref)
time_loss_estimate             (ms; positivo = perda, negativo = ganho)
next_straight_max_speed_delta  (km/h vs ref)
driver_instruction             (frase canônica para o piloto, opcional)
engineer_diagnosis             (texto longo estruturado para o box)
confidence                     (Alta / Média / Baixa)
```

A entidade não precisa virar tabela nova se já couber em `segmentExecutions` + colunas existentes — verificar antes de modelar. A regra é estrutura conceitual obrigatória, não modelo de dados específico.

Entidades conceituais relacionadas:

- `CornerApex` — referência cadastrada (ver `APEX_ANALYSIS_RULES.md`)
- `ApexReference` — alvo ideal de apex
- `ApexAnalysis` — execução real medida vs referência
- `CornerAnalysis` — esta estrutura
- `TrackSegment` — já existe (`src/domain/track-segment.js`)
- `TrackSection` — agrupamento de segments dentro de uma parcial (se necessário)

## Ordem de avaliação

Para cada execução de curva, avaliar nesta ordem:

### 1. Entrada e frenagem

- Velocidade de entrada está dentro da janela ideal?
- Ponto de frenagem está consistente com a referência?
- Carregamento de freio é progressivo ou abrupto?
- Soltura de freio até turn-in é suave?

Diagnóstico: "freou cedo" / "freou tarde" / "carregou freio demais" / "soltou cedo" / "freou bem".

### 2. Turn-in

- Ponto de turn-in está alinhado com a estratégia da curva?
- Ângulo de volante é compatível com o raio?

Diagnóstico: "turn-in cedo" / "turn-in tarde" / "turn-in agressivo" / "turn-in suave demais".

### 3. Apex

Aplicar `APEX_ANALYSIS_RULES.md` — uma das 12 classificações.

### 4. Retomada do acelerador

- Em que ponto começou a abrir o acelerador?
- A retomada é progressiva ou abrupta?
- O carro permite a retomada nesse ponto (tração, balanço)?

Diagnóstico: "acelerou cedo demais" / "acelerou tarde" / "acelerou bem".

### 5. Saída

- Velocidade de saída vs referência
- Trajetória de saída usa toda a pista?
- Carro estável ou compensando?

Diagnóstico: "saída lenta" / "saída ótima" / "saída instável".

### 6. Impacto na reta seguinte

- Velocidade máxima atingida na reta seguinte
- Tempo até atingir velocidade máxima
- Delta total no fim da reta

Esse é frequentemente o ponto onde o erro do apex se manifesta — uma curva mal-saída custa segundos na reta longa que vem depois.

## Atribuição de perda

Toda análise de curva atribui a perda a UM ponto da sequência:

- A perda nasceu na entrada?
- Na frenagem?
- No turn-in?
- No apex?
- Na retomada?
- Na saída?
- Na transição para a reta?

Sem atribuição clara, o diagnóstico é vago e a recomendação cai. Reprovado.

Se a perda é distribuída em múltiplos pontos, listar a contribuição de cada um.

## Padrões recorrentes

Catálogo de padrões que o sistema deve reconhecer (alimenta `error-classifier`):

| Padrão | Sintoma | Causa provável | Ação |
|---|---|---|---|
| Entrada agressiva, apex perdido | velEntrada alta + apex_delta_lateral alto | piloto tentando ganhar tempo na entrada | "menos entrada" / "priorize saída" |
| Apex correto, retomada tardia | apex_delta baixo + throttle_delta alto | medo de tração ou hábito | "acelere antes" / "saia forte" |
| Frenagem precoce constante | braking_delta -5m+ em ≥3 voltas | desconfiança ou freio quente | "freie depois" + verificar freio no box |
| Volante constante após apex | retomada parcial + sub-esterço estimado | carro empurrando | engenheiro: cambagem/pressão/aderência |
| Saída instável recorrente | wiggle/contra-volante na saída | sobre-esterço de potência | engenheiro: tração/diferencial/setup |
| Sequência (S, chicane) com 1º apex bom e 2º perdido | 2º apex_delta alto | timing de transição | "mais paciência no S" (frase a calibrar) |

## Regras críticas

1. Curva nunca avaliada apenas pela velocidade de entrada.
2. Curva nunca avaliada apenas pela velocidade mínima.
3. Curva nunca avaliada apenas pelo tempo total do trecho.
4. Apex sempre considerado.
5. Reta seguinte sempre considerada se relevante (curva pré-reta).
6. Sequência (S, chicane) tratada como uma unidade analítica.
7. Confidence sempre declarada.
8. Frase para piloto opcional (silêncio é resposta válida).
9. Diagnóstico para engenheiro sempre presente quando há dado mínimo.

## Curvas em sequência (S, chicane, esses)

Tratadas como UM trecho se a distância entre ápices é menor que X metros (configurável no cadastro do autódromo).

A análise de sequência:

- mede ambos os ápices
- avalia a transição (timing, balanço, peso)
- atribui perda à entrada do 1º, ao apex do 1º, à transição, ao apex do 2º ou à saída do 2º
- nunca recomenda ajuste só sobre 1 dos ápices isoladamente — sempre considera a sequência

## Cadastro mínimo por curva

No cadastro do autódromo, cada `TrackSegment` com `ehTrecho=true`:

- `corner_name` (real ou Curva N)
- `corner_type` (lenta / média / rápida)
- `apex_strategy` (antecipado / neutro / tardio / duplo)
- `apex_reference` (coordenadas)
- `next_straight_length` (m, se reta seguinte for relevante)
- `priority_axis` (entrada / apex / saída — onde está o ganho do trecho)

Sem cadastro completo, a análise opera em modo degradado e flagra no box: "trecho sem cadastro completo — análise limitada".

## Reprovação automática

Reprovar análise de curva que:

- não cobre a sequência completa
- não classifica o apex
- avalia só por velocidade
- recomenda setup antes de excluir pilotagem
- não atribui a perda a um ponto da sequência
- não declara confiança
- inventa nome de curva
- mistura piloto e engenheiro no mesmo output (Ambiente A vs B)
