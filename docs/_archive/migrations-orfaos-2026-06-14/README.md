# Migrações órfãs arquivadas — 14/06/2026

Estes arquivos tinham **número duplicado** em `supabase/migrations/` e travavam o
`supabase db push` (ele exigia `--include-all`, que reaplicaria seeds antigos e
sobrescreveria as curvas aprovadas em produção). Foram tirados da pasta de migrações
porque **não estão registrados no histórico da nuvem** (produção) e seu efeito já está
lá por outras migrações. Nada foi deletado — estão preservados aqui.

Estado da nuvem (produção `fvhwltzhytpnhlqbttmd`) conferido em 14/06/2026:
- versão 0025 = `padroes_telemetria_por_volta`
- versão 0026 = `melhores_passagens_trecho`
- versão 0027 = `melhores_passagens_trecho` (renumerada de 0026)
- versão 0028 = `rollback_brasilia_seed`

## O que foi arquivado e por quê

- **0026_padroes_telemetria_por_volta.sql** — cópia idêntica (só muda o comentário do
  topo) de `0025_padroes_telemetria_por_volta.sql`, que é a versão que a nuvem usa.
  Redundante.
- **0027_seed_brasilia_track_segments.sql** — seed antigo das curvas (GPS errado).
  Revertido por `0028_rollback_brasilia_seed.sql` e substituído por
  `0029_seed_brasilia_segments_v2.sql` + `0030_barras_aprovadas_flavio.sql`. Rodar de
  novo seria destrutivo.
- **0028_seed_brasilia_track_segments.sql** — mesma coisa (versão renumerada do seed
  antigo). Destrutivo se rodar.

## O que NÃO foi arquivado (foi renumerado)

- **0025_video_streams_recording.sql → 0044_video_streams_recording.sql** — adiciona as
  colunas de gravação (`recording_*`) em `video_streams`. É a única fonte dessas colunas
  (que já existem em produção). Por isso foi renumerada para o fim da fila (0044) e
  tornada idempotente (`add column if not exists`), para um ambiente novo recriar e a
  produção aceitar como no-op quando for aplicada formalmente.

## Backup

Cópia da pasta inteira de migrações antes desta limpeza:
`docs/_archive/backup-migrations-pre-renumeracao-2026-06-14/` (47 arquivos).
