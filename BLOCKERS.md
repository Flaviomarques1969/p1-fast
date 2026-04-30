# BLOCKERS

Bloqueios reais. Cada entrada: fase / motivo / impacto / decisão necessária.

Vazio = avançar.

---

## 2026-04-22 — Pós-auditoria

Todos os bloqueios P0/P1 levantados em `AUDIT_2026-04-22.md` foram fechados em `CORRECTION_PLAN_2026-04-22.md` (Fases 1–7 executadas). Histórico abaixo fica como rastro.

### Bloqueios fechados durante a correção

| ID | sev | task | como ficou |
|---|---|---|---|
| A-001 | P0 | T-001 | SessionRecorder liga provider→detector→Laps.create→db.segmentExecutions |
| A-002 | P0 | T-002 | `_onLineCross` fecha o setor ativo antes de emitir lap |
| A-003 | P0 | T-003 | `src/telemetry/projector.js` + `geoAncoras` na seed; Provider._emit projeta in-place |
| A-004 | P1 | T-005 | `seedCalcSegmentPct` preenche pathStart/pathEnd dos 14 trechos |
| A-015 | P1 | T-004 | linhaChegada vertical x=415, y∈[695,720] calibrada pro path real |
| A-012 | P1 | T-012 | `collectValidLaps` filtra `session.status !== INVALIDA` |
| A-018 | P1 | T-006 | ADR-014 declara telemetria como exceção formal a ADR-009 |
| A-005 | P1 | T-010 | SPEC_MENSAGENS §4 ganhou nota de alias Prioridade |

### Estado atual
**(sem bloqueios abertos)**

Referência viva: `EXECUTION_TRACKING.md` (dashboard + append-only log de cada task com evidência).

---

## 2026-04-23 — Bloqueios para fechar o PLANO_EXECUCAO.md

Levantados na sessão "execute até o final". Tudo que é software puro foi entregue; o que segue exige ação humana ou hardware.

### A1 · Deploy Vercel
**Ação Flavio:** criar projeto Vercel `fam-racing` (separado de CDAI/HomeCare), conectar ao repo novo `fam-racing` no GitHub, setar env var `ANTHROPIC_API_KEY` (Production + Preview).
**Impacto:** sem isso, `/api/advisor` e `/api/post-stint` ficam offline — o Box mostra fallback "AGUARDANDO STREAM" / "endpoint indisponível". Código já está pronto.
**Critério de fechamento:** botão SETUP ADVISOR no Box do domínio de produção retorna JSON válido da Claude.

### E1 · Vídeo Insta360 → nuvem
**Ação Flavio:** decidir stack — Daily.co (mais caro, fecha mais rápido) vs WebRTC puro custom (barato, mais código).
**Impacto:** sem isso, painel Box fica com placeholder "AGUARDANDO STREAM". UI já preparada pra trocar `<div>` por `<video autoplay muted playsinline>` quando stream chegar.

### E2 · Injepro T4000 — SPEC RECEBIDA 2026-04-24
**Estado atual:** Spec oficial Injepro CAN bus recebida via WhatsApp. PDF arquivado em [`docs/raceops/refs/INJEPRO_T4000_CAN_PROTOCOL_2026-04-24.pdf`](docs/raceops/refs/INJEPRO_T4000_CAN_PROTOCOL_2026-04-24.pdf). Documento detalhado em [`docs/raceops/T4000_CAN_SPEC.md`](docs/raceops/T4000_CAN_SPEC.md). Confirmado: CAN ID 0x7FB, 1Mbit/s, 5×8 bytes a 10ms, big-endian, checksum `sum mod 256` validado matematicamente contra exemplo.
**Pendências residuais (3, baixo risco):** diferenciação dos 5 pacotes (sem MUX byte), bytes 2-6 do pacote 5 (provável zero-padding), range físico máximo do EGT.
**Ação Flavio:** captura real do barramento com adaptador CAN/USB para validar as 3 dúvidas residuais antes de implementar parser.
**Impacto:** sem canais do motor (RPM, TPS, MAP, λ, temp motor/ar, pressão óleo/combustível), cockpit roda só com GPS+IMU. Implementação do parser está liberada — fixture canônica = exemplo do PDF.

### E3 · App iOS (iPhone) — **BLOQUEADOR DE DEPLOY FINAL** (atualizado 2026-04-24)
**Ação Flavio:** repo/xcode separado (app Swift/SwiftUI) publicando `CLLocation` + `CMDeviceMotion` em `/api/ingest/iphone`.
**Impacto:** Flavio declarou em 2026-04-24 — sistema só vai pra produção quando iPhone estiver publicando telemetria live. Hoje todas as métricas por trecho (velMin, ponto de freio, delta) são derivadas do GPS histórico da volta de referência (Brasília lap 5 do RaceChrono Pro), rotuladas na UI como `HISTÓRICO`. Quando E3 ligar, `state.liveMetricsByTrecho` popula → badge vira `● LIVE` automaticamente.
**Recomendação:** primeiro criar o app (sessão separada), depois criar `/api/ingest/iphone.js` com schema compatível com `telemetrySamples` do Box.
**Ver:** `memory/fam-racing-deploy-policy.md` — política de deploy.

### E4 · RaceBox Mini (Perna 2)
**Ação Flavio:** preencher formulário `racebox.pro/products/mini-micro-protocol-documentation` e repassar PDF (NDA leve).
**Impacto:** perna 2 do plano de hardware. Substitui iPhone como fonte GNSS+IMU com 10cm / 25Hz. Não bloqueia perna 1.

### F3 · Morning Briefing por voz
**Ação:** depende do app iOS (E3) rodando + TTS nativo.
**Código pronto:** nenhum. Quando E3 fechar, basta endpoint `/api/briefing` com prompt curado.

### G1 · Testes em pista
**Ação Flavio:** rodar track day com Mini PC + câmeras + iPhone + nuvem Vercel + Box remoto.
**Critério:** checklist de verificação em `docs/PLANO_EXECUCAO.md` §6 (quando houver stack completa).

### G3 · Deploy final / treinamento
Depende de A1-G1 fecharem.

### C1/C2/C3 · Detector end-to-end
**Status:** base pronta (`fase-curva.js` + `corredor.js` + detector existente). Integração ao vivo com Match σ-corredor depende de E3 (sinais iPhone) ou E4 (RaceBox). Testes unitários possíveis sem hardware; validação real não.
