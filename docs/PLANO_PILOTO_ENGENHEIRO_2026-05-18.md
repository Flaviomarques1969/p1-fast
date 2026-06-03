# P1 Fast — Plano Piloto + Engenheiro (aprendizado contínuo)

**Data:** 2026-05-18 (início ~15h)
**Pedido:** Flávio Marques — "pegue tudo que aprendeu, leia o CLAUDE.md, todo o histórico, as funções que temos. Como preparador extremamente experiente + orientador de pilotos alto nível, identifique como orientamos o piloto em aprendizado contínuo (vendo no painel enquanto corre), onde estão as maiores oportunidades, piores erros, melhores desempenhos. E, do lado do carro: onde perde potência/torque naquele dia/circuito, como resolver, na visão do engenheiro no Command Box, e mostrar pro piloto onde está perdendo por causa do estilo dele."

---

## 0. Premissas e fontes

Antes de qualquer afirmação técnica, lista do que está **verificado em código** e do que ainda é **suposição**:

### 0.1. Verificado (li no código antes de prometer)

| Peça | Onde está | Estado |
|---|---|---|
| `Detector` ao vivo | `ios/p1fast-core/Sources/P1FastCore/Detector.swift` | Existe e funciona com 6/6 nos testes Edge |
| `KalmanINSGPS` | `KalmanINSGPS.swift` | Funcional, com Joseph form, gap recovery |
| `Score`, `Benchmark`, `Repeatability`, `Pedagogical` | mesma pasta | Existem em domínio puro |
| `PilotReaction`, `ShiftAnalysis`, `ShiftEventDetector`, `ShiftTarget`, `GearEstimation` | mesma pasta | Existem em domínio puro |
| `TrajectoryMonitor`, `ErrorClassifier`, `ErrorTaxonomy`, `AttackPriority`, `PlannedVsExecuted` | mesma pasta | Existem em domínio puro |
| `CoachPhrases` 36 frases | `CoachPhrases.swift` | Catálogo pronto |
| `DynoCsvParser` | `DynoCsvParser.swift` | **Parser apenas** — não há estrutura `DynoCurve` consumível com `torqueAt(rpm:)` ainda |
| Curva oficial Celta Bubi | `docs/dyno/CELTA_BUBI_MARQUES_DYNO_2026-05-18.md` | 79 pontos RPM × HP × Torque registrados |
| `Manutencao`, `ManutencaoCatalogo`, `PeriodicidadeRegra`, `ContadorVida`, `avaliarStatus` | `Manutencao.swift` (nova) | Plantada esta madrugada |
| `Carro.motor` | `Models.swift:331` | **Texto livre** — não há relação de câmbio estruturada, nem redução, nem raio do pneu, nem cilindrada como número |
| `Configuracao.cambio` | `Models.swift:340` | **Texto livre** (ex.: "PK6 — 4ª/5ª curtas") — não é uma estrutura com `relacaoMarcha[1..5]` |
| `Carro.pesoKg` ou similar | há 3 ocorrências de `pesoKg` em Models | Existe mas em outros contextos (não no Carro). **Precisa confirmar onde** |
| Pontos dinâmicos (Vmin, frenagem, PAce) | `segment_pontos_dinamicos` v31 | Tabela existe, infraestrutura de gravação existe |

### 0.2. Suposições explícitas

- **Pressuposto 1:** o T4000 entregará RPM, marcha (ou inferiremos com `GearEstimation`), mistura (λ), MAP, EGT, temp óleo, temp água, pedal acelerador. Captura real ainda pendente.
- **Pressuposto 2:** existe (ou vamos criar) cadastro estruturado de **redução de marcha 1..N**, **redução do diferencial**, **raio do pneu** e **massa em ordem de marcha** (carro + 70 kg piloto + 30 kg combustível). Hoje **não existe** — é texto livre.
- **Pressuposto 3:** a curva do dinamômetro continua válida até a próxima medição. Quando o motor mudar, refazemos.
- **Pressuposto 4:** o cockpit do piloto roda no notebook Windows + tela 10,5" externa invertida (ADR-023 + amendments).
- **Pressuposto 5:** o Command Box do engenheiro roda no aplicativo iOS modo BOX → AirPlay → Apple TV → TV 32" (PLANO_FASE_1 §2).

### 0.3. Decisões já fechadas que este plano respeita

