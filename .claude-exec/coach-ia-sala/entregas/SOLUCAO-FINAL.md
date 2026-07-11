# SOLUÇÃO FINAL — Coach de IA de Stint

> Síntese do maestro (Fable 5), 2026-07-09. Junta as 5 entregas auditadas e aprovadas (`entregas/janela-1..5.md`) **já com as 9 decisões do Flávio incorporadas** (painel `p1fast-coach-decisoes-1543`, 09/07). Tudo aqui foi conferido contra código/dado REAL durante as auditorias — nenhuma afirmação sem lastro. Este documento é o ponto de partida construível da Fase 1; o detalhe fino de cada frente está na entrega da janela dona.

---

## 1. As decisões do Flávio (a régua final)

| # | Decisão | Resposta |
|---|---|---|
| 1 | Onde a Fase 1 entrega valor | **Tela de referência (navegador, replay real); o `.exe` do carro é a Fase 2** |
| 2 | Calibração da seleção | **Aceita como partida**: piso 0,10 s/volta · adesão 0,6 · técnica = 3+ curvas · troca de foco ≥ 0,10 s · desempate freio > entrada > saída > pace > ápice — calibrar no replay antes de fixar |
| 3 | Cores do cartão | **SEM vermelho no coach — só âmbar (oportunidade/ruim) e verde (recuperou)**. Novo padrão GERAL do Flávio: vermelho reservado a crítico (gravado em `licoes-globais.md`) |
| 4 | Relance na reta | ≤ **5 palavras**, permanência mínima **1,5 s**, calibrar no replay com o Flávio olhando |
| 5 | Revisão no box | **Parágrafo de recap** (+ nova demanda registrada, §9) |
| 6 | Insistência | **Contínua: TODA volta mostra onde está a necessidade, guiada pelo PLANO DO STINT** (substitui a pausa de 1 volta) |
| 7 | A tela | **Tempo-exclusivo APROVADO**: cartão do coach e números gigantes nunca juntos; os números cedem quando o cartão entra |
| 8 | Gráfico da Fase 1 | **Recorte ampliado do traçado**: linha do piloto vs referência + bolinha do ápice |
| 9 | Quão falante | **Conservador**: só fala do que se repete em toda volta (casos "ou tudo ou nada", como Vitória/Placar, calam por ora) |
| 10 | Limiar do vermelho | **Morta** — sem vermelho no coach, não há limiar |

---

## 2. O que o piloto vive (a cena)

A cada volta, o cérebro compara cada curva com a melhor passagem histórica (mesmo carro, pista e pneu) e elege **UMA** lição — a que mais paga, **em segundos**. Ao cruzar a linha (na reta principal), os números gigantes cedem e entra **um cartão único** no centro da tela de 10,5": à esquerda o **caco da pista ampliado** com a linha dele contra a linha de referência; à direita a **mensagem de ensino** em até 3 linhas, terminando sempre na ação + o ganho ("carregue mais velocidade · 1,0 s"). O cartão some sozinho **antes da próxima freada**. Nas retas seguintes, um relance de 1 linha lembra o foco. No box, a lição completa em parágrafo. Alarme crítico do carro **sempre** derruba o cartão. Sem certeza, o coach **cala** — silêncio com estado honesto ("Juntando dado — 2 voltas"), nunca lição fabricada.

**Cenário-vitrine (real, do stint 23-24/05):** Curva "S" — o Bubi deixa ~1,0 s **toda volta** (5 de 5). N1: `Curva "S" · 1,0 s`. N2: `CURVA "S" / você deixa 1 segundo aqui, toda volta / ─ / carregue mais velocidade · 1,0 s`. No stint, vale ~5 s.

---

## 3. Metodologia de ensino (dona: J1 — ajustada pelas decisões 3, 5 e 6)

- **1 foco por volta** (casa com a eleição única da J2); ciclo orientar → ensinar → apontar a solução, mapeado direto nos campos do dado.
- **Mensagem por níveis**: N0 silêncio · N1 relance (1 linha, ≤5 palavras, só em reta/baixa carga) · N2 ensino (3 linhas, fim de volta; ação+ganho sempre sozinha na última linha) · N3 revisão (parágrafo, box). O que viaja no pacote são **textos prontos** (N1/N2/N3 pré-computados) — nunca lógica.
- **Insistência (decisão 6 — substitui a pausa da entrega J1):** enquanto o foco do **plano do stint** estiver ativo (ex.: 20 voltas treinando trail braking), o coach mostra **toda volta** onde está a necessidade. A base já existe no produto: `src/domain/stint-plan.js` (plano obrigatório por stint, com `nVoltasAlvo` e trechos de foco). Formato anti-fadiga preservado: a repetição pode vir como relance curto ("de novo: freie mais tarde") e o verde confirma quando ele recupera. **O que segue valendo de "calar":** segurança (nunca em curva/freada/g-alto; crítico vence) e honestidade (sem dado confiável = silêncio com estado).
- **Cores (decisão 3):** âmbar = oportunidade/perda · verde = recuperação confirmada. **Vermelho não existe no coach.**
- Vocabulário: reusa os **verbos v3 já aprovados** (`web/cockpit/oportunidade-trecho.js`: FREIA DEPOIS/ANTES, FECHA A CURVA, ACELERA ANTES); "você" sempre; sem emoji; número **sem sinal** (direção = palavra + cor).

