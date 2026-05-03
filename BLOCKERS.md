# BLOCKERS

Bloqueios reais do P1 Fast. Cada entrada: motivo / impacto / decisão necessária.

Vazio = avançar.

**Última revisão:** 2026-05-03

---

## Ativos pra desbloquear Sprint 1A.6 (necessário antes do #23)

### S1 · Projeto Supabase real
**Estado:** Edge Functions (`sync`, `pull`, `ingest`, `health`) prontas em `supabase/functions/`. Migrations 0001 + (futuras 0002, 0003a, 0003b) versionadas mas **NÃO aplicadas em prod**.

**Ação Flávio:**
1. Criar projeto Supabase novo (separado do CDAI Imunoterapia conforme `docs/SUPABASE_SETUP.md`).
2. `supabase link --project-ref xxxxx`
3. `supabase db push` aplica migrations.
4. Criar 1 user via Auth + 1 time via RPC `create_team`.
5. Copiar `SUPABASE_URL` + `SUPABASE_ANON_KEY` pra `ios/p1fast-ios/.env.xcconfig`.

**Impacto:** sem isso, prompts #23 e #24 (Sprint 1A.6 finishing) não rodam smoke E2E real — só com mocks. Phase 1A não fecha.

---

## Ativos pra Phase 1B (cockpit ao vivo)

### E2 · Injepro T4000 — captura real do barramento CAN
**Estado:** spec oficial confirmada (PDF arquivado em [`docs/raceops/refs/INJEPRO_T4000_CAN_PROTOCOL_2026-04-24.pdf`](docs/raceops/refs/INJEPRO_T4000_CAN_PROTOCOL_2026-04-24.pdf), detalhamento em [`docs/hardware/T4000_CAN_SPEC.md`](docs/hardware/T4000_CAN_SPEC.md)). CAN ID `0x7FB`, 1 Mbit/s, 5×8 bytes a 10 ms, big-endian, checksum `sum mod 256` validado matematicamente.

**3 dúvidas residuais que só captura real responde:**
1. Diferenciação dos 5 pacotes (sem MUX byte documentado).
2. Bytes 2–6 do pacote 5 (provável zero-padding).
3. Range físico máximo do EGT (calibrar `OUT_OF_RANGE`).

**Ação Flavio:** capturar 30–60 s de tráfego com adaptador CAN/USB conectado ao Celta com T4000 ligada.

**Impacto:** sem isso, parser T4000 nasce frágil em detecção de desalinhamento e flag de OUT_OF_RANGE. Implementação do parser fica liberada após captura.

### E3 · iPhone publicando samples ao vivo no `/api/ingest/iphone`
**Estado parcial:**
- Endpoint serverless `api/ingest/iphone.js` existe e aceita chunks no schema canônico.
- App `P1FastIMUTest` captura IMU 100 Hz / GPS 1 Hz e salva CSV local.
- Baseline de hardware confirmado em [`docs/hardware/IPHONE_SENSORS_BASELINE.md`](docs/hardware/IPHONE_SENSORS_BASELINE.md).

**Ação Flavio:** decidir quando partir do `P1FastIMUTest` (captura local) para um app que faz POST live no endpoint, conforme `feedback_dev_sem_prod.md` (sem prod até autorização).

**Impacto:** sem app publicando, todo o pipeline real (Coach, fase de curva, V-001/V-002) só roda contra fixtures sintéticos ou CSV exportado manualmente. Para track day real, app precisa estar publicando.

### E4 · RaceBox — REBAIXADO PARA UPGRADE CONDICIONAL (2026-05-01)
**Estado:** spec arquivada como upgrade futuro, não MVP. Não bloqueia nada.

**Decisão:** baseline iPhone 16 Pro Max (IMU 100 Hz / jitter 0.30 ms) cobre o conceito atual. RaceBox volta SOMENTE se entrar feature de lap timing fino (delta sub-segundo) ou traçado sub-metro — gap real do iPhone (1 Hz / 2–5 m). Detalhes em [`docs/hardware/RACEBOX_INTEGRATION_SPEC.md`](docs/hardware/RACEBOX_INTEGRATION_SPEC.md) (cabeçalho marcado como arquivado).

---

## Arquivado — itens herdados do FAM Racing (limpeza 2026-05-01)

P1 Fast é projeto isolado do FAM Racing (ver `MEMORY.md`). Os bloqueios abaixo vieram do FAM Racing original, não se aplicam ao escopo atual:

- **A1 · Deploy Vercel** — `feedback_dev_sem_prod.md` declara: sem prod até autorização explícita do Flavio. Quando entrar, voltar a abrir.
- **E1 · Vídeo Insta360 → nuvem** — streaming de câmera não está no conceito P1 Fast (`p1-fast-conceito.md`).
- **F3 · Morning Briefing por voz** — dependia de stack FAM Racing + TTS; conceito não confirmado em P1 Fast.
- **G1 · Track day com Mini PC + câmeras + Box remoto** — setup FAM Racing. P1 Fast roda iOS native + ECU CAN (sem Mini PC, sem Box remoto, sem câmeras na loop).
- **G3 · Deploy final** — depende de Vercel e demais (todos arquivados acima).
- **Bloqueios A-001 a A-018 (auditoria 2026-04-22)** — todos fechados na correção. Histórico ficava como rastro mas não pertence ao P1 Fast — viver no `EXECUTION_TRACKING.md` original do FAM Racing se relevante.
- **C1/C2/C3 · Detector end-to-end** — `fase-curva.js` e `corredor.js` existem em `src/telemetry/`. A "integração ao vivo" depende de E3 (acima), que já é o item ativo. Não é bloqueio adicional.

Esses itens podem ser re-abertos a qualquer momento se virarem escopo real do P1 Fast — basta criar entrada nova em "Ativos" com justificativa.
