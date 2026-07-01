# Protocolo do canal AUTOMÁTICO — notebook ↔ iMac (sem o Flávio no meio)

**Objetivo (ordem do Flávio, 2026-07-01):** parar de depender do Flávio pra avisar "responde o
canal" / "ele te aguarda". Cada lado **vigia sozinho** o canal `claude-comms` e **responde/age
sozinho**. O Flávio só entra quando bate uma trava dura (produção / negócio / destrutivo).

Este doc é a fonte da verdade do comportamento automático. Vale pros DOIS lados (notebook e iMac).

---

## 1. O laço de vigília (o que cada sessão faz sozinha)

Enquanto a sessão estiver ligada em modo canal, repetir a cada **~60–90 s**:

1. `git fetch origin claude-comms` (no worktree do canal — ver §4).
2. Se há commit novo em `origin/claude-comms` com arquivo `…-para-<eu>.md` que eu ainda não tratei:
   - Ler a mensagem.
   - **Agir** (resolver o pedido: responder, passar dado, rodar teste, git ops, commit/push na
     branch de trabalho — tudo o que a autonomia permite, §3).
   - **Responder** no canal (append de `…-de-<eu>-para-<outro>.md`, §4).
3. Se não há nada novo, seguir vigiando (volta ao passo 1).
4. Parar só quando: o Flávio mandar parar, **ou** bater uma trava de escalonamento (§2).

Ferramenta pra ligar o laço: **`/loop`** (feito pra isso; auto-cadência ou intervalo curto). Cada
máquina liga o seu **uma vez**; a partir daí é automático entre as duas.

## 2. Escalonamento — PARA e chama o Flávio (travas duras)

A vigia resolve quase tudo sozinha, MAS **para o laço, avisa o Flávio e espera** se o que chegou
(ou o que seria preciso fazer pra responder) envolve:

- **PRODUÇÃO** — publicar em `cockpit-bubi-live`, `--producao`, ou qualquer coisa que só sai com a
  frase **"MIGRAR PARA PRODUÇÃO"** do Flávio.
- **DECISÃO DE NEGÓCIO / ESCOPO** — mudar arquitetura, reabrir decisão fechada, priorizar produto,
  custo, prazo. A vigia PROPÕE, o Flávio decide.
- **DESTRUTIVO / IRREVERSÍVEL** — `DELETE` em dado real, `push --force`, reescrita de histórico,
  apagar/sobrescrever o que não foi a própria sessão que criou, tocar a **tela do piloto** (INTOCÁVEL).

Fora dessas três, a vigia **resolve e responde** — não fica esperando o Flávio.

## 3. Autonomia concedida (2026-07-01, "resolve tudo, só escala produção/negócio")

PODE sozinha, sem pedir: responder o canal; `git fetch`/`add`/`commit`/`push` nas branches de
trabalho (`sync/*`, `claude-comms`); rebase/pull --rebase; rodar build e testes; ler/subir dado pro
`sessao_dumps` (canal de TESTE); escrever/atualizar docs e memória; criar/rodar ferramentas de dev.

NÃO pode sem o Flávio: as três travas do §2.

## 4. Mecânica do canal (git puro — vale Windows e Mac)

Worktree dedicado ao canal (uma vez por máquina):
```
git worktree add ../p1fast-comms claude-comms   # se ainda não existe
cd ../p1fast-comms && echo <notebook|imac> > .quem-sou
```
Ler:
```
git fetch origin claude-comms && git reset --hard origin/claude-comms
# abrir mensagens/*-para-<eu>.md mais recentes
```
Responder (append, nunca reescrever histórico):
```
# criar mensagens/AAAAMMDDTHHMMSSZ-de-<eu>-para-<outro>.md
git add -A && git commit -m "msg <eu>-><outro>: assunto" && git push origin claude-comms
# se o push bater de frente: git pull --rebase origin claude-comms && push de novo
```
Regras do canal seguem o `claude-comms:LEIA-PRIMEIRO.md`: só mensagens, nunca merge na `main`,
append-only, sem segredo.

## 5. Limitação honesta (o que ainda precisa do Flávio)

- O laço só roda com a **sessão aberta**. Se a sessão fecha, aquele lado para de vigiar — o Flávio
  reabre e liga de novo (uma linha: "liga a vigia do canal").
- Uma máquina não **acorda** a outra na hora; a resposta vem no próximo giro (~60–90 s) do outro
  lado. Pra conversa entre Claudes isso é rápido o bastante.
- Bootstrap: o Flávio liga a vigia **uma vez em cada máquina**. Depois, automático até fechar.

## 6. Como o Flávio liga (uma linha por máquina)

Em cada sessão (notebook e iMac):
> **"liga a vigia do canal"**  → a sessão lê este doc, entra no `/loop` do §1 e não sai até você
> mandar parar ou bater uma trava do §2.
