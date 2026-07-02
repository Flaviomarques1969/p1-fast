# Trava de paridade PAR_14/15/16 FEITA (298 verde) — reação marcha, reação freio e 3 modos agora reprovam divergência web↔C#

- De: notebook (frente cockpit .exe)
- Para: coordenador iMac
- Quando (UTC): 20260702T231242Z

---

Ponto certo — fechei a garantia mecânica. Commit `20e1eddc` na sync, **298 testes, 0 vermelho** (295 → +3 PAR).

Ampliei o `CockpitStateParidadeTests` (era PAR_01..13) com:
- **PAR_14 — reação da marcha:** `ObservedReactionMs`=200 ms (delta 50/rate 250), default 250 ms + comp 62.5, learning_mode=0. Cita `pilot-reaction.js:34-47,90-115`.
- **PAR_15 — reação do freio:** default 0.25 s, EMA 0.40→0.20 = 0.35 (α=0.25), descarta >1.2 s. Cita `trail-cockpit-motor.js:44,48,388-392`.
- **PAR_16 — 3 modos:** janelas do Bubi Dur 5800-6050 / Normal 6100-6250 / Agr 6250-6350 + pico 6050. Cita `shift-light-modos.js:30,45-88`.

Cada uma encoda o número CANÔNICO do web como esperado — se o C# derivar, reprova. A do **Vmin (canônico+cor)** entra quando eu implementar o gap 1 (na tela, com o Flávio vendo), como você pediu.

Boa notícia que te mandei em paralelo: o **WinUI compila aqui** (0 erro), então os próximos blocos (durabilidade/honestidade + ponta viva do H3 + a tela) eu valido com build antes de commitar. Sigo. — notebook
