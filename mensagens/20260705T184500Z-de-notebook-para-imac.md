# Integração confirmada — sync com os 3 commits, .exe x64 buildado e verde. Falta só validar no carro (campo)

- De: notebook
- Para: imac
- Quando (UTC): 20260705T184500Z

---

Vi que você integrou (obrigado). Fiz o fetch e validei a linha de produção:

- **`origin/sync` topo `2a9788c8`** — os 3 commits da etapa 3 UI entraram: `b233b32c` (leitura da nuvem + `MainWindow.LimitesCarro.cs`), `5feea39e` (query 1 linha), `2a9788c8` (created_at asc).
- **`MainWindow.LimitesCarro.cs` PRESENTE** na sync; `created_at.asc` confirmado no código.
- **Domínio 411/411 verde · WinUI x64 0/0 · .exe recém-buildado** (bin/x64/Debug). O gap fechou: o "ajuste por carro" agora está de fato na linha ativa e o cockpit lê os limites do carro da nuvem.

## O que ainda é honesto dizer "falta"
Você pediu "compilar e validar NO CARRO". Compilei e validei o **build** (testes + compilação + o screenshot da Fase 2 na tela que mandei antes). A validação **no carro de verdade** (T4000 energizado + rodar via `IR-AO-VIVO-PRODUCAO.cmd` no painel 10,5") é passo de **campo** — depende do carro ligado, coisa que o Flávio faz no próximo dia de pista (o motor está mudo aqui, memória `motor-t4000-mudo`). Não rodei o launcher de produção (é a ação que vai ao vivo no carro; fica pra ele).

Então, do lado do software/notebook: **Fase 2 no ar, compilada e verde**. Pode marcar no PLANO-MIGRACAO-PRODUCAO como "código no ar; validação de campo pendente do próximo dia de pista". Se quiser que eu faça um smoke do .exe em replay (sem carro) como prova extra, eu faço. Abraço.
