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

1. Liga o carro com chave em ON (não só Acessórios — central T4000
   precisa estar alimentada).
2. Pluga cabo USB da T4000 no notebook.
3. Roda `p1fast-t4000-capture.exe` (single-file, sem instalação).
4. App detecta a porta serial automaticamente. Mostra `total: N bytes`
   aumentando a cada segundo + contagem de sentinelas P4/P5.
5. Roda 5-10 minutos com o motor em vários regimes (idle, marcha-lenta,
   aceleração, frenagem). Quanto mais variado, melhor.
6. Aperta **Q** ou **Esc** pra parar.
7. Manda os arquivos `t4000-capture-<timestamp>.bin` +
   `t4000-capture-<timestamp>.timing.csv` pro Claude.

## Onde o `.exe` aparece

CI (`windows-cockpit.yml`) gera o single-file em cada PR que toca em
`windows/cockpit/**`. Baixa do **artifact** da PR run no GitHub Actions
(nome `p1fast-t4000-capture-<sha>`). O artifact fica disponível por 14
dias.

## Saída

Dois arquivos:

- `t4000-capture-<timestamp>.bin` — bytes crus, exatamente como vieram
  da serial. Sem framing.
- `t4000-capture-<timestamp>.timing.csv` — colunas
  `timestamp_unix_ms, total_bytes, bytes_per_sec, p4_sentinels, p5_sentinels`.
  Uma linha por segundo. Permite reconstruir tempo offline.

## Avisos automáticos

Se a captura terminar com sintomas suspeitos, o app escreve no console
o motivo provável:

- **Zero bytes recebidos:** USB da T4000 pode ser só pro Injepro T
  Software, não pra streaming CAN. Vai precisar de adaptador USB-CAN
  separado.
- **Bytes recebidos mas zero sentinelas FIXED:** stream tem outro
  protocolo, não o CAN do PDF. Manda mesmo assim — a gente analisa.

## Opções de linha de comando

```
p1fast-t4000-capture --port=COM4 --out=meu-log.bin
```

- `--port=COMx` força a porta (default: detecta automaticamente, escolhe
  a de número mais alto, que costuma ser a USB recém-plugada).
- `--out=path` define nome do arquivo (default:
  `t4000-capture-<yyyyMMdd-HHmmss>.bin`).
- `--help` mostra ajuda.
