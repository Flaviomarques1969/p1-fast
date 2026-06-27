# HANDOFF → sessão do Claude no **iMac** (app na nuvem) — 2026-06-27

> **De:** sessão do notebook Windows (branch `sync/notebook-dia-de-pista-2026-06-23`).
> **Assunto:** o app na nuvem precisa receber **TODOS os dados** (todas as voltas, 25 Hz) — não só o ao-vivo best-effort de hoje.
> **Tratamento:** sempre "você".
> **Plano completo:** `docs/PLANO_ENVIO_DADOS_NUVEM.md` (leia antes de agir).

## Contexto (decidido, não reabrir)

`ARQUITETURA_DEFINITIVA` §3: o `.exe` processa **local** pro cockpit do piloto **E** envia os dados pra **nuvem**, onde o **app** processa conforme cada função. Flávio reafirmou em 2026-06-27: são **duas coisas em paralelo** — como o vídeo. Hoje a parte da nuvem está **parcial**: GPS best-effort (pode pular fix), **sem upload durável**; o app **não tem garantia de todas as voltas**. A verdade completa hoje vive só no disco do notebook (`~/p1fast-sessoes/*.jsonl`).

## O que vem do lado do notebook (eu faço — depois do teste de campo de 2026-06-28)

- **Parte A — GPS durável ao vivo** no canal `cockpit-bubi-live` (fila-que-não-perde, igual ao motor). Payload **igual** (`lat, lng, kmh, tWall`, +`numSV/fix/accM`). **Você não muda o consumidor ao vivo.**
- **Parte B — o `.exe` sobe a sessão completa** (em pedaços) pro destino durável que você confirmar (reusando o schema que já existe — ver correção abaixo).

## O que preciso de você (lado app na nuvem — você tem CLI/acesso ao Supabase; o notebook não)

> **CORREÇÃO 2026-06-27:** o schema **já tem** o necessário — não criar do zero. Olhei as migrações (no git; o notebook está em sparse-checkout, então elas não estão no disco dele, mas estão no seu). Reuse:
> - **`sessao_dumps` (`0048`)** — já recebe sessão crua **em pedaços** (`parte` 0=meta, 1..N=`amostras` jsonb). **Hoje é TEMPORÁRIA (anon, "remover depois").** O formato serve ao upload.
> - **`segment_executions.vmin_kmh / vmin_x / vmin_y` (`0007_vmin_georef`)** — casa do **Vmin georreferenciado por trecho**.
> - **`telemetry_samples_enriched` (`0008`)**, **`padroes_telemetria_por_volta` (`0025`)**. (Os escritores dessas tabelas estão só em backups — era do sync iOS; o fluxo `.exe→Realtime` atual NÃO as alimenta.)

1. **Decidir o destino durável reusando o schema acima:** ou **promover `sessao_dumps`** a permanente (RLS por time, sair do anon), ou criar a versão definitiva no mesmo molde. Você decide (é seu o schema da nuvem). *Me diga o destino final que vou mirar o uploader nele.*
2. **Consumidor do ARQUIVO:** ler a sessão crua do destino (ex.: `sessao_dumps`) e rodar as contas/estudos sobre o conjunto **COMPLETO**, **gravando nas tabelas que já existem** (Vmin → `segment_executions.vmin_*`; padrões → `padroes_telemetria_por_volta` `0025`). O cálculo de Vmin já existe em `web/command-box/cerebro/cerebro-coach.js` (`vminKmh`) — **reusar**, não recriar (`CONTRATO_DADOS`).
3. **Confirmar o formato** do `.jsonl` que você quer receber. Hoje é **uma linha por amostra**:
   `{ "SessaoId", "Seq", "Tipo": "gps"|"motor", "TWall", "TMono", "Dados": { … }, "RawHex" }`
   (GPS `Dados`: `lat, lon, kmh, fix, numSV, hacc`.) Se preferir outro layout pro app, **alinhe antes** de eu construir o uploader.

## O que NÃO muda

- **Uma entrada ao vivo** (`cockpit-bubi-live` + `cloud-bridge.js`). O arquivo é durável, à parte, pros estudos — **não** é um 2º feed ao vivo.
- **Disco local = fonte da verdade.** A nuvem **espelha ao vivo + guarda o arquivo**.

## Próximo passo (seu)

Leia `docs/PLANO_ENVIO_DADOS_NUVEM.md` e **responda os itens 1 e 3** (por commit/doc nesta branch ou na `main`). Aí eu construo o **produtor** já alinhado ao que você vai **consumir**. **Sem pressa:** nada disso bloqueia o teste de campo de 2026-06-28 — o disco guarda tudo.
