# Pre-launch checklist — primeiro run real

Tudo que Flávio precisa fazer **antes** do app iOS poder ser testado com user real (não simulator + dados mockados). Sequência única, sem dependências cruzadas.

Cada item: comando + verificação + onde guardar credencial.

---

## 1. Projeto Supabase ⏳

### 1.1 Criar

1. Logar em [app.supabase.com](https://app.supabase.com).
2. **New Project** → nome `p1-fast`, região `sa-east-1` (São Paulo), plano Free.
3. Anotar do painel "Project Settings → API":
   - **Project URL** (`https://<ref>.supabase.co`)
   - **anon (public) key**
   - **service_role (secret) key**
4. Guardar tudo no 1Password — entry **separado** do CDAI (memória `project_cdai_arquitetura_dois_sistemas`).

### 1.2 Linkar

```sh
cd "/Users/imac/Projetos/P1 Fast"
supabase login                              # primeira vez
supabase link --project-ref <ref-do-projeto>
```

### 1.3 Aplicar schema + RPC

```sh
supabase db push
```

Aplica em ordem:
- `0001_initial.sql` — 20 tabelas + RLS + helpers `auth.is_member/is_admin`
- `0002_team_signup.sql` — RPC `create_team(nome)` + comments

**Verificar no Supabase Studio**:
- 20 tabelas em `public`
- RLS ON em todas (ícone de cadeado verde)
- Funções `auth.is_member`, `auth.is_admin`, `public.create_team` existem

### 1.4 Seed canônico (Brasília)

```sh
psql "$DATABASE_URL" -f supabase/seed.sql
```

`DATABASE_URL` vem de "Project Settings → Database → Connection string → URI".

**Verificar**:
```sql
select count(*) from public.tracks;          -- 1 (Brasília)
select count(*) from public.track_layouts;   -- 1 (Principal)
select count(*) from public.track_segments;  -- 12 (8 curvas + 4 retas)
select count(*) from public.marcos;          -- 4 (largada, chegada, pit-in, pit-out)
select count(*) from public.retas_especiais; -- 1 (RETA PRINCIPAL global)
```

### 1.5 Deploy das 4 Edge Functions

```sh
supabase functions deploy ingest
supabase functions deploy sync
supabase functions deploy pull
supabase functions deploy health --no-verify-jwt
```

`ingest`, `sync`, `pull` validam JWT do user. **`health` é diagnostic público** — usado por monitoring e UI "Sincronização" pra detectar drift.

Configurar secrets compartilhados:
```sh
supabase secrets set SUPABASE_URL=https://<ref>.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
supabase secrets set SUPABASE_ANON_KEY=<anon-key>
```

**Verificar** (precisa criar user antes — passo 2):

| Função | Para que serve | Test curl em README |
|---|---|---|
| `ingest` | telemetry_samples (10Hz IMU/GPS) — append-only batch | `supabase/functions/ingest/README.md` |
| `sync` | mutations CRUD (12 tabelas com `time_id`) — LWW por updated_at | `supabase/functions/sync/README.md` |
| `pull` | catch-up sync no app boot — cursor `last_sync_at` por tabela | (sem README — body+resposta no source TS) |

---

## 2. Primeiro user + primeiro time ⏳

### 2.1 Criar user

No Supabase Studio → **Authentication → Users → Add user**:
- email: `flaviomarques@me.com` (memória `userEmail`)
- senha: gerada (guardar 1Password)
- "Auto Confirm User" ✅

Anotar o `id` do user (UUID).

### 2.2 Criar primeiro time via RPC

No SQL Editor do Studio (logado como aquele user — usar "Impersonate"):
```sql
select public.create_team('Flávio Solo');
```

Retorna o `team_id`. Anotar.

**Verificar**:
```sql
select * from public.times where id = '<team_id>';
select * from public.usuarios_time where time_id = '<team_id>';
-- deve mostrar Flávio como admin
```

---

## 3. App iOS ⏳

### 3.1 Configurar credenciais

```sh
cp ios/p1fast-ios/Config/.env.xcconfig.example ios/p1fast-ios/Config/.env.xcconfig
```

Editar `.env.xcconfig` com:
```
SUPABASE_URL = https:/$()/<ref>.supabase.co
SUPABASE_ANON_KEY = <anon-key>
DAILY_API_KEY = <opcional, deixar REPLACE_ME se sem teleconsulta>
```

Atenção: URLs precisam de `$()` pra escapar `//` (xcconfig trata `//` como comentário).

### 3.2 Abrir no Xcode

```sh
open ios/p1fast-ios/p1fast-ios.xcodeproj
```

### 3.3 Build + run no simulator

- Schema: `p1fast-ios`
- Destination: iPhone 17 Pro (ou qualquer iOS 17+)
- ⌘R

**Verificar tela inicial**:
```
P1 Fast v0.1.0 · build 1
DB: ok · Tabelas: 21
Supabase: ok · Daily.co: ok (ou "não configurado")
```

### 3.4 Build + install em iPhone físico

- Conectar iPhone via cabo
- Desbloquear + "Confiar neste Mac" se primeiro plug
- Em Xcode: Destination → escolher o iPhone
- Pode pedir signing — usar Apple ID pessoal (Personal Team)
- ⌘R

Limitação Personal Team: app expira em 7 dias, precisa re-instalar.

---

## 4. Smokes finais antes de "soltar" ✓

```sh
# Local
npm run smoke                                 # 18 scripts, 230+ testes
cd ios/p1fast-core && swift run p1fast-smoke  # 129/0
xcodebuild -project ios/p1fast-ios/p1fast-ios.xcodeproj -scheme p1fast-ios -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

CI no GitHub roda os 2 primeiros automaticamente em todo PR.

---

## 5. O que ainda NÃO está pronto pra usar (esperado)

- **Sync drainer (HTTP injection)**: Sprint 1A.6 sub-prompts C+D pendentes. Lógica core 100% pronta (`SyncDrainer`, `PullCursor`, `TelemetryUploader`, `BackoffPolicy` em `p1fast-core`) + 3 Edge Functions deployáveis. Falta só URLSession adapter + UI de status no `p1fast-ios`.
- **Daily.co teleconsulta**: imports e creds prontos, sem uso real.
- **Eventos (#10)**: tela pendente (último de Sprint 1A.2). EventoRepository pronto em `p1fast-ios/Sources/Persistence/`.
- **Cockpit do piloto**: Sprint 1B+ (telemetria ao vivo na pista).

Sem esses 4, o app permite hoje:
- Ver Home cheia/vazia (#8)
- Cadastrar carros + setup base (#9 Garagem)
- Listar eventos (parcial — falta criar/editar)

Operação local-first 100% offline. Sync remoto vira ON quando #C+D do Sprint 1A.6 forem feitos.

---

## 6. Quando algo quebrar

- App não abre o DB → ver `AppDatabase.swift` — log mostra path do SQLite no sandbox. Apagar o app + reinstalar zera.
- Smoke quebra após mudança de schema → rodar `node tests/node-smoke-schema-parity.mjs` pra ver onde a divergência caiu.
- `.env.xcconfig` não funciona → confirmar `$()` em URLs e que arquivo está em `Config/.env.xcconfig` (não na raiz).
- Migration `supabase db push` falha → `supabase db diff` mostra o que está fora; `supabase db reset` zera local pra começar de novo.
