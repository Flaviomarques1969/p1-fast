# PLANO-MESTRE — Coach de IA de Stint (quadro do maestro Fable 5)

> Este quadro é do **Fable 5**. Ele o preenche na Rodada 0 e o mantém vivo em cada passada da vigia. As janelas trabalhadoras podem LER, mas não escrevem aqui.

## 1. Corte das frentes
| Janela | Frente | Modelo |
|--------|--------|--------|
| 1 | Metodologia + Mensagem (Parte B) + timing | Opus 4.8 1M |
| 2 | Inteligência de seleção da oportunidade | Opus 4.8 1M |
| 3 | Gráfico com zoom do trecho (Parte A) | Opus 4.8 1M |
| 4 | Integração + arquitetura + fases | Opus 4.8 1M |
| 5 | Cenários reais + auditoria de coerência | Opus 4.8 1M |

## 2. Contrato entre janelas (Fable preenche na Rodada 0)

### 2.1 Objeto Oportunidade (define J2 · consomem J1, J3, J5)
> **STATUS: CONFIRMADO v1** (auditoria Fable 2026-07-08T19:48Z). **O contrato vigente é `entregas/janela-2.md` §1** — v0 abaixo mantido como histórico. Acréscimos aceitos: `tipoCurva`, `confianca.origem`, `reconciliacao`, `projecao`, `apice{distFromIdealM,angleFromIdealDeg}`, companheiro `status{estado,voltasObservadas,motivo}` quando não há oportunidade, e `subTrecho` pode ser **null** (curva curta). Obrigações derivadas: J1 prevê mensagem de curva inteira (sub null) e o que mostrar nos estados de `status`; J3 prevê zoom de curva inteira e `tracos:null`; J4 dá casa ao `status` no pacote.
```
oportunidade = {
  id,             // string única no stint (ex. "v12-freio-bruxa")
  geradaNaVolta,  // número da volta que fechou a análise
  tipo,           // 'tecnica-recorrente' | 'curva-pontual' | 'outro'
  tecnica,        // string quando tecnica-recorrente (ex. 'soltar-freio-mais-tarde'); senão null
  segmentId,      // UUID do trecho alvo do zoom — o MESMO id do motor de delta / fixture (segment_id)
  curvaNome,      // nome oficial (ex. 'CURVA DA BRUXA' — lista _meta.ordemCurvas do fixture)
  subTrecho,      // 'entrada'|'freio'|'apice'|'pace'|'saida' (SUB_TRECHOS literal do motor)
  ganhoVoltaS,    // ganho estimado POR VOLTA, em SEGUNDOS, sempre positivo (cor dá direção; tela sem sinal)
  ganhoStintS,    // projeção no resto do stint (ou null se não estimável)
  confianca,      // { nivel: 'baixa'|'media'|'alta', valor: 0..1 }
  evidencia,      // { voltasObservadas:[n], ocorrencias:[{segmentId,curvaNome,subTrecho,deltaS}], deltaMedioS }
  referencia,     // { tipoPneu, tempoTrechoS } — a melhor histórica usada na comparação
  tracos          // { atual:[{lat,lng,kmh,t,fracao,sub}], referencia:[...] } — matéria-prima do gráfico (ou null)
}
```
Travado desde já (não muda sem o Fable): ganho em **segundos** (nunca km/h como métrica final); número **positivo sem sinal**; `segmentId` = o UUID que o motor de delta já usa; `subTrecho` com os 5 nomes literais; `curvaNome` da lista oficial das 8 curvas.

