# Inventário da faxina — ambientes e linhas de trabalho (2026-06-03)

Estado após a faxina segura: **9 ambientes** (era 24), **70 linhas de trabalho** locais (era 80).

## A. Ambientes isolados ainda abertos (9) e seu trabalho NÃO salvo

| Ambiente | Linha | Não salvo | Veredito |
|---|---|---|---|
| vista-engenheiro | command-box-mockup-recovery | Versões canônicas da Vista Piloto (definitiva + v02/03/04) — só existem aqui | 🔴 SALVAR (crítico) |
| rodada1-s1 | rodada1-s1 | 69 arquivos de código (Models, Migrations, Seed, Auth, App…) | 🔴 SALVAR (muito) |
| infallible-liskov-7a1b15 | infallible-liskov-7a1b15 | Mapa aprovado Brasília (apagado na árvore) + editor de pista novo | 🔴 SALVAR |
| infallible-snyder-198a08 | infallible-snyder-198a08 | 4 telas Swift mexidas (+ lixo de empacotamento) | 🟡 SALVAR as 4 telas |
| hardcore-nightingale | hardcore-nightingale-d1a1b8 | só ruído (Package.resolved) | 🟢 linha +25 própria |
| friendly-hopper | friendly-hopper-b61e0e | 0 não salvo | 🟢 linha +152 própria |
| determined-beaver | determined-beaver-390de9 | só ruído | 🟢 conteúdo na oficial (backup Ação 2) |
| hardcore-napier | hardcore-napier-a5e10c | só lixo de empacotamento; linha JÁ na oficial | 🟢 pode fechar |
| (wip ativo) | wip/20260526-132312 | workspace ativo | 🟢 manter |

## B. Linhas de trabalho (67 fora da oficial) — classificação

### B1. Históricas / superadas — conteúdo já na oficial ou evoluído além (SEGURAS de apagar)
Linhas de sprint de 01–07/maio (incorporadas via submissões #57–#120) + correções de fila + docs + autosaves antigos:
feat/1A1-*, feat/1A2-eventos, feat/1A3-*, feat/1A5-licoes, feat/1A6-*, eventos-merge-fix, icon-merge-fix, chore/* (ci, schema-parity, theme-tokens, pre-launch, seed), fix/drainer-*, fix/sync-timestamp-coerce, fix/configurador-hittest, docs/*, handoff-t4000-*, wip/20260503-*, feat/ms-2-7-kalman-domain, feat/ms-4-stint-plan, feat/ms-11-video, feat/edge-health-endpoint, feat/develop-cockpit-app-rotation.
→ ~50 linhas. Apagar = risco zero (verificado: arquivos idênticos na oficial ou versão velha superada). Inofensivas se ficarem.

### B2. Backups intencionais — MANTER
backup-autosaves-2026-05-04, backup-pre-cleanup.

### B3. Ambientes grandes / cockpit — PRECISAM revisão caso a caso (podem ter trabalho único)
- claude/friendly-hopper-b61e0e (4039 arq, 23/05)
- claude/hardcore-nightingale-d1a1b8 (3552 arq, 26/05)
- claude/clever-ramanujan-5dfaa7 (210, 26/05)
- claude/great-hermann-31ac00 (68, 20/05)
- claude/vibrant-merkle-0a1ff0 (43, 15/05 — PAce advisor?)
- claude/v04-promote-pitstop-2026-05-26 (93, 29/05 — promoção v04)
- claude/naughty-babbage-15967b (15, 15/05)
- feat/t4000-* e feat/t3000-* (cockpit/decoder — 24–26/05)
- claude/command-box-mockup-recovery, vista-engenheiro (Vista Piloto)
→ NÃO apagar sem abrir e conferir o que tem de único.

## Recomendação
1. PRIMEIRO proteger: salvar o trabalho não salvo dos 4 ambientes 🔴/🟡 nas suas linhas (commit), pra nunca se perder.
2. Depois, opcional: apagar as ~50 linhas históricas (B1) pra enxugar a lista.
3. B3 fica pra revisão focada (ou só manter — refs são inofensivas).
