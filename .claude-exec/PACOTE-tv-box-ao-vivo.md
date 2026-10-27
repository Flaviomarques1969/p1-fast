# MIGRAR PARA PRODUÇÃO: P1 Fast TV do box ao vivo no p1box

> Status: PRONTO E PROVADO EM DESENVOLVIMENTO (27/10/2026 ~19h). Nada foi ao ar.
> Pedido do Flávio, 27/10/2026: TV do box ao vivo (GPS + câmera + notebook 5G) — "esta tela não está funcionando
> corretamente". Etapas E1–E4 prontas na branch; esta é a E5 (publicar a TV).

## O que é
A TV do box passa a ter endereço próprio no site do Command Box: **`https://p1box.vercel.app/tv/?tv=1`**.
Ela mostra o carro pelo GPS do RaceBox (vindo do notebook pelo 5G) e a câmera do carro, e diz a verdade sobre o sinal:
AO VIVO só quando o dado é de agora; ATRASADO, SEM SINAL HÁ X s, GPS SEM POSIÇÃO, AGUARDANDO O CARRO ou SEM CONEXÃO
quando não é. A câmera vem pela ponte `/api/room` do próprio site (a TV só assiste; nunca recebe o acesso do piloto).

## O que muda para a operação
- Na Fire TV do box, o favorito passa a ser `https://p1box.vercel.app/tv/?tv=1` (passo da equipe, depois da publicação).
- **Nada muda nas telas que já estão no ar**: menu, Vista Piloto e Frenagem & Aceleração seguem byte a byte iguais à
  publicação de 01/07 (a Vista do ar tem ~286 linhas — Vmin novo, combustível da nuvem — que esta linha de código não tem;
  por isso a TV vai em pasta própria, `/tv/`, com cópia própria das peças, em vez de substituir a Vista).
- A TV só mostra AO VIVO quando o notebook estiver com o Cockpit novo publicando no canal ao vivo (instalação no
  notebook = obra da janela «P1FAST - GPS TV modo RaceBox», fora deste pacote). Com o Cockpit antigo ela também funciona
  (mensagem sem lote = um ponto), só sem as melhorias de envio da E2.

## Origem em desenvolvimento
- Worktree `~/Projetos/p1fast-worktrees/tv-box-aovivo`, branch `claude/tv-box-aovivo-e2-20261027` (no GitHub).
- Montador: `tools/montar-p1box-tv.mjs` → `dist/p1box-tv` (82 arquivos) + lista `dist/p1box-tv-LISTA.sha256`.
- Base do ar: `.claude-exec/p1box-ar-20261027/arquivos` + `MANIFESTO-AR.sha256` (41 arquivos, conferidos pelo sha1 da Vercel).

## ENTRA (site p1box.vercel.app — projeto Vercel `p1box`, `prj_EE2vFPmwyKxRtvdmVNykAgRPtudi`)
1. `tv/index.html` — a TV (Vista Piloto em modo TV), sem a ferramenta de autor.
2. `tv/web/...` — 38 peças da TV, cópia própria com toda referência `/web/` trocada por `/tv/web/`
   (lista exata e sha256 em `dist/p1box-tv-LISTA.sha256`; tudo que começa com `tv/`).
3. `api/room.js` — ponte da sala de vídeo (= `web/teste-aparelhos/api/room.js`; sem variável de ambiente nem segredo).
4. `package.json` — só `{"type":"module"}` (para a função da ponte).

## NÃO ENTRA (explícito)
- As 41 telas do ar (menu, Vista Piloto, Frenagem & Aceleração, `web/`, `src/`, `bubi.jpg`): vão no pacote **byte a
  byte iguais** à publicação de 01/07 (`dpl_FNKZphaSJqLyB7bTtC2qz2242V73`) — nenhuma muda.