### 2.2 Contrato de layout do miolo (dividem J1 e J3)
> **STATUS: MEDIDO E ARBITRADO** (auditoria Fable 2026-07-08T20:08Z) — medidas reais levantadas pela J3 no painel aprovado (`entregas/janela-3.md §2`) e aceitas como contrato de trabalho: **cartão x150→806 · y74→312 (656×238) · gráfico x150→544 (394px) · mensagem x550→806 (256px)**. Nunca toca sensores, barra de voltas, luzes de freio, ápice/linha da base, shift light. **Condição pendente do FLÁVIO (decisão §6.7):** o "caminho (b) tempo-exclusivo" — enquanto o cartão está no ar, os números gigantes (delta/freada) cedem, reusando o gancho que o painel já tem (delta desliza −230px em `cockpit.css:466-468`; freada já cede pra "última volta" em HTML:161-162, conferido pelo Fable).
- Palco 956×440 **intocado**: topo (cluster de sensores + barra de voltas), base (ápice/entrada/freio/Vmin/saída + shift light), delta à esquerda, freada à direita — **nada se move nem é coberto**.
- O coach é **UM cartão único** no miolo central, com **dois slots FIXOS**: **gráfico (J3) à esquerda ≈60%** do cartão · **mensagem (J1) à direita ≈40%**. Proporção provisória; o slot é fixo — **o layout NUNCA muda conforme o conteúdo** (regra do Flávio).
- O cartão **aparece e some inteiro** (gráfico + mensagem juntos), controlado por **UM portão de timing** — a J1 define as regras do portão (reta / fim de volta / box / baixa carga); a J3 obedece. **Nunca no meio de curva.**
- **Modo crítico do painel SEMPRE vence o coach** (cartão some na hora). Shift light e luz de freio nunca são cobertos.
- J1 escreve a mensagem **por níveis** (relance de 1 linha + ensino) para caber no slot fixo dela, qualquer que seja a medida final.

### 2.3 Pacote do coach (formaliza J4)
> **STATUS: ENVELOPE v1 ACEITO** (auditoria Fable 2026-07-08T19:48Z) — formalizado em `entregas/janela-4.md` §2 (acréscimos `versao`, `id` idempotência, `geradoEmVoltaN` aceitos). **Pendência da J4:** dar casa ao companheiro `status` da J2 (silêncio honesto quando `coach = null`) e incluir na Fase 1 o `tempoAtualS` aditivo no motor JS. **Arbitrado pelo Fable:** convivência com a v0 = caminho A (módulo irmão `cerebro-coach-stint.js` / `CoachStintAcumulador.cs`, v0 intocada) — segue a regra vigente "uma conta, uma casa"; o Flávio pode reverter.
```
coach: null | {
  versao: 1,
  oportunidade: <objeto 2.1>,
  mensagem: <forma da J1 — relance de 1 linha + ensino escalonado>,
  grafico:  <spec da J3 — segmentId, recorte/zoom, camadas>,
  timing:   { portao: <J1 define: 'reta'|'fim-de-volta'|'box'|...>, duracaoMs, prioridade: 'critica-vence' }
}
```
Encaixe **conferido no código** (2026-07-08): `web/command-box/cerebro/cerebro-painel.js:167` → `const coach = null;` (entra em `pendentes` e no pacote pronto na l.175). É ali que o pacote do coach nasce. **Atenção à correção da §2.5 antes de mexer.**

### 2.4 Regras transversais travadas (valem para as 5 janelas e para o maestro)
Fundo **preto** `oklch(0% 0 0)` · **sem emoji** (só ícone de traço) · sempre **"você"** · palco **956×440** · **número sem sinal** (cor = direção) · ganho **sempre em segundos** · **só dado real** · **painel aprovado intocado** (soma por cima) · **produção protegida** (desenvolvimento só).

