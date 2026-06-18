# Ultima tarefa — P1 Fast — ITEM 3: fundir o ao vivo no Command Box (18/06/2026)

## TASK_INIT — ITEM 3 (18/06/2026)
- **Pedido original (Flavio):** "faca" — seguir minha recomendacao: em DEV, plugar o que ja esta pronto (bolinha por GPS real, recalibrada+suavizada) direto no mockup do Command Box, pra ele VER a bolinha real andando na tela. Depois mover a conta pra nuvem.
- **Objetivo (1 frase):** fazer o mockup do Command Box mover a tela pela FRACAO DE ARCO derivada do GPS real (item 1+2 ja prontos), no lugar do relogio ficticio (liveT), com fallback pro relogio quando nao ha GPS, e um modo DEV de replay da volta real gravada (23/05) pra ver agora sem carro na pista.
- **Criterio de conclusao:** com `?replay=23-05`, a bolinha (e a tela, em sincronia) anda pela volta REAL gravada, projetada+suavizada, validado no navegador pela 8078, arranjo do Flavio intacto, demonstracao padrao intacta sem o parametro. Nada em producao.
- **Leitura confirmada (18/06):** ~/.claude/CLAUDE.md; ~/.claude-decisoes/padroes.md; FLAVIO_EXECUTION_PROTOCOL.md; FLAVIO_DONE_CHECKLIST.md; FLAVIO_ENVIRONMENT_RULES.md; FLAVIO_COMMUNICATION_RULES.md; P1 Fast/CLAUDE.md; memoria do Command Box (arquitetura definitiva 16/06, conceito producao 16/06, frenagem redesenho 15/06, servir-pela-8078).
- **Ambiente alvo:** DESENVOLVIMENTO (mockup/prototipo). Producao do Command Box (TV via Fire TV Stick) NAO e este arquivo.
- **Producao protegida:** sim. **Producao alterada:** nao. **Autorizacao producao:** nao recebida (nao necessaria — e dev).
- **Plano (<=5 passos):** (1) backup do mockup; (2) gerar fixture da volta real (dado real, aditivo); (3) modulo de posicao ao vivo (reusa geoParaCommandBox + suavizador, ponto->fracao de arco) expondo window.__cbPos; (4) ligar: onGps alimenta __cbPos, tick usa a fracao real como liveT quando fresca (senao relogio), selo "ao vivo/replay" + modo DEV replay; (5) validar na 8078 + navegador e mostrar.
- **Arquivos a tocar:** `_design-reference/mockup-command-box-vista-piloto.html` (tick ~6985; onGps 7757; checador 1s 7735; novo <script type=module> antes do </body>). Reuso (NAO duplicar): `web/cockpit/pista-brasilia-commandbox.js`, `web/cockpit/suavizador-bolinha.js`, `web/cockpit/pista-oficial-brasilia.js`. Novo fixture: `web/command-box/fixtures/volta-real-gps-23-05.json`.
- **REGRA DURA:** NAO tocar no Vmin (fr-*/_shortRevealStateForLap); BACKUP antes; arranjo do Flavio (ATUAL.json) intocado; servir SO pela 8078; comportamento padrao (sem ?replay) identico; dado da producao tem que ser real ao vivo (replay e DEV, rotulado).
- **Decisao de arquitetura assumida (recomendacao aceita por "faca"):** projetar GPS no proprio Command Box agora e DEV stand-in; a conta vai pra nuvem depois (mudanca interna, nao muda o que a tela mostra). Rotular honestamente.
- **Status inicial:** iniciado.

---

## (HISTORICO ANTERIOR — CAMINHO 1: itens 1 e 2, 16/06/2026)

