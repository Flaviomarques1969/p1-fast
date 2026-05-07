-- 0012_seed_brasilia.sql
-- Seed canônico da pista de Brasília no servidor.
--
-- Bug E1 do MS-10: cliente Swift seeda Brasília localmente com id
-- `trk_brasilia` (literal), mas servidor tem `tracks.id uuid`. Quando
-- evento real subia pelo sync com `track_id="trk_brasilia"`, Postgres
-- rejeitava com `invalid input syntax for type uuid`.
--
-- Cliente passa a usar UUID5 determinístico:
--   namespace = DNS canonical (6ba7b810-9dad-11d1-80b4-00c04fd430c8)
--   name      = "p1fast.brasilia"
--   uuid5     = e8335412-3312-54fe-b634-db2d02c7fa81
--
-- Migration v10 do cliente (ios/p1fast-core/.../Migrations.swift) renomeia
-- todas as FKs locais que apontavam pra `trk_brasilia`.
--
-- Aqui criamos a row no servidor com o mesmo UUID. Track é catálogo
-- global (sem time_id próprio); RLS lê via `track_layouts.track_id`
-- ou similar. ON CONFLICT DO NOTHING torna idempotente.

INSERT INTO public.tracks (id, apelido, nome_oficial)
VALUES (
  'e8335412-3312-54fe-b634-db2d02c7fa81',
  'Brasília',
  'Autódromo Internacional Nelson Piquet'
)
ON CONFLICT (id) DO NOTHING;

-- Layouts e segments canônicos seguem em migration separada quando o
-- mapa do cockpit precisar deles (Sprint Ghost Map). Por hoje só o
-- track principal basta pra desbloquear `eventos.track_id`.
