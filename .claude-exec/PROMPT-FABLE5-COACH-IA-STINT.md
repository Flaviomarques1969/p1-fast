# PROMPT PARA O FABLE 5 — Coach de IA de Stint (P1 Fast, rodando no .exe do Windows)

> **Como usar (Flávio):** entregue este arquivo inteiro ao Fable 5 numa sessão do Claude Code aberta na raiz `/Users/imac/Projetos/P1 Fast`. Este documento é o *briefing* completo — já traz o dado separado e aponta os arquivos-fonte-da-verdade para o Fable ler mais fundo. Ele foi montado só sobre código e docs REAIS do projeto (verificados em 2026-07-07), não sobre suposição.

---

## 0. O que é este documento e o que você (Fable 5) tem que fazer

Você é o **projetista-chefe** de um módulo novo do P1 Fast: o **Coach de IA de Stint**. Sua entrega é uma **solução de projeto completa e construível** (metodologia + inteligência de análise + especificação das duas partes da tela + plano de execução), **não** é sair escrevendo o código final ainda. Trabalhe com **profundidade máxima**: gere mais de uma abordagem candidata, critique-as, e recomende a melhor com justificativa.

Antes de projetar, **leia os arquivos-fonte-da-verdade da Seção 8**. Nada de inventar campo, tabela, função ou comportamento: se um dado não existir, escreva "não encontrei X" — é regra dura do projeto.

---

## 1. A MISSÃO (escopo travado — não amplie sem marcar como proposta)

Construir um coach que, **a cada volta**, olha o desempenho do piloto naquele **stint** (turno em pista) e **identifica a MAIOR oportunidade de ganho de tempo** — a única que mais paga. Essa oportunidade pode ser:

- **uma técnica** (ex.: trail-braking, soltar o freio mais cedo, abrir o gás antes),
- **um trecho/curva específico** (ex.: "você está perdendo na freada da Curva da Bruxa"),
- **ou outra coisa** (ex.: linha, ponto de troca de marcha, velocidade mínima baixa).

Essa orientação aparece **no MIOLO da tela**, dividida em **duas partes**:

- **PARTE A — Gráfico com ZOOM do trecho onde ele está.** Uma visualização ampliada do pedaço da pista/curva em foco.
- **PARTE B — A mensagem.** Focada na **metodologia de orientação, ensino e apontamento da solução**, considerando que **o piloto está em pista, em alta velocidade**.

O piloto vê isso na **tela de 10,5" do notebook dentro do carro** (o `.exe`).

---

## 2. RESTRIÇÕES DURAS (inegociáveis — são o padrão do Flávio e do projeto)

1. **Tema escuro. Fundo PRETO puro (`oklch(0% 0 0)`), NUNCA branco.** "Limpo" = leve e com respiro, não claro.
2. **Sem emojis. Só ícones de traço (SVG com `stroke`).**
3. **Tratamento sempre "você". NUNCA "tu/te/ti/teu/tua".** Vale para toda mensagem na tela.
4. **Tela 956 × 440 px, paisagem, tela cheia (kiosk).** É a proporção canônica aprovada (22/06/2026) para a tela 10,5".
5. **NÃO quebrar o painel aprovado** (`web/cockpit/cockpit-volta-real.html`, congelado em `_design-reference/versions/cockpit-painel-APROVADO-2026-06-22.html`). Melhoria **soma por cima**, preservando o que existe. Você vai ter que decidir **onde** o coach cabe no miolo sem atropelar sensores/shift/ápice/delta/freada — isso faz parte do projeto.
6. **Número na tela nunca leva sinal (+/−).** A direção/qualidade é dada pela **COR** (verde = bom, âmbar = atenção, vermelho = ruim). Regra do Flávio de 04/07.
7. **Produção é protegida.** Você está em DESENVOLVIMENTO. Não altere canal ao vivo (`cockpit-bubi-live`), banco de produção, nem faça publicação. Projete; não coloque no ar.
8. **Só dado REAL.** Proibido inventar volta, campo ou passagem. Honestidade sobre limite físico (ex.: GPS ~1 Hz, ápice ±1 m só confiável com 25 Hz) faz parte da entrega.

---

## 3. TENSÃO CENTRAL QUE VOCÊ TEM QUE RESOLVER (leia com atenção)

