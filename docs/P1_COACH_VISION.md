# P1 Coach — Visão de Produto

**Status:** doc de visão. Não é plano de execução.
**Decisão:** Flávio 2026-05-05 — arquivar como constituição do módulo.
**Função:** orientar decisões futuras de Coach. Quando o módulo for implementado (depois de MS-2.1/2.2/2.3 e de 2-3 sessões reais gravadas), este doc define o vocabulário, as regras e o que NÃO fazer. Pesos numéricos e limiares específicos ficam de fora — calibram com dado real, não com palpite.

Este doc trata só do **conceito**. Tipos, migrations, scoring numérico e arquitetura ficam para o `P1_COACH_DESIGN.md` quando chegar a hora.

---

## 1. Regra central do produto

> Apex orienta a linha.
> Vmin revela a rotação.
> O Ponto de Virada mostra se a frenagem virou rotação no momento certo.
> Saída manda quando existe reta relevante depois.

**Não implementar nada baseado na ideia errada de que apex é o ponto mais lento da curva.**

---

## 2. Definições oficiais

### Apex / ápice
Referência de **tangência interna** da linha de corrida usada para organizar rotação, posicionamento e saída.

Pode ser:
- ponto único
- ápice tardio (late apex)
- zona de ápice (apex zone — comum em curva em U)
- dois ápices (double apex)
- múltiplos ápices funcionais (multi apex)
- ápice sacrificado (usado só pra posicionamento)
- ápice dominante (prepara a saída)

O apex **não é** necessariamente o ponto mais lento, nem o mais interno geométrico, nem o ponto pra onde o carro está apontado. É **referência de linha**, não evento dinâmico.

### Vmin
Menor velocidade real registrada dentro da janela da curva em uma volta específica. **Evento dinâmico** calculado pela telemetria.

Analisado sempre junto de: posição na pista, distância até apex relevante e dominante, duração em baixa velocidade, ângulo do carro, trajetória desde o ponto de frenagem, retomada de acelerador, velocidade de saída, delta do trecho.

### Vmin Pivot (interno)
O Vmin como **pivô dinâmico da curva** — o ponto/zona onde a mudança de trajetória deve estar acontecendo ou ficando resolvida.

Responde:
- O carro já estava apontado?
- A rotação aconteceu no momento certo?
- A frenagem ajudou a virar?
- O piloto chegou ao Vmin em posição útil pra buscar o apex e a saída?

### Ponto de Virada (público)
Nome do conceito para o piloto.

> "O Ponto de Virada é o momento em que a freada deixa de ser apenas redução de velocidade e passa a virar o carro pra preparar o apex e a saída."

Frase de produto:
> "O Ponto de Virada mostra se você transformou a frenagem em rotação no momento certo."

### Construção da Curva (público) / BVA Score (interno)
Indicador que mede a qualidade da sequência **Ponto de Frenagem → Vmin / Ponto de Virada → Apex**.

- **Cockpit:** mostrar como "Construção da Curva", sem número, só mensagem dominante.
- **Pós-stint:** pode mostrar "Construção da Curva: 82/100" e decomposição.
- **Internamente:** chama BVA Score (Brake / Vmin / Apex).

Frase de produto:
> "Não é sobre entrar mais rápido. É sobre construir melhor a curva pra sair mais forte."

### Saída / Exit
Quando há **reta relevante depois**, a saída domina o diagnóstico. A melhor curva não é a de maior Vmin — é a que gera melhor aceleração e maior velocidade sustentada depois.

### Ângulo no Vmin
**Erro entre o heading real do carro no Vmin e o heading ideal naquele ponto da linha.**

NÃO é "ângulo Vmin → apex". O heading ideal considera apex relevante, apex dominante, saída, tangente da linha, tipo da curva, retas adjacentes e a melhor referência disponível do piloto/carro/pista.

O carro pode estar apontando para o apex, tangenciando, passando ao largo, apontando pro segundo apex, ou mais pra saída — depende do tipo da curva.

---

## 3. Regras inegociáveis

- **Nunca** tratar apex como ponto mais lento.
- **Nunca** ensinar o piloto a buscar maior Vmin isoladamente.
- **Nunca** premiar entrada forte se a saída piorou.
- **Nunca** gerar diagnóstico sem evidência.
- **Nunca** inventar dados de sensores que não existem (usar confidence baixo).
- **Nunca** mostrar várias mensagens simultâneas no cockpit.
- **Nunca** mostrar explicação longa durante a pilotagem.
- **Sempre** separar referência fixa (apex) de evento dinâmico (Vmin).
- **Sempre** calcular confidence quando houver inferência.
- **Sempre** priorizar o delta real do trecho.
- **Sempre** escolher um erro dominante por curva.
- **Sempre** permitir mais de um apex por curva.
- **Sempre** permitir apex sacrificado e apex dominante coexistirem.

### Fórmula conceitual da boa curva

> linha coerente
> + ponto de frenagem correto
> + caminho Brake → Vmin correto
> + Vmin no lugar certo
> + erro angular baixo no Vmin
> + pouco tempo preso em baixa velocidade
> + carro apontado cedo
> + apex relevante bem preparado
> + aceleração progressiva
> + saída forte
> + delta positivo no trecho