- ADRs 018, 023 (com amendments 2-5)
- ADR-003 (SQLite local = fonte da verdade durante sessão)
- ADR-004/014 (telemetria append-only, sem syncQueue)
- Regra dura "você" / "linguagem de gestor"
- Mapa de Brasília v2 (não suavizar)
- Estoque e Manutenção: locais primeiro, produção só sob "MIGRAR PARA PRODUÇÃO: …"

---

## 1. Glossário rápido (linguagem de gestor)

| Termo deste plano | O que significa |
|---|---|
| **Curva do motor** | Tabela RPM → torque (e potência derivada). É o que o motor ENTREGA em condições ideais. Saída do dinamômetro. |
| **Aceleração teórica** | Quanto o carro DEVERIA acelerar agora, dado o motor que tem, a marcha engatada e o que ele pode entregar nesse RPM. |
| **Aceleração real** | Quanto o carro ESTÁ acelerando agora, medido pela combinação do GPS com os sensores internos do iPhone. |
| **Δ aceleração** | Diferença entre teórica e real. Quando positiva, o motor não está entregando o que poderia. |
| **Faixa de uso** | Banda de rotações onde o motor entrega mais. No Celta Bubi, 4.500 a 6.300 RPM. |
| **Recorde pessoal (PB)** | A melhor versão sua naquela curva/volta/configuração já registrada. |
| **Reference line** | Trajetória ideal teórica da pista (não confundir com PB). |
| **Ponto dinâmico** | V mínimo + ponto de freada + ápice de torque, calculados em pista (não no editor). |

---

## 2. Arquitetura conceitual (o que conversa com o quê)

```
┌─────────────────────────────────────────────────────────────────┐
│  FONTES VIVAS (na pista)                                        │
│  ─────────────────────                                          │
│  • iPhone (CoreMotion 100 Hz + CoreLocation 1 Hz)               │
│  • T4000 (RPM, marcha, λ, MAP, EGT, temp, pedal) — via Windows  │
│  • Câmera frontal (Daily.co)                                    │
└─────────────────────────────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  CAMADA DE DADO ENRIQUECIDO                                     │
│  ──────────────────────────                                     │
│  • Kalman 10 Hz → posição/velocidade estáveis                   │
│  • Detector → trecho atual + cruzamento de linhas               │
│  • CockpitEnvelope → publica no cabo USB + Realtime             │
└─────────────────────────────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  REFERÊNCIAS PERMANENTES (no banco local)                       │
│  ────────────────────────────────                               │
│  • Curva do motor (Celta Bubi: 79 pontos RPM × HP × Torque)     │
│  • Recorde pessoal por trecho × carro × configuração            │
│  • Pontos dinâmicos por trecho × carro × configuração           │
│  • Setup do carro (relação de marcha, redução, raio pneu, peso) │
│  • Faixa de uso (4.500–6.300 RPM derivado da curva)             │
│  • Manutenção: status de cada item (verde/amarelo/vermelho)     │
└─────────────────────────────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  CAMADA DE INTELIGÊNCIA (calculada em tempo real)               │
│  ────────────────────────────────────────                       │
│  • Aceleração teórica @ (RPM, marcha)                           │
│  • Δ aceleração (= teórica − real)                              │
│  • Decisão "carro perdeu" vs "piloto não extraiu"               │
│  • Δ volta atual vs PB (acumulado e por trecho)                 │
│  • Score por trecho (verde/amarelo/vermelho/ouro)               │
│  • Top 1 oportunidade da volta corrente                         │
│  • Frase do coach (qual disparar agora)                         │
└─────────────────────────────────────────────────────────────────┘
                                ▼
┌──────────────────────────────┬──────────────────────────────────┐
│  TELA DO PILOTO              │  TELA DO ENGENHEIRO              │
│  (notebook + 10,5")          │  (TV 32" AirPlay no box)         │
│  ──────────────────          │  ──────────────────              │
│  • Δ acumulado vivo          │  • Mapa térmico RPM × marcha × Δ │
│  • Cor por trecho            │  • Distribuição RPM do stint     │
│  • Marcha + RPM + cor faixa  │  • Recomendação automática       │
│  • Frase do coach            │  • Vmin/Pace por curva           │
│  • Top 1 oportunidade        │  • Saúde do motor (M/E/I/T)      │
└──────────────────────────────┴──────────────────────────────────┘
```

---

## 3. Plano em 6 blocos (em ordem de retorno)

### Bloco 1 — Cadastro estruturado do "motor + transmissão + chassi"

