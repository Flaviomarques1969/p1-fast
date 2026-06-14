# TASK_INIT 14/06/2026 — PLANO DE AUDITORIA (5 disciplinas) do P1 Fast

> Arquivo separado de propósito: o `ultima-tarefa.md` guarda o checkpoint ATIVO
> da frente trail-braking/passagem. NÃO foi tocado, para não destruir o ponto de
> retomada daquela frente.

1. **Pedido original (Flávio, literal):** "Monte um plano de auditoria com 5 disciplinas
   da área de auditoria, como segurança, desempenho, funções que estarem quebradas ou
   funcionando realmente, monte esse plano e me traga aqui. no p1 fast"

2. **Objetivo em 1 frase:** entregar um PLANO de auditoria (não a execução) do P1 Fast,
   organizado em 5 disciplinas, fundamentado em evidência real do repositório.

3. **Critérios objetivos de conclusão:**
   - 5 disciplinas definidas, cada uma com: objetivo, escopo real (arquivos/áreas do repo),
     riscos já conhecidos com evidência, método de auditoria, critérios de aprovação/reprovação
     e o que tratar como somente leitura.
   - Fundamentação por evidência (arquivos lidos / comandos rodados), sem invenção.
   - Entrega visual em formato mapa (HTML, largura total, sem emoji/ícones, linguagem de gestor),
     aberta no navegador, com link clicável.
   - Nenhuma alteração de produção. Nenhuma alteração de código.

4. **Leitura confirmada:** ~/.claude/CLAUDE.md (sim) · ~/.claude-decisoes/padroes.md (sim, vazio) ·
   FLAVIO_EXECUTION_PROTOCOL (sim) · FLAVIO_DONE_CHECKLIST (sim) · FLAVIO_ENVIRONMENT_RULES (sim) ·
   FLAVIO_COMMUNICATION_RULES (sim) · memória P1 Fast dois caminhos (sim) · CLAUDE.md do projeto (sim).

5. **Plano curto (≤5 passos):**
   (1) Mapear subsistemas com evidência real (6 agentes read-only — em andamento, workflow wg03920wm).
   (2) Sintetizar 5 disciplinas a partir do mapeamento + riscos conhecidos da memória.
   (3) Montar o plano: objetivo/escopo/riscos/método/critérios por disciplina.
   (4) Gerar HTML formato mapa, abrir no navegador.
   (5) Apresentar resumo curto no chat e aguardar Flávio priorizar.

6. **Arquivos/áreas a inspecionar:** ios/ (app + p1fast-core), src/ (telemetria JS),
   supabase/ (migrations + Edge Functions + RLS) e api/, web/ + tools/ + windows/ (painéis e tempo real),
   STATUS.md/BLOCKERS.md/ARCHITECTURE_DECISIONS.md/docs/ (qualidade e dívida),
   docs+src+ios (integridade: lambda WB/NB, dyno, marcos Brasília, voltas reais vs sintéticas).

7. **Ambiente alvo:** desenvolvimento (somente leitura). Nenhuma execução em produção.
8. **Produção protegida:** sim.
9. **Autorização para produção:** não.
10. **Evidência da autorização para produção:** não recebida (e não necessária — é só plano/leitura).
11. **Riscos:** baixo. Único cuidado: não rodar migration/deploy/seed; não sobrescrever o checkpoint
    da frente trail-braking; não tocar nas regras duras (não suavizar pista, não perder versões finais).
12. **Status inicial:** iniciado.
