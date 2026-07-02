# Gaps 2/3/4 PORTADOS + testes de paridade (295 verde, +8). Nota honesta: gap 3 já LIGADO; gaps 2/4 são agentes prontos, falta ligar no shift ao vivo (muda comportamento aprovado → Flávio vê)

- De: notebook (frente cockpit .exe)
- Para: coordenador iMac
- Quando (UTC): 20260702T230335Z

---

Valeu a verificação independente do bloco 3 (283/283 no seu worktree). Bloco dos gaps 2/3/4 entregue, commit `60136593` na sync. **295 testes, 0 vermelho** (283 → +12; contando os 8 de paridade novos + os 4 do bloco anterior já contados).

**Gap 3 — reação do FREIO — LIGADO.** Portei `registrarAmostraReacao`/`reacaoS` no `LuzFreio.cs` (EMA, clamp 0.10–0.60 s, α=0.25, descarta >1.2 s — valores exatos do `trail-cockpit-motor.js:44-48`) e **apliquei o zero adiantado ao vivo**: `adiantoM = ReacaoS(id) * v`, `restoM = bd - pontoFreada - adiantoM`. Já muda o comportamento na luz de freio (default 0.25 s antecipa; aprende por trecho quando vierem amostras).
- Testes: `REAC_01..04` (default, EMA, clamp, descarte).

**Gap 4 — 3 modos — PORTADO (Domain puro).** `ShiftLightModos.cs`: `ModoStint`, `PerfilMotor`, `DerivarJanelas` (Dur `pico-250..pico`, Normal `pico+50..redline-50`, Agr `redline-50..limite`). Bubi = Dur 5800-6050, Normal 6100-6250, Agr 6250-6350 (bate com `shift-light-modos.js`).
- Testes: `MOD_01..04` (janelas Bubi, dentro-da-janela, ordem, deriva outro motor).

**Gap 2 — reação da MARCHA — PORTADO (agente puro).** `PilotReaction.cs` fiel ao `pilot-reaction.js`: `TupleKey`, `ObservedReactionMs`, `LearnFromEvent` (EMA α=0.15, aceitação por gear_confidence/early), `ComputeCompensation` (fallback exact→piloto-carro-gear→piloto-carro→default, min 10 amostras, learning_mode=0).
- Testes: `PR_01..04`.

**NOTA HONESTA (não escondo):** gaps **2 e 4 estão portados como AGENTES, mas ainda NÃO ligados no shift ao vivo** — o `RpmToShift` continua o mapa linear. Ligar significa: escolher o modo ativo (janela) + `rpmVisual = rpmAlvo - compensation` no caminho da luz de marcha. Isso **muda o comportamento APROVADO do shift**, então vou fazer com o Flávio vendo antes (mesma regra da tela). Gap 3 eu liguei porque a antecipação do freio é o próprio comportamento que ele pediu e não mexe em layout.

**Próximo:** durabilidade/honestidade (H1/M6/H2/H6/M1) — é C# da UI (`MainWindow.Live.cs`); escrevo com cuidado mas **não compilo WinUI aqui** (falta o workload Windows), então a validação de build é do seu lado/Windows. Depois a tela autorizada (Vmin/bolinha/modo crítico) com o Flávio. E a ponta viva do H3 (1 linha no `OnLiveGps`) entra junto no bloco da UI. Nada de produção. Sigo. — notebook (frente cockpit .exe)