---

## 4. As três fases da curva

O Coach analisa a curva em três fases, não em "Vmin foi alto?":

| Fase | Trecho | O que mede |
|---|---|---|
| 1. Construção inicial | Brake Point → Vmin | Qualidade da entrada e rotação inicial |
| 2. Preparação do apex | Vmin → Apex relevante/dominante | Apontamento e tangência |
| 3. Conversão em tempo | Apex → Exit | Aceleração e saída |

**Brake → Vmin** = "chegou ao Ponto de Virada pelo caminho certo?"
**Vmin → Apex** = "o Ponto de Virada preparou corretamente o apex?"
**Apex → Exit** = "transformou a preparação em tempo?"

---

## 5. Múltiplos ápices (classificação funcional)

Uma mesma curva pode ter mais de um apex. O apex mais importante **não é** automaticamente o primeiro — é o que melhora o delta do trecho, especialmente saída.

| Função | O que faz |
|---|---|
| `positioning_apex` | Posiciona o carro pra próxima fase da curva |
| `rotation_apex` | Completa ou induz rotação |
| `exit_preparation_apex` | Prepara a saída |
| `dominant_apex` | O que mais influencia o tempo do trecho |
| `sacrificed_apex` | Propositalmente ignorado/atrasado pra melhorar a saída |
| `apex_zone` | Zona contínua de referência interna (curva em U, raio constante longo) |

Em curva antes de reta longa, o **apex dominante costuma ser o último apex relevante antes da saída**.

---

## 6. Tipos de curva (vocabulário fechado)

`simple_apex` · `late_apex` · `v_corner` · `u_corner` · `double_apex` · `multi_apex` · `constant_radius` · `decreasing_radius` · `increasing_radius` · `fast_corner` · `complex_sequence`

Cada tipo tem regras próprias de scoring e de heading ideal. Pesos numéricos ficam pro doc de design.

### Notas-chave por tipo

- **late_apex / v_corner:** Vmin pode ocorrer antes do apex tardio. Heading ideal favorece exit. Erro angular alto + saída baixa = entrou forte.
- **u_corner:** zona de apex ou apex zone, não ponto único. lowSpeedDuration importa muito. Progressão angular ao longo da curva.
- **double_apex:** apex 1 normalmente posiciona, apex 2 normalmente prepara saída. Antes do apex 1 → referência é apex 1. Entre os dois → referência dominante é apex 2. Depois do apex 2 → referência dominante é exit.
- **multi_apex:** suportar N apexes com `sequenceIndex`. Identificar apex relevante (próximo do Vmin) e apex dominante (do trecho).
- **fast_corner:** Vmin pouco pronunciado. Heading ideal protege estabilidade. Vmin alto só é bom se linha, estabilidade e saída não piorarem.
- **decreasing_radius:** rotação tardia, controle maior. Vmin depois do apex pode não ser erro automático.
- **increasing_radius:** saída permite acelerar mais cedo. Heading ideal favorece abertura de volante progressiva.
- **complex_sequence:** não otimizar curva isolada se isso destrói a próxima. Métrica dominante pode ser posicionamento pra próximo trecho.

---

## 7. Influência das retas

### Reta anterior define **severidade de chegada**

Reta anterior longa → chegada mais rápida, frenagem mais forte, maior risco de overdrive, maior necessidade de rotação resolvida no Vmin.

Reta anterior curta → frear demais vira erro mais provável.

### Reta posterior define **prioridade de saída**

Reta posterior longa → saída domina. Vmin pode ser menor se gerar saída melhor. Apex bonito vale menos que aceleração sustentada. Último apex relevante tende a dominar.

Reta posterior curta → fluidez e velocidade média pesam mais. Apex de posicionamento pode valer tanto quanto apex de saída.

---

## 8. Como calcular o heading ideal no Vmin

**Ordem de preferência:**
1. Melhor trecho do próprio piloto.
2. Melhor volta do próprio piloto.
3. Volta ideal composta por melhores trechos.
4. Referência manual de coach humano.
5. Referência de piloto mais rápido.
6. Fallback geométrico (composição ponderada de apex/exit/tangente segundo o tipo da curva).

**Princípio:** sempre que houver referência real do próprio piloto, ela ganha. Não comparar piloto iniciante com referência impossível se houver referência própria mais útil.

---

## 9. Hierarquia de decisão quando há conflito

Quando dois sinais brigam (ex: Vmin alto mas saída baixa), o Coach decide pela ordem:

1. Delta do trecho.
2. Velocidade de saída.
3. Velocidade após 50 m / 100 m.
4. Throttle commit.
5. Construção da Curva / BVA Score.
6. Erro angular no Vmin.
7. Posição do Vmin.
8. Duração em baixa velocidade.
9. Precisão no apex dominante.
10. Precisão no apex primário.
11. Velocidade de entrada.

**Motivo:** o objetivo é menor tempo no trecho. Não apex bonito, não Vmin alto.

---

## 10. Diagnóstico — padrões dominantes