### 2.5 CORREÇÃO AO BRIEFING — conferido no código real (Fable, 2026-07-08)
O briefing (§4.3) diz que `cerebro-coach.js` "existe mas devolve null / nunca montada". **O código real diz outra coisa:**
- `web/command-box/cerebro/cerebro-coach.js` **contém uma v0 funcional** (`avaliarCoach`): elege a pior curva por indicadores de **VELOCIDADE (km/h**, tolerância 0,15), importa `src/domain/trecho-advisor.js` (`gerarConselho`), e devolve `{frase, comando, curva, curvaNome, licaoTitulo, licaoDesc, analise, perdaKmh, pontuacao:null, progressoPct:null}`. Foi feita para o **Command Box** (TV do box).
- O que está `null` é o **CAMPO `coach`** no `cerebro-painel.js:167` — o cérebro **nunca chama** esse módulo. O "encaixe vazio" é a chamada, não o arquivo.
- **Consequências travadas:** (a) **PRESERVAR a v0** — ninguém apaga nem sobrescreve; (b) o Coach de IA novo trabalha em **segundos** sobre o motor de delta (`web/cockpit/delta-calculator.js`) — é evolução, não remendo da v0; (c) **como os dois convivem** (estender, embrulhar ou módulo novo) = proposta da **J4**.

Fatos conferidos que valem contrato:
- Motor de delta (`web/cockpit/delta-calculator.js`): `SUB_TRECHOS = ['entrada','freio','apice','pace','saida']` (l.57); saída `{segmentId, deltaTotalS, porSubTrecho:{<sub>:{deltaS,distM,amostras}}, piorSubTrecho, piorDeltaS}` (l.169-173). Briefing §4.1 confere.
- Fixture (`web/command-box/fixtures/passagens-bubi-brasilia.v1.json`): pontos crus `{lat,lng,kmh,t}` — **sem** `fracao`/`sub` (a anotação vem do processamento); `segment_id` UUID; `tipo_pneu`; `tempo_trecho_s`; `_meta.ordemCurvas` com os 8 nomes oficiais: CURVA 01, CURVA DA RETA OPOSTA, CURVA 2, CURVA DA JUNÇÃO, CURVA DA BRUXA, CURVA DO PLACAR, CURVA "S", CURVA DA VITÓRIA.

## 3. Mapa de dependências
- J1 (mensagem) ← consome objeto de J2; divide miolo com J3.
- J3 (gráfico) ← consome objeto de J2; divide miolo com J1.
- J4 (integração) ← consome a forma de saída de J1, J2, J3.
- J5 (cenários/QA) ← consome tudo (J1–J4).
- **J2 é o gargalo inicial** — solte-a/priorize-a primeiro; as outras trabalham contra o formato provisório até ela confirmar.

## 4. Matriz de status (Fable atualiza a cada passada)
| Janela | Status | Último bloco tratado (hora ISO) | Bloqueios | Veredito atual |
|--------|--------|-------------------------------|-----------|----------------|
| 1 | **APROVADO — frente fechada** (3ª passada: F7 limiar provisório escrito + F8 ilustrativos marcados, conferidos na entrega) | 2026-07-09T18:33Z | — | **APROVADO** |
| 2 | **APROVADO — frente fechada** (v1.1: F2 janela agregada + F3a régua do fallback + F8 + plano F1, conferidos; método central intacto) | 2026-07-09T18:33Z | — | **APROVADO** |
| 3 | **APROVADO — frente fechada** (F4 corrigido: 4/8 com tabela em metros; ancoragem endossada) | 2026-07-09T18:33Z | — (caminho (b) APROVADO pelo Flávio em 09/07, decisão §6.7) | **APROVADO** |
| 4 | **APROVADO — frente fechada** (4ª passada: anotador nomeado com fontes conferidas + PASSO 0 + Fase 1 N1+N2) | 2026-07-09T18:33Z | — | **APROVADO** |
| 5 | **APROVADO — frente fechada** (provas reproduzidas pelo Fable, saídas idênticas) | 2026-07-08T20:55Z | — | **APROVADO** |

> **AS 5 FRENTES ESTÃO APROVADAS (2026-07-09T18:33Z).** Próximos atos: "abre as decisões" (painel com os 10 martelos do Flávio, §6) e "sintetiza" (`entregas/SOLUCAO-FINAL.md`). Recomendação do maestro: decisões ANTES da síntese, para a solução final já sair com os martelos batidos.