O painel atual tem uma **régua dura para as frases curtas**: **máximo 2 palavras**, uma por vez (ex.: "Freou Cedo", "Acelere Mais"). Isso existe porque a 200+ km/h o piloto tem ~1–2 s de leitura periférica.

Mas o Flávio agora pede um **coach com metodologia de ENSINO** — uma mensagem mais rica que uma frase de 2 palavras. **Essas duas coisas não brigam se forem superfícies diferentes.** Sua tarefa é projetar essa segunda superfície (o miolo — gráfico + mensagem de coach) de um jeito que **seja seguro para quem está guiando em alta velocidade**. Você decide:

- **Quando** o coach aparece (a 200 km/h ninguém lê parágrafo). Candidatos óbvios: **na reta**, **ao cruzar a linha de chegada / fim de volta**, **na janela de box**, ou em **trecho de baixa carga cognitiva**. Você define e justifica.
- **Quanto** de texto é seguro, e como escalonar (glance de 1 linha no calor da volta → explicação mais longa quando o piloto tem folga).
- Como o **gráfico** comunica em relance, sem exigir leitura demorada.

Resolver essa tensão com método é o coração da entrega.

---

## 4. O QUE JÁ EXISTE (a fundação que você herda — tudo verificado no código)

Você **não vai começar do zero na análise** — o motor que alimenta o coach já roda. Você começa do zero **só no gráfico com zoom** (esse elemento não existe hoje).

### 4.1 O motor de delta por sub-trecho — JÁ PRONTO E TESTADO
Compara **a passagem atual de cada curva** contra a **melhor passagem histórica** (mesmo carro + mesma pista + mesmo tipo de pneu), ponto a ponto, e devolve **onde o piloto perdeu/ganhou tempo, por sub-trecho**.

- Web (referência executável): `web/cockpit/delta-calculator.js`
- Windows (produto): `windows/cockpit/P1Fast.Cockpit.Domain/DeltaCoach.cs` (port fiel do de cima)

Os **5 sub-trechos** de cada curva: `entrada`, `freio`, `apice`, `pace`, `saida`.

Formato de saída (é isto que você tem para trabalhar por curva):
```
{
  segmentId: "uuid-do-segmento",
  deltaTotalS: 0.18,            // perda total na curva, em segundos (>0 = perdeu)
  porSubTrecho: {
    entrada: { deltaS: 0.02, distM: 15.3, amostras: 5 },
    freio:   { deltaS: 0.08, distM: 22.1, amostras: 7 },
    apice:   { deltaS: -0.01, distM:  8.9, amostras: 3 },
    pace:    { deltaS: 0.04, distM: 12.5, amostras: 4 },
    saida:   { deltaS: 0.05, distM: 18.2, amostras: 6 }
  },
  piorSubTrecho: 'freio',      // o sub-trecho que mais custou tempo
  piorDeltaS: 0.08
}
```
> **Insight para você:** o coach de HOJE só olha UMA curva e traduz o pior sub-trecho numa frase de 2 palavras. O que o Flávio pede é a **evolução**: olhar a **volta inteira / o stint inteiro**, somar os deltas, achar a **UMA maior oportunidade** (recorrente ou pontual), estimar o **ganho em segundos**, e ensinar. Essa síntese é sua a construir.

### 4.2 O detector de trecho — JÁ PRONTO
Diz **em qual curva o carro está** e dispara os 4 marcos canônicos.
- `web/cockpit/trecho-detector.js` / `windows/cockpit/P1Fast.Cockpit.Domain/TrechoDetector.cs`
- 4 marcos por curva: `entrada-cruzou` → `freada-iniciou` (desaceleração ≥ 0,5 g) → `apice-cruzou` (±60 m do ideal, com ângulo do erro) → `saida-cruzou`.
- Brasília tem **8 curvas** (lista na 4.6). É daqui que sai "o trecho onde ele está" — a âncora do seu gráfico com zoom.

### 4.3 O ENCAIXE DO COACH — VAZIO DE PROPÓSITO (é aqui que você pluga)
`web/command-box/cerebro/cerebro-coach.js` **existe mas devolve `null`** hoje — é a "Onda 3", reservada e nunca montada. **É a casa natural do Coach de IA.** O cérebro (`web/command-box/cerebro/cerebro-painel.js`) já monta o "pacote pronto" que as telas só exibem, e já tem o campo `coach: null` esperando.

