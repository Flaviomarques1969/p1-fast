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

## RESULTADO DA AUDITORIA (workflow 6 agentes, 16/06) — meu plano FOI REFUTADO
Veredito dos 2 céticos (confiança alta): "bolinha fiel com esforço médio" é FALSO. Esforço real = ALTO. Provas:
1. **Projeção GPS→tela não existe nesta tela e a que existe não serve.** SVG do Command Box = viewBox "130 110 580 660" (espaço 580×660, traço hardcoded mockup:3502/3533). Única função GPS→pixel do projeto = `geoParaDesenho` em pista-oficial-brasilia.js, espaço 823×799 (linhas 9-10/22-26), calibrada pra OUTRO desenho e NEM carregada no mockup (grep zero). Reuso direto joga a bolinha pra longe → precisa re-calibrar do zero pro Command Box.
2. **GPS de hoje é ~1 Hz (grosseiro).** A ~100 km/h = ~28 m por amostra → bolinha aos saltos, não fiel. Sem suavização por GPS no mockup. O 25 Hz (RaceBox) que resolveria está SPEC ARQUIVADA/condicional (docs/hardware/RACEBOX_INTEGRATION_SPEC.md:3) — futuro, não realidade.
3. **liveT (relógio fictício) move ~12 funções**, não só a bolinha (mockup:6976-7011: reveal, trajetória colorida, lap-wrap, passagem, frenagem, vmin, delta-acum). Mover só a bolinha dessincroniza a tela. Honesto = trocar a FONTE do liveT (relógio→fração-de-arco do GPS) = redesenho.
4. **DECISÃO DE ARQUITETURA (do Flávio):** ARQUITETURA_DEFINITIVA.md:49/77 "Command Box não calcula nada, só apresenta o que o .exe gera". Projetar GPS = cálculo. Quem projeta — notebook (manda posição pronta, fiel à regra) ou Command Box (rápido de mostrar, viola a regra)? Canal hoje só manda lat/lng cru (cloud-bridge.js:81-87), sem progresso pronto.
Limitação honesta: 1 das 4 frentes (fonte-gps) não devolveu estruturado; coberta pelo cético de dados. Fluidez/sincronismo/latência só se provam com carro na pista.
Status: auditoria concluída — aguardando decisão do Flávio sobre quem projeta o GPS antes de construir.