## 4. A inteligência que elege (dona: J2 — com decisões 2 e 9)

- **Objeto oportunidade v1** (`janela-2.md §1`) = o contrato que mensagem, gráfico e cenários consomem: tipo (técnica-recorrente / curva-pontual / outro), curva-alvo, sub-trecho (**ou null** = curva inteira), **ganho por volta em segundos (positivo)**, projeção do stint, confiança com origem, evidência, reconciliação anti-inflação e os traços das duas linhas para o gráfico.
- **O número honesto nasce do relógio** (tempo medido da curva vs melhor histórica) — a decomposição interna só diz ONDE. Trava anti-dupla-contagem: o ganho nunca passa do gap medido.
- **Sinal vs ruído:** com GPS de 1 leitura/segundo, o que separa erro real de ruído é a **repetição volta a volta** (o stint, não a volta). **Decisão 9 (conservador):** o coach só anuncia o que se repete em toda volta — quantil baixo; casos bimodais calam.
- **Eleição:** pontuação `ganho × confiança` com pisos e gates ANTES da escolha (Vitória é "sem freada" — verbo de freio nunca é apontado lá), estabilidade de foco (só troca se o desafiante ganhar por ≥0,10 s) e exclusão de out-laps. Calibração da decisão 2 em vigor.
- **Achado central do QA (regra de expectativa):** com o registro atual, o caminho COMUM da Fase 1 é a lição de **curva inteira** (`subTrecho:null`) — o "onde-fino" (freio/saída) entra quando os limites de trecho forem acertados (§7 passo 0) e/ou com captura fina (25 leituras/s).

## 5. A tela (donas: J3 + J1 — com decisões 3, 4, 7 e 8)

- **Tempo-exclusivo (decisão 7):** cartão e números gigantes nunca coexistem. Reusa mecanismo que a tela aprovada JÁ tem (o delta desliza; a freada já cede para "última volta"). Nada do painel se move ou é redesenhado — o coach soma por cima.
- **Cartão** (medido no painel real): x150→806 · y74→312 (656×238). **Gráfico à esquerda (394 px)** · **mensagem à direita (256 px)**. Slots fixos — o layout nunca muda com o conteúdo.
- **Gráfico (decisão 8):** recorte ampliado do traçado oficial (espaço 823×799, conversor `geoParaDesenho`) em volta da curva-alvo, com linha do piloto (âmbar/verde) vs linha de referência (fria), sub-trecho em destaque quando houver, bolinha do ápice quando for o caso, velocidade como cor na própria linha. Método **provado com dado real** (recorte da Bruxa gerado do fixture). Âncora = traços/ápice **vivos** do dado (nunca o arquivo-semente — diverge em 4/8 curvas, provado).
- **Aparição:** o cartão entra e sai **inteiro** pelo portão único da J1 (reta → N1 · fim de volta → N2 · box → N3); some antes da próxima zona de freada; crítico/GRAVE sempre vence; shift light e luz de freio nunca são cobertos.
- **Padrão de cores novo (decisão 3):** o coach nasce âmbar/verde. A adequação do restante do painel (que hoje usa vermelho para "ruim") é **tarefa separada e planejada** — não se mexe no painel aprovado sem plano próprio.

## 6. A plataforma (dona: J4)

