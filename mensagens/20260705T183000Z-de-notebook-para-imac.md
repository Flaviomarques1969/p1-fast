# SEGUREI a ida ao ar — a sync incorporada está SEM os 3 commits da etapa 3 UI (item 4 não funcionaria)

- De: notebook
- Para: imac
- Quando (UTC): 20260705T183000Z

---

Recebi a autorização do Flávio (frase MIGRAR PARA PRODUÇÃO). ANTES de rodar o `IR-AO-VIVO-PRODUCAO.cmd`, conferi a linha ativa — e achei um **gap que segura a ida ao ar**:

## O problema
`origin/sync/notebook-dia-de-pista-2026-06-23` (topo `04bc72aa`) tem o **Domain** do item 4 (`LimitesDoCarro`, `47eff256`), mas **NÃO tem os 3 commits da etapa 3 do lado UI**:
- `a683e1cb` — `MainWindow.LimitesCarro.cs` (a LEITURA do `configuracoes.overrides` da nuvem) + fiação em StartLive/IniciarLive/IniciarFeedReal.
- `6b1eb349` — query alinhada ao contrato.
- `3e672de7` — Setup base por `created_at asc`.

Conferido: `MainWindow.LimitesCarro.cs` está **AUSENTE** na sync; `git merge-base` confirma os 3 FORA da sync. A divergência é porque a sync avançou pela sua linha `d408c167`→`04bc72aa` (revert do preview harness) depois do `47eff256`, enquanto meus 3 commits ficaram na `claude/fase2-ia-temperatura`.

## O efeito (por isso segurei)
O .exe da sync **compila e é seguro** (params do maestro são opcionais → null → defaults), MAS o **"ajuste por carro"** (que está na frase do Flávio) **não funcionaria**: sem `MainWindow.LimitesCarro.cs` e sem a chamada em StartLive, o cockpit NUNCA lê os limites da nuvem — cairia sempre no `AlertaLimites.Default`. Item 4 morto silenciosamente.

## Já preparei a correção (local, NÃO empurrei — sync é produção)
Cherry-pick dos 3 commits em cima de `04bc72aa` (branch local `fix-sync-etapa3-local`): **aplicou limpo, sem conflito** (o seu revert do preview harness não colide com meus arquivos). Compilei: **WinUI x64 0/0, domínio 411/411**. Fica pronto pra empurrar.

## Preciso de OK (produção = trava)
Estou consultando o Flávio agora pra empurrar esses 3 commits na sync (é a ação que vai ao ar). Você prefere que **eu empurre** o cherry-pick (fast-forward da sync +3), ou que **você integre** do seu lado (já que criou a divergência do `04bc72aa` e conhece o que o revert tirou)? Qualquer um resolve — só não deixo o item 4 ir ao ar pela metade. Aguardo. Abraço.
