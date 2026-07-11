# TASK — Tela de comparação de voltas (gráfico horizontal de frenagem + aceleração, com ghost da melhor volta)

> Registro anterior (teste do Command Box) preservado em
> `.claude-exec/ultima-tarefa.backup-2026-06-27-pre-tela-comparacao-voltas.md`.

## 1. Pedido original de Flávio
"em p1 fast quero desenvolver uma tela com um gráfico na horizontal mostrando frenagem e
aceleração de uma volta completa e nele fazer um ghost da melhor volta. e na mesma tela ir
mostrando volta a volta adicionando as novas voltas para irmos vendo cada uma delas na tela e
podendo comparar."

## 2. Objetivo (1 frase)
Tela de ANÁLISE (Command Box) com um gráfico horizontal da volta inteira mostrando frenagem e
aceleração, com a melhor volta como ghost de referência, acumulando volta a volta pra comparar.

## 3. Critérios objetivos de conclusão
- Gráfico horizontal cobre a volta inteira (eixo = posição na pista), frenagem e aceleração.
- Ghost da melhor volta sobreposto como referência.
- Várias voltas empilhadas/sobrepostas, podendo comparar cada uma.
- Alimentado por VOLTA REAL gravada (sem dado fictício na tela), respeitando a regra dura
  "tela só EXIBE, não abre conexão própria" — passa em `npm run smoke:arquitetura`.
- Telas congeladas (cockpit-volta-real.html, cockpit-app.html) e Vmin intocados.

## 4. Leitura confirmada
- `~/.claude/CLAUDE.md` — sim
- `~/.claude-decisoes/padroes.md` — sim (vazio, sem padrões registrados)
- `~/.claude/FLAVIO_EXECUTION_PROTOCOL.md` — sim
- `~/.claude/FLAVIO_DONE_CHECKLIST.md` — sim
- `~/.claude/FLAVIO_ENVIRONMENT_RULES.md` — sim
- `~/.claude/FLAVIO_COMMUNICATION_RULES.md` — sim
- Projeto: `CLAUDE.md`, regra dura da arquitetura do dado (uma fonte/um cérebro/telas exibem)
- Memória do projeto: acelerador≠aceleração, frenagem command-box redesenho/dado real,
  command-box na nuvem (guarda toda volta p/ análise), cockpit vs command box, padrão premium

## 5. Plano (≤5 passos)
1. Mapear (paralelo): contrato de dados, componentes de gráfico, lógica melhor volta/ghost,
   onde a tela vive, dados reais p/ DEV, travas. EM ANDAMENTO.
2. Resolver a 1 decisão de negócio real: "aceleração" = força G longitudinal (iPhone, dado real
   hoje) ou posição do pedal/acelerador (TPS, depende de sensor T4000 não instalado). → card.
3. Construir a tela nova de análise (web/command-box), consumindo volta real gravada via a casa
   do dado existente (frenagem-real.js / fixtures de voltas reais do Bubi), sem conexão própria.
4. Ghost da melhor volta + empilhamento volta a volta.
5. Validar (smokes, browser real, navegador aberto pra Flávio ver) e reportar.

## 6. Áreas a inspecionar
- `docs/CONTRATO_DADOS.md`, `src/domain/lap.js`, `web/cockpit/cockpit-state.js`
- `web/command-box/` (frenagem-real.js, frenagem-curvas-reais.js, fixtures), mockup vista-piloto
- `web/cockpit/melhores-loader.js`, `src/domain/reference-line.js`, `cloud-bridge.js`
- Dados reais: `web/command-box/fixtures/passagens-bubi-brasilia.v1.json`, backup voltas reais

## 7. Ambiente
- Ambiente alvo: DESENVOLVIMENTO.
- Produção protegida: sim.
- Autorização para produção: não.
- Evidência da autorização para produção: não recebida.

## 8. Riscos
- Confundir "aceleração" (G) com "acelerador" (pedal/TPS) e construir contra dado inexistente.
- Quebrar a trava smoke:arquitetura (conexão própria / dado fictício na tela).
- Tocar tela congelada ou o Vmin por engano.

## 9. Status inicial: iniciado.
