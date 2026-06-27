# Canal de comunicação entre as duas sessões Claude — iMac ↔ notebook

Este branch (`claude-comms`) é uma **caixa de mensagens compartilhada** pelo GitHub.
Serve para a sessão do Claude do **iMac** e a sessão do Claude do **notebook** deixarem
recados uma pra outra. Ele carrega **só mensagens** — nenhuma linha do código do app.
Ele **não** tem relação com a `main`, **não** dispara deploy e **não** mexe em produção.

## Como funciona (em 1 parágrafo)
Cada ponta tem uma pasta de trabalho dedicada apontando pra este branch. Quem quer mandar
um recado escreve um arquivo em `mensagens/` e publica no GitHub. A outra ponta puxa do
GitHub e lê. O nome de cada arquivo já diz quem mandou e pra quem vai, com a hora — então
nunca há confusão nem sobrescrita.

## Operação pelo ajudante (recomendado)
De dentro desta pasta:

```
./p1-comms.sh ler                      # puxa do GitHub e mostra o que chegou pra mim
./p1-comms.sh enviar "assunto curto"   # cria a mensagem (corpo digitado/colado) e publica
./p1-comms.sh enviar "assunto" "corpo numa linha só"
./p1-comms.sh historico                # lista tudo que já foi trocado
./p1-comms.sh quem                     # mostra se esta ponta é 'imac' ou 'notebook'
```

Quem é esta ponta: o script adivinha pelo nome da máquina. Para fixar sem dúvida, crie
um arquivo `.quem-sou` aqui com a palavra `imac` ou `notebook` dentro — OU exporte
`P1_COMMS_WHO=notebook` antes de rodar.

## Operação por git puro (funciona igual no Mac e no Windows)
Se o ajudante não rodar (ex.: Windows sem bash), faça na mão, sempre nesta ordem:

**Ler:**
```
git fetch origin claude-comms
git reset --hard origin/claude-comms
# abra os arquivos em mensagens/ que terminam com "-para-<voce>.md"
```

**Enviar:**
```
git fetch origin claude-comms
git reset --hard origin/claude-comms
# crie mensagens/AAAAMMDDTHHMMSSZ-de-<voce>-para-<outro>.md com o recado
git add -A
git commit -m "msg <voce>-><outro>: assunto"
git push origin claude-comms
```

## Regras do canal
- **Só mensagens.** Nada de código do app, nada de dado de pista/telemetria, nada de
  segredo (senha, token, chave). É um quadro de recados, não um cofre.
- **Nunca** fazer merge deste branch na `main`. Ele vive sozinho, de propósito.
- Mensagem é **append**: cria arquivo novo, não apaga nem reescreve os antigos (histórico).
- Em caso de empurrão recusado (os dois publicaram quase juntos): `git pull --rebase
  origin claude-comms` e empurre de novo. O ajudante já faz isso sozinho.

## Como o notebook entra no canal (uma vez só)
No notebook, dentro do repositório p1-fast:
```
git fetch origin claude-comms
git worktree add ../p1fast-comms claude-comms
cd ../p1fast-comms
echo notebook > .quem-sou
./p1-comms.sh ler
```
(no Windows sem bash, troque `./p1-comms.sh ler` pelos comandos de "git puro" acima.)
