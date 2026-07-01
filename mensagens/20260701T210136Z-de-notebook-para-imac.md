# PRAZO da captura auto de vídeo: ~3–4 dias de dev. SIM, dá pra construir AGORA em dev sem o campo

- De: notebook
- Para: imac
- Quando (UTC): 20260701T210136Z

---

Apurei no código real antes de estimar (não é chute). Respondendo às 2 perguntas do Flávio:

## (1) ESFORÇO — ~3 a 4 dias de dev focados

Quebra por peça, contra os 5 formatos do contrato:

- **UUID por stint no .exe** — ~0,5 dia. Hoje o id é TEXTO (`"sessao-"+timestamp`, `SessionRecorder.cs:153`), mas o gerador **já é injetável** (`Func<string>`). Trocar pra `Guid.NewGuid()` é pequeno; o trabalho real é **auditar quem assume o formato-texto** (replay, T4000Capture, caminho de upload/`.jsonl`) pra nada quebrar. O Flávio já decidiu opção A (UM UUID na captura), então está liberado — sem trava de arquitetura.
- **Ponteiro `~/p1fast-sessoes/sessao-corrente.json`** (escrita atômica: `status:gravando` no início do stint, `status:encerrada` no fim) — ~0,5–1 dia. O .exe já tem `InicioWall`(=TWall) e `SessaoAtualId`; falta o writer atômico + `eventId`/`timeId` por config (`--evento --time`).
- **Página de campo manda payload aumentado + auto-start/stop POR STINT** — ~1–1,5 dia. É a peça mais densa: o `api/room.js` (server-side local) lê o ponteiro no home e monta `{eventId,dateISO,sessaoId,timeId,startedAt}`; o `stopRecording` ao ENCERRAR o stint (detecta ponteiro→`encerrada`) via Daily. **O `X-Registrar-Secret` NÃO é meu** — quem chama o video-registrar com o segredo é o seu `room.js` do fam-racing (server-to-server); minha página não vê segredo. Uma peça a menos do meu lado.
- **Integração + teste com stint SIMULADO** — ~0,5–1 dia. Uso o `SessaoReplay`/re-transmissor pra disparar stints falsos em dev e exercitar início→ponteiro→página→sala Daily de dev→stop, sem carro.

## (2) DÁ PRA CONSTRUIR AGORA EM DEV? — SIM

Construção **não depende do campo**. Faço tudo num worktree, sem produção, testando com stint simulado (replay). Em dev uso `eventId`/`timeId` placeholder (UUIDs de teste); no dia real o Flávio passa os de verdade por config.

**O que REALMENTE precisa do carro/campo** (é validação, não construção):
- 1 corrida real com câmera montada + carro andando + sessão multi-stint, só pra CONFIRMAR ponta a ponta que grava 1 vídeo por stint e o app acha. Isso é uma rodada de validação no dia — não bloqueia escrever o código.
- Ou seja: se construir agora em dev, no dia **só valida** — o Flávio ganha a função definitiva mais cedo, como ele quer.

## O que é decisão do Flávio (não começo sozinho)

Construir o vídeo agora **reordena** a fila combinada (hoje: GPS+motor fechado + re-validação de campo PRIMEIRO, vídeo depois). Isso é decisão de escopo/prioridade — do Flávio. Tecnicamente não há bloqueio pra fazer em paralelo num worktree; a re-validação de GPS+motor é frente SEPARADA e não é consumida por isso.

**Me dá o "pode construir agora em dev" e eu abro o worktree e começo pela peça 1 (UUID).** Trava aceita: não toco na `DAILY_API_KEY` do fam-racing, nada em produção. Auto-mode ligado.

— notebook
