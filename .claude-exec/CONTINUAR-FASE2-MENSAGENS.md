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

- FASE 2 (a parte inteligente = IA de padrão) = **EM DEFINIÇÃO**.
  - Painel de decisão ABERTO: .claude-perguntas/pendentes/20260705-103020-fase2-ia-temperatura.html (5 perguntas).
  - Quando Flávio disser "fiz": ler ~/Downloads/resposta-perguntar-*.txt (mais recente), confirmar item a item, registrar em ~/.claude-decisoes/perguntar-historico.jsonl, e passar a spec da Fase 2 pro notebook implementar (só a IA da TEMPERATURA DO MOTOR entra já; pneu/câmbio esperam sensor).
  - As 5 decisões: (1) voltas de aprendizado [rec 3]; (2) gatilho +3°C acima da máxima [rec]; (3) fonte da temperatura do AMBIENTE, já que não há sensor [rec: usar a água antes de ligar]; (4) Pneu Quente 2 níveis por tipo [rec]; (5) óleo sem sensor -> deixar fora do aprendizado [rec].

## ACHADOS DA VERIFICAÇÃO (confirmados no código real AmostraAlerta)
- Carro NÃO mede temperatura de ÓLEO (só o BIT de baixa pressão). "Óleo Quente" foi tirado na Fase 1. -> P5 do painel.
- Carro NÃO tem sensor de temperatura do AMBIENTE. -> P3 do painel (definir a fonte).
- Sensores de PNEU (temp+pressão) e CÂMBIO (temp) ainda não instalados no carro.

## PENDÊNCIAS
- Marcha lenta REAL do Bubi (limiar de partida do óleo; 500 rpm hoje) — confirmar com Flávio.
- Screenshots do notebook das mensagens novas (pedidos, ainda não vieram) — mostrar ao Flávio quando chegarem.
- Banco de TESTE próprio pro P1 Fast (não existe; só produção fvhwltzhytpnhlqbttmd) — decisão do Flávio, em aberto.
- Branch de trabalho da Fase 2: claude/fase2-ia-temperatura (auto-save ativo).

## CANAL notebook<->imac
- Worktree: ~/Projetos/p1fast-worktrees/comms; ajudante p1-comms.sh; branch claude-comms.
- Religar vigia: cd nesse worktree e rodar ./vigia-canal.sh em background monitorado.
- REGRA: nas mensagens do canal usar "você", NUNCA "tu/te/teu" (§9.2 PLANO_FASE_1). Eu falhei nisso antes; corrigir daqui pra frente.
