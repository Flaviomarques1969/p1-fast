# CONTINUAR — Mensagens do cockpit (Fase 1 feita, Fase 2 IMPLEMENTADA em DEV)
# Gatilho de retomada: "RETOMAR FASE 2" ou "voltei". Atualizado 2026-07-05.

## >>> ATUALIZAÇÃO 2026-07-05 (sessão iMac) — FASE 2 FOI IMPLEMENTADA <<<
Flávio autorizou implementar direto ("vai até o fim e implementa tudo, no final audita e corrige"),
em vez de esperar o painel de decisões. Segui as RECOMENDAÇÕES do painel + o prompt. Estado atual:
- FASE 2 (IA de padrão de temperatura do MOTOR) = IMPLEMENTADA em DEV, testada, sem produção.
- Branch `claude/fase2-ia-temperatura`. Doc completo: `docs/FASE2_IA_TEMPERATURA.md`. Estado: `.claude-exec/ultima-tarefa.md`.
- Prova: dotnet test domínio 396/396 (com DOTNET_ROLL_FORWARD=Major) + JS alertas 25/25.
- DIVERGÊNCIA do painel a confirmar com Flávio: P1 recomendava "3 voltas"; o PROMPT manda "contínuo, sem número
  fixo de voltas" — segui o prompt (aprendizado contínuo, com semente de referência). Ver §5 do doc.
- O painel `.claude-perguntas/pendentes/20260705-103020-fase2-ia-temperatura.html` fica como registro; as
  decisões dele já entraram na implementação (defaults = as recomendações). Confirmar se estão do agrado.
## >>> fim da atualização <<<


## ONDE ESTAMOS
- FASE 1 (simplificação das 24 mensagens do cockpit do piloto) = **CONCLUÍDA** pelo notebook.
  - 6 commits na branch sync/notebook-dia-de-pista-2026-06-23: d5493671 textos · 6afcdbe0 números · d4d59d0b -3 alertas · 9e6c2d06 -coach · 3ea8ad99 histerese · 39f03cd4 caixa (+45ee926e água, c28a532b §2 RaceBox).
  - Placar: 16 alertas + 8 coach = 24. Suite 377/377 verde, WinUI compila. Zero produção.
  - Spec canônica: canal claude-comms -> specs/SPEC_MENSAGENS_COCKPIT_PILOTO_v2.md
  - Regra de caixa: Title Case (exceto ligação de/da/do), IDs/chaves seguem CAIXA ALTA, sigla GPS mantida.

- FASE 2 (a parte inteligente = IA de padrão) = **DECIDIDA pelo Flávio 2026-07-05** (resposta salva: `~/Downloads/resposta-perguntar-fase-2-*.txt (1)`; registrada em `~/.claude-decisoes/perguntar-historico.jsonl`).
  - DECISÕES TRAVADAS (5):
    1. Aprendizado = **C: contínuo, nunca trava** (NÃO "3 voltas"). → JÁ implementado assim (AprendizadoTemperatura.cs L7-8,52,88). CONFERE com o código.
    2. Gatilho "Temperatura Motor Subindo" = **+3°C acima da máxima normal** (DeltaSubindoC=3). JÁ implementado. (Flávio devolveu dúvida só sobre a mecânica do painel — respondida: escolher outra letra não é erro, é decidir diferente da recomendação.)
    3. Ambiente (sem sensor) = **A: usar a água ANTES de ligar** como referência do dia. STATUS **PARCIAL**: o aprendizado contínuo já embute o dia; a leitura EXPLÍCITA da água pré-ignição alimentando o `AmbienteOffsetC` ainda NÃO está ligada (offset existe, default 0). → implementar em DEV.
    4. Pneu Quente = **A: 2 níveis por tipo** (radial185 95/105 · slick195 105/115). Config preparada (AprendizadoLimites); espera sensor. **PEDIDO NOVO do Flávio:** esses limites têm que ser EDITÁVEIS no APP (aba "Garagem", celular). → pendência de produto (app), abaixo.
    5. Óleo = **A: fora do aprendizado** (sem sensor de temperatura; só o aviso de pressão). JÁ está fora (saiu na Fase 1). CONFERE.
  - Próximo: (a) ligar item 3 em DEV; (b) ✅ FEITO 05/07 14:38 — decisões+código EMPACOTADOS pro notebook: linha `claude/fase2-ia-temperatura` enviada pro origin + recado no canal `claude-comms` (mensagens/20260705T143854Z-de-imac-para-notebook.md). Notebook deve baixar, compilar WinUI, validar visual e mandar screenshots; (c) tela "Garagem" p/ editar limites no app celular (pendência de produto).

## ACHADOS DA VERIFICAÇÃO (confirmados no código real AmostraAlerta)
- Carro NÃO mede temperatura de ÓLEO (só o BIT de baixa pressão). "Óleo Quente" foi tirado na Fase 1. -> P5 do painel.
- Carro NÃO tem sensor de temperatura do AMBIENTE. -> P3 do painel (definir a fonte).
- Sensores de PNEU (temp+pressão) e CÂMBIO (temp) ainda não instalados no carro.

## PENDÊNCIAS
- **[Fase 2 · item 3] Água pré-ignição como referência de ambiente** — ligar em DEV (alimentar `AmbienteOffsetC` com a leitura da água antes do motor rodar). Hoje só o aprendizado contínuo cobre o dia.
- **[Fase 2 · item 4] Tela "Garagem" no app celular** p/ o Flávio editar os limites de pneu (e demais parâmetros da IA). A base já é toda configurável no código; falta a TELA. Pedido explícito do Flávio 2026-07-05.
- Marcha lenta REAL do Bubi (limiar de partida do óleo; 500 rpm hoje) — confirmar com Flávio.
- Screenshots do notebook das mensagens novas (pedidos, ainda não vieram) — mostrar ao Flávio quando chegarem.
- Banco de TESTE próprio pro P1 Fast (não existe; só produção fvhwltzhytpnhlqbttmd) — decisão do Flávio, em aberto.
- Branch de trabalho da Fase 2: claude/fase2-ia-temperatura (auto-save ativo).

## CANAL notebook<->imac
- Worktree: ~/Projetos/p1fast-worktrees/comms; ajudante p1-comms.sh; branch claude-comms.
- Religar vigia: cd nesse worktree e rodar ./vigia-canal.sh em background monitorado.
- REGRA: nas mensagens do canal usar "você", NUNCA "tu/te/teu" (§9.2 PLANO_FASE_1). Eu falhei nisso antes; corrigir daqui pra frente.
