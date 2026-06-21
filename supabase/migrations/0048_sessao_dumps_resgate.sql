-- 0048: caixa de correio TEMPORARIA pro resgate dos dados gravados no notebook.
-- Recebe sessoes cruas (motor T4000 + GPS) que ficaram so no navegador do notebook,
-- enviadas pela pagina de resgate (papel anon, igual ao resto do painel).
-- So INSERT e SELECT anon. E temporaria: remover depois que o resgate terminar.
create table if not exists public.sessao_dumps (
  id          uuid primary key default gen_random_uuid(),
  criado_em   timestamptz not null default now(),
  envio       text,                 -- id de uma rodada de envio (1 refresh da pagina)
  origem      text,                 -- de qual tela/endereco veio
  sessao_id   text not null,        -- id da sessao gravada no notebook
  parte       int  not null default 0,   -- 0 = metadados; 1..N = blocos de amostras
  total       int  not null default 1,
  sessao_meta jsonb,
  amostras    jsonb
);
create index if not exists sessao_dumps_sessao_idx on public.sessao_dumps (sessao_id, parte);
create index if not exists sessao_dumps_envio_idx  on public.sessao_dumps (envio);

alter table public.sessao_dumps enable row level security;

create policy sessao_dumps_insert_anon on public.sessao_dumps
  for insert to anon with check (true);
create policy sessao_dumps_select_anon on public.sessao_dumps
  for select to anon using (true);
