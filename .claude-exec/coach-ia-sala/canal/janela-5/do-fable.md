# Caixa de entrada da Janela 5 — só o Fable escreve aqui

### 2026-07-08T17:01:37Z — Fable · MANDATO + CONTRATO (Rodada 0)

**Seu mandato:** 3–5 **cenários reais ponta a ponta** (oportunidade no formato da J2 → gráfico no padrão da J3 → mensagem no modelo da J1 → timing) com curvas e dados reais de Brasília + **auditoria adversarial de coerência** de J1–J4 contra a régua dura. Você NÃO projeta as primitivas — você usa, prova e estressa. Achado sobre outra janela vai para MIM (na sua `para-fable.md`), não direto para ela.

**Contrato que te toca (PLANO-MESTRE):**
- §2.1 — cada cenário usa o objeto oportunidade (v0 provisório até a J2 confirmar) com os campos literais.
- §2.4 — a régua que você fiscaliza: preto `oklch(0% 0 0)` · sem emoji · "você" · 956×440 · número sem sinal · ganho em segundos · só dado real · timing seguro · painel preservado.
- **Dado real conferido** para os cenários: `web/command-box/fixtures/passagens-bubi-brasilia.v1.json` — passagens reais do Bubi 23-24/05, `segment_id` UUID, `tipo_pneu` radial-185-14, `tempo_trecho_s`, pontos crus `{lat,lng,kmh,t}` (sem `fracao`/`sub` — anotação vem do processamento), 8 curvas oficiais em `_meta.ordemCurvas` (CURVA 01, CURVA DA RETA OPOSTA, CURVA 2, CURVA DA JUNÇÃO, CURVA DA BRUXA, CURVA DO PLACAR, CURVA "S", CURVA DA VITÓRIA).

**Item EXTRA de QA (correção ao briefing, §2.5):** o briefing afirma que `cerebro-coach.js` está vazio — **é falso**; o arquivo tem uma v0 funcional que o cérebro não chama. Fiscalize que **nenhuma** entrega de J1–J4 trate o arquivo como vazio nem proponha apagar/sobrescrever a v0.

**PRONTO =** PLANO-MESTRE §5 (J5). Como você depende das outras, trabalhe no que já dá (esqueleto dos cenários com o objeto v0) e conclua quando tiver material.

VEREDITO: (nenhum ainda — trabalhe seu prompt; auditoria vem quando o Flávio acionar o Fable)

### 2026-07-08T20:08:02Z — Fable · material completo na mesa + 2 itens novos de QA
J1–J4 entregaram e foram auditadas (todas SEGUIR) — sua matéria-prima está completa: objeto v1 (`janela-2.md §1`), mensagem por níveis + portão (`janela-1.md`), gráfico + medidas do cartão (`janela-3.md`), envelope + fases (`janela-4.md`).
1. **QA extra 1:** verifique de forma INDEPENDENTE o achado da J3 (`janela-3.md §5`): ápices-semente divergem das passagens do fixture em 7/8 curvas (53–164 px; só Curva 2 casa). Confirme ou refute com seu próprio cálculo.
2. **QA extra 2:** confira que os cenários exercitam também os caminhos de silêncio honesto (`null`+`status`), `subTrecho:null` (curva curta) e o gate SF da Vitória (freio nunca é apontado lá).
3. **Pedido do Flávio (vale já):** comece **toda resposta** a ele com `[JANELA 5]` e rode uma vez no terminal: `printf '\033]0;JANELA 5\007'` (estampa o número no título da janela do terminal).

### 2026-07-08T20:55:41Z — Fable · AUDITORIA da entrega

**VEREDITO: APROVADO — frente fechada.** QA do nível que a sala precisava.

**Contraprova do maestro:** rodei os seus 2 scripts (`analise-j5.mjs` e `prova-motor-bruxa.mjs`) — **saídas idênticas às suas**: eleição = "S" 0,996 (5/5) + Bruxa 0,485 (4/5); out-laps 23/05 v1 e 24/05 v1; ápices 4/8 divergem (70,4 / 235,0 / 99,9 / 82,4 m) e 4/8 casam (≤5,2 m); Bruxa gap 0,485 vs integrado 0,025, `freio` com 0 amostras. Seus números são reproduzíveis de verdade.

**Despacho dos achados (feito por mim, nas caixas):** F1 → J4+J2 (investigação passo 0 da Fase 1) · F2/F3a/F8 → J2 (correção de especificação) · F3b e F7 → fila de decisões do Flávio (§6.9 e §6.10) · F4 → J3 (corrigir 7/8→4/8) · F5 → J4 (anotador no plano de teste) · F6 → arbitrado por mim (Fase 1 embarca N1+N2; muda 1 linha na J4) · F8 → J1 (marcar exemplos como ilustrativos). Sua sugestão de promover o C1 (Curva "S") a cenário-vitrine oficial: **aceita** — entra assim na síntese.

Fique de prontidão; se as correções de J2/J3 mudarem números dos seus cenários, eu te reabro pontualmente.
