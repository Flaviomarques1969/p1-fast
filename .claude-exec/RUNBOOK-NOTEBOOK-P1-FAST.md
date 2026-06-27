# RUNBOOK — "notebook p1 fast" (executado pelo Claude do iMac)

> **Gatilho:** o Flávio diz **"notebook p1 fast"** (ou "publica o notebook", "faz o que o notebook deixou pendente").
> **Quem executa:** a sessão do Claude no **iMac** (é a única que publica no Vercel — o notebook Windows não tem CLI/node/painel).
> **Tratamento:** sempre **"você"**, nunca "tu/te" (§9.2 do PLANO_FASE_1).
> Atualizado: 2026-06-27 pelo notebook (branch `sync/notebook-dia-de-pista-2026-06-23`).

---

## ★ NOVO (2026-06-27) — dados pro app na nuvem + CONVERSA esperando resposta
Tarefa nova de arquitetura: **fazer o app na nuvem receber TODOS os dados** (todas as voltas, 25 Hz). O notebook já fez a parte dele (o `p1fast-upload` já pôs dado real em `sessao_dumps`). **Tem 6 perguntas suas esperando resposta** em **`.claude-exec/CONVERSA-NOTEBOOK-IMAC-DADOS-NUVEM.md`** — responda lá (commit+push). Contexto: `.claude-exec/HANDOFF-IMAC-DADOS-NUVEM-2026-06-27.md` + `docs/PLANO_ENVIO_DADOS_NUVEM.md`. Não bloqueia o publish do `p1tv` abaixo — é trabalho à parte, e é seu (destino durável + consumidor do arquivo).

---

## 0. Objetivo
Concluir o **go-live do cockpit/pista** fazendo o que ainda falta — que hoje é **UMA coisa**: **publicar o site `p1tv` no Vercel**. Todo o resto já está no git (feito no notebook).

## 1. Primeiro, sincronize e veja o estado
```
git fetch origin
git log origin/main --oneline -2          # deve conter: 6de7ee81 consolidacao onda 5 (site item-3)
git log origin/sync/notebook-dia-de-pista-2026-06-23 --oneline -6
```
Leia também `.claude-exec/PLANO-MIGRACAO-PRODUCAO.md` (item **4**) — é o tracker oficial.

## 2. O QUE FALTA (a sua tarefa): publicar o site `p1tv`
- **O que publicar:** `web/teste-aparelhos/index.html` (= `p1tv.vercel.app`, "Central de Pista"), versão **item-3**, já commitada na **`main`** (`6de7ee81`).
- **Por que ainda não está no ar:** o push pra `main` **não disparou** auto-deploy no Vercel (o site no ar é de ~21/jun). Publique do jeito que você normalmente publica o `p1tv` (deploy do Vercel a partir da `main`).
- **NÃO** mude o conteúdo no ar além do que está na `main`. Produção é protegida (regra do `PLANO-MIGRACAO-PRODUCAO.md`).

## 3. Verifique que subiu
Abra `https://p1tv.vercel.app/` e confirme que o HTML contém **`onCloudGps`** e o comentário **"Item 3 (RaceBox dono único)"**, e que **NÃO** tem mais a UI "GRAVAÇÃO · parada". (Se ainda tiver a versão antiga, o deploy não concluiu.)

## 3b. (UMA VEZ — pedido do Flávio 2026-06-26) Criar um **Deploy Hook** do Vercel
Objetivo: deixar o **notebook Windows** capaz de publicar o site sozinho depois (o notebook não tem CLI/painel do Vercel, mas consegue "tocar" num link). Assim o Flávio passa a pedir tudo — inclusive o deploy — direto ao Claude do notebook.
- No painel do Vercel do projeto **`p1tv`** → **Settings → Git → Deploy Hooks** → crie um hook na branch **`main`** (nome sugerido: `notebook-deploy-main`). Copie a **URL** gerada.
- **A URL é SECRETA.** **NÃO** comite ela no repositório (o repo é público pra esse fim) e **NÃO** escreva ela em nenhum doc do git.
- **Entregue a URL ao Flávio** (mostre na tela / mande pra ele) com a instrução: *"cole esta URL no Claude do notebook; ele guarda como variável de ambiente `P1FAST_VERCEL_DEPLOY_HOOK` (igual a chave do Supabase) e passa a publicar o site daí."*
- Marque no `PLANO-MIGRACAO-PRODUCAO.md` que o Deploy Hook foi criado (sem a URL).

## 4. Ao concluir, atualize os docs
- Em `.claude-exec/PLANO-MIGRACAO-PRODUCAO.md`, mude o **item 4** de 🟡 PRONTO-aguardando-publish → **🟢 NO AR** (com a data), e adicione uma linha no "Histórico de migrações".
- Commit + push. Reporte ao Flávio em 2-3 linhas (inclua "Deploy Hook criado; URL entregue ao Flávio pro notebook").

## 5. Se algo der errado — desfazer
- O site no ar voltava antes via republicar a `main` na tag **`backup/main-pre-onda5-2026-06-26`** (= `a821ddaa`, estado da `main` antes do item-3).

---

## Contexto — o que o NOTEBOOK já fez (não precisa refazer)
Branch `sync/notebook-dia-de-pista-2026-06-23`, tudo no GitHub:
- **Cockpit `.exe` Fase 1** (`b6fdb976`): threading dedicado, nuvem ligada (publica em `cockpit-bubi-live` só com `--producao`), flush N=10, RaceBox dono único. Build verde, Domain 261/262.
- **Docs** (`6cff4f0e`): ADR-024 (vídeo Osmo + uplink iPhone) + **Amendment 7** (GPS=RaceBox, o `.exe` é dono). Command Box / Amendment 6 (Fire TV) preservados.
- **Site item-3** (`6de7ee81` na `main`): a página `p1tv` parou de abrir o RaceBox por BLE e passou a ouvir o GPS da nuvem (publicado pelo `.exe`). ← **é o que falta publicar.**
- **Ícone/botões no notebook** (`windows/cockpit/`): `P1FAST-AO-VIVO.cmd` (+ ícone "P1 FAST - AO VIVO" na área de trabalho) sobe o `.exe --live --producao` e abre o vídeo; `IR-AO-VIVO-TESTE.cmd` (ensaio); `INSTALAR-ICONE.cmd` (recria o ícone).
- **Regressão de 24/06 descartada** (revertia ios/web-cockpit/supabase + Command Box) — backup num `git stash` **no notebook** (não vem pro iMac; só se precisar, é lá).

## Por que o iMac e não o notebook
O notebook Windows **não publica no Vercel** (sem CLI/node/painel). O canal entre as duas máquinas é **o git**. A memória do Claude de cada máquina é **separada** — por isso este runbook vive no repositório, não na memória.

## Regra de ouro
Nada novo vai pra produção sem o Flávio mandar. Este runbook autoriza **só** publicar o `p1tv` com o conteúdo que **já está na `main`** (item-3). Qualquer outra frente (rodar o `.exe --producao` na pista, shift light, etc.) é ação à parte, na hora, decidida pelo Flávio.
