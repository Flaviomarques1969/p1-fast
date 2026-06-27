# Plano — Enviar TODOS os dados pro app na nuvem (em paralelo ao cockpit local)

> **Status:** plano (obra a fazer). Não mexe em código ainda.
> **Origem:** é a "lacuna de construção" que o `docs/ARQUITETURA_DEFINITIVA.md` §9 marca como
> *"NÃO é decisão em aberto… obra a fazer"*. Decisão de arquitetura já fechada por Flávio.
> **Tratamento:** sempre "você".
> **Criado:** 2026-06-27, pela sessão do notebook Windows (branch `sync/notebook-dia-de-pista-2026-06-23`).

## 1. Por quê (o requisito, reafirmado por Flávio em 2026-06-27)

`ARQUITETURA_DEFINITIVA` §3: o dado é processado em **DOIS lugares** —
1. **No notebook (.exe), local**, pro **cockpit do piloto**: de propósito local, latência baixa, o canal do piloto **nunca pode cair** (sem dependência de internet/lag).
2. **No app na nuvem**: o notebook **envia os dados** (5G/Starlink) e o app **processa conforme cada função** (cálculos e estudos).

São as **duas coisas em paralelo** — como o vídeo (processa/mostra local **e** transmite). Hoje a segunda está **parcial**:

| Dado | Hoje | Falta |
|---|---|---|
| Motor | fila durável, **não perde** ✅ | — |
| GPS | best-effort, "último valor vence" — **pode pular fix** 🟠 | durabilidade igual ao motor |
| Arquivo (todas as voltas, 25 Hz) | **não sobe** — só transporte ao vivo 🔴 | **upload durável** |
| Canal | `--producao` apenas; senão vai pro teste | operação |

**Consequência:** o app **não tem garantia de TODOS os dados** pras suas contas/estudos. A nuvem (Supabase Realtime) é um **barramento efêmero**: app que entra atrasado ou cai **não recupera** as voltas. Hoje a verdade completa vive **só no disco local** (`~/p1fast-sessoes/*.jsonl`, 25 Hz, todas as voltas).

## 2. Princípio (não reabre arquitetura)

- Local pro cockpit (nunca cai) **+** em paralelo manda pra nuvem.
- **UMA entrada ao vivo** continua: `cockpit-bubi-live` via `web/cockpit/cloud-bridge.js` (`docs/CONTRATO_DADOS.md`).
- A nuvem já tem papel duplo (transporta ao vivo + hospeda o app). Este plano explicita um 3º: **GUARDA o arquivo completo** pro app estudar.
- **Disco local segue a fonte da verdade** (ADR-003/004). Nuvem = espelho ao vivo **+** guarda do arquivo.

## 3. Parte A — GPS durável (ao vivo, sem perda)

- **Hoje:** `MainWindow.Live.cs` → `LacoNuvemAsync` envia `_liveUltimoGps` amostrado a 40 ms (último-valor-vence). Se dois fixes caem entre ticks, o primeiro **não é enviado nem reenviado**.
- **Alvo:** GPS pela **mesma fila-que-não-perde do motor** (`LivePublisher`), com **reenvio na religação**.
- **Onde:** `MainWindow.Live.cs` + um publisher de GPS espelhando o do motor. **Não toca a tela do piloto.**
- **Payload:** mantém o contrato (`lat, lng, kmh, tWall`, + `numSV/fix/accM`). **O consumidor ao vivo não muda.**
- **Garantia:** todo fix válido chega ao barramento enquanto online. (Não resolve "app entrou atrasado" — isso é a Parte B.)

## 4. Parte B — Upload durável da gravação (o arquivo que o app estuda)