Cada curva recebe **um** diagnóstico dominante. Padrões iniciais:

| Combinação | Diagnóstico |
|---|---|
| Vmin baixo + saída baixa | Freou demais |
| Vmin baixo + saída alta + erro angular baixo | Boa rotação / sacrifício correto |
| Vmin alto + saída baixa + erro angular alto | Entrou forte / não apontou |
| Vmin alto + saída alta + erro angular baixo | Curva eficiente |
| Vmin muito antes do apex dominante + lowSpeedDuration alto | Esperou curva |
| Vmin depois do apex dominante + erro angular alto | Vmin tarde / rotação atrasada |
| Vmin perto do apex dominante + saída alta + erro angular baixo | Execução boa |
| Erro angular alto + throttle commit cedo + saída baixa | Acelerou torto |
| Apex 1 bom + apex dominante ruim + saída ruim | Errou ápice |
| Apex sacrificado + saída forte | Sacrifício correto |
| Apex sacrificado + saída ruim | Sacrifício errado |
| Brake → Vmin bom + Vmin → Apex ruim | Erro de virada para apex |
| Confidence baixo / GPS ruim / heading instável | Dados insuficientes |

---

## 11. Linguagem de produto

### No cockpit (durante pilotagem)
- Linguagem de piloto, máximo 3 palavras.
- **Uma** mensagem dominante por curva, nunca várias.
- Sem números, sem fórmula, sem termos técnicos.
- Exemplos: "Boa virada" · "Virou tarde" · "Freou torto" · "Não apontou" · "Saída forte" · "Vmin tarde" · "Esperou curva" · "Construção ruim" · "Dados fracos".

### No pós-stint (modo análise)
- Pode mostrar BVA, decomposição, evidências, deltas, ângulos.
- "Construção da Curva: 82/100" + decomposição em 5 sub-scores.
- Diagnóstico textual + correção sugerida + próxima tentativa.

### Termos a evitar no cockpit
`heading error` · `bearing` · `angular error` · `BVA Score` · `vminHeadingErrorDeg` — esses são vocabulário técnico interno.

### Termos a usar publicamente
`Construção da Curva` · `Ponto de Virada` · `Vmin` (já é vocabulário de piloto) · `Saída` · `Apex` · `Linha`.

---

## 12. O que NÃO entra no MVP

Quando o módulo for implementado, esses ficam de fora da v0.1 — entram só com dado real e calibração:

- `rotationDuringBrakingDeg` (heading durante frenagem é o pior momento pro GPS).
- `trailBrakeRatio` (sem ECU/sensor de freio é inferência sobre inferência).
- `throttle pickup / commit` automáticos (sem ECU é cego).
- 9 scoring profiles fixos por tipo de curva (calibrar primeiro).
- Multi-apex inteligente (começar com 1 apex dominante por trecho).
- 40 mensagens dominantes (começar com 5-8).

A regra: **calibrar com dado real antes de fixar limiares em código.**

---

## 13. Pré-requisitos antes de implementar

Sem qualquer um destes, o módulo é exercício acadêmico:

1. **Telemetria viva** — MS-2.1 (CoreMotion+GPS), MS-2.2 (background), MS-2.3 (botão amarra ao stint).
2. **Volta/trecho de referência** — pelo menos 1 sessão completa gravada por piloto/carro/pista.
3. **Heading confiável** — fusão IMU+GPS calibrada para dar yaw rate em baixa velocidade.
4. **Linha de corrida cadastrada** — não só apex points soltos. Configurador atual cadastra apex; falta a linha completa pra fallback geométrico funcionar.

Quando esses 4 estiverem em pé, abrir `P1_COACH_DESIGN.md` com escopo recortado pelo dado disponível.

---

## 14. v0.1 sugerida (quando chegar a hora)

Escopo mínimo que cabe com o dado que o sistema vai ter logo após MS-2.x:

- Vmin position vs apex dominante (já temos os dois).
- Distância Brake → Vmin (`Detector.pontoFrenagem` já calcula).
- Exit speed delta (precisa exit gate cadastrado).
- 3 mensagens cockpit: **Boa virada · Vmin tarde · Esperou curva**.
- 1 tabela nova: `corner_diagnoses` (não 12).
- Sem multi-apex inteligente — usa o `dominant_apex` cadastrado.
- Sem heading ideal por linha de referência — só fallback geométrico simples.

Calibração dos pesos vem com 2-3 sessões reais. Não fixar nada antes.

---

## 15. O que esta visão substitui

Spec original colado pelo Flávio em 2026-05-05 (5 papéis combinados, 30 seções, plano TypeScript). Aquele documento misturava visão + design + execução. Esta versão fica só com a **visão e a linguagem**. Design e execução vão para docs próprios quando os pré-requisitos estiverem em pé.

A parte que foi descartada (não perdida — se quiser revisitar, está no histórico do chat):
- Estrutura de arquivos TypeScript (projeto é Swift nativo).
- 12 tabelas Postgres novas (excesso pra MVP — começar com 1).
- 40 testes obrigatórios (calibrar com dado real primeiro).
- Tipos completos com pesos fixos (calibrar antes de codificar).