**Por que primeiro:** sem isso, o cálculo de aceleração teórica não existe. Hoje `Carro.motor` e `Configuracao.cambio` são texto livre — não dá pra calcular nada.

**O que entrega:**
- Migração de banco local v33 adicionando à `configuracoes`:
  - `relacao_marcha_1` até `relacao_marcha_6` (Double, opcional)
  - `relacao_diferencial` (Double, opcional)
  - `raio_pneu_metros` (Double, opcional)
  - `massa_ordem_marcha_kg` (Double, opcional — carro + piloto + combustível típico)
- Migração paralela adicionando à `carros` (se a equipe trocar setup raramente):
  - alternativa de fallback caso `configuracoes` esteja vazia
- Tela "Cadastro técnico do carro" dentro do painel do carro
- Seed inicial pro Celta Bubi (PK6, redução típica do Celta 1.0)

**Critérios de sucesso:**
- Smoke MN-18: round-trip dos 8 campos novos preservando valores
- Smoke MN-19: cálculo simbólico "RPM × redução × raio → velocidade km/h" produz resultado conhecido (60 km/h em 3ª aos 3.000 RPM com setup-padrão Celta)
- Tela permite editar e salvar valores típicos

**Esforço:** ~4 horas
**Bloqueia:** Blocos 2 e 3
**Dependência:** nenhuma

---

### Bloco 2 — Estrutura `DynoCurve` e função `aceleracaoTeorica`

**Por que segundo:** núcleo do lado engenheiro. Transforma a curva gravada hoje em algo que o código consulta a 10 Hz.

**O que entrega:**
- `public struct DynoCurve` em `P1FastCore` com:
  - `points: [DynoSample]` (RPM, torqueNm, powerHp)
  - `torqueAt(rpm:) -> Double` (interpolação linear entre pontos vizinhos)
  - `powerAt(rpm:) -> Double` (interpolação)
  - `peakTorqueRpm: Double` / `peakPowerRpm: Double`
- `DynoCsvParser.parseAsCurve(_:)` (extensão do parser atual) — devolve `DynoCurve`
- Seed embutido `DynoCurve.celtaBubi2026_05_18` com os 79 pontos da medição registrada hoje (constante codificada — não depende de leitura de CSV em tempo de execução)
- `public func aceleracaoTeorica(rpm:, marcha:Int, configuracao:Configuracao, curva:DynoCurve) -> Double` (em m/s²)
- Smokes MN-20..MN-27:
  - Torque interpolado nos pontos exatos da curva preserva valor
  - Torque interpolado entre pontos cai entre vizinhos
  - Aceleração teórica em 1ª aos 5.200 RPM com peso 1.000 kg ≈ valor conhecido (~6 m/s², checado contra a fórmula)
  - Aceleração em 5ª aos 6.000 RPM &lt; aceleração em 1ª aos 5.200 RPM (sanidade)

**Critérios de sucesso:**
- 8 smokes verdes
- Função pura (sem IO)
- Documentação inline com a fórmula explícita

**Esforço:** ~3 horas
**Bloqueia:** Blocos 3, 4
**Dependência:** Bloco 1 (precisa dos campos estruturados)

---

### Bloco 3 — Cálculo de Δ aceleração ao vivo + decisão "carro × piloto"

**Por que terceiro:** primeiro produto entregável de valor real pro piloto-engenheiro.

**O que entrega:**
- `public struct AceleracaoComparada` com `teorica`, `real`, `delta`, `causaProvavel: CausaProvavel` (enum)
- `public enum CausaProvavel`:
  - `.motorAbaixoEsperado(faixaRpm: ClosedRange<Double>)` — quando Δ &gt; X em retas com pedal ≥ 95%
  - `.pilotoMarchaBaixa(rpmAtual: Double, rpmIdeal: Double)` — quando saída de curva com RPM &lt; 80% do pico
  - `.pilotoPedalParcial(percentual: Double)` — quando pedal &lt; 100% em reta
  - `.cambioEscorregando(quedaRpmMs: Double)` — queda de RPM &gt; 1.500 numa troca
  - `.indeterminado` — quando nenhuma regra bate confiabilidade
- Função pura `analisarAmostra(_:setup:curva:)` que classifica
- Estado agregado por stint: `EstatisticaMotorStint` com soma de Δ por faixa RPM × marcha
- Smokes MN-28..MN-35 cobrindo cada cenário da regra

**Critérios de sucesso:**
- 8 smokes verdes
- Cada cenário do enum tem teste dedicado
- Regra de decisão "carro × piloto" documentada em uma tabela