- O **.exe sobe o `.jsonl`** da sessão (completo, todas as voltas, 25 Hz) pra um Storage durável, **em pedaços durante a sessão + fechamento completo ao fim**.
- **Destino na nuvem — REUSAR o schema que JÁ EXISTE** (descoberto 2026-06-27; não criar do zero):
  - **`sessao_dumps` (migração `0048`)** já recebe sessão crua **em pedaços** (`parte` 0=meta, 1..N=blocos de `amostras` jsonb; `sessao_id`, `total`) — exatamente o formato do upload. **Hoje está marcada como TEMPORÁRIA (caixa de resgate, anon insert/select).** Decisão do iMac: **promover** a permanente (RLS por time) ou criar a versão definitiva no mesmo molde.
  - **Vmin por trecho JÁ TEM casa:** `segment_executions.vmin_kmh / vmin_x / vmin_y` (migração `0007_vmin_georef`). O cérebro grava ali o Vmin georreferenciado por trecho.
  - **Amostras enriquecidas:** `telemetry_samples_enriched` (`0008`). **Padrão aprendido:** `padroes_telemetria_por_volta` (**`0025`**, não 0026 — corrigido).
- **Atenção (disconnect):** essas tabelas nasceram do fluxo antigo de **sync do iOS** (functions `sync`/`pull`, hoje em backup). O fluxo atual é `.exe → Realtime`, que **não as alimenta**. A obra é **religar** o caminho durável a esse schema — **reusando, não reinventando**.
- **Resiliência:** fila de upload ancorada no disco; internet caiu, retoma de onde parou (o disco é a verdade). O fechamento garante a sessão completa.

## 5. Quem consome (lado app na nuvem)

- **Ao vivo:** já consome via `cloud-bridge.js` (`onSample`/`onGpsPoint`). Com a Parte A o GPS fica completo.
- **Arquivo (novo):** consumidor que lê a sessão crua do destino durável (ex.: `sessao_dumps`), roda as contas/estudos do app sobre o **conjunto COMPLETO** e **grava nas tabelas que já existem** (Vmin por trecho → `segment_executions.vmin_*`; padrões → `padroes_telemetria_por_volta` `0025`), expondo nas telas do app.
- O cálculo de Vmin/trecho **já existe** no cérebro web (`web/command-box/cerebro/cerebro-coach.js`, `vminKmh`) — **reusar sobre o arquivo**, não recriar (CONTRATO_DADOS).

## 6. Divisão de responsabilidade

| Lado | Quem | Faz |
|---|---|---|
| Notebook (.exe) | sessão do **Windows** | Parte A (GPS durável) + Parte B **produtor** (uploader + índice) |
| App na nuvem | sessão do **iMac** | decide/promove o destino durável **reusando o schema existente** (`sessao_dumps` `0048`, `segment_executions.vmin_*` `0007`, `padroes` `0025`); **consumidor** do arquivo; roda os estudos; telas do app |
| Contrato | ambos | atualizar `docs/CONTRATO_DADOS.md` (nova seção "ARQUIVO durável") + smoke quando construído |

## 7. Fases (ordem)

0. **(feito)** Plano + handoff pro iMac. Sem código.
1. **(feito)** **Parte B produtor** como ferramenta `p1fast-upload` (`windows/cockpit/P1Fast.Cockpit.Upload`, **fora** do `.exe`) — sobe o `.jsonl` pra `sessao_dumps` em pedaços. Provado com sessão real (`sessao_id=UPLOAD-TESTE-notebook-2026-06-27`).
2. **Consumidor na nuvem** (iMac) — lê `sessao_dumps`, roda estudos, grava em `segment_executions.vmin_*`/`padroes` `0025`, telas do app. **Decide o destino durável definitivo** (promover `sessao_dumps` ou novo) — aí re-aponto o uploader.
3. **Parte A** (GPS durável ao vivo) — `.exe`, com testes. **Depois do teste de campo de 2026-06-28.**
4. **Integrar o upload no fim da sessão do `.exe`** (hoje `p1fast-upload` é manual). Depois do teste de campo.
5. Atualiza `CONTRATO_DADOS` + smoke; valida ponta a ponta (sessão de teste primeiro).

## 8. Guardas (não-objetivos)

- **Não tocar a tela do piloto** (INTOCÁVEL — §regra dura).
- **Não criar segundo "cérebro" ao vivo** nas telas (`CONTRATO_DADOS`). O arquivo é durável, à parte — não é um 2º feed ao vivo.
- Disco local continua a **fonte da verdade**; a nuvem **espelha ao vivo + guarda o arquivo**.
- Nada disso **bloqueia** o teste de campo de 2026-06-28: o disco já guarda tudo a 25 Hz; o sync é a obra seguinte.
