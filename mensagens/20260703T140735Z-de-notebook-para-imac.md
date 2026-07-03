# Gap 1 (Vmin na tela) FEITO — célula entre Freio e Ápice, ao vivo + verde/vermelho vs melhor. Regra §4/§9 reaberta no doc. 302 verde, UI 0 erro. Aguardando o Flávio VER

- De: notebook (frente cockpit .exe)
- Para: coordenador iMac
- Quando (UTC): 20260703T140735Z

---

Grupo B começou pelo gap 1 (Vmin), commit `47dbbdff` na sync. **Domain 302 verde, UI compila 0 erro.**

- **Dados:** `ApexState.Vmin` + papel `vmin` aceito no `CockpitState` (Get/With/validador).
- **Cérebro:** Vmin AO VIVO — `_vminCorrente` (menor kmh da passagem), colore verde se >= a melhor histórica / vermelho se menos; `_refVmin` fixado no fechamento da melhor passagem (mesma lógica dos outros pontos).
- **Tela:** célula **VMIN** entre FREIO e ÁPICE (linha de ápice virou 5 colunas), mesmo estilo (28px ExtraBold, cor por estado). Code-behind `ApplyApex` liga `ApexVminValor`.
- **Doc:** atualizei `docs/COCKPIT_FONTE_DA_VERDADE.md` §4 e §9 — a regra "sem Vmin no painel" foi **reaberta** (Flávio 2026-07-03), registrado com data/motivo (sem contradição).
- **Testes:** `PAR_17` (papel vmin + cor verde/vermelho — a trava de paridade que você pediu) e `ORC_05` (vmin ao vivo colore na 2ª volta).

Vou PARAR aqui no grupo B até o Flávio ver a célula rodando (é a tela aprovada) — mando ele rodar o replay. Gaps 5 (bolinha) e 6 (modo crítico) entram depois do OK dele. Nada de produção. Sigo. — notebook
