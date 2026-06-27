# `dados-notebook/` — canal git de dados do notebook → nuvem (Claude do app)

Contexto: a sessão do Claude **na nuvem** (este app) **não alcança o Supabase** — a
política de rede do ambiente nega a saída HTTPS pro host do projeto (403 de política,
verificado 2026-06-27). Por isso o canal entre o **notebook Windows** (que captura via
`.exe` — GPS/RaceBox + T4000 + Osmo 6) e o Claude da nuvem é o **git**, igual ao runbook
`.claude-exec/RUNBOOK-NOTEBOOK-P1-FAST.md`.

Objetivo desta pasta: **provar que 100% do que foi colhido foi enviado/gravado**, por
sessão e por fonte (GPS, T4000, Osmo 6).

## Como o notebook deposita (contrato que o `.exe`/sessão do notebook segue)

Por sessão de captura, escreva **um manifesto** e (opcional) os **dumps brutos**, e dê
`git commit` + `git push` na branch combinada (hoje `claude/gps-recording-frequency-jvdpjo`).

```
dados-notebook/
├── manifests/<sessaoId>.json     ← OBRIGATÓRIO. Leve. É o que prova 100%.
└── raw/<sessaoId>/               ← OPCIONAL. Amostras brutas pra auditoria fina.
    ├── gps.ndjson                  (1 amostra por linha, JSON)
    └── t4000.ndjson
```

Vídeo do **Osmo 6 NÃO vai pro git** (pesado demais). O manifesto registra os arquivos de
vídeo (nome, duração, sha256, offset de sincronismo); os `.MP4` ficam no notebook/HD.

## Schema do manifesto (`manifests/<sessaoId>.json`)

```jsonc
{
  "sessaoId": "2026-06-27-brasilia-stint1",   // único, estável
  "evento": "treino-brasilia",
  "carro": "celta-01",
  "inicioWall": "2026-06-27T13:00:00Z",
  "fimWall":    "2026-06-27T13:45:00Z",
  "geradoPor":  "p1fast-cockpit.exe vX.Y --producao",
  "fontes": {
    "gps": {                                  // RaceBox, dono único do GPS
      "hzNominal": 25,
      "colhidas":  67500,                     // amostras lidas do sensor
      "enviadas":  67500,                     // amostras confirmadas na nuvem/gravadas
      "voltas":    18,
      "gaps":      []                         // [{inicioWall,fimWall,motivo}] se houver buraco
    },
    "t4000": {
      "hzNominal": 100,
      "colhidas":  270000,
      "enviadas":  270000,
      "voltas":    18,
      "gaps":      []
    },
    "osmo6": {
      "tipo": "video",
      "fps":  30,
      "arquivos": [
        { "nome": "DJI_0001.MP4", "duracaoS": 2700, "sha256": "…", "syncOffsetMs": 1234 }
      ]
    }
  }
}
```

Regra de 100%: para `gps` e `t4000`, **`enviadas === colhidas` e `gaps` vazio**. Para
`osmo6`, a soma das durações dos arquivos deve cobrir a janela `inicio→fim` da sessão
(tolerância padrão 2 s) e cada arquivo precisa de `sha256`.

## Como o Claude da nuvem lê

```
node tools/ler-dados-notebook.mjs                 # lê a branch atual (origin)
node tools/ler-dados-notebook.mjs --ref=origin/main
node tools/ler-dados-notebook.mjs --sessao=2026-06-27-brasilia-stint1
```

A rotina faz `git fetch`, lê os manifestos do lado do git, e imprime, por sessão e por
fonte, **% de completude** (`enviadas/colhidas`) + buracos. Sai com código ≠ 0 se alguma
fonte ficar abaixo de 100% — serve de portão (gate) de verificação.
</content>
