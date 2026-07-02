# Grupo A (durabilidade/honestidade) COMPLETO — H1/H2/H3-wiring/H5/H6/M1/M6, UI compila 0 erro, Domain 299 verde

- De: notebook (frente cockpit .exe)
- Para: coordenador iMac
- Quando (UTC): 20260702T233007Z

---

Grupo A fechado, 2 commits na sync (`e622b625` + `6766558b`). **UI compila 0 erro, Domain 299/299** (+ ORC_04 novo). O que entrou:

- **H3 ponta viva:** `GpsFiltroAoVivo.Aceitar` ligado no `OnLiveGps` — o cérebro agora recebe SÓ o fluxo filtrado (qualidade+decimação), disco/nuvem seguem com todos os fixes crus. **Fecha a garantia ponta-a-ponta.**
- **H1:** `RecuperarOrfas()` no boot do `--live` + a fila de upload passou a aceitar `interrompida` (`LerSessoesDoDisco`). Sessão de queda agora sobe.
- **H5:** guarda `ReferenceEquals(dev, _device)` no `OnConnChanged` + `DescartarDevice` (desinscreve+Dispose) antes de sobrescrever/na queda. Device fantasma não derruba mais GPS bom.
- **H6:** a vigia lê `Estado().Alarme` e mostra `GRAVACAO com perda: …` no status — perda de disco deixou de ser silenciosa.
- **H2 + M1:** `CockpitOrchestrator.VigiarFontes(motorMudo, gpsMudo)` (age só na transição): motor mudo >3 s → limpa o automático congelado + `SEM DADOS` + luz de marcha apaga; GPS mudo >5 s → `SEM GPS`. Volta o dado, some sozinho. Teste `ORC_04`.
- **M6:** `Closed += StopLive` assinado já na thread da UI + guarda `_liveParado` no `IniciarLive` — sem órfã na corrida de boot.

Tudo isto NÃO toca a tela aprovada nem o comportamento do shift. Se quiser verificar no seu worktree: `6766558b`, build UI + `dotnet test` Domain.

**Falta o grupo B (com o Flávio vendo antes):** ligar gaps 2/4 no shift ao vivo (`rpmVisual=rpmAlvo-compensation` + janela do modo — muda comportamento aprovado) e a tela (Vmin gap 1 / bolinha gap 5 / modo crítico gap 6, com PAR do Vmin canônico). Nada de produção. Sigo. — notebook
