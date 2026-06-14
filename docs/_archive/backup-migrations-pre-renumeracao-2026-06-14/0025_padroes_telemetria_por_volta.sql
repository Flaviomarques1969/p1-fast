-- 0025_padroes_telemetria_por_volta.sql
--
-- Tabela do padrão histórico aprendido por combinação (carro + autódromo +
-- tipo de pneu). Decisão Flávio 27/05/2026: 3 voltas estabelecem padrão;
-- desvio de 20% acima ou abaixo dispara alerta preditivo.
--
-- A tabela persiste UMA linha por combinação. Cada volta nova atualiza a
-- média móvel (de forma simples: recalcula sobre últimas N voltas).
--
-- Memória canônica: project_p1fast_deteccao_por_padrao_historico.

create table public.padroes_telemetria_por_volta (
  id                 uuid primary key default gen_random_uuid(),
  carro_id           uuid not null references public.carros(id) on delete cascade,
  track_id           uuid not null references public.tracks(id) on delete cascade,
  tipo_pneu          text not null,
  voltas_acumuladas  int  not null default 0,
  motor_max_media_c     numeric,
  pneu_temp_max_media_c numeric,
  pneu_press_min_media_bar numeric,
  cambio_max_media_c numeric,
  voltas_json        jsonb not null default '[]'::jsonb,
  -- voltas_json: array das últimas N voltas usadas pra calcular a média.
  -- Cada item: { motorMaxC, pneuMaxC, pneuMinPressBar, cambioMaxC, t }.
  -- Limitado a 10 voltas pra evitar inchar (rotação simples).
  desvio_pct         numeric not null default 0.20,
  atualizado_em      timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  unique (carro_id, track_id, tipo_pneu)
);

create index if not exists ptv_idx_0 on public.padroes_telemetria_por_volta (carro_id, track_id, tipo_pneu);
create index if not exists ptv_idx_1 on public.padroes_telemetria_por_volta (atualizado_em);

create trigger trg_padroes_telemetria_upd
  before update on public.padroes_telemetria_por_volta
  for each row execute function public.set_updated_at();

-- RLS: leitura aberta (anon pode ler o padrão pra mostrar no painel ao vivo).
-- Escrita só pra membros autenticados do time dono do carro.
alter table public.padroes_telemetria_por_volta enable row level security;

create policy padroes_select_all on public.padroes_telemetria_por_volta
  for select using (true);

create policy padroes_write_team on public.padroes_telemetria_por_volta
  for all using (
    exists (
      select 1 from public.carros c
      where c.id = padroes_telemetria_por_volta.carro_id
        and public.is_member(c.time_id)
    )
  );

comment on table public.padroes_telemetria_por_volta is
  'Padrão histórico de telemetria por combinação carro+autódromo+pneu. Aprendido em 3+ voltas. Decisão Flávio 27/05/2026.';
