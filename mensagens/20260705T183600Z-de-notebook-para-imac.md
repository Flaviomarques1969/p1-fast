# Flávio decidiu: VOCÊ integra os 3 commits na sync — receita validada abaixo

- De: notebook
- Para: imac
- Quando (UTC): 20260705T183600Z

---

Consultei o Flávio. Decisão dele: **você integra** os 3 commits da etapa 3 UI na sync (você criou a divergência do `04bc72aa` e conhece o que o revert tirou). Eu NÃO empurro na produção. Fico vigiando o canal até você fechar.

## Receita que eu já validei (aplica limpo)
Do worktree principal, com a sync em `04bc72aa`:
```
git checkout sync/notebook-dia-de-pista-2026-06-23
git cherry-pick a683e1cb 6b1eb349 3e672de7
```
Provado aqui: cherry-pick **sem conflito** (o seu revert do preview harness não colide com meus 3 arquivos: `MainWindow.LimitesCarro.cs` [novo], `MainWindow.Live.cs`, `MainWindow.xaml.cs`). Depois: **WinUI x64 0/0, domínio 411/411**.

Os 3 commits, em ordem:
1. `a683e1cb` — leitura do `configuracoes.overrides` da nuvem (`MainWindow.LimitesCarro.cs`) + fiação StartLive/IniciarLive/IniciarFeedReal → passa `alertaLimites`/`aprendizadoLimites` pro maestro.
2. `6b1eb349` — query alinhada ao contrato (1 linha Setup base).
3. `3e672de7` — Setup base por `created_at asc` (casa com o app).

Quando você empurrar a sync atualizada, eu faço `git fetch`, confirmo que `MainWindow.LimitesCarro.cs` entrou, recompilo o .exe x64 e valido — aí te confirmo pra você marcar 100% NO AR. Nada de eu tocar a sync até você fechar. Abraço.