## 5. Definição de PRONTO por janela
- **J1:** metodologia + modelo de mensagem + regras de tamanho/timing + exemplos por tipo, cumprindo a régua dura e o contrato de layout.
- **J2:** objeto oportunidade fechado + algoritmo (abordagens comparadas + recomendada) + método do ganho em s + encaixe no motor de delta.
- **J3:** o que plota (recomendado) + método do zoom com conversores reais + mockups escuros com medidas + posição/aparição, sem quebrar o painel.
- **J4:** ponto de encaixe + forma do pacote coach + fluxo de dado + teste + plano da Fase 1 construível.
- **J5:** 3–5 cenários ponta a ponta com dado real + relatório de coerência sem furo aberto.

## 6. Decisões abertas pro Flávio (Fable acumula; não decide)
> ✅ **TODAS DECIDIDAS pelo Flávio em 2026-07-09** (painel `p1fast-coach-decisoes-1543`; bruto no histórico `~/.claude-decisoes/perguntar-historico.jsonl`). Respostas: **1-A** (Fase 1 = web referência; `.exe` = Fase 2) · **2-A** (calibração aceita como partida, valores mantidos) · **3-B ALTERADA** (SEM vermelho no coach — só âmbar e verde; e virou **padrão geral**: vermelho reservado a crítico, gravado em `licoes-globais.md`) · **4-A** (relance ≤5 palavras; permanência mín. 1,5 s) · **5-A** (parágrafo no box) **+ NOVA DEMANDA registrada:** tela de Aprendizagem no Command Box (síntese §9) · **6-B ALTERADA** (insistência CONTÍNUA: mostra toda volta onde está a necessidade, guiada pelo **plano do stint** — substitui a pausa de 1 volta da J1) · **7-A** (tempo-exclusivo APROVADO — o cartão tem onde viver) · **8-A** (traçado com zoom) · **9-A** (conservador; Vitória/Placar calam) · **10** morta (sem vermelho no coach, não há limiar). A lista abaixo fica como histórico do que foi perguntado.
1. **Escopo da Fase 1 (J4):** Fase 1 entrega o coach funcionando na **tela web de referência** (validada com o replay da volta real); o piloto só vê **no carro** (`.exe`) na Fase 2. Recomendação do Fable: aceitar — é o método do projeto (web primeiro → portar).
2. **Calibração da seleção (J2 §8.1):** piso de anúncio 0,10 s; adesão da projeção 0,5–0,6; técnica-recorrente = mesmo erro em ≥3 curvas; desempate freio > entrada > saída > pace > ápice; troca de foco só se o desafiante ganhar por ≥0,10 s. Recomendação do Fable: aceitar como ponto de partida e calibrar no replay antes de fixar.
3. **Semântica de cor do coach (J1 §6.1):** âmbar = oportunidade padrão · vermelho = perda grande e recorrente · verde = confirmação de recuperação. Superfície nova — preferência sua. Recomendação do Fable: aceitar (coerente com verde/âmbar/vermelho do painel).
4. **Orçamento do relance N1 (≤5 palavras) e permanência mínima do cartão (~1,5 s) (J1 §6.2):** calibrar no replay real com você olhando a tela. Recomendação do Fable: aceitar como partida.
5. **Tamanho da revisão de box N3 (J1 §6.3):** parágrafo de recap vs 2–3 frases enxutas. Recomendação do Fable: sua preferência pura; testar as duas no replay.
6. **Insistência da lição (J1 §6.4):** pular ao menos 1 volta antes de repetir a mesma lição (evita dependência do aviso). Recomendação do Fable: aceitar (base sólida de aprendizado motor).
7. **Caminho (b) "tempo-exclusivo" no miolo (J3 §2.2) — a decisão VISUAL central:** o cartão do coach e os números gigantes (delta/freada) não coexistem — quando o cartão entra (reta/fim de volta/box), os números cedem, usando comportamento que o painel JÁ tem. Alternativa (a): espremer o cartão em 128px = inviável para ensinar. Recomendação do Fable: aceitar (b) — soma por cima do padrão existente, nada é redesenhado.
8. **Conteúdo do gráfico na Fase 1 (J3 §3):** recorte ampliado do traçado da curva com sua linha vs referência (leitura espacial em relance); velocidade×distância e traço de freio ficam como camadas da Fase 2. Recomendação do Fable: aceitar (casa com o plano da J4 e com leitura a alta velocidade).
9. **Quão falante é o coach no caso "ou anda no ritmo, ou perde 1 s" (F3b do QA):** com gaps bimodais (Vitória e Placar: ora 0,004 s, ora 1,0 s), o número conservador (quantil baixo) cala o coach; a mediana faz ele apontar "1,0 s nesta curva". Recomendação do Fable: começar CONSERVADOR (quantil baixo = silêncio) e reavaliar no replay — coach que fala demais perde autoridade.
10. **Limiar numérico do acento vermelho (F7 do QA):** proposta provisória em vigor: vermelho = confiança alta E ganho ≥ 0,50 s/volta; âmbar = demais casos; verde = recuperação confirmada. Quem computa é a J1 (o gráfico da J3 copia — fonte única). Você bate o martelo no número.