### 4.4 Contrato de dados — o que o carro entrega (campos REAIS)
Fonte única: `docs/CONTRATO_DADOS.md`. Entrada pelo canal `cockpit-bubi-live` (ponte `web/cockpit/cloud-bridge.js`).

**Motor (T4000, ~10 Hz):** `rpm`, `batteryV`, `mapBar`, `tpsPct` (acelerador %), `airTempC`, `waterTempC`, `lambda`, `mapaAtual`, `consumoBorboleta`.
**Pilotagem:** `pedalAceleradorPct`, `pedalFreioPct`, `pressaoFreioBar`, `speedKmh`, `accelXg`, `accelYg`, `accelZg`.
**Cilindros:** `fuelInjectionBalanced`, `fuelInjectionSpread`, `fuelTimeA`.
**Cronômetro:** `cronometroParcialS`, `cronometroTotalS`. **Status:** `alarmes`, `statusSinais`.
**GPS (evento separado, ~1 Hz):** `lat`, `lng`, `kmh`, `tWall` (timestamp). Fusão GPS×motor é feita pelo `tWall`.

Cada **ponto** de uma passagem, já anotado:
```
{ lat, lng, kmh, t: tWall, fracao: 0..1, sub: "entrada|freio|apice|pace|saida" }
```

### 4.5 A melhor volta histórica — onde mora
Tabela `public.melhores_passagens_trecho` (migração `supabase/migrations/0026_...sql`). Chave: `(carro_id, track_id, tipo_pneu, segment_id)`, guarda a de **menor `tempo_trecho_s`** e o `pontos_json`. **Pneu separa histórico** (radial-185-14 ≠ semi-slick). Fixture real para você testar sem banco: `web/command-box/fixtures/passagens-bubi-brasilia.v1.json`.

### 4.6 Geometria da pista de Brasília — para o gráfico com zoom
- **8 curvas + tipo** (`web/command-box/tipos-curva-brasilia.js`): CURVA 01 = T5 (raio crescente); RETA OPOSTA = T1 (lenta pós-reta); CURVA 2 = T0 (média clássica); JUNÇÃO = T2 (raio decrescente); BRUXA = T0; PLACAR = T2; CURVA "S" = T4 (encadeada); VITÓRIA = SF (sem freada, pé embaixo).
- **Ápices semente** (`web/cockpit/apices-semente-brasilia.js`): lat/lng de cada ápice.
- **Desenho oficial da pista** (`web/cockpit/pista-oficial-brasilia.js`): 495 pontos, conversor `geoParaDesenho(lat,lng) → {x,y}` no espaço 823×799 px (selo DEFINITIVO do Flávio).
- **Polilinha densa + fração de arco** (`web/command-box/pista-cb-polyline.js`): `fracDe(x,y) → 0..1` ao longo da volta.
> Você tem, portanto, **como desenhar a pista e recortar/ampliar exatamente a curva onde o carro está**. O "zoom" é recorte dessa geometria em torno do `segmentId` atual.

### 4.7 O painel onde tudo isso vive (não quebrar)
956×440, fundo preto, `web/cockpit/cockpit-volta-real.html` + `web/cockpit/cockpit.css`. Elementos atuais: cluster de 14 sensores (topo), barra de voltas (topo), número **Delta + frase** (esquerda), **resultado da freada** (direita), **ápice com bolinha** + entrada/freio/Vmin/saída (base), **shift light** de 17 LEDs (base), **luz de freio** nas laterais, **modo crítico** (overlay que toma a tela). O **miolo hoje está relativamente livre** entre o topo e a base — é o alvo do coach. **Não existe nenhum desenho de traçado/mapa no painel do piloto hoje** — o gráfico com zoom é elemento 100% novo.

### 4.8 Onde roda de verdade
- **Produto:** o `.exe` é **C# nativo (WinUI 3 + .NET 8)** em `windows/cockpit/` (tela `MainWindow.xaml`, estado `CockpitState.cs`, 255 testes automáticos passando).
- **Método do projeto:** desenvolve-se primeiro na **referência web** (`web/cockpit/`, roda no navegador com replay da volta real 21/06), valida, e **depois porta para o C#**. As duas superfícies andam em paridade.
- **Sua entrega deve mirar o `.exe`**, mas o caminho natural de construção é **web-referência primeiro → portar para o Windows**.

