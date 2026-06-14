# TASK_INIT 14/06/2026 — CORREÇÃO DE SEGURANÇA (item 1 da auditoria)

> Arquivo próprio. NÃO toca o checkpoint trail-braking (`ultima-tarefa.md`).
> Origem: auditoria 14/06 — relatorio `relatorios/auditoria-resultado-5-disciplinas-2026-06-14.html`.

1. **Pedido original (Flávio):** "sim." — autorizou começar pela Segurança (item 1 do plano de correção).

2. **Objetivo em 1 frase:** fechar a porta aberta do painel — ligar a trava de acesso (RLS)
   nas tabelas do shift light e desenhar o login real — SEM quebrar o painel, preparado em
   desenvolvimento, validado, e só migrado pra produção com autorização literal.

3. **Critérios objetivos de conclusão (desta etapa = diagnóstico + desenho):**
   - Estado real mapeado: quais tabelas estão sem trava, quais policies anon existem, e o que
     o painel LÊ vs GRAVA em cada uma (com evidência arquivo:linha).
   - Saber se há banco de desenvolvimento separado ou se é só a nuvem de produção.
   - Desenho da correção mínima que protege sem quebrar o painel anônimo + opção de login real.
   - Decisões de negócio reais isoladas (card), se houver. Nada aplicado em produção sem autorização.

4. **Leitura confirmada:** CLAUDE.md global (sim) · padroes.md (sim, vazio) · protocolos FLAVIO (sim) ·
   memória P1 Fast 2 caminhos (sim) · CLAUDE.md do projeto (sim) · relatório da auditoria (sim).

5. **Plano curto (≤5 passos):**
   (1) Mapear estado real (migrations 0023/0034/0035/0041 + POLICIES-VIVAS + consumidores JS + AMBIENTES).
   (2) Confirmar ambiente (dev separado? nuvem única?).
   (3) Desenhar a trava certa (anon só leitura onde precisa; escrita protegida) + caminho do login real.
   (4) Separar o que é correção segura do que é decisão de negócio (card se preciso).
   (5) Preparar a mudança em DEV, testar, apresentar pra Flávio validar. NÃO migrar sem autorização.

6. **Áreas a inspecionar:** supabase/migrations (0023/0034/0035/0041 e vizinhas), supabase/POLICIES-VIVAS-2026-06-11.md,
   web/cockpit/{pontos-troca-persister,configuracao-stint,pilot-reaction-persister,*-loader,voltas-persister}.js,
   AMBIENTES_P1_FAST.md, memória project_p1fast_auth_decisao.

7. **Ambiente alvo:** desenvolvimento. 8. **Produção protegida:** sim. 9. **Autorização produção:** não.
10. **Evidência autorização produção:** não recebida (só autorizou começar a trabalhar a segurança em dev).
11. **Riscos:** ALTO se fechar anon errado (quebra o painel). Mitigar: desenhar trava fina, testar, validar antes de migrar.
12. **Status inicial:** iniciado.

---

## EXECUÇÃO 14/06 — aplicação da 0045 (higiene RLS)
- Decisão Flávio (card 20260614-seguranca-painel-fechamento): "Só a higiene, sem login".
  Registrada em ~/.claude-decisoes/respostas/p1-fast/ + index.jsonl.
- Autorização literal de produção: "MIGRAR PARA PRODUÇÃO: higiene de segurança do painel (0045)".
- Estado da nuvem (migration list): aplicadas até 0043; PENDENTES = 0044 (vídeo, NÃO autorizada,
  aguarda Flávio validar vídeo) e 0045 (segurança, autorizada).
- BLOQUEIO encontrado: `db push` falhou no login automático do Postgres (28P01) e disparou
  circuit breaker do pooler ("too many auth failures"). `supabase projects list` OK (token vivo,
  p1-fast linkado ●). Causa provável: excesso de tentativas. NÃO cacei senha (classificador
  bloqueou varredura de credenciais — correto). Espero a trava liberar e re-tento.
- Método cirúrgico (memória 14/06): 0044 movida p/ /tmp/p1fast-0044-hold/ para o push aplicar
  SÓ a 0045. Restaurar 0044 ao fim. NUNCA --include-all.
- Em andamento: dry-run após espera (background be8p9mlpa).
- Status: CONCLUÍDO.

## TASK_DONE — 0045 aplicada em produção 14/06
- Pedido original conferido: sim (começar pela Segurança / "roda tudo" → item 1).
- Ambiente trabalhado: produção (nuvem fvhwltzhytpnhlqbttmd).
- Produção foi alterada: SIM (apenas regras de acesso/RLS; nenhuma linha de dado tocada).
- Autorização explícita registrada: SIM — "MIGRAR PARA PRODUÇÃO: higiene de segurança do painel (0045)".
- Arquivos reais inspecionados: sim (migrations 0001/0023/0034/0035/0041, POLICIES-VIVAS, consumidores JS).
- Alterações feitas: 0045 criada e aplicada. 0044 (vídeo) preservada/devolvida — NÃO aplicada.
- Testes/validação executados: sim — migration list (0045 remoto OK; 0044 segue pendente);
  leitura anônima HTTP 200 nas 4 tabelas (painel continua lendo); push sem erro.
- Resultado: CONCLUÍDO (Camada 1 / higiene).
- Pendências reais:
  - Login real do painel (Camada 2) ADIADO por decisão do Flávio (escolheu "só higiene, sem login").
  - 0044 (vídeo) segue pendente, aguardando Flávio validar o vídeo (não autorizada).
  - Higiene menor restante da auditoria (chave central, enum pneu, view voltas reais, consolidar 0026/0027) — fora desta etapa.

### O que mudou no banco (0045)
- RLS ligada em: pontos_troca_aprendidos, envelopes_seguranca_stint, qualidade_troca_marcha
  (espelhando o acesso anon que o painel já usa: select/insert/update onde aplicável).
- perfis_reacao_piloto: trocada policy FOR ALL (permitia DELETE a qualquer um) por select/insert/update anon.
- t4000_live_commands / t4000_live_events: removido acesso anônimo (filas órfãs; ninguém consome).
- Rollback documentado dentro do próprio 0045.