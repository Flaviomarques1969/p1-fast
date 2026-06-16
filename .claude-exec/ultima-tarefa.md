# Última tarefa — P1 Fast — auditoria da bolinha do carro no Command Box (16/06/2026)

## TASK_INIT
- **Pedido original (Flávio):** "Na tela do Command Box, a função do pontinho na pista que representa o carro — como está, está ligada de verdade, está mostrando realmente onde o carro está, isso está funcionando?"
- **Objetivo (1 frase):** Auditar, em modo só leitura, se a bolinha do carro no mapa do Command Box (Vista Piloto) é alimentada por dado real ao vivo ou por animação.
- **Critério de conclusão:** Dizer com prova (arquivo:linha) qual é a fonte que move a bolinha hoje, se o GPS real chega, e se está ligado ao mapa.
- **Leitura confirmada:** ~/.claude/CLAUDE.md; padroes.md; FLAVIO_EXECUTION_PROTOCOL.md; FLAVIO_DONE_CHECKLIST.md; FLAVIO_ENVIRONMENT_RULES.md; FLAVIO_COMMUNICATION_RULES.md; memória global + memória P1 Fast.
- **Plano:** (1) ler arquitetura canônica e memória do Command Box; (2) localizar a bolinha no mockup; (3) achar o que move ela; (4) achar a fiação ao vivo; (5) cruzar com o plano de conexão real.
- **Áreas inspecionadas:** `_design-reference/mockup-command-box-vista-piloto.html`; `_design-reference/PLANO-command-box-conexao-real-2026-06-13.html`; `web/cockpit/pista-oficial-brasilia.js` (existe, mas não é carregado no mockup).
- **Ambiente alvo:** desenvolvimento (mockup/protótipo do Command Box; produção do Command Box = TV 32'' com ao vivo real, não este arquivo).
- **Produção protegida:** sim. **Autorização para produção:** não. **Evidência:** não recebida.
- **Riscos:** nenhum (só leitura). Status: concluído.

## Achado (prova)
A bolinha "live" do carro NÃO está ligada ao dado real. Ela é **animação por relógio**:
- `mockup-command-box-vista-piloto.html:6979` — `liveT = (elapsed % MAP_CFG.lapMs)/MAP_CFG.lapMs` (posição vem do tempo decorrido).
- `:6936` — assinatura da volta vem de `currentLap().trajetoria` = FAKE_LAPS (voltas fictícias, `:4657`).
- `:6988` — `setMarkerPos('live', liveP.x, liveP.y)` movido só pelo tick do relógio.
- GPS real CHEGA mas é IGNORADO: `:7756-7757` gravam `REAL.lat/REAL.lng` e **nada lê** (grep confirma: só escrita).
- Bloco `mapa` está em `DEP_LIGACAO` (`:7677`) → recebe selo cinza "aguardando ligação" (`:7688`, CSS `:7639`).
- `pista-oficial-brasilia.js` (projeção GPS→tela) NÃO é carregado neste mockup.
- Corrobora o plano: `PLANO-command-box-conexao-real-2026-06-13.html:94` — "o ponto do carro pode acender com o GPS real — que já chega, mas hoje é ignorado (o ponto anda por animação)".

## TASK_DONE
- Pedido original conferido: sim
- Ambiente trabalhado: desenvolvimento (só leitura)
- Produção foi alterada: não
- Autorização explícita registrada: n/a
- Arquivos reais inspecionados: sim
- Alterações feitas: não (auditoria)
- Testes/validação executados: leitura de código + grep (prova arquivo:linha)
- Resultado: concluído
- Pendências reais: ligar o GPS real ao mapa (Fase 1 do plano) — não autorizado/não pedido ainda
