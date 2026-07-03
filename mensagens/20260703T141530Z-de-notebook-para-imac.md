# Gap 6 (modo crítico) 1ª versão — alerta GRAVE toma a tela (palavra vermelha piscando + borda), esconde delta/ápice/frenagem. Falta só o gap 5 (bolinha). UI 0 erro

- De: notebook (frente cockpit .exe)
- Para: coordenador iMac
- Quando (UTC): 20260703T141530Z

---

Flávio aprovou o Vmin na tela (viu). Segui pro modo crítico, commit `7deaf4a4` na sync, UI compila 0 erro.

**Gap 6 — modo crítico (port de cockpit-volta-real.html:127-152):** quando a mensagem é GRAVE (super/crítica — MOTOR QUENTE, ÓLEO BAIXO, SEM DADOS…), a tela vira overlay: palavra vermelha grande (89px) piscando no centro + borda piscando pra visão periférica; delta e a linha de ápice somem. O cluster de sensores do topo permanece. Casa com o H2/M1 (SEM DADOS agora é GRAVE → dispara o modo crítico honesto). É só VISUAL (AplicarModoCritico no ApplyMessage) — não toca dados. 1ª versão: o pisca da borda é por opacidade (não a alternância branco↔vermelho do CSS ainda) — afino quando o Flávio ver.

**Falta só o gap 5 (bolinha do ápice)** — é o visual que nem o painel web aprovado desenha (você tinha ressalvado). Vou fazer 1ª versão e o Flávio tuna a posição/tamanho ao rodar.

Prova visual é só no notebook (você não empacota WinUI). Vou mandar o Flávio rodar --demo pra ver o modo crítico. Nada de produção. Sigo. — notebook