## TASK_INIT
- **Pedido original (Flavio):** "siga" — seguir o caminho 1 ja escolhido: ligar a frenada/dados ao vivo no Command Box, reusando o motor que ja existe, em desenvolvimento.
- **Objetivo (1 frase):** fazer o Command Box (mockup vista-piloto) consumir o fluxo ao vivo (canal cockpit-bubi-live) e mostrar dado REAL continuo, ponto a ponto — comecando pela bolinha do carro por GPS real e pelo bloco de frenada saindo de "aguardando ligacao".
- **Criterio de conclusao:** a bolinha anda por GPS real (nao mais por relogio) e/ou a frenada acende do fluxo ao vivo, validado no navegador pela 8078, com o arranjo do Flavio intacto. Nada em producao.
- **Leitura confirmada:** ~/.claude/CLAUDE.md; padroes.md; FLAVIO_EXECUTION_PROTOCOL.md; FLAVIO_DONE_CHECKLIST.md; FLAVIO_ENVIRONMENT_RULES.md; FLAVIO_COMMUNICATION_RULES.md; arquitetura definitiva (docs/ARQUITETURA_DEFINITIVA.md + memoria); auditoria da bolinha (este arquivo, versao anterior).
- **Ambiente alvo:** DESENVOLVIMENTO (mockup/prototipo). Producao do Command Box (TV via Fire TV Stick) NAO e este arquivo.
- **Producao protegida:** sim. **Producao alterada:** nao. **Autorizacao producao:** nao recebida (nao necessaria — e dev).
- **Plano (<=5 passos):** (1) mapear e desenhar a ligacao minima e segura (workflow); (2) backup do mockup antes; (3) implementar a ligacao ao vivo (GPS->bolinha continua; depois frenada ao vivo); (4) validar na 8078 + navegador; (5) mostrar ao Flavio.
- **Arquivos a inspecionar/tocar:** `_design-reference/mockup-command-box-vista-piloto.html` (live: setupLigacaoAoVivo ~7612, REAL.lat/lng ~7756, bolinha ~6979/6988, frenada DEP_LIGACAO ~7677); `web/cockpit/pista-oficial-brasilia.js` (projecao GPS->tela); `web/command-box/frenagem-real.js` + `web/cockpit/freio-trecho.js` (motor).
- **REGRA DURA:** NAO tocar no Vmin (compartilha fr-*/_shortRevealStateForLap); classes proprias; BACKUP antes de tocar no mockup; arranjo do Flavio (ATUAL.json) intocado; servir SO pela 8078; dado tem que ser CONTINUO ponto a ponto (nao em lote).
- **Achado base (auditoria anterior, prova):** a bolinha "live" anda por RELOGIO (mockup:6979/6988), GPS real CHEGA mas e IGNORADO (:7756-7757 so escrevem), frenada em DEP_LIGACAO (:7677), pista-oficial-brasilia.js NAO e carregado no mockup.
- **Status inicial:** iniciado — fase de mapeamento/desenho.

## RESULTADO DA AUDITORIA (workflow 6 agentes, 16/06) — meu plano FOI REFUTADO
Veredito dos 2 céticos (confiança alta): "bolinha fiel com esforço médio" é FALSO. Esforço real = ALTO. Provas:
1. **Projeção GPS→tela não existe nesta tela e a que existe não serve.** SVG do Command Box = viewBox "130 110 580 660" (espaço 580×660, traço hardcoded mockup:3502/3533). Única função GPS→pixel do projeto = `geoParaDesenho` em pista-oficial-brasilia.js, espaço 823×799 (linhas 9-10/22-26), calibrada pra OUTRO desenho e NEM carregada no mockup (grep zero). Reuso direto joga a bolinha pra longe → precisa re-calibrar do zero pro Command Box.
2. **GPS de hoje é ~1 Hz (grosseiro).** A ~100 km/h = ~28 m por amostra → bolinha aos saltos, não fiel. Sem suavização por GPS no mockup. O 25 Hz (RaceBox) que resolveria está SPEC ARQUIVADA/condicional (docs/hardware/RACEBOX_INTEGRATION_SPEC.md:3) — futuro, não realidade.
3. **liveT (relógio fictício) move ~12 funções**, não só a bolinha (mockup:6976-7011: reveal, trajetória colorida, lap-wrap, passagem, frenagem, vmin, delta-acum). Mover só a bolinha dessincroniza a tela. Honesto = trocar a FONTE do liveT (relógio→fração-de-arco do GPS) = redesenho.
4. **DECISÃO DE ARQUITETURA (do Flávio):** ARQUITETURA_DEFINITIVA.md:49/77 "Command Box não calcula nada, só apresenta o que o .exe gera". Projetar GPS = cálculo. Quem projeta — notebook (manda posição pronta, fiel à regra) ou Command Box (rápido de mostrar, viola a regra)? Canal hoje só manda lat/lng cru (cloud-bridge.js:81-87), sem progresso pronto.
Limitação honesta: 1 das 4 frentes (fonte-gps) não devolveu estruturado; coberta pelo cético de dados. Fluidez/sincronismo/latência só se provam com carro na pista.
Status: auditoria concluída — aguardando decisão do Flávio sobre quem projeta o GPS antes de construir.

