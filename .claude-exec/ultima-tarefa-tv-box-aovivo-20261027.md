# OBRA — TV do box AO VIVO (GPS + câmera USB + notebook no 5G) — 27/10/2026

Pedido do Flávio (27/10 ~16h10, janela «P1FAST - tela no Box ao vivo»): "audite profundamente a tela no Box… vamos usar os dados
do GPS para vermos no box o que está acontecendo com o Bruno no carro ao vivo; câmera no USB do notebook, GPS de corrida, notebook
no celular em 5G. Esta tela não está funcionando corretamente. Identifique tudo, todas as soluções, organize em passos de ~200 mil
tokens e execute em sequência."

Worktree: ~/Projetos/p1fast-worktrees/tv-box-aovivo · branch claude/tv-box-aovivo-20261027 (de origin/claude/gps-base-g-racebox-20261027
@ 42535e946). Território: tv-box-aovivo-1027. Produção intocada.

DIVISÃO COM A OUTRA JANELA («P1FAST - GPS TV modo RaceBox», sessão imac-9c, worktree gps-base-g): ELA cuida do teste de troca
Wi-Fi→celular no notebook (9ee11ab2e + 42535e946 religação), da escuta e da análise da gravação da rua. EU: tudo abaixo. Antes de
escrever em MainWindow.Live.cs / SupabaseRealtimeChannel.cs / ReligacaoNuvem.cs → SendMessage imac-9c.

## DIAGNÓSTICO (3 auditorias só leitura, 27/10; provas em scratchpad 150deabe…/audit-tv*.mjs + PNGs)
TELA (_design-reference/mockup-command-box-vista-piloto.html):
 T1 carro anda sozinho no mapa quando o sinal cai (:7069-7072 volta ao relógio de demo; medido 5 s sem dado = bolinha andou).
 T2 selo invertido: ao vivo mostra "GPS local (provisório)", caído mostra "AO VIVO · aguardando"; 6 escritores (:7744,7869,7927,8138,8189,8551).
 T3 trocas do modo real (:7827-7835) em escopo errado → globais soltas; fora do modo RaceBox HUD mostra FAKE_LAPS (194 km/h) com selo "ao vivo".
 T4 sem esm.sh/internet ao abrir → demo com selo ao vivo, import() sem nova tentativa (:7919,8604,8684).
 T5 dado velho como novo: onGps (:7887-7895) não confere ordem/idade; rajada de 1500 pontos da fila = fresco:true (fresco = chegada, não tWall :8608).
    Sem "sem sinal há X s" nem atraso; "5G=18ms", BAT, RT, ALT, TEMP, odômetro 12347 = fixos/inventados.
 T6 não serve na TV 32": quadro máx 1280×720 (:77-80) = 44% de 1920×1080; corta em 960×540; textos da camada GPS 6 px;
    barra de edição/rodapé "Mock data"/salvar aparecem; reset com controle remoto (localStorage :4009).
 T7 p1box no ar = versão de junho (cerebro-gps-tv.js 404). Branch sem tools/montar-p1box.mjs nem menu-command-box.html.
 T8 bloco vídeo = desenho fixo ("REC · CAM ONBOARD 02:48.215" :3502-3509) — mente.
 T9 conta duplicada na tela (odômetro, fracDe da bolinha, 2 detectores de volta); sats/km congelam (:8671); HUD aceita fix<3 (:7889).
NOTEBOOK (windows/cockpit):
 N1 [CONSERTADO pela imac-9c 42535e946] religação se derrubava no 5G (relógio antes do ConnectAsync).
 N2 fila GPS reenvia até 45 mil pontos do mais velho p/ o mais novo sem limite (GpsLivePublisher.cs:35,93-108) → rajada (TV passado; risco cota Supabase).
 N3 motor drena inteiro antes do GPS (MainWindow.Live.cs:721-727).
 N4 ninguém no carro vê que o ao vivo caiu (_statusCanal só na partida; erros engolidos).
 N5 gravação sobe só ao fechar (1 tentativa) ou na partida seguinte (6 rodadas).
 N6 atalhos: "AO VIVO"/vigia T4000 abrem Release ANTIGO em PRODUÇÃO; gps.cmd compila só Debug; ensaio sem trava de 2ª cópia.
 N7 25 msg/s por espectador + rajadas vs cota Supabase (plano NÃO verificado; docs/PRE_LAUNCH_CHECKLIST.md:14 = Free na criação).
