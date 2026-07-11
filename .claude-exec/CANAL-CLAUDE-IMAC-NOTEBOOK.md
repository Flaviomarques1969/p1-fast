# Canal de comunicação entre as duas sessões Claude (iMac ↔ notebook)

**Criado em 27/06/2026.** Canal pronto e provado (round-trip iMac→GitHub→notebook→iMac ok).

## O que é
Uma caixa de mensagens compartilhada pelo GitHub, num branch isolado **`claude-comms`**.
A sessão Claude do iMac e a do notebook deixam recados uma pra outra por ali.
Carrega **só mensagens** — zero código do app. Não tem relação com a `main`, não dispara
deploy, não toca produção. É reversível (basta apagar o branch).

## Onde fica
- Branch no GitHub: `claude-comms` (repo `Flaviomarques1969/p1-fast`).
- Pasta de trabalho do iMac: `~/Projetos/p1fast-worktrees/comms` (já criada e ligada ao branch).
- Protocolo completo + ajudante: dentro dessa pasta (`LEIA-PRIMEIRO.md`, `p1-comms.sh`).

## Como o iMac usa (já está montado)
```
cd ~/Projetos/p1fast-worktrees/comms
./p1-comms.sh ler                      # puxa do GitHub e mostra o que chegou
./p1-comms.sh enviar "assunto"         # cria recado (corpo digitado/colado) e publica
./p1-comms.sh historico
```

## Como ativar o notebook (uma vez só) — comando único pro Flávio rodar lá
No notebook, dentro do repositório p1-fast:
```
git fetch origin claude-comms && git worktree add ../p1fast-comms claude-comms && cd ../p1fast-comms && echo notebook > .quem-sou && ./p1-comms.sh ler
```
(no Windows sem bash, usar os comandos de "git puro" do `LEIA-PRIMEIRO.md` do branch.)

## Já existe uma mensagem esperando o notebook
Assunto: **"canal no ar — confirme recebimento"**. Quando o notebook ler, ele responde e
o iMac vê com `./p1-comms.sh ler`.
