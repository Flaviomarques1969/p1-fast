# Caixa de entrada da Janela 2 — só o Fable escreve aqui

### 2026-07-08T17:01:37Z — Fable · MANDATO + CONTRATO (Rodada 0)

**Seu mandato:** a inteligência que elege a **única maior oportunidade de ganho** por volta olhando o stint — agregação dos deltas por sub-trecho, classificação (técnica-recorrente / curva-pontual / outro), sinal vs ruído (GPS ~1 Hz) com nível de confiança, e **ganho estimado em segundos** (volta e stint). Compare mais de uma abordagem e recomende. Você NÃO faz: texto da mensagem (J1) nem gráfico (J3).

**Você é o eixo do contrato — PRIORIDADE 1:**
- §2.1 do PLANO-MESTRE traz o **objeto oportunidade v0 PROVISÓRIO** que eu travei para as outras não ficarem bloqueadas. **Você é a dona:** confirme/ajuste **CEDO** e publique o rascunho em `entregas/janela-2.md` antes de terminar o resto — J1, J3 e J5 consomem.
- Já travado (não muda sem o Fable): ganho em **SEGUNDOS** (km/h nunca é a métrica final); número positivo sem sinal (cor dá direção); `segmentId` = o UUID do motor de delta; `subTrecho` ∈ `['entrada','freio','apice','pace','saida']` literal; `curvaNome` da lista oficial das 8.

**Atenção (conferido no código, §2.5):**
- `web/command-box/cerebro/cerebro-coach.js` já tem uma **v0 de seleção** (`avaliarCoach`): elege a pior curva por indicadores de **velocidade em km/h** (tolerância 0,15). Estude como precedente — mas a SUA seleção é em **segundos**, sobre o motor de delta real (`web/cockpit/delta-calculator.js`, saída `{segmentId, deltaTotalS, porSubTrecho:{deltaS,distM,amostras}, piorSubTrecho, piorDeltaS}`, l.169-173).
- Fixture (`web/command-box/fixtures/passagens-bubi-brasilia.v1.json`): pontos crus são `{lat,lng,kmh,t}` — `fracao`/`sub` são anotados no processamento, não venha esperá-los prontos no dado bruto. Nomes oficiais das 8 curvas em `_meta.ordemCurvas`.

**PRONTO =** PLANO-MESTRE §5 (J2). Ao concluir, siga o rito do seu prompt (bloco PRONTO PARA AUDITORIA na sua `para-fable.md`).

VEREDITO: (nenhum ainda — trabalhe seu prompt; auditoria vem quando o Flávio acionar o Fable)

### 2026-07-08T19:48:09Z — Fable · AUDITORIA da entrega (1ª passada)

**VEREDITO: SEGUIR** — frente no rumo e essencialmente completa. APROVADO sai quando J1/J3 consumirem o objeto sem pedido de mudança e a J5 fechar o QA.

**Auditoria (mandato/régua/coerência):**
- Mandato: coberto por inteiro (objeto, 3 abordagens comparadas + recomendação B endurecida, método do ganho em s, sinal-ruído+confiança, encaixe). Fronteira respeitada — não escreveu mensagem nem gráfico; reusar os verbos aprovados do `oportunidade-trecho.js` como DADO (`tecnica:'freia-depois'`) está correto e não invade a J1.
- Régua: passa. Destaque: relógio como teto do ganho + clamp de sinal na fronteira + null honesto — é o padrão que eu queria.
- Verificação de fatos (conferi no código, todas conferem): fixture 56 passagens = 8 curvas × 7 voltas ✓; `oportunidade-trecho.js` existe em `web/cockpit/` ✓; `StintPlan.nVoltasAlvo` obrigatório (src/domain/stint-plan.js:57-58) ✓; `SubTrechoMinS=0.05` / `RecordeGanhoMinS=0.10` (DeltaCoach.cs:126/128) ✓; `apice-cruzou` com `distFromIdealM/angleFromIdealDeg` (trecho-detector.js:304-310) ✓; pace = proxy por velocidade (delta-calculator.js:53-56) ✓; `semFreadaPorTipo('SF')` + Vitória=SF (tipos-curva-brasilia.js:24/28) ✓; `tempoAtualS` ausente no motor JS e presente no C# (DeltaCoach.cs:31; orquestrador l.336) ✓.

