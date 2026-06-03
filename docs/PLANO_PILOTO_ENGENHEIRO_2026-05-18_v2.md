# P1 Fast — Plano Piloto + Engenheiro, versão 2

**Data:** 2026-05-18 (final da tarde)
**Origem:** versão 1 (`docs/PLANO_PILOTO_ENGENHEIRO_2026-05-18.md`) auditada por 2 agentes terceiros + 9 decisões de produto do Flávio respondidas em cartão (`.claude-perguntas/respostas/20260518-duvidas-plano.json`).
**Status:** pronto pra começar a execução pelo Bloco 1.

---

## 1. Resumo executivo (uma página)

O P1 Fast vai medir e mostrar 3 coisas em cada ida à pista:

1. **A diferença entre você e a sua melhor versão** — cada trecho da pista vira uma comparação automática com seu recorde pessoal naquele carro, naquela configuração de setup. Mostra a diferença em palavras curtas (ganhou 0,2 s na curva 5; perdeu 0,4 s na curva 8) no painel enquanto você corre.

2. **A diferença entre o motor que está girando e o motor que poderia girar** — combinando a curva oficial do dinamômetro (que registramos hoje no Celta Bubi: 122,8 cavalos a 6.050 rotações por minuto, 162,1 Newton-metro a 5.200) com a aceleração real medida na pista, o sistema sabe quanta força o motor está deixando de entregar. Isso vira o "Δ aceleração" — o ouro deste sistema.

3. **Se a perda é do CARRO ou do estilo da PILOTAGEM** — regras claras separam as duas causas. Em reta com pedal cravado e motor entregando abaixo = carro perdendo. Saindo de curva em rotação baixa = piloto em marcha errada. Cada caso vira mensagem diferente, no destino certo (Command Box do engenheiro com diagnóstico técnico; cockpit do piloto com frase curta e cor).

**Arquitetura geral fechada pelo Flávio em 18/05:**
- **Inteligência roda na nuvem** (Edge Functions da Supabase — a mesma assinatura que já usamos).
- **Frequência: trecho a trecho** (cerca de 5 segundos depois de cruzar o fim do trecho), não tempo real contínuo. Suficiente porque o piloto tem essa janela pra olhar a tela sem comprometer a pilotagem.
- **Painel é dinâmico** — usa o notebook + tela de 10,5" externa quando o equipamento do motor (T4000) está ativado; usa só o celular quando não está.
- **Algoritmo precisa pensar como ultra-especialista** — não basta dizer "este trecho perdeu tempo". Tem que ponderar o efeito em cadeia: alongar a aceleração de uma reta pode prejudicar a entrada na curva seguinte, líquido pode ser perda.

**Total de trabalho revisto:** 62 horas (~8 dias de trabalho concentrado). Versão 1 dizia 39 — auditoria mostrou que era subestimado.

---

## 2. Glossário (todo termo técnico explicado uma vez)

Quando aparecer pela primeira vez no documento, o termo técnico vem com explicação curta em parênteses. Aqui ficam todos juntos pra referência rápida.

