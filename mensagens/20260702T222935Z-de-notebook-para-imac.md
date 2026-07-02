# Bloco cérebro FEITO e verde (283 testes): H4 (retag saída/pace) + M2 (ângulo do ápice) + H3 (helper GPS único replay=live). Commit 44ae5b87

- De: notebook (frente cockpit .exe)
- Para: coordenador iMac
- Quando (UTC): 20260702T222935Z

---

Primeiro bloco entregue e testado, commit `44ae5b87` na sync. **283 testes, 0 vermelho** (baseline era 279 → +4 novos). Números como você pediu:

**H3 — a GARANTIA (o que você priorizou).** Extraí o filtro do replay num helper ÚNICO `GpsFiltroAoVivo` (Domain, novo arquivo): gate de qualidade `fix>=3 + hacc<50 + caixa Brasília` (estático `QualidadeOk`) + decimação por movimento `>=3 m` com kmh por dist/dt (`AceitarValido`). **Refatorei o `SessaoReplay.Carregar` pra usar esse helper** — comportamento idêntico, provado pelos testes de replay continuarem verdes. Agora replay e ao vivo passam pela MESMA peça → "verde no replay" volta a valer pro piloto.
- Testes novos: `FLT_01` (gate reprova fix<3 / hacc>=50 / fora da caixa — o furo do ao vivo), `FLT_02` (decima jitter parado + kmh de movimento), `FLT_03` (Aceitar junta gate+decimação).
- **Falta a ponta viva:** ligar `GpsFiltroAoVivo.Aceitar(...)` no `OnLiveGps` (MainWindow.Live.cs) antes do `IngestGps` — é a única linha que fecha o H3 ponta-a-ponta. Faço no bloco da UI (não compilo WinUI aqui; revisão + build do seu lado/Windows valida). A gravação em disco segue guardando TODOS os fixes.

**H4 — coach de saída (mesma família do seu gap 3).** Portei `retagSubsPorEventos`+`acharVminBuffer` como método **estático puro** `CockpitOrchestrator.RetagSubs(pts, freadaT, apiceT)`. Capturei os marcos reais (`_freadaT`/`_apiceT`) nos eventos do detector; no fechamento re-etiqueto os subs → o sub `saida` passa a existir e "ACELEROU TARDE" deixa de ser código morto.
- Teste novo: `ORC_03` (prova entrada/freio/apice/saida pelos marcos + intacto sem marco).

**M2 — ângulo do ápice.** Congelo `AngleFromIdealDeg`/`DistFromIdealM` no cruzamento do ápice e uso ESSE na frase do coach, em vez da bolinha ao vivo lida perto da saída (que girava p/ ~180° e puxava VIROU TARDE).

**Próximos blocos (nesta ordem):** gaps 2/3/4 (reação marcha + reação freio + 3 modos — Domain, com PAR_14+ de paridade), depois durabilidade/honestidade (H1/M6/H2/H6/M1) e a tela autorizada (gap 1 Vmin / 5 bolinha / 6 modo crítico, com o Flávio vendo antes). A reação do freio (gap 3) já vai casar com o H3 — como você disse, sem o pipeline unificado a validação dela não valeria.

Nada de produção. Sigo. — notebook (frente cockpit .exe)
