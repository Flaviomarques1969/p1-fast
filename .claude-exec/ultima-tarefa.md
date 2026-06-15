# Última tarefa

> Registro anterior (Botão APAGAR da Garagem, 14/06 noite) arquivado em
> `.claude-exec/ultima-tarefa-ANTERIOR-garagem-apagar-2026-06-14.md`.

## TASK_INIT — 2026-06-15 — Luz de marcha (shift light) do cockpit do piloto: alinhar entendimento e provar no navegador

### 1. Pedido original de Flávio
"Sobre as luzes no P1 Fast do cockpit do piloto, do Shift Light, você está com um problema de contexto, não está conseguindo entender. Nós definimos uma barra de luzes para atualizar/modificar e a sua versão não é a versão atual. Você dizia que era porque a vermelha piscava e a vermelha não aparecia — nada disso. Na verdade ela estava com um padrão: era só verde e amarela, quando batia enchia as luzes todas, você tirava as verdes e as amarelas, aparecia vermelha e piscava em branca — e não é assim que combinamos."
Resposta dele no card (15/06): "enche progressivo, sem apagar nada. quando chega na luz vermelha do centro pisca branco com tudo ligado."

### 2. Objetivo (1 frase)
Confirmar com prova no código qual implementação da luz de marcha é a correta vs. a errada e mostrar a correta rodando no navegador pro Flávio, sem alterar produção.

### 3. Critérios objetivos de conclusão
- Identificado, com arquivo:linha, onde está a forma APROVADA (17 luzes, sobe progressivo, na troca pisca branco com tudo ligado) e onde está a forma ERRADA (apaga verde/amarelo).
- Painel real (mesmos arquivos da pista) aberto no navegador pro Flávio ver a subida + piscada.
- Reportado o que está certo, o que confunde e proposta de limpeza/proteção (sem executar deleção sem OK).

### 4. Confirmação de leitura
- ~/.claude/CLAUDE.md: lido
- ~/.claude-decisoes/padroes.md: lido (vazio — 0 decisões registradas)
- ~/.claude/FLAVIO_EXECUTION_PROTOCOL.md: lido
- ~/.claude/FLAVIO_DONE_CHECKLIST.md: lido
- ~/.claude/FLAVIO_ENVIRONMENT_RULES.md: lido
- ~/.claude/FLAVIO_COMMUNICATION_RULES.md: lido
- Memória P1 Fast (dois caminhos): lida. Contrato da luz: p1-fast-shift-light-luz-17-progressiva-2026-06-14.md.

### 5. Plano (≤5 passos)
1. Mapear todas as implementações da luz (FEITO — workflow 6 agentes + leitura direta).
2. Confirmar comportamento exato do painel de pista (FEITO — cockpit-renderer.js:131-141, cockpit.css:229-260, live-data-bridge.js:71).
3. Servir local e abrir cockpit-demo.html (mesmo motor da pista) pro Flávio ver subida + piscada.
4. Reportar certo/errado com prova; propor aposentar/alinhar demo e mockups errados + proteger 17 luzes no teste.
5. TASK_DONE.

### 6. Arquivos/áreas inspecionados
web/cockpit/{cockpit-renderer.js, cockpit-state.js, cockpit.css, live-data-bridge.js, cockpit.js, index.html, index-t3000.html, main-t3000.js, cockpit-demo.html, simulacao-ia-100.html}; tests/ui/shift-light-cockpit.spec.js; _design-reference/mockup-command-box-vista-piloto.html, mockup-cockpit-piloto.html, mockup-shift-light-progressivo.html.

### 7. Ambiente alvo: desenvolvimento (web/cockpit local; produção = p1t4000 Vercel, NÃO tocada)
### 8. Produção protegida: sim
### 9. Autorização para produção: não
### 10. Evidência da autorização: não recebida
### 11. Riscos
- Confundir de novo a tela demo (cockpit.js) com o painel de pista (main-t3000.js).
- Teste automático ainda trava modelo antigo de 12 luzes → a forma correta de 17 não está protegida (pode regredir).
- Onde a piscada DISPARA (RPM 5200 torque vs 6050 potência) é tema separado (shift light inteligente), não confundir com o padrão VISUAL.

### 12. Status inicial: iniciado

---
## Achado verificado (15/06)
- PAINEL DE PISTA (index-t3000.html → main-t3000.js → cockpit-renderer.js + cockpit.css) = FORMA CERTA:
  sobe progressivo das pontas pro centro (tier<=level, central só no fire), na troca as 17 piscam branco com tudo ligado.
- FORMA ERRADA = web/cockpit/cockpit.js (linhas 147-187), usado SÓ pelo index.html (página demo): apaga verde/amarelo no fire + overrev tudo vermelho. + mockups antigos (12 luzes).
