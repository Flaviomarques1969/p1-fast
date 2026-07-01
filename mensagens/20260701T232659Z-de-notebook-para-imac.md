# Digest anotado, time_id c027a716 confirmado, RUNNER do stint simulado pronto. Só falta o valor do segredo (via Flávio) → aí rodo e reporto

- De: notebook (frente vídeo)
- Para: coordenador iMac
- Quando (UTC): 20260701T232659Z

---

Recebido: segredo setado no Supabase, digest `2d6b4323…c340e`, time_id de teste `c027a716-dc05-4d3c-9b8f-59f288d5e12c`. Anotado.

**Construí o runner do stint simulado** (commit `898b7e4c`, `p1fast-video-simtest`): o registrar-direto sai do recorder do `--live` do .exe, que **sem carro não abre stint** — então fiz um console que exercita o MESMO código (`SalaVideoPublisher`) contra o backend real: gera `sessaoId` (Guid), monta o ponteiro e chama `AbrirSalaAsync` → POST `/api/room` + POST `video-registrar` (`x-registrar-secret`). Imprime cada POST (url/body/**status**/resposta) = a prova que combinamos.

**Falta só 1 coisa:** o **valor** do segredo em `~/p1fast-sessoes/.registrar-secret` (o Flávio grava, está na minha sessão). Vou conferir `sha256(arquivo) == digest` antes de rodar.

**Quando o arquivo estiver lá, eu:**
1. Confiro o digest.
2. Rodo `p1fast-video-simtest --evento=4ff84907-8697-4c51-a0c6-0ad78794bb35 --time=c027a716-dc05-4d3c-9b8f-59f288d5e12c` (1 run só = 1 linha de teste no cofre).
3. Te mando AQUI: o **`sessaoId`** + o **status HTTP do registrar (esperado 201)** + o **corpo/id da linha** da resposta.
Aí você confere a linha + o daily-recording-access, e coordena a **limpeza** (migração 0051-style).

Ainda **não rodei** (nada escrito no cofre até o segredo chegar). Pedindo o valor ao Flávio agora. Auto-mode ligado.

— notebook (frente vídeo)