**Esforço:** ~6 horas
**Bloqueia:** Blocos 4 e 5
**Dependência:** Blocos 1 e 2

---

### Bloco 4 — Tela do piloto plugada nos dados reais (painel ao vivo)

**Por que quarto:** primeiro retorno emocional pro piloto. Vê na pista funcionando.

**O que entrega:**
- O painel já desenhado ganha 5 fontes de dado ligadas:
  - **Centro:** Δ acumulado vs PB do stint atual (atualiza ao cruzar cada linha de trecho)
  - **Topo:** cor do último trecho (verde/amarelo/vermelho/ouro) + frase do `CoachPhrases` selecionada pelo `ErrorClassifier`
  - **Direita:** marcha (do `GearEstimation` ou T4000) + RPM (do T4000) + cor (verde dentro de 4.500–6.300, amarelo abaixo, vermelho acima de 6.350)
  - **Esquerda:** Top 1 oportunidade da volta corrente (vinda de `AttackPriority`)
  - **Pé:** alerta "carro perdendo Y% em motor" ou "marcha baixa em Cx" baseado no Bloco 3
- Renderização no notebook Windows usa `CockpitState` + `CockpitRenderer` já existentes — só plugar os novos observáveis
- Smokes MN-36..MN-39 do renderer

**Critérios de sucesso:**
- Painel exibe os 5 dados em tempo de simulação
- Demo loop com fixture `stint-brasilia-3-laps.v1.json` mostra dados se atualizando
- Frase do coach muda em &lt; 200 ms após cruzar fim de trecho

**Esforço:** ~8 horas
**Bloqueia:** Bloco 5 (parcialmente)
**Dependência:** Blocos 1, 2, 3

---

### Bloco 5 — Command Box do engenheiro (mapa térmico + histograma + recomendação)

**Por que quinto:** primeiro retorno pro engenheiro entre stints. Permite ajuste real durante o evento.

**O que entrega:**
- Aba "Motor" dentro do Command Box (extensão do mockup canônico aprovado)
- Painel A — **Mapa térmico RPM × marcha × Δ**:
  - Grade 8 linhas (marchas 1..N) × 8 colunas (faixas de RPM de 500 em 500)
  - Cor: verde = motor entrega o esperado · amarelo = perda &lt; 5% · vermelho = perda ≥ 5% · cinza = nunca usado
  - Hover/tap mostra Δ médio em N·m e amostras
- Painel B — **Distribuição de tempo por RPM**:
  - Histograma das amostras do stint
  - Sobreposto: faixa ideal (4.500–6.300 do Celta Bubi) destacada
  - Texto: "47% do tempo fora da banda forte"
- Painel C — **Recomendação automática**:
  - 1-3 frases geradas pela regra do Bloco 3 priorizadas
  - Cada frase tem destino: "Mecânica" (motor/ignição/mistura) ou "Pilotagem" (marcha/pedal)
- Smokes MN-40..MN-44

**Critérios de sucesso:**
- 3 painéis renderizam com fixture de stint conhecido
- Mapa térmico cobre toda a grade
- Frase de recomendação faz sentido pra cada cenário do enum `CausaProvavel`

**Esforço:** ~10 horas
**Bloqueia:** —
**Dependência:** Blocos 1, 2, 3 (não depende do Bloco 4)

---

### Bloco 6 — Debrief pós-stint + evolução entre eventos

**Por que sexto:** menor retorno imediato, maior retorno acumulado em 3-6 meses.

**O que entrega:**
- Tela "Debrief" ao encerrar stint:
  - Top 3 oportunidades (do `AttackPriority`) com tempo estimado de ganho
  - Onde melhorou vs stint anterior do mesmo evento
  - Onde regrediu
  - Onde acertou consistentemente (reforço positivo)
  - Plano sugerido pro próximo stint (do `Pedagogical`)
- Tela "Sua evolução" (entrada pelo menu Garagem → carro):
  - Linha do tempo dos últimos 5 eventos
  - Por curva: tempo médio + variação (mostra onde está estável e onde varia)
  - Conexão com Manutenção: quando o Δ aceleração crescer em N eventos consecutivos, sugerir pendência ("verificar bomba combustível")
- Conexão com Estoque: se a sugestão é "trocar vela", consultar disponibilidade
- Smokes MN-45..MN-49