## EXECUÇÃO — ITEM 1 (recalibração) + ITEM 2 (suavização), 16/06 (autorizado: "faça primeiro a recalibração e depois siga para o item 2")
Ambiente: DESENVOLVIMENTO. Produção NÃO tocada. Mockup do Command Box NÃO tocado (diff contra backup = idêntico).
BACKUP: `_design-reference/_backups/mockup-command-box-vista-piloto.BACKUP-recalibracao-2026-06-16.html`.

ITEM 1 — RECALIBRAÇÃO (feita e provada):
- `tools/recalibrar-mapa-command-box.mjs` — acha a transformação de semelhança (escala+rotação+posição+espelho) desenho-oficial(823×799) → traço do Command Box (viewBox 130 110 580 660), testando todas as rotações/direções/espelho. Reusa a amarração provada GPS→desenho-oficial (pista-oficial-brasilia.js).
- Saída: `web/cockpit/pista-brasilia-commandbox.js` (função `geoParaCommandBox(lat,lng)`).
- VALIDADO com volta REAL do Bubi (gps-23-05.tsv, 1013 leituras, independente do ajuste): mediana 7,3 px (0,33 largura de pista), p95 22,9 px (~1 largura), máx 53,8 px (~2,4 larguras, 1-2 curvas onde o desenho estilizado abre). Sobreposição de caixas 100%, centros a 15 px.

ITEM 2 — SUAVIZAÇÃO (feita, testada, demonstrada):
- Verificado: GPS real é ~1 leitura/seg (mediana 1000 ms; buraco máx 9,2 s) → ~28 m/leitura a 100 km/h. Suavização necessária confirmada.
- `web/cockpit/suavizador-bolinha.js` — desliza pela FRAÇÃO DE ARCO do traço (sempre na pista), trata virada de volta e NÃO inventa trajeto em perda de sinal (marca perdido).
- `tests/node-smoke-suavizador-bolinha.mjs` — 10/10 verdes.

PROVA VISUAL (aberta no navegador): `relatorios/prova-bolinha-command-box.html` — pista do CB + volta real por cima + 2 bolinhas (crua pulando 1/seg vs suavizada deslizando 60 q/s), trecho limpo de ~95 s tocado em 14 s.

PENDENTE (NÃO feito de propósito — é item 3 + decisão do Flávio): ligar de verdade no mockup (trocar o relógio fictício liveT pela fração derivada do GPS ao vivo) e DECISÃO A vs B (quem projeta: notebook ou Command Box).

TASK_DONE:
- Pedido conferido: sim (item 1 depois item 2)
- Ambiente: desenvolvimento | Produção alterada: não | Mockup alterado: não
- Arquivos inspecionados/criados: sim (6 novos; mockup preservado, backup feito)
- Validação executada: sim (volta real projetada + 10 testes do suavizador + prova visual no navegador)
- Resultado: concluído (itens 1 e 2). Item 3 (ligar ao vivo no mockup) aguarda decisão A vs B.
- Pendências reais: decisão A vs B (quem projeta o GPS) antes de fundir no mockup ao vivo.
