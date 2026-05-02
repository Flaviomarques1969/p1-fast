# Supabase setup — P1 Fast

> ⚠️ **AVISO BIG**: o projeto Supabase do P1 Fast é **isolado** do CDAI Imunoterapia.
> NUNCA compartilhar credentials, NUNCA cross-reference de dados, NUNCA usar a mesma
> URL/anon key entre os dois sistemas. São duas contas/projetos Supabase distintos.

---

## Visão geral

`supabase/migrations/0001_initial.sql` espelha o schema Dexie v13 (ver
`src/core/db.js` e `src/data/schemas.js`) em Postgres. RLS está habilitada em
todas as tabelas. Workspace é por **time** — toda row pertence a um `time_id` e
só é visível/editável por membros do time (via helper `auth.is_member(time_id)`).

Tracks/layouts/segments/marcos são globais (read-only pra clientes; write via
service_role). `retas_especiais` é híbrida: `time_id NULL` = global; `time_id`
não-nulo = curadoria do time.

Telemetria (`telemetry_samples`) é append-only (ADR-004): policy permite SELECT
e INSERT, NUNCA UPDATE/DELETE.

## Pré-requisitos

- Conta Supabase pessoal do Flávio (não a do CDAI).
- Supabase CLI instalado (`brew install supabase/tap/supabase`, atual ≥ 2.75).
- Node 20+.

## Setup novo (passo a passo)

### 1. Criar projeto Supabase

1. Logar em [app.supabase.com](https://app.supabase.com).
2. New Project → nome `p1-fast`, região `sa-east-1` (São Paulo).
3. Anotar:
   - **Project URL** (`https://<ref>.supabase.co`)
   - **anon (public) key** — cliente browser/app
   - **service_role (secret) key** — backend/Edge Functions
4. Guardar as keys no 1Password (entrada **separada** da conta CDAI).

### 2. Linkar repo local ao projeto

```sh
cd "/Users/imac/Projetos/P1 Fast"
supabase login                              # primeira vez só
supabase link --project-ref <ref-do-projeto>
```

Isso cria `supabase/.temp/project-ref` (gitignored) com o ref.

### 3. Aplicar migrations

```sh
supabase db push
```

Aplica em ordem:
- `0001_initial.sql` — schema + RLS + helpers `auth.is_member/is_admin`.
- `0002_team_signup.sql` — RPC `create_team(nome)` + comments documentando policies restritas.

Verificar no Supabase Studio que:

- 20 tabelas existem em `public`.
- RLS está **ON** em todas.
- Funções `auth.is_member(uuid)` e `auth.is_admin(uuid)` existem.
- Função `public.create_team(text)` existe e tem grant `EXECUTE` pra `authenticated`.

### 4. Aplicar seed canônico

```sh
psql "$DATABASE_URL" -f supabase/seed.sql
```

`seed.sql` é **idempotente** (`ON CONFLICT DO NOTHING`) — pode rodar quantas vezes quiser. Cria:

- 1 track: **Brasília** (Autódromo Internacional Nelson Piquet).
- 1 layout principal com path SVG real (volta 5 do Flávio, 171.038s) + 4 parciais de tempo.
- 12 segments (8 curvas + 4 retas, com apex defaults conservadores).
- 4 marcos canônicos: largada, chegada, pit-in, pit-out.
- 1 reta especial global: "RETA PRINCIPAL / BOX" (tempo médio 12s).

Locamente roda automático em `supabase db reset`.

### 4. Lint local antes de cada migration nova

```sh
supabase db lint
```

CI vai rodar isso automaticamente quando configurarmos.

## Checklist de setup

- [ ] Projeto Supabase criado em região `sa-east-1`
- [ ] anon key e service_role key guardadas em 1Password (entry separado do CDAI)
- [ ] `supabase link` aplicado
- [ ] `supabase db push` rodou sem erro
- [ ] Studio mostra 20 tabelas com RLS ON
- [ ] `auth.is_member` e `auth.is_admin` testadas com `select auth.is_member('<time-id>')`
- [ ] App iOS recebeu URL + anon key via `.env.xcconfig` (não commitado)

## Convenções pra próximas migrations

- Nome: `NNNN_descricao_curta.sql` (sequencial, 4 dígitos).
- Cada migration é **aditiva** — drop só com aviso explícito no comentário do PR.
- RLS habilitada em **toda** tabela nova.
- Time scoping: tabela nova precisa de `time_id uuid not null references public.times(id)`
  exceto se for catálogo global (justificar no comentário).
- Triggers `updated_at` via helper `public.set_updated_at()` (já existe).

## Edge Functions

Funções vivem em `supabase/functions/<nome>/index.ts`. A `ingest` (Prompt #6)
substitui a função Vercel `api/ingest/iphone.js`.

Servir local:
```sh
supabase functions serve ingest --env-file supabase/.env.local
```

## Por que isolado do CDAI

CDAI Imunoterapia (clínica) tem dados de saúde de pacientes — LGPD, sigilo médico.
P1 Fast tem telemetria pessoal/track day. Compartilhar projeto Supabase
poderia levar a:

- Cruzamento acidental de RLS (uma policy mal escrita expõe dados clínicos).
- Mesma anon key num app distribuído vazaria acesso cross-domínio.
- Restore de backup do P1 sobrescreveria base do CDAI.

Manter contas/projetos completamente separados.