| Termo | Significado |
|---|---|
| **Curva oficial do motor** | Tabela RPM → torque medida no dinamômetro. No Celta Bubi temos 79 pontos de 2.500 a 6.400 RPM. É a régua que diz "neste RPM o motor pode dar tanto torque". |
| **Aceleração teórica** | Quanto o carro DEVERIA estar acelerando agora, dado o motor que tem, a marcha engatada e o pedal pisado. Calculado da curva. |
| **Aceleração real** | Quanto o carro está acelerando agora, medido pelo iPhone (combinação de GPS com sensores internos). |
| **Δ aceleração** | A diferença entre teórica e real. Quando positiva, motor entregando abaixo do potencial. |
| **Trecho** | Pedaço delimitado da pista (cada curva e cada reta). Brasília tem 14 trechos catalogados. O Detector sabe em qual trecho o carro está a cada instante. |
| **Cruzamento de trecho** | Quando o carro passa do fim de um trecho pro início do próximo. Ponto onde a nuvem dispara análise. |
| **Recorde pessoal** | Sua melhor passagem registrada por aquele trecho, com aquele carro, com aquela configuração de setup. Base de comparação principal. |
| **Configuração** | No P1 Fast significa o "setup do carro pronto pra correr" (motor, pneu, câmbio, aerodinâmica). Trocar pneu de chuva pra slick = nova configuração. |
| **Shift light** | Faixa branca pulsando no painel. Hoje serve pra avisar troca de marcha. No novo plano também destaca o trecho de maior oportunidade. |
| **Cadeia de aprovação** | Fluxo 5 etapas pra ajustes técnicos: Proposta da Inteligência → Engenheiro propõe → Chefe valida → Sistema confirma → Central reavalia. Comando Box mostra; ação acontece no aplicativo do mecânico. |
| **Edge Function** | Programa que roda na nuvem da Supabase quando algo dispara (ex.: trecho acabou de fechar). Resposta volta em menos de 1 segundo. |
| **Cockpit do piloto** | Painel que o piloto vê enquanto corre. Pode ficar no notebook + tela de 10,5" externa (quando T4000 está ativado) ou só no celular. |
| **Command Box · Visão Engenheiro** | Painel que o engenheiro vê NO BOX (no AirPlay da Apple TV pra TV de 32"). Não é o mesmo que cockpit do piloto. |

---

## 3. Decisões fechadas pelo Flávio em 18/05 (incorporadas)

Estas 9 respostas vieram do cartão `20260518-duvidas-plano-piloto-engenheiro.html` e norteiam o plano todo:

1. **(A) Inteligência na nuvem** — Edge Functions Supabase. iPhone e notebook só consomem o resumo processado.
2. **(B) Submissão à versão oficial: separado** — cada bloco vira sua entrega independente.
3. **(C) Massa do carro: catálogo + peso do piloto cadastrado + combustível estimado** — cálculo passa a ser sensível a quem está dirigindo.
4. **(D) Painel mostra cor em todos os trechos, mas shift light branco só destaca o trecho de maior oportunidade** — antes de entrar e depois de sair.
5. **(E) Painel é dinâmico** — só celular se T4000 não está ativo; notebook + 10,5" externa se T4000 está ativo. Celular continua gravando vídeo, GPS e sensores em ambos os casos.
6. **(F) Pendência de manutenção automática** + destaque visual no Command Box quando motor cai em 3 eventos seguidos.
7. **(G) Só o Celta Bubi (também chamado de Bolinha — é o mesmo carro)** — outros carros eram massa de teste minha; saem do escopo.
8. **(H) Captura real do T4000: próxima ida à pista** — trabalho de software roda em paralelo com dado simulado; integração final acontece quando você for à pista.
9. **(I) Recomendação do engenheiro segue cadeia das 5 etapas** — Command Box é só visualização; ação acontece no aplicativo do mecânico.

---

## 4. Arquitetura geral

```
┌─────────────────────────────────────────────────────────────┐
│  CAPTURA NO CARRO (dois cenários)                          │
│  ──────────────────────────────────                        │
│  Cenário 1 (só celular):                                   │
│    iPhone — sensores 100 Hz + GPS 1 Hz + câmera frontal    │
│                                                             │
│  Cenário 2 (T4000 ativado):                                │
│    iPhone — sensores + GPS + câmera (gravador)             │
│    T4000 — RPM, marcha, mistura, pressão, temperaturas     │
│    Notebook do carro — recebe T4000 + tela 10,5" pro piloto│
└─────────────────────────────────────────────────────────────┘
                              ↓
                     CADA FIM DE TRECHO
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  UPLOAD PRA NUVEM (Supabase)                                │
│  ─────────────────────────                                  │
│  Pacote: amostras do trecho + identificação                 │
│           (carro, configuração, piloto, autódromo, evento)  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  EDGE FUNCTION DA NUVEM (Supabase) — coração do sistema    │
│  ──────────────────────────────────                        │
│  • Calcula aceleração teórica em cada amostra              │
│  • Calcula Δ aceleração                                     │
│  • Classifica causa (carro · piloto · câmbio · ?)           │
│  • Compara com recorde pessoal do trecho                    │
│  • Pondera trade-off com trechos vizinhos                   │
│  • Escolhe top 1 oportunidade da volta                      │
│  • Detecta motor caindo (vs eventos anteriores)             │
│  • Gera frase pro piloto e diagnóstico pro engenheiro       │
└─────────────────────────────────────────────────────────────┘
                              ↓
                  RESUMO POR TRECHO (JSON pequeno)
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  DESTINOS                                                   │
│  ────────                                                   │
│  • Painel do piloto (notebook OU celular conforme cenário) │
│  • Command Box · Visão Engenheiro (TV 32" no box)          │
│  • Banco local pra debrief depois do stint                 │
│  • Pendência de manutenção (quando regra de motor caindo)  │
└─────────────────────────────────────────────────────────────┘
```

**Por que essa arquitetura é melhor:**
- Não precisa de cálculo em milissegundos no carro. Computação pesada fica na nuvem.
- Lógica única num lugar só (a Edge Function). Sem duplicar entre Swift do iPhone e C# do notebook.
- Janela de 5 segundos pelo cruzamento de trecho é suficiente — confirmado pelo Flávio.
- Edge Function tem acesso direto ao banco de dados oficial (recorde pessoal, curva do motor, configuração do carro, peso do piloto cadastrado). Cálculo fica completo.

---

## 5. Os 6 blocos (em ordem de retorno)

### Bloco 1 — Cadastro técnico do Celta Bubi + ligação com o piloto

**Por que primeiro:** sem isso a aceleração teórica não tem como sair de zero.

**O que entrega:**

(a) Cadastro novo na "Configuração do carro" (que já existe — `configuracoes`). Vamos adicionar 9 campos numéricos opcionais:

| Campo | Significado | Valor inicial pro Celta Bubi |
|---|---|---|
| Relação da 1ª marcha | Quanto a marcha multiplica o torque do motor | Catálogo Celta 1.0 PK6 (a confirmar) |
| Relação da 2ª marcha | idem | idem |
| Relação da 3ª marcha | idem | idem |
| Relação da 4ª marcha | idem | idem |
| Relação da 5ª marcha | idem | idem |
| Relação da 6ª marcha | idem (se houver) | nulo |
| Relação do diferencial | Multiplicador da saída do câmbio pra roda | Catálogo Celta 1.0 (a confirmar) |
| Raio do pneu (metros) | Pra converter rotação da roda em velocidade | Depende do pneu montado (a confirmar) |
| Massa do carro pronto (kg) | Carro + tanque típico, sem piloto | Catálogo Celta + estimativa (~870 kg) |

(b) **Ligação massa + piloto + combustível** — quando começa um stint, o sistema soma:
- Massa do carro pronto (do cadastro) +
- Peso do piloto cadastrado pra este stint (já existe campo "peso em kg" no cadastro de piloto) +
- 30 kg estimados de combustível (calibra depois)

(c) Tela nova "Setup técnico do carro" entrando pelo painel do carro → configuração ativa → botão "Setup técnico".

**Critérios de sucesso:**
- Você consegue cadastrar os 9 valores na tela e salvar.
- O sistema mostra o peso total calculado (carro + piloto + combustível) na tela do stint.
- 5 testes automáticos novos validam: persistência dos valores · cálculo de peso total · validação de faixas razoáveis · ligação correta com o piloto · ligação correta com a configuração.

**Esforço:** 6 horas
**Bloqueia:** Blocos 2 e 3
**Pré-requisito do mundo real:** você me passar relações de marcha e raio do pneu (catálogo Celta 1.0 PK6 + medida do pneu montado hoje).

---

### Bloco 2 — Curva consultável do motor + aceleração teórica (centro técnico)

**Por que segundo:** transforma a curva do dinamômetro (estática num PDF) numa régua que o sistema consulta.

**O que entrega:**

(a) Estrutura "Curva do Motor" em código (Swift do iPhone + replicação em TypeScript da Edge Function — mesma lógica, dois ambientes). Recebe RPM e devolve torque interpolando entre os 79 pontos.

(b) Função "Aceleração teórica" com 10 entradas:
- RPM atual
- Marcha engatada
- Velocidade atual (km/h)
- Pedal do acelerador (% — quando T4000 está ativado)
- Curva do motor
- Relações de marcha (do cadastro)
- Relação do diferencial
- Raio do pneu
- Massa total (carro + piloto + combustível)
- Constantes ambientais (resistência do ar, resistência do solo, densidade do ar pra altitude de Brasília) — começam com valores padrão e podem ser calibradas depois.

(c) Curva oficial do Celta Bubi (os 79 pontos do dinamômetro) embutida no código como constante — não precisa ler CSV em tempo de execução.

**Critérios de sucesso:**
- 10 testes automáticos validam interpolação da curva, cálculo em condições conhecidas, comportamento nos extremos.
- O resultado da função em 5.200 RPM em 3ª marcha bate com o esperado calculado à mão (sanity check).
- Mesma fórmula roda no Swift e no TypeScript — saída idêntica até a quarta casa decimal.

**Esforço:** 6 horas
**Bloqueia:** Bloco 3
**Pré-requisito do mundo real:** Bloco 1 fechado.

---

### Bloco 3 — Edge Function da nuvem: motor de análise por trecho (centro de inteligência)

**Por que terceiro:** primeiro produto de valor real entregue. Cada trecho cruzado vira análise estruturada.

**O que entrega:**

(a) Edge Function na Supabase chamada `trecho-analisar`. Quando dispara:

1. **Entrada:** pacote do trecho recém-fechado (amostras do iPhone + amostras do T4000 quando ativado).
2. **Processamento:**
   - Calcula aceleração teórica em cada amostra (usa Bloco 2)
   - Calcula Δ aceleração
   - Classifica causa de perda (regra abaixo)
   - Compara tempo do trecho com recorde pessoal
   - Calcula ganho potencial estimado (segundos)
3. **Saída:** resumo do trecho (cor verde/amarelo/vermelho/ouro · frase pro piloto · diagnóstico pro engenheiro · ganho estimado em segundos · causa classificada).

(b) **Regras de classificação de causa** (com limiares iniciais — calibrar com 2-3 stints reais):

| Cenário | Condição numérica | Causa identificada |
|---|---|---|
| Motor abaixo do esperado | Numa reta, pedal ≥ 95% por ao menos 0,5 segundo, Δ aceleração ≥ 0,5 m/s² | CARRO — motor entregando abaixo, com identificação da faixa de RPM afetada |
| Marcha baixa na saída | Até 2 segundos depois do ponto mais lento da curva, pedal ≥ 90%, RPM abaixo de 80% do pico de torque | PILOTO — marcha errada |
| Pedal parcial em reta | Reta, velocidade > 60 km/h, pedal < 95% por mais de 0,3 segundo | PILOTO — não pisou tudo |
| Câmbio escorregando | Queda de RPM ≥ 1.500 em menos de 100 milissegundos, velocidade não caiu | CÂMBIO — embreagem possivelmente escorregando |
| Indeterminado | Nenhuma das anteriores bate com confiança | INDETERMINADO — verificar com o piloto |

(c) **Priorização ponderada de trechos** (algoritmo "ultra-especialista"):

Quando 2 trechos consecutivos estão acoplados (saída de uma reta cai numa curva), o ganho aparente de um pode virar perda no outro. O algoritmo simula a cadeia:

```
Pra cada trecho do top 5 candidatos a "oportunidade":
  ganho_aparente = (tempo_atual - recorde_pessoal_trecho)
  efeito_no_trecho_seguinte = simular(velocidade_saida_proposta)
  ganho_líquido = ganho_aparente - perda_no_seguinte
Ordena por ganho_líquido decrescente.
Top 1 = oportunidade real (não a aparente).
```

Exemplo: piloto está atrasando a freada antes da curva 8 — ganho aparente 0,4 s. Mas isso fará a curva 8 ter velocidade mínima 5 km/h menor — perda estimada 0,3 s na curva 9 (que vem em sequência). Ganho líquido = 0,1 s. Pode não ser a melhor oportunidade do dia.

(d) **Detecção de motor caindo entre eventos** — se o Δ aceleração médio numa faixa de RPM cresce de forma consistente em 3 eventos seguidos com o mesmo carro+configuração, gera pendência automática de manutenção ("verificar mistura/vela/filtro na faixa de X a Y mil RPM").

**Critérios de sucesso:**
- 12 testes automáticos cobrindo cada cenário de classificação de causa + priorização ponderada com exemplo trecho-cadeia + detecção de motor caindo.
- Resposta da função em menos de 800 milissegundos com pacote de tamanho real.
- Saída JSON estável e documentada.

**Esforço:** 12 horas
**Bloqueia:** Blocos 4, 5, 6
**Pré-requisito do mundo real:** Blocos 1 e 2 fechados. Não precisa do T4000 real ainda — desenvolve com pacote simulado.

---

### Bloco 4 — Painel do piloto (versão NOTEBOOK + 10,5" externa) + versão CELULAR

**Por que quarto:** primeiro retorno emocional pro piloto. Vê funcionando na próxima pista.

**O que entrega:**

(a) **Detector de cenário** — ao iniciar um stint, o sistema verifica se o T4000 está ativado:
- T4000 ativo → painel renderiza no notebook (a tela 10,5" externa invertida é o que o piloto vê).
- T4000 inativo → painel renderiza no celular (a tela do iPhone vira cockpit; iPhone continua gravando GPS, sensores e vídeo).

(b) **Conteúdo do painel** (igual nos dois cenários, layout adaptado):

| Zona | O que mostra |
|---|---|
| Centro grande | Diferença acumulada vs seu recorde pessoal nesta volta (em segundos com sinal) |
| Topo | Nome do trecho que acabou de passar + cor (verde · amarelo · vermelho · ouro) + frase curta da nuvem |
| Direita | Marcha atual + RPM atual (do T4000) + cor da faixa (verde dentro de 4.500-6.300 do Celta; amarelo abaixo; vermelho acima de 6.350) |
| Esquerda | Top 1 oportunidade da volta (com tempo estimado de ganho) |
| Cor de cada trecho do mapa | Status atual de TODOS os trechos sempre visível |
| Shift light branco piscando | Destaca APENAS o trecho de maior oportunidade — antes de entrar e depois de sair |

(c) **Atualização**: quando a nuvem responde (cerca de 5 segundos depois do trecho fechar), o painel pisca brevemente no nome do trecho e atualiza valores.

**Critérios de sucesso:**
- Painel renderiza nos 2 cenários (notebook + 10,5" / celular).
- Atualização chega em menos de 7 segundos depois do cruzamento de fim de trecho (5 segundos da nuvem + 2 de margem).
- 8 testes automáticos validam: cada zona do painel · detecção de cenário · pulsação do shift light no trecho certo · cores corretas.
- Demonstração com pacote simulado: 3 voltas do Celta Bubi em Brasília mostram dados se atualizando trecho a trecho.

**Esforço:** 12 horas
**Bloqueia:** —
**Pré-requisito do mundo real:** Bloco 3 fechado.

---

### Bloco 5 — Command Box · Visão Engenheiro (aba "Motor" nova)

**Por que quinto:** primeiro retorno pro engenheiro entre stints. Permite ajuste real durante o evento.

**O que entrega:**

(a) **Aba "Motor"** nova dentro do Command Box (extensão do mockup canônico aprovado — pré-requisito: trazer o arquivo do mockup pro ambiente isolado de trabalho antes de começar).

(b) **3 painéis** dentro da aba:

**Painel A — Saúde do motor por trecho**
Reusa o desenho oficial da pista de Brasília (495 pontos congelados, regra dura — não suavizar). Cada trecho fica colorido pelo Δ aceleração médio observado. Verde = motor entregou o esperado. Amarelo = perda leve. Vermelho = perda relevante. Cinza = trecho sem dados suficientes.

Nas RETAS, não pinta o caminho inteiro — usa marcadores pontuais (3-5 pontos por reta) representando faixas de RPM diferentes. Regra dura "torque é PONTO, não TRECHO" mantida.

**Painel B — Distribuição de tempo do piloto por faixa de RPM**
Histograma das amostras do stint. Sobreposto: a faixa ideal (4.500-6.300 RPM da curva oficial do Celta Bubi). Mostra "47% do tempo fora da banda forte" como número.

**Painel C — Sugestões do engenheiro com cadeia de aprovação**
Cada sugestão vinda da nuvem aparece como cartão com:
- Texto da sugestão (ex.: "Mistura aparentemente pobre entre 5.500 e 6.000 RPM em 3ª e 4ª marcha").
- Indicador da cadeia de 5 etapas (Proposta da Inteligência → Engenheiro propõe → Chefe valida → Sistema confirma → Central reavalia). A bolinha colorida mostra em qual etapa está.
- Botão "Detalhes" abre a leitura completa. **NÃO existe botão "Aplicar" no Command Box.** A ação acontece no aplicativo do mecânico.

(d) **Pendência de manutenção automática** — quando a regra de "motor caindo 3 eventos seguidos" dispara, aparece um cartão destacado em vermelho na aba Motor + cria automaticamente uma pendência na função Manutenção (que entregamos hoje de madrugada).

**Critérios de sucesso:**
- 3 painéis renderizam com pacote real do stint demonstrativo.
- Mapa de Brasília reusa o desenho canônico — verificado por inspeção do código.
- Cadeia de 5 etapas funciona com pelo menos 1 sugestão exemplo.
- Pendência automática nasce na função Manutenção quando o cenário de "motor caindo" dispara.
- 10 testes automáticos.

**Esforço:** 16 horas
**Bloqueia:** —
**Pré-requisito do mundo real:** Bloco 3 fechado + mockup do Command Box trazido pro ambiente isolado.

---

### Bloco 6 — Debrief pós-stint + evolução de longo prazo

**Por que sexto:** aprendizado entre sessões e ao longo de eventos. Retorno acumulado em 3-6 meses.

**O que entrega:**

(a) **Tela "Debrief"** ao encerrar stint:
- Top 3 oportunidades reais (priorização ponderada, não a aparente) com tempo estimado de ganho.
- Onde você melhorou comparado ao stint anterior do mesmo evento.
- Onde você regrediu.
- Onde você acertou consistentemente (reforço positivo).
- Plano sugerido pro próximo stint (vindo do decisor pedagógico que já existe).

(b) **Tela "Sua evolução"** (entrada pelo menu Garagem → carro → "Evolução"):
- Linha do tempo dos últimos 5 eventos.
- Para cada trecho: tempo médio + variação (mostra onde está estável e onde varia muito).
- Aviso de regressão de longo prazo: "Você está 0,8 segundos mais lento na curva 8 em Brasília desde maio".

(c) **Conexão Estoque** — quando uma sugestão é "trocar vela", o sistema consulta automaticamente o Estoque (entregue ontem). Se há disponível, mostra "1 em Box". Se não há, mostra "ESGOTADA — pedir antes do próximo evento" sem bloquear a sugestão.

**Critérios de sucesso:**
- Debrief abre automaticamente ao encerrar stint.
- Top 3 oportunidades batem com priorização ponderada (não com priorização aparente).
- Conexão Estoque: pelo menos 1 sugestão de exemplo consulta e exibe disponibilidade.
- 10 testes automáticos.

**Esforço:** 10 horas
**Bloqueia:** —
**Pré-requisito do mundo real:** Blocos 3, 4 e 5 fechados.

---

## 6. Cronograma e dependências

| Bloco | Esforço | Acumulado | Pré-requisito mundo real |
|---|---|---|---|
| 1 — Cadastro técnico | 6 h | 6 h | Você passar relações de marcha + raio do pneu |
| 2 — Curva consultável + aceleração teórica | 6 h | 12 h | Bloco 1 |
| 3 — Edge Function de análise por trecho | 12 h | 24 h | Bloco 2 (T4000 simulado por enquanto) |
| 4 — Painel do piloto (notebook + celular) | 12 h | 36 h | Bloco 3 |
| 5 — Command Box · Visão Engenheiro | 16 h | 52 h | Bloco 3 + mockup importado pro ambiente |
| 6 — Debrief + evolução + conexões | 10 h | 62 h | Blocos 3, 4 e 5 |

**Total:** 62 horas (~8 dias de trabalho concentrado).

**Caminho crítico mais curto pra valor visível:** Blocos 1 + 2 + 3 + 4 = **36 horas** (próxima ida à pista já tem cockpit inteligente atualizado por trecho).

**Caminho completo (engenharia + aprendizado de longo prazo):** 62 horas.

---

## 7. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Relações de marcha do Celta 1.0 PK6 incorretas | Começa com catálogo de fábrica; calibra com pista conhecida (60 km/h em 3ª aos 3.000 RPM deve dar mais ou menos X — ajusta) |
| Captura real do T4000 atrasa | Trabalho roda em paralelo com dado simulado. Integração final ao receber dado de pista. |
| Curva do motor envelhece | Refaz dinamômetro a cada 12 meses ou após mexida no motor. Documento estruturado já preparado em `docs/dyno/`. |
| Edge Function da Supabase responder devagar | Limite de 1 segundo aceito (você falou 5). Se ultrapassar, otimiza a função ou pré-calcula. |
| Algoritmo de priorização ponderada acertar pouco no início | Calibração contínua usando recorde pessoal. Depois de 5-10 stints, o sistema "aprende" o piloto. |
| Massa do carro errada | Pesar de verdade quando der oportunidade. Catálogo + estimativa funciona bem por 80-90 horas; depois disso o desvio acumula. |

---

## 8. O que este plano explicitamente NÃO faz

Pra evitar inchaço de escopo:

- Não desenha o "ghost map" (linha fantasma do recorde no mapa) — está em outro caminho de entrega do projeto.
- Não trabalha fases térmicas + chuva — está em outro caminho de entrega.
- Não cria sincronização das tabelas de Manutenção com a Supabase — Manutenção continua local enquanto você não autorizar a frase exata "MIGRAR PARA PRODUÇÃO".
- Não adiciona outros carros (Bolinha = Celta Bubi é o único hoje).
- Não calcula consumo teórico de combustível — fica num caminho separado.
- Não toca em mapeamento de injeção — competência da oficina.

---

## 9. Próximo passo concreto

**Pré-requisito do mundo real pra começar o Bloco 1:**
1. Você me passa as relações de marcha do câmbio do Celta 1.0 PK6 (catálogo de fábrica vale como primeira aproximação).
2. Você me confirma qual pneu está montado hoje (medida e marca).
3. Massa: começo com catálogo do Celta (~870 kg) + peso do seu cadastro de piloto + 30 kg de combustível. Você ajusta depois.

**Após essas 3 informações, posso começar o Bloco 1 imediatamente.** Tempo até cockpit inteligente funcionando: cerca de 36 horas de trabalho concentrado (Blocos 1+2+3+4). Se você for à pista nesse meio tempo, captura real do T4000 já se integra direto.

Versão 1 deste plano fica preservada em `docs/PLANO_PILOTO_ENGENHEIRO_2026-05-18.md`. Esta versão 2 substitui em escopo, arquitetura e cronograma.
