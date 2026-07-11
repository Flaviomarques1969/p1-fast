# Caixa da CONSTRUTORA CÉREBRO → Fable — só a construtora escreve aqui

> Sempre ACRESCENTE blocos com hora (`date -u +%FT%TZ`); nunca sobrescreva. Blocos obrigatórios: `PRONTO PARA AUDITORIA (M1)` e `(M2)`, com comandos e saídas REAIS.

### 2026-07-10T13:41:48Z — PRONTO PARA AUDITORIA (M1) — LAUDO DO PASSO 0 (PORTÃO ACIONADO)
**Achado: MISTO, com componente de REGISTRO NO PRODUTO → parei no passo 0, conforme mandato.**
Laudo completo + scripts + saídas reais: `construcao/passo0/LAUDO-PASSO0.md`, `passo0-linhas-vivas.mjs`+`RESULTADO-*.txt`, `passo0-fixture-vs-0029.mjs`+`RESULTADO-*.txt`.

**Método:** rodei o `TrechoDetector` REAL com as linhas VIVAS (migration 0029 v2) sobre o traço cru `volta-real-gps-23-05-rodando.json` (1 Hz).

**(B) Produto:** a janela da 0029 é apex±30 m (60 m) — curta demais pras curvas rápidas. Com as linhas vivas, a freada cai FORA do segmento: `freada-iniciou` NUNCA dispara em CURVA 01/JUNÇÃO/PLACAR/VITÓRIA; em CURVA 2 o Vmin está no 1º ponto (freou 68 km/h ANTES da entrada, 0 DEPOIS). Sub freio/entrada inatribuível nessas curvas **no produto**, não só no fixture.
**(A) Dado de teste:** `passagens-bubi-brasilia.v1.json` usa segmentação ANTIGA (só rotula com os IDs da 0029): 5/8 passagens nunca chegam a <60 m do ápice 0029 (CURVA 01 102 m, BRUXA 73 m, PLACAR 220 m, "S" 106 m, VITÓRIA 69 m); `tempo_trecho_s` de 8-21 s ≫ 60 m. Mesma causa-raiz do ápice-semente 4/8 da J5.

**O sistema NÃO quebra:** caminho honesto = `subTrecho:null` (curva inteira), já previsto (J2 §5.4 / SOLUCAO-FINAL §10). Vitrine C1 (Curva "S" ~1,0 s) funciona nele.

**Decisão que escalo (não decido):**
1. [Recomendo] SEGUIR os passos 1-3 no caminho `subTrecho:null` agora (DEV, não toca produção, entrega curva inteira). "Onde-fino" entra depois sem mudar contrato.
2. Conserto de registro de segmentos (janela que comece antes da freada / por-curva + regerar fixture das linhas vivas) = tarefa de PRODUTO separada, com autorização.

**pacote-exemplo.json:** NÃO publicado ainda — depende dos passos 1-3, que estão atrás deste portão. Publico assim que você liberar o caminho (1).
Aguardo veredito: SEGUIR (caminho 1) / CORRIGIR / segurar.

### 2026-07-10T14:37:30Z — PRONTO PARA AUDITORIA (M2) — passos 1-5 construídos + pacote publicado
**Caminho liberado (1) executado no ambiente isolado `.claude/worktrees/coach-cerebro`. Produção/produto intocados.**

**O que construí (passos 1-5):**
- **Passo 1** — `tempoAtualS` ADITIVO em `web/cockpit/delta-calculator.js` (relógio da passagem = (últ.t−1º.t)/1000; paridade C# DeltaCoach.cs:31). Os 5 campos antigos intactos; `mensagens-pedagogicas.js:206` já lê o campo (laço fechado).
- **Passo 2** — módulo NOVO `web/command-box/cerebro/cerebro-coach-stint.js` (casa própria; v0 `cerebro-coach.js` INTOCADA). Acumulador de stint + eleição J2: p25 conservador (decisão 9), confiança agregada-no-stint, out-laps fora, stickiness, fallback curva-inteira, gate SF, status honesto. Calibração = constantes NOMEADAS (decisão 2). Insistência guiada pelo plano (`trechosFoco`/`nVoltasAlvo`, decisão 6).
- **Passo 3** — pacote de 3 estados (envelope J4 §2): `null`/`silencio`(status+linha J1 §2.5)/`oportunidade`(objeto v1 + mensagem N1/N2 pré-computada, SÓ ÂMBAR — decisão 3 + GraficoSpec J3 §1.2 + timing). Ligado em `cerebro-painel.js:167` de forma NÃO-QUEBRÁVEL (acumulador opcional; sem ele, comportamento idêntico ao de hoje).
- **Passo 4** — nova casa registrada em `docs/CONTRATO_DADOS.md` §2 (distinta da v0 km/h) + adicionada à trava `CASAS` do smoke.
- **Passo 5** — `tests/node-smoke-coach-stint.mjs` (11 testes) + no `npm run smoke`.

**PUBLICADO (destrava a TELA):** `construcao/pacote-exemplo.json` — pacote REAL do fixture nos 3 estados. Eleição = **CURVA "S", subTrecho:null, ganhoVoltaS 0,996 (p25), deltaMedio 1,394, voltas 2,3,4,6,7** — reproduz a J5 C1 exato. Bruxa atrás. Silêncio = coletando-dados (C5). semOnda = null.

**Comandos + saídas REAIS (2026-07-10T14:37:30Z, no worktree):**
```
node tests/node-smoke-delta-calculator.mjs      → 11 ok / 0 fail
node tests/node-smoke-mensagens-pedagogicas.mjs → 17 ok / 0 fail
node tests/node-smoke-arquitetura-dado.mjs      → 28 ok / 0 fail (nova casa protegida)
node tests/node-smoke-coach-stint.mjs           → 11 ok / 0 fail
node web/command-box/cerebro/cerebro-painel.smoke.mjs → TUDO VERDE (coach antigo comportamento intacto)
node tests/node-smoke-oportunidade-trecho.mjs   → 13 ok / 0 fail (consumidor do delta intacto)
npm run smoke  → só 4 falhas em node-smoke-schema-parity.mjs (contagem de tabelas PG×GRDB),
                 PRÉ-EXISTENTES (idênticas 11ok/4fail na base sem minhas mudanças) — não é do coach.
```

**Achado honesto (não escondo):** a confiança da "S" deu **media (0,648)**, NÃO "alta 0,85" como a J5 estimou ilustrativamente — é o resultado fiel da fórmula J2 §4.3 sobre o dado real (2 das 5 voltas perdem ~2s → CV puxa a consistência pra baixo). A eleição não muda (passa o piso). Se você quiser "alta" ali, é recalibrar fConsistencia (decisão de calibração → Flávio), não um bug.

**Correção registrada:** o p25 conservador é sobre TODAS as voltas voadoras (gap~0 conta 0) — sem isso a Vitória bimodal elegia falsamente; corrigido e coberto pelo CS-06 (Vitória → silêncio, = J5 C4).

Aguardo veredito do M2: APROVADO / CORRIGIR.

### 2026-07-10T14:47:24Z — CÉREBRO · M2 aprovado recebido + nota cosmética resolvida
Obrigado pela auditoria. Apliquei a nota cosmética já (não esperei a integração): a linha do silêncio agora
inclui a contagem — `linhaSilencio(status)` usa `status.voltasObservadas` → "Juntando dado — 2 voltas" (J1 §2.5).
Teste CS-04 atualizado (11/0). `pacote-exemplo.json` republicado com a linha corrigida.
Frente do CÉREBRO fechada e de prontidão para a integração final (M2 CÉREBRO × M2 TELA) quando você conduzir.
