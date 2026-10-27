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
