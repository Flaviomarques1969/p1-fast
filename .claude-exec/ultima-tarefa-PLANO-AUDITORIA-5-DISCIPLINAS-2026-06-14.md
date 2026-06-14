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

---

## TASK_DONE 14/06/2026
- Pedido original conferido: sim
- Ambiente trabalhado: desenvolvimento (somente leitura)
- Produção foi alterada: não
- Se produção foi alterada, autorização explícita registrada: não se aplica
- Arquivos reais inspecionados: sim (6 frentes: ios/, src/, supabase/, web/+tools/+windows/, STATUS/BLOCKERS/docs, dados de referência)
- Alterações feitas: sim — só criei o plano (HTML) + este registro; nenhum código tocado
- Testes/validação executados: leitura de evidência real (~240 verificações pelos 6 agentes); não rodei build/migration/deploy
- Resultado: concluído (entrega = PLANO; a auditoria em si é decisão do Flávio)
- Pendências reais: Flávio escolher por onde começar a execução (recomendado: Segurança)

### Entrega
- `relatorios/plano-auditoria-5-disciplinas-2026-06-14.html` (formato mapa, aberto no navegador).

### Achados preliminares mais relevantes (só do mapeamento)
- GRAVE seguranca: tabelas de limites do motor (mig 0034) + fila de comandos T4000 (mig 0023) + perfil de reacao (mig 0035) abertas para acesso publico (anon/USING(true)).
- MEDIO integridade: alvo de potencia pode ler CV como kW; voltas reais x sinteticas sem flag no schema.
- MEDIO confiabilidade: envio iPhone->nuvem pendente de validacao fim-a-fim; 8 curvas de Brasilia incompletas (P0).
- Nucleo solido: 546 testes Swift + 345 testes Node verdes; painel validado com motor real.

### O que foi preservado
- `.claude-exec/ultima-tarefa.md` (checkpoint da frente trail-braking) — NAO tocado.

---

## EXECUCAO 14/06/2026 — "roda tudo" (auditoria completa das 5 disciplinas)
- Autorizacao: Flavio escreveu "roda tudo".
- Modo: SOMENTE LEITURA. Sem migration, sem deploy, sem escrita em banco. Producao protegida.
- Metodo: 5 auditores a fundo (1 por disciplina) + verificacao adversarial de cada achado grave/medio (cetico tenta refutar) — alinhado a "validar uso real antes de alarmar".
- Testes read-only permitidos (npm run smoke; tentar swift smoke).
- Entrega prevista: relatorio de auditoria em HTML (formato mapa) + plano de correcao PROPOSTO (sem executar).
- Status: CONCLUIDA.

### TASK_DONE EXECUCAO 14/06/2026 (auditoria completa)
- Pedido original conferido: sim ("roda tudo" = auditar as 5 disciplinas).
- Ambiente trabalhado: desenvolvimento (somente leitura).
- Producao foi alterada: NAO.
- Autorizacao para producao: nao se aplica (nada migrado).
- Arquivos reais inspecionados: sim (25 agentes; ~858 acoes de leitura/grep/testes).
- Alteracoes feitas: NAO em codigo/banco. So gerei 2 relatorios HTML + este registro.
- Testes executados (read-only): npm run smoke = 345 ok/0 fail (e 382 ok/0 fail em outra contagem de suites); swift run p1fast-smoke = 546 ok/0 fail; node-smoke-* por disciplina, todos verdes.
- Resultado: CONCLUIDO.

### Entregas
- `relatorios/plano-auditoria-5-disciplinas-2026-06-14.html` (o plano).
- `relatorios/auditoria-resultado-5-disciplinas-2026-06-14.html` (o resultado).

### Veredito consolidado (pos 2a checagem adversarial)
- 40 achados: 1 GRAVE real, 3 medios, 12 baixos, 19 OK confirmados, 5 falso-alarme descartados.
- Dos 7 alarmes graves do 1o levantamento, NENHUM se confirmou grave (3 falso-alarme: CV/kW INT-01, contaminacao referencia INT-03, calibracoes CONF-03; 4 rebaixados). 1 medio subiu pra grave (SEG-05).
- GRAVE REAL = SEG-05: painel publico (p1t4000) + tabelas do shift light sem trava (RLS) + chave anon = qualquer um escreve nessas tabelas pela internet. Dano CONTIDO hoje porque o painel usa ENVELOPE_DEFAULT_BUBI fixo no codigo, nao o do banco (SEG-06 refutado). CUIDADO: fechar anon sem desenhar a trava certa quebra o painel (abertura foi decisao do Flavio 11/06).
- Pendencia do Flavio (nao defeito): calibrar apice das 8 curvas de Brasilia (CONF-01) liga a analise de apice.

### Plano de correcao proposto (aguardando Flavio escolher)
1) Seguranca (RLS + login real) — prioridade 1, preparar em DEV, validar, so migrar com autorizacao.
2) Calibrar apice (acao do Flavio no configurador).
3) Faxina linhas/ambientes orfaos.
4) Higiene menor (chave central, enum pneu, view voltas reais, consolidar 0026/0027).
5) Medir em pista (aquecimento iPhone, fluidez painel, atraso do dado).

### Pendencias reais
- Nenhuma da auditoria em si. Aguarda decisao do Flavio sobre qual item de correcao executar.
