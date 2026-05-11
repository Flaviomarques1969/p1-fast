# p1fast-t4000-capture

Console pequeno pra capturar o stream cru da Injepro T4000 no notebook
Windows, em arquivo binário com índice de tempo. Análise/parse fica pra
depois (offline).

## Pra que serve

Destrava as **3 dúvidas residuais** do `docs/hardware/T4000_CAN_SPEC.md`:

- #1 Diferenciação dos 5 pacotes — verifica se a heurística de sentinelas
  FIXED + ordem temporal aguenta na vida real.
- #2 Bytes 2-6 do pacote 5 — descobre se variam por cenário (dado útil)
  ou são zero-padding.
- #3 Range físico do EGT — opcional, via Injepro T Software.

## Como o Flávio usa

1. Roda `p1fast-t4000-capture.exe` (single-file, sem instalação) no
   notebook. **Não precisa estar com a T4000 plugada ainda** — o app
   abre em "modo aguardar" e fica esperando.
   - Ao iniciar, **apaga sozinho cópias antigas com sufixo `(1)`,
     `(2)`, etc.** na mesma pasta (que o browser cria quando você baixa
     de novo). O nome canônico é preservado pra próxima execução.
2. Pluga o cabo USB da T4000 no notebook e liga a central (carro com
   chave em ON, não só Acessórios). O app detecta a porta nova em até
   2 s, abre sozinho e começa a captura.
3. Mostra status a cada segundo (`total: N bytes`, velocidade B/s,
   contagem de sentinelas P4/P5).
4. Roda 5-10 minutos com o motor em vários regimes (idle, aceleração,
   frenagem). Quanto mais variado, melhor.
5. Aperta **Q**, **Esc** ou **Ctrl+C** pra parar.
6. Se a T4000 desconectar no meio (cabo, central desligada), o app
   **volta sozinho pro modo aguardar** sem fechar — quando reconectar,
   começa uma nova captura com timestamp novo.
7. Manda os arquivos pro Claude:
   - `t4000-capture-<timestamp>.bin` (no diretório onde rodou o .exe —
     pode haver vários se houve reconexão)
   - `t4000-capture-<timestamp>.timing.csv` (idem)
   - `session-<timestamp>.log` (em `%LOCALAPPDATA%\P1Fast.Cockpit.T4000Capture\logs\` —
     o app imprime o caminho exato no fim)

## Onde baixar o `.exe`

**Link estável (sempre a última versão da `main`):**

  https://github.com/Flaviomarques1969/p1-fast/releases/download/t4000-capture-latest/p1fast-t4000-capture.exe

A release rolling `t4000-capture-latest` é atualizada automaticamente em
todo push pra `main` que toca em `windows/cockpit/**`. Single-file
self-contained .NET 8 + win-x64 — sem instalação, sem .NET runtime
externo, sem permissão de admin.

**Versão de PR não-mergeada:** baixa do artifact
`p1fast-t4000-capture-<sha>` na run da workflow `windows-cockpit` da PR
no GitHub Actions. Disponível por 14 dias.

## Saída

Três arquivos por execução:

- `t4000-capture-<timestamp>.bin` — bytes crus, exatamente como vieram
  da serial. Sem framing. Costuma ter MB; **não dá pra colar no chat**.
- `t4000-capture-<timestamp>.timing.csv` — colunas
  `timestamp_unix_ms, total_bytes, bytes_per_sec, p4_sentinels, p5_sentinels`.
  Uma linha por segundo. Costuma ter alguns KB.
- `%LOCALAPPDATA%\P1Fast.Cockpit.T4000Capture\logs\session-<timestamp>.log` —
  log estruturado da execução (info do sistema, porta usada, parâmetros,
  cada erro de leitura, totais, motivo do encerramento). Texto plano
  com timestamps. Costuma ter 5-15 KB pra sessões de 5-10 min — **cabe
  num paste / Gist / até direto no chat**.

## Como me mandar os logs

O `.log` é a peça mais importante quando algo dá errado. 3 caminhos, em
ordem de simplicidade:

1. **Cola direto no chat** se for pequeno (< 50 KB / < 1000 linhas).
2. **Gist no GitHub:** abra https://gist.github.com (logado), cole o
   conteúdo do `.log`, "Create secret gist", me mande a URL.
3. **Pacote completo:** abra a pasta do log com `p1fast-t4000-capture
   --open-logs`, zipa o `.log` + `.bin` + `.timing.csv`, sobe num
   serviço de transferência (Drive, Dropbox, transfer.sh, file.io) e
   me passa a URL.

Para a opção 3, o `.bin` pode ter dezenas de MB — só inclua se eu pedir
explicitamente (a primeira análise é sempre do `.log` + `.timing.csv`,
que são pequenos).

## Avisos automáticos

Se a captura terminar com sintomas suspeitos, o app escreve no console
e no `.log` o motivo provável:

- **Zero bytes recebidos:** USB da T4000 pode ser só pro Injepro T
  Software, não pra streaming CAN. Vai precisar de adaptador USB-CAN
  separado.
- **Bytes recebidos mas zero sentinelas FIXED:** stream tem outro
  protocolo, não o CAN do PDF. Manda mesmo assim — a gente analisa.

## Opções de linha de comando

```
p1fast-t4000-capture --port=COM4 --out=meu-log.bin
p1fast-t4000-capture --open-logs
```

- `--port=COMx` força a porta (default: detecta automaticamente, escolhe
  a de número mais alto, que costuma ser a USB recém-plugada).
- `--out=path` define nome do arquivo (default:
  `t4000-capture-<yyyyMMdd-HHmmss>.bin`).
- `--open-logs` abre `%LOCALAPPDATA%\P1Fast.Cockpit.T4000Capture\logs`
  no Explorer e sai (não inicia captura).
- `--help` mostra ajuda.

## Última verificação automatizada

2026-05-10 — build limpo (0 erro, 0 warning), `--help` exibido corretamente,
fallback "porta serial não encontrada" com mensagem amigável, 33 testes do
parser T4000 verdes. Validação de captura real com a central T4000 plugada
continua pendente (depende do Flávio rodar no carro).
