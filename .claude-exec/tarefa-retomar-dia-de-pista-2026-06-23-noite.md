# Tarefa — RETOMAR DIA DE PISTA (sessão de 23/06/2026, noite)

## Pedido original de Flávio
"RETOMAR DIA DE PISTA" (gatilho) — continuar exatamente do ponto salvo, sem refazer o que está
feito, e avançar no que dá pra avançar no Mac (fora carro/Windows).

## TASK_INIT
- Protocolo carregado: sim (CLAUDE.md global + projeto + memória + RETOMAR-DIA-DE-PISTA.md)
- Padrões carregados: parcial (não reli os FLAVIO_*.md um a um nesta sessão)
- Ambiente alvo: desenvolvimento · Produção protegida: sim · Autorização produção: não
- Pedido entendido: retomar o "tudo pronto pro dia de pista" e fechar o que sobra no Mac
- Critério: estado verificado de verdade (não inferido) + avanço provado, sem quebrar o existente

## O que VERIFIQUEI (não inferido)
- Versão oficial (main) limpa; linha sync `sync/notebook-dia-de-pista-2026-06-23` existe (Mac + GitHub).
- A linha sync NÃO avançou: notebook não devolveu nada (origin/sync = df7d7bf7, atrás da main local).
- Arquivos-chave todos no lugar (CapturaDiaDePista, SessionRecorder, testes, MainWindow WinUI).
- Bateria do domínio rodada de verdade: era 261/1; a falha era PAN_04 (locale, vírgula no Mac).

## O que FIZ e PROVEI nesta sessão (só acréscimo)
1. Consertei a única falha da bateria (PAN_04): em LivePanel.cs as 4 linhas de telemetria com
   decimal passaram a usar FormattableString.Invariant — igual o arquivo já fazia nas datas.
   Painel de diagnóstico agora mostra ponto em qualquer máquina. Bateria: **262/262 verde**.
2. Criei o GUIA DE BANCADA (`.claude-exec/GUIA-BANCADA-DIA-DE-PISTA.md`): passo a passo fiel ao
   código (console `--nuvem-teste` → `--diag` → `--gravar` → `--gravar --nuvem` → produção travada)
   + o que aparece na tela do piloto + tabela de "quem faz o quê".
3. Atualizei o ponto de retomada (RETOMAR-DIA-DE-PISTA.md): bateria verde, guia, e a divergência.

## Divergência ABERTA (alertei, não escolhi)
- Tela WinUI tem 12 luzes de marcha; a versão aprovada 22/06 tem 17. O .exe sairia com a barra
  antiga se a sessão do notebook só "ligar a tela existente". Decisão do Flávio.

## TASK_DONE
- Pedido conferido: sim · Ambiente: desenvolvimento · Produção alterada: não
- Arquivos inspecionados: sim · Alterações: sim (1 conserto + 1 guia + 2 registros) · Testes: sim (262/262)
- Resultado: concluído no que dá no Mac; resto bloqueado em Windows/iPhone/carro/decisão do Flávio
- Pendências reais (não são minhas de fazer agora):
  1. Tela do piloto ligada no feed real (CapturaDiaDePista) — só compila no Windows (sessão notebook).
  2. GPS do iPhone (1 Hz) chegando ao notebook — Windows + iPhone.
  3. Curvas de Brasília no orquestrador — Windows.
  4. Físico (Flávio): bancada + pista + calibrar 15 km/h e 12 s.
  5. Decisão: 17 luzes no WinUI x 12 atuais.

## Arquivos
- ALTERADO: windows/cockpit/P1Fast.Cockpit.T4000LiveDemo/LivePanel.cs (4 linhas, FormattableString.Invariant)
- NOVO: .claude-exec/GUIA-BANCADA-DIA-DE-PISTA.md
- ATUALIZADO: .claude-exec/RETOMAR-DIA-DE-PISTA.md
- NOVO: este registro

## Preservado
- Todo o comportamento do painel (só formatação invariável), todos os 262 testes, a tarefa anterior
  em ultima-tarefa.md (não sobrescrita). Nada em produção. Nada removido.
