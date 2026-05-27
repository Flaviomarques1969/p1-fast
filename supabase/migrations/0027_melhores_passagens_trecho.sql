-- 0026_melhores_passagens_trecho.sql
--
-- Tabela das melhores passagens históricas por trecho (segmento de pista).
-- O módulo web/cockpit/melhores-loader.js já espera esta estrutura.
-- Decisão Flávio 27/05/2026: referência persiste entre sessões; toda
-- passagem nova é gravada e a melhor passa a alimentar o DeltaCalculator.
--
-- Memórias canônicas:
--   - project_p1fast_logica_central_comparacao_por_trecho
--   - reference_p1fast_fonte_dados_ao_vivo

-- Drop+create: a tabela pode ter ficado parcialmente criada em tentativa
-- anterior (sem colunas reais). 0 linhas, sem consumidores ainda.
drop table if exists public.melhores_passagens_trecho cascade;

create table public.melhores_passagens_trecho (
  id            uuid primary key default gen_random_uuid(),
  carro_id      uuid not null references public.carros(id) on delete cascade,
  track_id      uuid not null references public.tracks(id) on delete cascade,
  layout_id     uuid references public.track_layouts(id) on delete cascade,
  segment_id    uuid not null references public.track_segments(id) on delete cascade,
  tipo_pneu     text not null,
  tempo_trecho_s numeric not null,
  pontos_json   jsonb not null,
  -- pontos_json: array de amostras GPS canônicas. Cada item:
  --   { lat, lng, kmh, t, fracao, sub }
  -- fracao: 0..1 ao longo do segmento (entrada=0, saída=1).
  -- sub: 'entrada' | 'freio' | 'apice' | 'saida'
  gravado_em    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists mpt_idx_0 on public.melhores_passagens_trecho (carro_id, track_id, tipo_pneu);
create index if not exists mpt_idx_1 on public.melhores_passagens_trecho (segment_id, tempo_trecho_s);
create index if not exists mpt_idx_2 on public.melhores_passagens_trecho (gravado_em);

-- RLS: leitura aberta (anon pode ler pra alimentar painel); escrita só time.
alter table public.melhores_passagens_trecho enable row level security;

drop policy if exists melhores_select_all on public.melhores_passagens_trecho;
create policy melhores_select_all on public.melhores_passagens_trecho
  for select using (true);

drop policy if exists melhores_write_team on public.melhores_passagens_trecho;
create policy melhores_write_team on public.melhores_passagens_trecho
  for all using (
    exists (
      select 1 from public.carros c
      where c.id = melhores_passagens_trecho.carro_id
        and public.is_member(c.time_id)
    )
  );

comment on table public.melhores_passagens_trecho is
  'Melhor passagem histórica por trecho, combinação carro+autódromo+pneu. Decisão Flávio 27/05/2026.';
