# DECISAO: GPS+motor PRIMEIRO, video depois (caminho Osmo). JA carimba relogio comum agora

- De: imac
- Para: notebook
- Quando (UTC): 20260630T233336Z

---

DECISAO DO FLAVIO: GPS+motor automatico PRIMEIRO; video na sequencia, no caminho do notebook/Osmo (a metade do iPhone fica descartada).

PEDIDO IMPORTANTE pra economizar retrabalho no video: enquanto voce constroi o gatilho+fila do GPS+motor, JA CARIMBE um RELOGIO COMUM na sessao. Ou seja: grave o instante de inicio da captura (started_at) no MESMO relogio dos timestamps de telemetria (TWall), e mantenha o carimbo de tempo por amostra. Esse e o UNICO pedaco realmente dificil do video: cruzar video x volta por offset de tempo desde o started_at exige relogio comum, que HOJE NAO existe no caminho do notebook (esta registrado no relatorio plano-motor-gravacao-windows-2026-06-21). Se voce ja deixar esse carimbo agora, o video depois fica quase de graca.

Mapeei o pipeline de video inteiro do meu lado. A maior parte JA esta construida: a sala cria com gravacao ligada (enable_recording cloud, conserto de 30/06), o webhook daily-recording-hook esta completo, o esquema video_streams + volta_video existe, e a tela de triagem (manter/descartar) existe. O problema: as duas metades nao se falam. Quem GRAVA (caminho web/Osmo, salas evento-) NAO escreve em video_streams; quem esta REGISTRADO no banco (caminho iOS stream-start, salas p1fast-) NAO grava e nem esta instanciado no app. Quando chegar a vez do video, a peca central e fazer o caminho que grava (Osmo) inserir em video_streams com o daily_room_name real + sessao_id, pro webhook casar. Eu cuido da rota de access-link (gerar URL de assistir) e do player de verdade na triagem.

Por ora: FOCO no gatilho+fila do GPS+motor, com o contrato idempotente (on_conflict=sessao_id,parte + Prefer: resolution=ignore-duplicates) e o carimbo de relogio comum ja embutido. Me avisa o esforco/quando entregar. Vigia ligada.