- A Vista Piloto desta linha de código por cima da do ar (seria regressão).
- Site `p1tv`, site `fam-racing` (backend de vídeo — a ponte só o chama), `p1-teste-aparelhos`, `p1t4000`, `command-box-tv`.
- Configurações do projeto p1box (variáveis, domínio, proteção, região) — nada muda.
- Cockpit do notebook (.exe), `gps.cmd`, canal `cockpit-bubi-live`, nuvem Supabase (nenhuma tabela, função ou migration).
- `web/command-box/fixtures/replay-hoje-*` (gravação do modo DEV; fica fora de propósito).

## Provas em desenvolvimento (27/10)
- Catraca do montador `tests/node-smoke-montar-p1box-tv.mjs`: 17/17; controles dentro dela (base com 1 byte trocado,
  arquivo a mais, ar já com `tv/`, montador sem isolar) todos RECUSADOS, saída 1. No `npm run smoke`: 84/85 um a um
  (único FAIL `schema-parity`, anterior à obra). `smoke:arquitetura` 39/0.
- Ensaio do pacote montado, Chrome sem janela + nuvem real no canal `cockpit-bubi-dev-ensaio-e5`
  (`.claude-exec/ensaio-pacote-p1box/ensaio-pacote.mjs`): 17 ok / 0 falha — AGUARDANDO → AO VIVO → SEM SINAL →
  reenvio velho descartado → ATRASADO → AO VIVO; a TV só carrega `/tv/...` e `/api/room`; 0 erro de script; 0 404;
  as 3 telas do ar abrem sem nada de `/tv/`. Controles: selo estragado (AO VIVO até 60 s) = 3 FAIL; TV pedindo a sala
  sem papel de espectador = 1 FAIL.
- Conferência do ar `tools/conferir-p1box-no-ar.mjs`: publicação atual × cópia do ar = APROVADO 41/41;
  publicação atual × pacote = REPROVADO; 27/06 × cópia de 01/07 = REPROVADO; publicação inexistente = PAROU (saída 2).

## Passos (só depois da frase)
0. Conferir que o ar não mudou: produção do projeto ainda é `dpl_FNKZphaSJqLyB7bTtC2qz2242V73`, e
   `node tools/conferir-p1box-no-ar.mjs dpl_FNKZphaSJqLyB7bTtC2qz2242V73 .claude-exec/p1box-ar-20261027/arquivos` = APROVADO.
   Mudou → PARAR, baixar a nova base, remontar e reprovar o pacote.
1. `node tools/montar-p1box-tv.mjs && node tests/node-smoke-montar-p1box-tv.mjs`.
2. Vincular: `mkdir dist/p1box-tv/.vercel && cp "/Users/imac/Projetos/P1 Fast/dist/p1box/.vercel/project.json" dist/p1box-tv/.vercel/`.
3. `cd dist/p1box-tv && npx vercel deploy --prod --skip-domain --yes` → publicação nova SEM o endereço oficial (dpl_NOVO).
4. `node tools/conferir-p1box-no-ar.mjs <dpl_NOVO> dist/p1box-tv` = APROVADO (82/82; senão PARAR, não promover).
5. `npx vercel promote <dpl_NOVO> --yes` (dentro de `dist/p1box-tv`) → `p1box.vercel.app` passa a servir a nova.

## Validação no ar
- API: produção do projeto = dpl_NOVO; alias `p1box.vercel.app`.
- `node tools/conferir-p1box-no-ar.mjs <dpl_NOVO> dist/p1box-tv` = APROVADO e sha1 das 41 do ar iguais às de 01/07.
- `ENSAIO_URL=https://p1box.vercel.app node .claude-exec/ensaio-pacote-p1box/ensaio-pacote.mjs` = 17/17
  (canal de ensaio, sala de vídeo de verdade).
- `https://p1box.vercel.app/` e `/mockup-command-box-vista-piloto.html` abrem como antes (ensaio E9).

## Volta atrás (rollback)
`npx vercel promote dpl_FNKZphaSJqLyB7bTtC2qz2242V73 --yes` (dentro de `dist/p1box-tv` vinculado) → o site volta a ser
exatamente o de 01/07. Nada mais a desfazer (nenhum dado, configuração ou nuvem muda).