CÂMERA (web/teste-aparelhos/index.html no notebook via windows/cockpit/servidor-video-local.ps1 → fam-racing.vercel.app/api/video/room):
 V1 escolherOsmo (:397-401) recusa nomes com "webcam/hd camera" → pode transmitir a câmera interna; escolha manual se perde na religação.
 V2 nada sobe sem T4000 plugada (VIGIA-T4000.ps1); abrir P1FAST-AO-VIVO.cmd à mão (= Release em produção!).
 V3 data da sala: notebook local × ponte UTC → 21h–24h salas diferentes (ps1:90 × room.js:14).
 V4 sala sem privacy, tokens livres, tokenBox is_owner, máx 4 participantes, expira 2 h ejetando todos.
 V5 sem limite de qualidade (estimativa 0,5–1,1 GB/h); daily-js sem versão fixa.
 V6 TV não tem vídeo; CORS do room.js não aceita origem da TV.

## ETAPAS (~200 mil tokens cada, em sequência)
E1 TELA HONESTA E DO TAMANHO DA TV (só _design-reference/mockup-command-box-vista-piloto.html + web/command-box/cerebro/*):
   - um dono só do selo: AO VIVO (dado ≤3 s) / ATRASADO X s (rajada/fila) / SEM SINAL há X s / AGUARDANDO O CARRO / DEMONSTRAÇÃO (só ?demo);
   - idade do dado pelo tWall (offset = mínimo de chegada−tWall numa janela) + ordem: descarta ponto mais velho que o último exibido no HUD;
     rajada → HUD/carro mostram só o mais novo, cérebro recebe tudo (rastro);
   - queda de sinal: carro congela no último ponto + marca "sem sinal", nunca relógio de demo; sats/km zeram/acinzentam;
   - nada de FAKE_LAPS/números inventados com ?canal (ou modo TV): blocos sem fonte cobertos desde o início; cabeçalho só o real;
   - import() com nova tentativa; selo "sem conexão com a nuvem";
   - modo TV: escala o quadro para preencher a tela (transform fit, preserva o layout aprovado), esconde edição/rodapé/salvar, sem reset;
   - catraca nova tests/node-smoke-tv-honesta.mjs + prova Chrome sem janela (ponte falsa, gravação 21/06, queda, rajada, ponto velho).
E2 NOTEBOOK ENVIO (C#; avisar imac-9c antes): GPS ao vivo em lote (5 pontos/msg a 5 Hz = 25 Hz de fidelidade, 5 msg/s) OU limite;
   fila ao vivo só os últimos ~10 s (atraso maior fica no disco/sessao_dumps); GPS antes do motor; letreiro de saúde do ao vivo no cockpit;
   subida da gravação com nova tentativa periódica; TV aceita o lote. Conferir cota Supabase (leitura).
E3 CÂMERA NA TV: escolha da câmera USB (nome guardado, mantém na religação), 720p ~1 Mbps, data da sala em Brasília nas 2 pontas,
   token espectador sem dono; bloco vídeo da Vista Piloto recebe só (daily-js versão fixa, sem botões, religa); ponte de sala acessível pela TV.
E4 NOTEBOOK NO DIA: atalho único "TESTE AO VIVO" (Release novo, canal de teste, trava 2ª cópia, abre vídeo + cockpit sem T4000); gps.cmd compila Release.
E5 PACOTE + ENSAIO: montar p1box com a TV nova (+ ponte de sala), PACOTE-*.md, ensaio de bancada ponta a ponta no canal de TESTE
   (simulador publica a gravação 21/06 com quedas e rajada), checklist do dia; frase MIGRAR para o Flávio.

## ANDAMENTO
- 27/10 16h28: auditoria fechada, ficha escrita, worktree criada (base 42535e946 já com o conserto da religação). Próximo: E1.
- 27/10 16h28: E1 começou só com leitura (nada editado). Pontos de entrada confirmados: .stage max 1280×720 (linhas 77-86);
  tick() da demo (linhas ~7062-7085) usa window.__cbPos.fracAt(now) e, sem posição real, volta ao relógio fictício (T1) e escreve o selo
  cb-live-selo (T2). PRÓXIMO: ler os outros 5 escritores do selo (:7744,7869,7927,8138,8189,8551), onGps do HUD (:7887-7895), camada
  modo RaceBox (:8600-8691); desenhar o "modo TV" (ligado com ?canal= ou ?tv=1): sem relógio de demo, selo com dono único, idade pelo tWall,
  escala da .stage para preencher a tela; backup do HTML em .claude-exec/backup-tv-honesta-20261027/ ANTES de editar.

## RETOMADA 1027-1629 (27/10, conversa nova após /clear)
Território reservado de novo (tv-box-aovivo-1027). Backup do HTML em .claude-exec/backup-tv-honesta-20261027/ (base 4e9b62c85).
Desenho da E1: módulo puro web/command-box/cerebro/cerebro-tv-sinal.js (idade pelo tWall, ordem, fix, estados do selo) +
"modo TV" no HTML (?tv=1 ou ?canal=; ?tv=0 desliga): selo com dono único, HUD/carro só o ponto mais novo a 5 Hz, carro congela
na queda, cobertura RaceBox desde o início, layout do arquivo (não o salvo), escala para a tela, sem barra de edição;
sem ponte → recarrega em 15 s.
- 27/10 ~17h: E1 PRONTA E PROVADA em DEV. Modo TV (?tv=1 ou ?canal=; ?tv=0 desliga) em _design-reference/mockup-command-box-vista-piloto.html
  + cérebro novo web/command-box/cerebro/cerebro-tv-sinal.js (registrado em docs/CONTRATO_DADOS.md e na trava de arquitetura).
  Provas: tests/node-smoke-tv-honesta.mjs 37/37 · smoke:arquitetura 37/37 · Chrome sem janela
  .claude-exec/prova-tv-honesta/prova-tv-honesta.mjs 32/32 (fotos tv-1920-*.png, tv-960-*.png); CONTROLE contra o backup = 26 falhas de 32.
  Fica para depois (não é E1): import() dos outros blocos sem nova tentativa → resolvido pela recarga de 15 s; texto pequeno
  da camada GPS (6 px → 9 px com a escala 1,5); "não vem do RaceBox" agora quebra linha.
  PRÓXIMO: E2 (envio do notebook, C#) — avisar a janela «P1FAST - GPS TV modo RaceBox» antes de mexer em MainWindow.Live.cs.

## RETOMADA 1027-1647 (27/10, conversa nova após /clear) — E2 em andamento
Território: reservado também windows/cockpit. Aviso à imac-9c («P1FAST - GPS TV modo RaceBox») feito; ela: sem colisão, manter
`religacao.GarantirAsync` ANTES das drenagens (mantido); conserto dela da religação = 1d7a32ffc em claude/gps-base-g-racebox-20261027
(SupabaseRealtimeChannel.cs, ReligacaoNuvem.cs, T4000Capture/Program.cs) — REBASEAR por cima depois do commit da E2.
Backup: .claude-exec/backup-e2-envio-20261027/.
FEITO (commit WIP local, sem push):
- GpsLivePublisher.cs reescrito: lote ~200 ms (topo = fix mais novo, chave aditiva "lote" = anteriores), janela ao vivo 10 s
  (ForaDoAoVivo), reenvio dos últimos 10 s quando o canal cai (conexão meio-morta, achado da imac-9c), relógio injetável.
- LivePublisher.cs (motor): janela ao vivo 10 s por chegada (ForaDoAoVivo); SEM reenvio (TV não deduplica 'sample').
- LetreiroAoVivo.cs (novo, puro) + testes.
- MainWindow.Live.cs: GPS drena antes do motor; letreiro ~1 Hz em _statusCanal; varredura de subida contínua, só com carro parado.
- web/cockpit/gps-fonte-unica.js: pontosDoGps (desmonta lote) + criarFiltroRepetidos; cloud-bridge.js usa os dois (cópias iOS idênticas);
  tools/nuvem-posicao.mjs calcula só o ponto mais novo do lote.
PROVAS: Domain.Tests 621/621 (dotnet test com DOTNET_ROLL_FORWARD=Major via ~/.claude/fila-pesada/na-fila.sh);
GpsLivePublisherTests 11/11 com 2 controles por mutação (reenvio desligado → 1 falha; janela desligada → 2 falhas);
node tests/node-smoke-gps-fonte-unica.mjs 28/28 com controle (ponte antiga → reprova).
FALTA NA E2: (1) conferência de sintaxe do MainWindow.Live.cs (WinUI não compila no Mac — Roslyn só-sintaxe ou smoke de texto);
(2) catraca de texto da E2 (tests/node-smoke-tv-envio-lote.mjs: GPS antes do motor, letreiro ligado, varredura contínua);
(3) npm run smoke:arquitetura + node tests/node-smoke-tv-honesta.mjs + prova Chrome tv-honesta com mensagens em LOTE;
(4) docs/CONTRATO_DADOS.md: chave "lote" no evento gps; (5) cota Supabase (leitura); (6) rebase em 1d7a32ffc, commit final, push;
(7) responder imac-9c que o achado do buffer foi tratado no GPS (reenvio 10 s + filtro de repetidos na TV) e no motor só a janela.

## RETOMADA 1027-1657 (27/10, conversa nova após /clear) — fechar a E2
Começo pelo FALTA NA E2 (1)→(7) acima; nada refeito. Servidor 5199 no ar (200).
- (1) Sintaxe MainWindow.Live.cs: Roslyn do SDK (csc.dll, só erros CS1xxx) = 0; controle (uma chave a menos) = 1 erro CS1513. Nomes usados conferidos por grep.
- (2) Catraca tests/node-smoke-tv-envio-lote.mjs 18/18 (5 controles por mutação); contra a base 194934a81 = 11 regras reprovam. Entrou no `npm run smoke` (+ tv-honesta).
- (3) smoke:arquitetura 37/37 · tv-honesta 37/37 · gps-fonte-unica 28/28 · gps-tv 91/91 · nuvem-posicao 7/7.
  Prova Chrome com a PONTE REAL e só o supabase-js falsificado: .claude-exec/prova-tv-honesta/prova-tv-lote.mjs 13/13
  (50 msgs em lote → 250 pontos; reenvio de 10 s → 250 repetidos descartados, só os 75 novos; Cockpit antigo segue).
  CONTROLE com a ponte de 194934a81: 3 falhas (só 50 de 250 pontos; repetidos passam).
- (4) docs/CONTRATO_DADOS.md: parágrafo "Lote" no evento gps.
- (5) Cota: organização do p1-fast está no plano PRO (GET api.supabase.com/v1/organizations, 27/10; o checklist dizia Free).
  Doc oficial: Pro = 500 conexões, 500 msg/s, 5 M msg/mês incluídas, US$ 2,50/milhão extra; broadcast conta 1 envio + 1 por receptor.
  ESTIMATIVA com 2 espectadores (TV + 1 celular): antes 30 msg/s enviadas → 90 contadas/s ≈ 324 mil/h; agora 10 → 30/s ≈ 108 mil/h
  (≈ 46 h de ao vivo/mês dentro do incluído; excedente ≈ US$ 0,27/h).
- PEDIDO NOVO DELE (27/10 ~17h20, no meio da E2): "trail braking, freio, aceleração, tempo de volta, quantidade de voltas, comparativos
  de gráfico de frenagem e aceleração, etc. tudo dá para ver no tv box a partir do gps." → a E1 cobriu como "não vem do RaceBox" todo
  bloco fora de mapa/hud/header; isso está ERRADO para os blocos que o GPS alimenta. Nova etapa E2b (antes da câmera): mapear bloco a
  bloco da Vista Piloto o que sai do GPS (gLong/gLat/kmh/posição → freio, aceleração, trail, voltas, tempos, gráficos) e ligar pelo
  cérebro (cerebro-gps-tv.js / frenagem-real / forma-trail-tipo), cobrindo só o que depende do motor (rpm, temperatura etc.).

## E2 PRONTA (27/10 ~17h40) — branch claude/tv-box-aovivo-e2-20261027 no GitHub (rebase em 1d7a32ffc; antiga intocada: push com sobrescrita barrado)
Provas pós-rebase: Domain.Tests 625/625 · tv-envio-lote 18/18 · tv-honesta 37/37 · gps-fonte-unica 28/28 · gps-tv 91/91 · nuvem-posicao 7/7 ·
arquitetura 37/37 · prova-tv-lote 13/13 · prova-tv-honesta 32/32 · sintaxe MainWindow.Live.cs 0. imac-9c avisada (SendMessage).

## E2b EM ANDAMENTO — blocos da TV pelo GPS (pedido dele 27/10 ~17h20). Mapa: .claude-exec/e2b-mapa-blocos-gps-20261027.md
FEITO (commit local 65c468a01, sem push): casa nova web/command-box/cerebro/cerebro-tv-blocos-gps.js (stint, deltaAcum, curva{passagem, frenagem pelo
G MEDIDO, vmin}, coach) + catraca tests/node-smoke-tv-blocos-gps.mjs 24/24 (achou e corrigiu: "soltou" media desde o 1º ponto do pico).
PRÓXIMO: (1) registrar a casa em docs/CONTRATO_DADOS.md e na trava tests/node-smoke-arquitetura-dado.mjs; catraca no `npm run smoke`;
(2) TV: camada TV-GPS cria o cerebro-gps-tv com guardarVoltas:true e passa o snapshot à casa nova (4 Hz); DO_RACEBOX ganha passagem,
frenagem, vmin, stint, stint-bar, delta-acum, coach; pintar cada bloco com o pacote (campos sem fonte = "—": PB histórico, plano, nota,
preditivo, pneu); desligar massa de maio/FAKE_LAPS nesses blocos no modo TV; rodapé da frenagem "G medido pelo RaceBox";
(3) prova Chrome: replay 21/06 com G pela física via ponte falsa (lote) → blocos com número real; controle = backup do HTML;
(4) commit + push na branch -e2-. Depois E3 câmera, E4 atalho, E5 pacote.

## RETOMADA 1027-1718 (27/10, conversa nova após /clear) — continuar a E2b
Estado conferido: commit local 65c468a01 (casa cerebro-tv-blocos-gps.js + catraca 24/24), servidor 5199 no ar (200), território
tv-box-aovivo-1027 nesta janela (ttys019). Seguir: contrato + trava de arquitetura + smoke → ligar na TV → prova Chrome → push.
### E2b — TV LIGADA (27/10, conversa 1027-1718) — commit local, SEM push
FEITO: contrato (docs/CONTRATO_DADOS.md) + trava de arquitetura 38/38 (era 37) + catraca no `npm run smoke` (smoke:tv-blocos-gps).
TV (backup .claude-exec/backup-e2b-20261027/): camada TV-GPS cria o cérebro com guardarVoltas e monta window.__tvGps.blocos a 4 Hz;
DO_RACEBOX ganhou stint, stint-bar, delta-acum, passagem, frenagem, vmin, coach; camada nova "BLOCOS DO GPS NA TV" pinta (.tvb por cima,
demo escondida; MutationObserver por bloco devolve a camada quando a demo reescreve). Casa: vírgula pt-BR nas frases do coach (catraca 25/25,
controle com a versão de antes reprova).
PROVAS: prova-tv-blocos-gps 23/23 (controle com o HTML de antes reprova) · prova-tv-honesta 32/32 · prova-tv-lote 13/13 6× seguidas ·
tv-honesta 37 · tv-envio-lote 18 · gps-tv 91 · gps-fonte-unica 28 · arquitetura 38 · trechos-volta 24.
TRIAGEM (3 reprovações, todas régua): (1) honesta A: lista à mão da regra antiga → agora nasce da página (.tvb); (2) lote: lia o velocímetro
exatamente 1 período (200 ms) depois do último envio → +250 ms (e −250 ms no "6 s sem mensagem"); perfilador: carga igual antes × agora,
0 tarefas longas; (3) blocos: maiúsculas do innerText e Δ com 2 dígitos.
ACHADO NÃO MEU (já falhava em a0d2be2dd): pagina-volta 45/1 — "iPhone: os 15 arquivos da página têm cópia idêntica no app:
web/cockpit/gps-fonte-unica.js" → a E2 mudou gps-fonte-unica.js e a cópia do app iPhone ficou velha. CONFERIR E CORRIGIR (próximo passo 1).
Artefato do teste (não do sistema): "acel. +7,87 G" na foto vem do G montado pela física na gravação 21/06 (sem G real).
PRÓXIMO: (1) pagina-volta: achar a cópia do iPhone de gps-fonte-unica.js e igualar (ver o teste); (2) `npm run smoke` inteiro;
(3) commit + push na branch claude/tv-box-aovivo-e2-20261027; (4) responder imac-9c (3 recados: rua offline 240 s; troca 1 religou com
perda 6,7 s = reenvio da E2 tem valor; ensaio 30 min: teto 720p ~1 Mbps é item 1, sala expira 2 h → renovar na E3, Windows pode dormir);
(5) E3 câmera (incluir: teto de vídeo, renovar sala, impedir o Windows de dormir — SetThreadExecutionState).
