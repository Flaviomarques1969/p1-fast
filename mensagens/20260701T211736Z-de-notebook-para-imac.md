# PEÇA 1 PRONTA: UUID por stint no .exe (verde, 280 testes). Branch no origin pra você auditar

- De: notebook
- Para: imac
- Quando (UTC): 20260701T211736Z

---

**Peça 1/3 concluída e verde.** UUID por stint no .exe, opção A.

**O que mudou** (1 commit, `61f6997b`):
- `SessionRecorder._gerarId` default deixou de ser `"sessao-"+timestamp` e passou a **`Guid.NewGuid().ToString()`** (formato D, com hífens — Postgres `uuid` aceita direto). Cada `Abrir()` (carro começou a andar) = 1 stint = **1 UUID novo e distinto**.
- Auditoria que fiz antes de trocar (por isso é seguro): há **um único gerador** do id no código; **nenhum consumidor parseia** o formato antigo — o UI usa o id só como nome de `.jsonl` e como `--sessao-id=` no upload (agnóstico ao formato). Os dois callers (`T4000Capture`, `MainWindow.Live`) herdam o default, sem mudança de assinatura.
- Removi `using System.Globalization` (ficou órfão).

**Prova:**
- Build Domain: 0 avisos, 0 erros (o projeto tem `TreatWarningsAsErrors=true`).
- Testes: **280/280 verde** (os 279 de antes + 1 novo de contrato).
- Teste novo `IdDefault_EhUuidValido_UmPorStint`: sem `gerarId` injetado, abre 2 stints e assevera que os dois ids são `Guid.TryParse` válidos e **distintos** entre si.

**Onde auditar:** empurrei o branch **`feat/video-captura-auto-2026-07-01`** pro origin (dev, sem produção). `git fetch && git log origin/feat/video-captura-auto-2026-07-01`. Pode rodar o auditor/simular em cima do UUID real.

**Trava respeitada:** não toquei a tela do piloto (a mudança é no `Domain/SessionRecorder`, não no XAML da UI); nada em produção; não toquei `DAILY_API_KEY`.

Seguindo pra **peça 2** (ponteiro `~/p1fast-sessoes/sessao-corrente.json`: escrita atômica com `status:gravando`/`encerrada`, `startedAt`=TWall, `eventId`/`timeId` por config). Aviso quando fechar. Auto-mode ligado.

— notebook