### 4.9 Metodologia de mensagem já aprovada (a régua que você respeita/estende)
- Frases pedagógicas de 2 palavras já existem (`web/cockpit/mensagens-pedagogicas.js` / `DeltaCoach.cs`): "Freou Cedo", "Freou Tarde", "Acelerou Tarde", "Acelere Mais", "Recorde", "Melhor Stint", "Manteve Linha", "Coletando Dados". O **ápice não gera frase** — o piloto corrige pela **bolinha** visual.
- Regras: **máx 2 palavras**, uma por vez, **cor = direção**, hierarquia de urgência (super > crítico > atenção > info), Title Case.
- Fonte da verdade do catálogo: `_design-reference/versions/mensagens-painel-piloto-v1-aprovado-2026-05-27.json` e a auditoria `_design-reference/auditoria-mensagens-piloto-2026-07-04.html`.
> O coach de IA é uma **camada de ENSINO acima dessas frases**, não um substituto delas.

---

## 5. O QUE VOCÊ DEVE ENTREGAR (explore ao máximo suas capacidades)

Entregue uma solução organizada, com estas frentes. Onde houver bifurcação real, apresente as opções, o trade-off e a **sua recomendação**.

1. **Metodologia de coaching por volta.** Como um grande coach de automobilismo ensina em ciclo curto: como escolher UM foco por volta (não sobrecarregar), como orientar → ensinar → apontar a solução, como evoluir a lição ao longo do stint (do erro grosso ao ajuste fino), quando calar. Fundamente em princípios reais de pilotagem e de aprendizado motor.

2. **A inteligência que escolhe a MAIOR oportunidade.** O algoritmo/heurística que, a partir dos deltas por sub-trecho (Seção 4.1) somados na volta e no stint, elege **a única oportunidade que mais paga**. Precisa: rankear por **ganho estimado em segundos**; distinguir **técnica recorrente** (mesmo erro em várias curvas → vira lição de técnica) de **curva pontual** (um ponto só) de **outro** (linha, marcha, Vmin); separar **sinal de ruído** (o que é erro real vs variação de GPS ~1 Hz); e dizer **quanto** dá para ganhar. Explore o uso do seu raciocínio de IA aqui — não precisa ser só regra fixa.

3. **Especificação da PARTE A — o gráfico com zoom.** Defina exatamente: o que ele plota (traçado da curva com a linha do piloto vs a linha da referência? perfil de velocidade vs distância? traço de freio? uma combinação?), como faz o **zoom no trecho atual** (recorte da geometria 4.6 em torno do `segmentId`), como isso é legível **em relance** e **em alta velocidade**, como cabe no miolo 956×440 em **tema escuro** sem atropelar o painel, e **quando** aparece/some. Entregue **mockup** (pode ser ASCII/descrição precisa, fundo preto) do gráfico.

4. **Especificação da PARTE B — a mensagem.** Modelo de conteúdo (o que a mensagem sempre tem: o "quê", o "onde", o "como corrigir", o "quanto ganha"?), regras de tamanho/tempo seguras para cada momento (calor da volta vs folga), tom ("você", sem emoji, ensino direto), e **exemplos escritos** para cada tipo de oportunidade (técnica / curva / outro).