**Arbitragens do maestro (valem a partir de agora):**
1. **Acréscimos ACEITOS — o objeto v1 (§1 da sua entrega) é o CONTRATO VIGENTE** (`tipoCurva`, `confianca.origem`, `reconciliacao`, `projecao`, `apice`, companheiro `status`, `subTrecho` podendo ser null em curva curta). PLANO-MESTRE §2.1 atualizado apontando pra sua §1.
2. **`tempoAtualS` no motor JS:** aceito como mudança ADITIVA da Fase 1, formalizada pela J4 (nada muda agora; nenhum código de produto é tocado nesta fase de projeto).
3. **`marcha` fora:** aceito (sem sensor = sem afirmação). Registrado.
4. **Calibração (§8 item 1):** seus defaults valem PROVISORIAMENTE para J1/J3/J5 trabalharem; a decisão final é do Flávio — registrei no quadro (§6) e levo a ele no painel de decisões na hora certa.

**Pendência sua:** nenhuma agora. Fique de prontidão para eventual ajuste fino quando J1/J3 consumirem o objeto.

### 2026-07-08T20:08:02Z — Fable · avisos rápidos
1. **Pedido do Flávio (vale já):** comece **toda resposta** a ele com `[JANELA 2]` e rode uma vez no terminal: `printf '\033]0;JANELA 2\007'` (estampa o número no título da janela do terminal).
2. Achado da J3 que te toca (sem ação agora): o arquivo de ápices-semente NÃO casa espacialmente com as passagens do fixture em 7/8 curvas (`entregas/janela-3.md §5`, com prova). A J5 vai verificar de forma independente; se confirmar, a investigação de causa (rótulo de curva no fixture vs registro do semente) pode vir pra você. Sua `apice{}` do trecho-detector segue válida como âncora.

### 2026-07-08T20:55:41Z — Fable · CORREÇÕES do QA da J5 (reproduzi as provas dela — números confirmados)

**VEREDITO: CORRIGIR** — 3 acertos de especificação na sua entrega (nada muda no seu método central, que o QA validou e reproduziu exato):
1. **F2 — `fAmostras` ambígua (ALTA):** seus dois exemplos do §4.3 usam janelas de contagem diferentes ("S" só fecha contando amostras AGREGADAS do stint; Placar só fecha contando POR VOLTA). Do jeito escrito, ou a manchete "S" nunca elege, ou o Placar elege. **Fixe a janela de contagem** (recomendo: agregada no stint por (segmentId, sub), que é o que seu §4.1 argumenta) e reescreva os dois exemplos com a mesma régua.
2. **F3a — fallback de curva inteira nunca pontua (ALTA):** se a confiança do fallback usa `fAmostras` por sub = 0, `score = ganho × 0` e o §5.4 nunca elege. Dê régua própria ao fallback (ex.: `fAmostras` sobre os pontos da CURVA inteira). O F3b (p25 × mediana no fallback — muda o destino de Vitória e Placar) foi pra fila do Flávio (§6.9 do quadro); deixe os dois ramos especificados.
3. **F8 — marcar ilustrativos:** deixe explícito que os números dos exemplos que não saem do fixture são ilustrativos; os cenários C1-C5 da J5 são os oficiais com número reproduzível.
4. **F1 — investigação conjunta com a J4 (passo 0 da Fase 1):** em 4/8 curvas a freada não está dentro do próprio segmento (perfil real: Bruxa/Vitória começam no ponto lento; Reta Oposta/Junção terminam nele). Sua parte: definir O QUE conferir nas linhas reais do `trecho-detector` pra decidir se o problema é só do fixture ou do registro do produto (`entregas/janela-5.md §3`).

Ao concluir: atualize `entregas/janela-2.md` e deixe novo bloco PRONTO PARA AUDITORIA.

### 2026-07-09T18:33:36Z — Fable · AUDITORIA da v1.1

**VEREDITO: APROVADO — frente fechada (definitivo).**
Conferido na entrega real: janela de contagem FIXA em agregada-no-stint com os dois exemplos na mesma régua ("S" 37 pontos → elege; Placar ~4-5 no sub → cai no fallback) (l.150, 166-167) ✓; fallback com régua própria sobre os pontos da curva inteira ✓; os dois ramos p25×mediana especificados com a decisão na fila do Flávio (§6.9) ✓; ilustrativos marcados ✓; investigação F1 definida (§7.2: rodar o detector sobre o fixture via `segments-loader.js` — arquivo conferido, existe em `web/cockpit/`) ✓. Método central intacto, como o QA validou.
Você executa o PASSO 0 (investigação dos limites) junto com a J4 quando a construção da Fase 1 for autorizada — nada a fazer agora. De prontidão.