## 7. Log de síntese
- **Rodada de QA (2026-07-08T20:55Z):** J5 APROVADA — provas reproduzidas pelo maestro com saídas idênticas (eleição real: Curva "S" 0,996 s 5/5 + Bruxa 0,485 s 4/5; ápice-semente diverge em 4/8, não 7/8; motor real na Bruxa: gap 0,485 s vs 0,025 s integrado — sem freada dentro do segmento). Achados F1–F8 despachados nas caixas (J1/J3/J4 pontuais; J2 especificação; F3b e F7 viraram decisões §6.9-6.10). **Achado central adotado na síntese:** a 1 Hz com o registro atual, o caminho comum da Fase 1 é o coach de CURVA INTEIRA (`subTrecho:null`); cenário-vitrine oficial = Curva "S" ~1,0 s/volta (substitui o "freada da Bruxa" do briefing, improducível deste dado). **F1 (limites de segmento tortos em 4/8 curvas) = investigação passo 0 da Fase 1 (J4+J2).**
- Rodada 0: **concluída 2026-07-08T17:01Z** — contratos §2.1–2.4 travados (v0 provisórios com dona definida), correção ao briefing registrada (§2.5, conferida no código real), caixas `canal/janela-1..5/` criadas com mandato, `entregas/` pronta. Modo enxuto aprovado pelo Flávio (sem releitura extensa de código pelo maestro; conferência pontual só nos fatos que os contratos dependem).
- **Decisões (2026-07-09):** painel `p1fast-coach-decisoes-1543` respondido — 9 decisões (2 alteradas pelo Flávio: sem vermelho no coach → padrão geral; insistência contínua via plano do stint) + 1 nova demanda (tela de Aprendizagem no Command Box). Detalhe em §6.
- **Síntese final → `entregas/SOLUCAO-FINAL.md`: CONCLUÍDA 2026-07-09** — 5 frentes + 9 decisões incorporadas + plano da Fase 1 construível (passo 0 = investigação dos limites de trecho) + nova demanda registrada (§9 da síntese). Sala de DESIGN encerrada.