5. **Integração.** Como o módulo pluga em `cerebro-coach.js` (web) e depois em `DeltaCoach`/`CockpitState` (C#): o que entra, o que sai, que campos novos o "pacote pronto" ganha (hoje `coach: null`), sem quebrar o contrato de dados.

6. **Tempo e segurança.** A regra de **quando** o coach surge (reta / fim de volta / box), garantindo que **nunca** distraia o piloto no meio de uma curva.

7. **Plano de construção em fases.** Web-referência primeiro → portar para o `.exe`, com estratégia de teste (o projeto usa replay da volta real e testes automáticos). Marque o que é Fase 1 e o que fica para depois.

8. **3 a 5 cenários trabalhados de ponta a ponta.** Ex.: "freada cedo recorrente na Curva da Bruxa custando 0,12 s/volta" → mostre o gráfico com zoom (mockup) + a mensagem exata que apareceria + o timing. Use nomes/curvas/dados reais de Brasília.

---

## 6. COMO TRABALHAR (regras de método)

- **Leia antes de afirmar.** Abra os arquivos da Seção 8. Se algo não existir, diga "não encontrei X" — não infira.
- **Não invente dado objetivo** (campo, tabela, função, comportamento).
- **Preserve o que existe.** O painel aprovado e o motor de delta não se refazem — o coach soma por cima.
- **Proponha; o Flávio decide** negócio/escopo. Onde a escolha for de negócio ou preferência dele, marque como decisão dele, não resolva sozinho.
- **Profundidade máxima:** para as partes difíceis (a inteligência de seleção e o desenho do gráfico), gere **mais de uma abordagem**, compare, e recomende. Mostre o raciocínio.
- **Saída construível:** ao fim, alguém tem que conseguir montar a Fase 1 a partir do seu documento.

---

## 7. GLOSSÁRIO RÁPIDO

- **Stint:** turno do piloto em pista (várias voltas seguidas).
- **Trecho / segmento / curva:** pedaço da pista entre uma linha de entrada e uma de saída. Brasília = 8.
- **Sub-trecho:** as 5 fases dentro de uma curva — entrada, freio, ápice, pace, saída.
- **Delta:** diferença de tempo (em s) entre a passagem atual e a melhor histórica; >0 = perdeu tempo.
- **Ápice:** ponto ideal interno da curva; no painel é uma **bolinha** que aponta onde estava a referência.
- **Vmin:** velocidade mínima da curva (o "vale").
- **Tipos de curva (Brasília):** T0/T1/T2/T4/T5/SF (SF = "sem freada", pé embaixo).
- **T4000:** injeção/central do carro que entrega os dados de motor por USB.
- **`.exe`:** o app do cockpit que roda no notebook Windows dentro do carro, mostrando a tela de 10,5".

---

## 8. ARQUIVOS-FONTE-DA-VERDADE (leia estes antes de projetar)

**Contexto e regras**
- `docs/COCKPIT_FONTE_DA_VERDADE.md` — requisitos + decisões duras do cockpit (LEIA PRIMEIRO)
- `docs/ARQUITETURA_DEFINITIVA.md` — arquitetura canônica
- `docs/CONTRATO_DADOS.md` — entrada, cérebro, pacote pronto, campos reais
- `CLAUDE.md` (raiz) — regras de linguagem ("você"), canais, escopo

**Motor de análise (a fundação)**
- `web/cockpit/delta-calculator.js` — delta por sub-trecho vs melhor volta
- `windows/cockpit/P1Fast.Cockpit.Domain/DeltaCoach.cs` — o mesmo, no produto C#
- `web/cockpit/trecho-detector.js` / `.../TrechoDetector.cs` — qual curva + 4 marcos
- `web/command-box/cerebro/cerebro-coach.js` — **o encaixe vazio do coach (é aqui)**
- `web/command-box/cerebro/cerebro-painel.js` — o cérebro que monta o pacote pronto

**Geometria da pista (para o gráfico com zoom)**
- `web/command-box/tipos-curva-brasilia.js`, `web/cockpit/apices-semente-brasilia.js`
- `web/cockpit/pista-oficial-brasilia.js` (`geoParaDesenho`), `web/command-box/pista-cb-polyline.js` (`fracDe`)

**A tela (não quebrar)**
- `web/cockpit/cockpit-volta-real.html` + `web/cockpit/cockpit.css` (referência web aprovada)
- `windows/cockpit/P1Fast.Cockpit.UI/MainWindow.xaml` + `CockpitState.cs` (produto C#)

**Metodologia de mensagem**
- `web/cockpit/mensagens-pedagogicas.js`
- `_design-reference/versions/mensagens-painel-piloto-v1-aprovado-2026-05-27.json`
- `_design-reference/auditoria-mensagens-piloto-2026-07-04.html`

**Dados para testar**
- `web/command-box/fixtures/passagens-bubi-brasilia.v1.json` (passagens reais)
- `supabase/migrations/0026_melhores_passagens_trecho.sql` (estrutura da melhor histórica)

---

**Fim do briefing. Comece lendo a Seção 8, depois entregue a solução da Seção 5 com a profundidade da Seção 6.**