- **Pacote do coach com 3 estados honestos:** `null` (onda desligada — comportamento de hoje) · `'silencio'` (ligada, sem lição confiável — carrega o estado + a linha honesta) · `'oportunidade'` (lição completa: objeto + mensagem pré-computada + spec do gráfico + timing). Um ponto único de leitura para a tela; chave de idempotência para não repintar à toa.
- **Encaixe:** o campo `coach` nasce no cérebro (`cerebro-painel.js:167`, hoje `null`). **Caminho A** (arbitrado): módulo irmão novo `cerebro-coach-stint.js` (web) / `CoachStintAcumulador.cs` (C#) — a v0 do Command Box (`cerebro-coach.js`, em km/h) fica **100% intocada**; nova casa registrada no Contrato de Dados.
- **Fluxo:** canal → ponte única → cérebro (motor de delta por curva) → **acumulador de stint** (peça nova: a memória do stint) → pacote → tela só exibe. Arquitetura "uma entrada, um cérebro" preservada.
- **Paridade:** referência web primeiro, porte C# fiel depois (mesmo padrão do motor de delta atual, 255 testes preservados).

## 7. Plano de construção — Fase 1 (decisão 1: tela de referência) e Fase 2

**Fase 1 (navegador + replay da volta real):**
0. **PASSO 0 — investigação dos limites de trecho (J2+J4):** conferir as linhas reais do detector vs os limites do dado 23-24/05 (em 4/8 curvas a freada caiu fora do trecho nomeado). Se o defeito for só do dado de teste, o teste espera `subTrecho:null` nessas curvas; se for do registro do produto, **escala ao Flávio antes de seguir**.
1. `tempoAtualS` aditivo no motor de análise web (paridade com o C#, onde já existe; é fechar laço).
2. Acumulador de stint (`cerebro-coach-stint.js`) consumindo os deltas do replay.
3. Pacote com os 3 estados + mensagem N1+N2 (decisões 4/6) + gráfico mínimo (decisão 8) + portão fim-de-volta/reta.
4. Ligar o campo no cérebro (troca do `null` pela chamada, preservando o silêncio honesto) + cartão no miolo da tela de referência (tempo-exclusivo, decisão 7).
5. **Testes:** replay real com anotador nomeado (`pontoCanonico` + lógica de marcos, paridade com o `RetagSubs` do C#); determinismo; silêncio honesto; idempotência; portão/segurança; as 4 curvas tortas caindo em curva-inteira como esperado.

**Fase 2 (o carro):** porte C# (`CoachPacote` + `SetCoach` respeitando silencioso/GRAVE + render no `MainWindow`), N3 no box, camadas ricas do gráfico (fita de freio/velocidade), evolução fina da lição — e captura fina (25 leituras/s) quando entrar, que destrava o "onde-fino" sem mudar contrato nenhum.

## 8. A prova de que o conjunto fecha (dona: J5)

5 cenários ponta a ponta com dado real, reproduzidos pelo maestro com saídas idênticas: **C1** Curva "S" 0,99 s (a vitrine) · **C2** Bruxa 0,485 s com o motor real rodado (curva inteira honesta) · **C3** técnica recorrente (formato completo; irrealizável no dado de 1 Hz — vira demonstração quando entrar captura fina) · **C4** Vitória "sem freada" (gate funciona; conservador = silêncio) · **C5** silêncio honesto do início de stint. Nenhum campo faltou entre as frentes; régua dura cumprida nas 5 entregas.

## 9. NOVA DEMANDA registrada (fora do escopo desta sala — próxima frente proposta)

**Tela de Aprendizagem no Command Box** (pedido do Flávio em 09/07, na decisão 5): uma tela na TV do box que lista as execuções e os stints escolhidos como aprendizagem; ao clicar num stint, a tela inteira vira a **revisão**: o vídeo dele pilotando + o mapa da pista à esquerda, e o restante da tela com as informações de desempenho e orientações — para ir e voltar com calma. **O controle dessa tela é feito pelo aplicativo (celular).** Conecta com o que já existe (vídeo Daily.co, Command Box, app), mas é módulo novo: precisa de escopo e sala/fase próprios. Não iniciado — registrado para o Flávio priorizar.

## 10. Riscos e limitações declaradas

1. **Limites de trecho tortos em 4/8 curvas** — investigação é o passo 0; até lá, lição de freio nessas curvas não é atribuível (o sistema silencia o "onde", não quebra).
2. **GPS 1 Hz** — o "onde-fino" é minoria das lições na Fase 1; honestidade mantida por desenho (curva inteira + confiança).
3. **Adequação do padrão de cores nas telas antigas** (decisão 3 como padrão geral) — tarefa separada, planejada, caso a caso; nada muda automaticamente.
4. **Produção intocada** — toda a sala foi projeto em desenvolvimento; construir a Fase 1 exige o "vai" do Flávio (e produção continua exigindo a frase de migração).

## 11. Referências

`PLANO-MESTRE.md` (contratos §2.1–2.5, decisões §6, log §7) · `entregas/janela-1.md` (metodologia/mensagem/portão) · `janela-2.md` (objeto v1 + eleição) · `janela-3.md` (gráfico/zoom/medidas) · `janela-4.md` (plataforma/pacote/fases) · `janela-5.md` (cenários/QA F1–F8) · provas reproduzíveis em `provas-j5/` e `scratchpad/prova-zoom.mjs` · decisões brutas em `~/.claude-decisoes/perguntar-historico.jsonl` (2026-07-09).

_Fim da solução final. Próximo ato: o "vai" do Flávio para construir a Fase 1 (começando pelo passo 0)._