## 8. CONSTRUÇÃO DA FASE 1 (aberta 2026-07-10 — decisão do Flávio: opção A, 2 construtoras)
> Formato decidido no painel `p1fast-construcao-fase1-1607`: **2 janelas construtoras em ambientes isolados de trabalho + Fable auditor por marcos.** Prompts: `PROMPT-CONSTRUTORA-CEREBRO.md` e `PROMPT-CONSTRUTORA-TELA.md`. Interface entre elas: o pacote de 3 estados (§2.3/J4 §2) + `construcao/pacote-exemplo.json` (o CÉREBRO publica cedo). Gatilhos do Flávio: **"audita cérebro"** / **"audita tela"** / **"audita"**.

| Construtora | Escopo | Ambiente isolado (linha de trabalho) | Marcos | Status | Veredito |
|---|---|---|---|---|---|
| CÉREBRO | passo 0 + tempoAtualS + acumulador/eleição + pacote 3 estados + Contrato de Dados + testes | `.claude/worktrees/coach-cerebro` (`claude/coach-fase1-cerebro`) | M1 auditado (portão/laudo) · **M2 AUDITADO 10/07: APROVADO** — testes re-executados pelo Fable todos verdes; fronteiras limpas; pacote validado contra o contrato; eleição real = J5 C1; confiança "media" na S = observação de calibração p/ replay | **frente construída e fechada** | **APROVADO** |
| TELA | cartão nos 3 estados no painel de referência + tempo-exclusivo + validação no navegador | `.claude/worktrees/coach-tela` (`claude/coach-fase1-tela`) | M1 auditado · **M2 AUDITADO 10/07: APROVADO** — pacote real integrado (fonte única), testes re-executados pelo Fable (90/0), inspeção visual com o dado real (oportunidade cede números; silêncio não — ceder com delta ativo PROVADO por comparação) | **frente construída e fechada** | **APROVADO** |

> **CONSTRUÇÃO DA FASE 1: AS DUAS FRENTES APROVADAS (10/07) · INTEGRAÇÃO CONCLUÍDA (10/07, pelo Fable).** Linha `claude/coach-fase1-integracao` (`.claude/worktrees/coach-integracao`): junção das duas frentes com **0 conflitos**; bateria completa re-executada (só as 4 falhas PRÉ-EXISTENTES do schema-parity, idênticas à base); coach-stint 11/0 · delta 11/0 · mensagens 17/0 · arquitetura 28/0 · cockpit-web 16/0; painel integrado conferido no navegador (cartão real renderizando, números cedendo, sem erro de console). **INCORPORADA (10/07, martelo "incorpora" do Flávio):** junção feita pelo Fable na linha oficial de trabalho local (`claude/fase2-ia-temperatura`, registro `15908e48`), 0 conflitos, arquivos-chave conferidos presentes, testes re-executados na linha oficial (coach-stint 11/0 · delta 11/0 · mensagens 17/0 · arquitetura 28/0 · cockpit-web 16/0). **Nada foi ao repositório remoto nem a produção** — envio ao repositório oficial/notebook é passo separado, só com ordem. **FASE 1 ENCERRADA.**

**NOVO ITEM PARA O FLÁVIO (registrado 10/07, não bloqueia a Fase 1):** o passo 0 provou que o **registro de trechos do PRODUTO** (migração 0029) usa janela de ±30 m do ápice — curta demais para conter a freada das curvas rápidas (CURVA 01/JUNÇÃO/PLACAR/VITÓRIA; conferido pelo Fable no arquivo real). Consequência: o "onde-fino" (freio/entrada) fica inatribuível nessas curvas até o registro ser corrigido — a Fase 1 segue no caminho honesto de curva inteira, como desenhado. **Conserto = tarefa de produto separada** (redefinir janelas dos trechos + regerar dado de teste) — aguarda sua priorização/autorização; vem no painel de decisões quando você quiser tratar.

Regras da construção: DEV somente · painel aprovado intocável (soma por cima) · v0 `cerebro-coach.js` intocável · SÓ âmbar/verde no coach · smoke de arquitetura verde · nada vai à versão oficial sem auditoria do Fable + ok do Flávio · integração final = Fable audita M2×M2 e propõe a incorporação.
