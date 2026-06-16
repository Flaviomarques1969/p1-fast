# Ultima tarefa — P1 Fast — CAMINHO 1: ligar o Command Box no ao vivo (16/06/2026)

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