**Critérios de sucesso:**
- Debrief abre automaticamente ao encerrar stint
- Top 3 oportunidades estimam tempo realista (validação com PB conhecido)
- Conexão Manutenção: gerar 1 pendência automática real em fixture

**Esforço:** ~8 horas
**Bloqueia:** —
**Dependência:** Blocos 1-5

---

## 4. Total e cronograma

| Bloco | Esforço | Acumulado | Marco |
|---|---|---|---|
| 1 — Cadastro técnico do carro | 4 h | 4 h | Fundação pra todo o resto |
| 2 — DynoCurve + aceleracaoTeorica | 3 h | 7 h | Motor "P1 Fast" calculável |
| 3 — Δ aceleração + carro × piloto | 6 h | 13 h | Inteligência pronta |
| 4 — Painel do piloto ao vivo | 8 h | 21 h | Próxima ida à pista já útil |
| 5 — Command Box engenheiro | 10 h | 31 h | Análise no box durante evento |
| 6 — Debrief + evolução + conexões | 8 h | 39 h | Aprendizado de longo prazo |

**Total: ~39 horas** (~5 dias de trabalho concentrado).

**Caminho crítico mais curto pra valor:** Blocos 1 + 2 + 3 + 4 = 21 horas → próxima ida à pista já tem painel inteligente.

**Caminho completo:** 39 horas → ciclo Mecânica/Engenharia/Piloto fechado.

---

## 5. Riscos identificados e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| **Captura real do T4000 atrasa** | Alta | Bloco 3+ ficam parciais | Usar simulador de T4000 com fixture pra desenvolver. Real entra depois. |
| **Massa do carro não é precisa** | Alta | Aceleração teórica calibra errado | Fazer pesagem real numa balança comercial antes do próximo evento. Anotar piloto + combustível. |
| **Reduções de câmbio variam por geração** | Média | Cálculo pode estar deslocado | Inicializar com valores de catálogo Celta 1.0, calibrar com 1 estrada conhecida ("60 km/h em 3ª aos 3.000 RPM"). |
| **Curva do dyno envelhece** | Certa | Cálculo desvia ao longo do tempo | Refazer dyno após qualquer mexida no motor + a cada 12 meses. Documento já preparado em `docs/dyno/`. |
| **Ambiente isolado de trabalho mistura entregas** | Alta (já vimos) | Submissão à versão oficial complicada | Decidir antes do Bloco 1 se entregamos como pacote único ou separado. Recomendação: pacote único (Estoque + Manutenção + Cadastro técnico + Cockpit) — mas é decisão do Flávio. |

---

## 6. O que este plano explicitamente NÃO faz

Pra evitar inchaço de escopo, lista do que fica de fora:

- ❌ Não desenha ghost map novo (MS-14 já está no plano mestre — separado).
- ❌ Não trabalha fases térmicas + chuva (MS-15 — separado).
- ❌ Não cria sincronização das tabelas de manutenção com servidor (continua local).
- ❌ Não adiciona suporte a múltiplos motores cadastrados por carro (1 por enquanto).
- ❌ Não calcula consumo de combustível teórico (existe `FuelCalc` no domínio — entra em ciclo separado).
- ❌ Não toca em mapeamento de injeção (compete à oficina).

---

## 7. Decisões abertas que dependem de você

1. **Massa do Celta Bubi em ordem de marcha** — qual número usamos no Bloco 1? Recomendo pesar antes do próximo evento.
2. **Reduções do câmbio Celta 1.0 (PK6)** — você tem catálogo da fábrica ou prefere medirmos com pista conhecida?
3. **Raio do pneu** — qual medida está montada hoje (175/70 R13, 185/60 R14, slick específico)?
4. **Caminho de submissão à versão oficial** — pacote único (Estoque + Manutenção + Cadastro técnico + Cockpit + Engenheiro) ou cada um separado?
5. **Quem começa: Bloco 1 hoje ou esperar a próxima ida à pista pra captar dados de telemetria reais primeiro?**

---

## 8. Próximo passo

Antes de executar qualquer bloco, este plano vai passar por **auditoria de agente terceiro** (próxima ação na conversa). O agente vai:
- Ler este documento.
- Verificar cada afirmação técnica contra o código real do projeto.
- Apontar contradições, lacunas, exageros.
- Corrigir o que estiver errado.
- Detalhar o que estiver vago.

Após o resultado do agente, este plano vira "PLANO_PILOTO_ENGENHEIRO_2026-05-18_v2.md" com as correções incorporadas.
