# Última tarefa — Tela que se transforma: STATUS (parado) ⟷ COCKPIT do piloto (andando) — 23/06/2026

## Pedido original de Flávio
Resposta dele à pergunta "monto o checar antes de rodar?":
"Na tela de mostrar os status, se o carro não está andando, mostra a tela com todos os status,
como é que eles estão, o que está funcionando, pode colocar até o dado debaixo do ícone, o título
dele em cima, na tela toda a gente pode usar para... se o carro estiver andando, aí mostra a tela
que é a réplica, a cópia do que o piloto está vendo."

## Objetivo (1 frase)
UMA tela que, com o carro PARADO, mostra todos os status dos aparelhos em tela cheia (ícone, título em
cima, dado embaixo, cor por estado) e, quando o carro ANDA, vira a réplica do painel do piloto.

## Critérios objetivos de conclusão
- Parado: grade de status em tela cheia, com os MESMOS aparelhos do painel aprovado (Motor/Movimento/Chassi),
  título em cima, dado/estado embaixo, cor verde(comunicando)/vermelho(sem sinal)/amarelo(falha)/cinza(a instalar).
- Destaque do que decide a gravação: GPS e MOTOR chegando (sim/não).
- Andando: a tela vira o painel do piloto APROVADO (cockpit-volta-real.html), sem alterá-lo.
- A troca parado⟷andando acontece sozinha pela velocidade (histerese, sem botão).
- Provado no navegador com a volta real (replay): para→status, anda→cockpit.

## Leitura dos arquivos obrigatórios
- ~/.claude/CLAUDE.md: sim · ~/.claude-decisoes/padroes.md: sim
- ~/.claude/FLAVIO_EXECUTION_PROTOCOL.md / DONE_CHECKLIST / ENVIRONMENT_RULES / COMMUNICATION_RULES: existem (confirmados)
- docs/COCKPIT_FONTE_DA_VERDADE.md: sim · P1 Fast/CLAUDE.md: sim
- memórias: cockpit-metodo-web-primeiro, captura-automatica-movimento, app-tela-cockpit-piloto, cockpit-bubi-live-nao-publicar: sim

## Plano (<=5 passos)
1. (feito) Ler o painel aprovado e mapear os 14 sensores + de onde vem a velocidade.
2. Criar web/cockpit/checar-antes-de-rodar.html: embute o painel aprovado (iframe, intocado) + overlay de status.
3. Overlay lê o estado REAL dos sensores e a velocidade do painel (mesma origem) — sem duplicar lógica.
4. Troca por velocidade com histerese (anda>=15, para<=6 por 12s) — mesma régua da captura automática.
5. Servir na raiz do projeto + abrir no navegador pro Flávio ver a transição. Sim/não.

## Arquivos/áreas a inspecionar
- web/cockpit/cockpit-volta-real.html (painel APROVADO — só leitura, NÃO alterar)
- web/cockpit/cockpit-state.js / cockpit-renderer.js / live-data-bridge.js (peças do painel)

## Ambiente alvo: desenvolvimento
## Produção protegida: sim
## Autorização para produção: não
## Evidência da autorização: não recebida (é web/dev; nada publicado no canal cockpit-bubi-live)

## Riscos
- NÃO tocar no painel aprovado (cockpit-volta-real.html) — usar por embute (iframe). Regra dura.
- Não publicar nada no canal de produção cockpit-bubi-live. É tela local de demonstração.
- Limiares de velocidade (anda/para) são defaults — calibrar na pista.
- Sensores de chassi são "a instalar": marcar cinza/"A instalar", NUNCA vermelho de falha (sem alarme falso).

## Status inicial: iniciado
