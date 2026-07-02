# AUDITORIA DO .EXE DO COCKPIT DO PILOTO — 2026-07-02

> Auditoria multi-agente (8 dimensões × achar → verificar adversarialmente → sintetizar), 41 agentes.
> 31 achados brutos → **23 confirmados/plausíveis** (7 high · 8 medium · 6 low · 2 hardware-pending · 0 blocker).
> Fonte de requisitos: `docs/COCKPIT_FONTE_DA_VERDADE.md`. Nenhum conserto abaixo exige, por si, mexer na tela aprovada.

## 1. Veredicto

O .exe **ainda não está pronto pra rodar 100% conforme os requisitos** — mas está perto, e **nenhuma falha viva corrompe o dado cru gravado** (o `.jsonl` é append-only e sobrevive à queda; a fonte da verdade local está protegida). O que falta se concentra em três frentes:
- **(a) Durabilidade ponta-a-ponta:** grava à prova de queda, mas depois de uma queda a sessão órfã nunca é recuperada nem sobe pra nuvem → o app/Command Box não recebem o que foi gravado.
- **(b) Honestidade da tela crítica:** um alerta GRAVE congela na tela quando o motor emudece; a perda de gravação em disco é silenciosa. Ambos violam a regra dura "nunca mostrar dado velho/errado ao piloto".
- **(c) Precisão do cérebro:** o GPS ao vivo entra **sem** o filtro de qualidade (hacc<50 m + caixa de Brasília + decimação por movimento) que o pipeline provado aplica; e o coach de saída de curva está morto. Curva/ápice/freada/frase podem sair errados.

Depois dos consertos de código, resta **validação de campo com T4000/RaceBox reais energizados** — que nunca aconteceu.

## 2. Falhas por severidade

### BLOCKER — nenhuma
Todas as candidatas foram rebaixadas na verificação: o dado cru é preservado em disco. O que quebra é recuperação, visibilidade ou precisão — não a integridade da fonte da verdade.

### HIGH

- **H1 — Sessão órfã de queda nunca é recuperada nem sobe pra nuvem.** `MainWindow.Live.cs:100` (+ `PendenciasUpload.cs:45`, `SessionRecorder.cs:358`). O `--live` cria o `SessionRecorder` mas **nunca chama `RecuperarOrfas()`** (só o console dev chama). Sessão interrompida fica `Status="gravando"` pra sempre; o upload só pega `"encerrada"` → nunca sobe. **Quebra §3.** Fix: chamar `RecuperarOrfas()` no boot do `--live` ANTES de qualquer amostra **+** aceitar `"interrompida"` como elegível pra upload. _(É o mesmo defeito da "interrompida nunca sobe", `PendenciasUpload.cs:45`.)_

- **H2 — Alerta crítico congela na tela quando o motor emudece.** `MainWindow.Live.cs:419`. A mensagem GRAVE só é reavaliada dentro de `IngestMotor` (por amostra de motor). Se o cabo USB solta com um GRAVE ativo, os LEDs apagam em ~3 s (certo) mas a **faixa GRAVE fica na tela indefinidamente** — e mantém o modo crítico da luz de freio (`CockpitOrchestrator.cs:101`). **Quebra §4/§9** ("nunca dado velho/errado"). Fix: na vigia ~1 Hz, quando `TickCount64 - _ultimoMotorTick >= 3000`, expirar o motor / levantar `SEM_DADOS` e limpar os automáticos.

- **H3 — GPS ao vivo entra sem filtro de qualidade.** `MainWindow.Live.cs:431`. O ao vivo filtra só `fix>=3`; **não aplica `hacc<50 m` nem a caixa de Brasília** que o pipeline provado (`SessaoReplay.Carregar`) exige. Um `fix=3` com `hacc>=50 m` (comum no início/obstrução) vai direto pro cérebro → **curva falsa, bolinha deslocada, ponto de freada errado**. **Quebra §4.** Fix: aplicar a MESMA guarda do replay antes do `IngestGps` (grava TODOS os fixes no disco; só o cérebro recebe filtrados).

- **H4 — Sub-trecho "saída"/"pace" morto (coach de saída errado).** `CockpitOrchestrator.cs:130`. `_subAtual` só assume `entrada`/`freio`/`apice`; no `saida-cruzou` a passagem fecha **sem re-etiquetar** os pontos pós-ápice como `saida`. A perda na SAÍDA é somada ao bucket `apice`, o ramo `saida => AcelerouTarde` (`DeltaCoach.cs:173`) é código morto → o piloto recebe "VIROU CEDO/TARDE" em vez de "ACELEROU TARDE". Número/halo do delta continuam certos. **Quebra §4.** Fix: portar o retag do web (`retagSubsPorEventos`/`acharVminBuffer`, "conserto 11/06").

- **H5 — RaceBox: disconnect de device fantasma derruba GPS saudável.** `RaceBoxBleReader.cs:116`. `OnConnChanged` **não compara** o `dev` do evento com `_device`; o handler é assinado a cada religação (`:98`) e nunca removido; `_device` é sobrescrito sem `Dispose` (`:97`). Um device velho sinalizando `Disconnected` zera o `_rx` de uma conexão **já boa** → GPS cai sozinho. **Quebra §4.** Fix: `if (!ReferenceEquals(dev, _device)) return;` no topo; e desinscrever+`Dispose` do anterior antes de sobrescrever.

- **H6 — Perda de gravação em disco é silenciosa.** `MainWindow.Live.cs:220`. A vigia chama `Tick()` e **descarta o retorno**; nada lê `SessionEstado.Alarme` (`parada-armazenamento`/`perdendo-amostras`). Disco cheio/morto na pista → alarme dispara no Domain e o .exe engole. **Quebra o contrato "perda NUNCA silenciosa"** (ADR-003/004). Fix: ler `Estado().Alarme` na vigia e mostrar aviso não-destrutivo em `StatusText`.

### MEDIUM

- **M1 — Alertas operacionais nunca sobem ao piloto (SEM_DADOS, SEM_GPS, BOX, ÚLTIMA_VOLTA).** `AlertasCriticos.cs:177`. O port C# abandonou as avaliadoras automáticas do JS; `RaiseManual`/`ClearManual` só têm chamador em teste. Essas 4 mensagens estão mortas na pista. (A regra de segurança — sensor ausente não dispara falso — segue OK; a falha é o oposto.) Fix: wire-up no live (SEM_GPS/SEM_DADOS por recência; BOX quando a captura auto está em espera).

- **M2 — Frase do ápice usa ângulo do momento errado.** `CockpitOrchestrator.cs:202`. `ClassificarApice` lê o ângulo da bolinha AO VIVO no fechamento (perto da saída), não o capturado no cruzamento do ápice (`AtualizarBolinha` sobrescreve a cada amostra) → frase errada (tende a VIROU TARDE). Fix: guardar `AngleFromIdealDeg` do evento `apice-cruzou` e usar esse no `ContextoApice`.

- **M3 — Mistura lida como 0 pode disparar MISTURA RICA falso.** `AlertasCriticos.cs:138` (+ `T3000RIBlockParser.cs:200`). Com a sonda WB ausente, `Lambda=0.0` (não-nulável); o guard `is { } lambda` não protege (0.0 ≠ null); sob carga `0.0 < 0.80` → alerta sem sonda. **Quebra §4/§9** (condicionado à sonda cair; é port fiel do JS). Fix: mapear `lambdaWBRaw==0` (ou fora de 0.3–1.6) → `null` e propagar `Lambda` como `double?`.

- **M4 — Warn de mistura/bateria sem gate "sob carga" no cluster.** `MainWindow.Replay.cs:236`. `AtualizarSensores` pinta Lambda/Bateria de amarelo por limiar cru, sem o gate `rpm>=3000 || tps>=15`. Em marcha lenta dá warning visual falso (só o ícone; a mensagem grande usa `AlertasCriticos`, correta). Vale replay E live. Fix: aplicar `sobCarga` só no warn de Lambda/Bateria; Água/Alarme sem gate.

- **M5 — Captura automática por movimento não está ligada no .exe.** `MainWindow.Live.cs:100`. O `SessionRecorder` é criado **sem `AutoCaptura`** → só fecha por 8 s de silêncio total; com o motor em marcha lenta no box a sessão nunca fecha por "parado" (junta box+pista+box). Não perde dado cru. Fix: passar `AutoCaptura(VOn,VOff,ParadoMs)` (a peça existe e é testada) OU registrar a decisão de manter por-silêncio.

- **M6 — Teardown do `--live` pode não rodar numa corrida de boot.** `MainWindow.Live.cs:93`. `this.Closed += StopLive` é registrado DENTRO de `IniciarLive` (assíncrono, pós-`Task.Run`). Se a janela fechar antes, `StopLive` nunca roda: threads seguem vivas, sessão fica órfã, upload de fim não dispara. Fix: assinar `Closed` no início de `StartLive` (thread da UI), ANTES do trabalho em fundo, + flag `_liveParado`.

### LOW
- **L1** — Resultado da freada pode não fechar por chave divergente (`_onset` indexado por curva-mais-próxima vs segId do detector; pares de ápices <220 m em Brasília). `LuzFreio.cs:119`. Retorno seguro (some da tela), sem dado errado.
- **L2** — Heading do pacote RaceBox descartado → ângulo do ápice sempre por 2 posições (mais ruidoso). `RaceBoxBleReader.cs:167`. Mesma limitação do web.
- **L3** — Contingência COM do motor resolvida 1× no boot, nunca re-resolvida. `MainWindow.Live.cs:159`. Baixo: a T4000 real fala WinUSB (re-checado ao vivo).
- **L4** — Trava de produção estoura exceção não-tratada na ferramenta de captura (`--canal=cockpit-bubi-live` sem `--producao`). `T4000Capture/Program.cs:251`. Não vaza dado; o .exe não tem esse furo.
- **L5** — Reconexão da nuvem vaza `CancellationTokenSource` (`Cancel()` sem `Dispose()`). `SupabaseRealtimeChannel.cs:63`.
- **L6** — Ponte de alertas divergente no caminho morto `CapturaDiaDePista.cs:48` (não seta combustível; comentário obsoleto). Trap de manutenção, não falha viva.

### HARDWARE-PENDING (só a pista fecha)
- **HW1 — Handshake WinUSB do motor com timeout de 150 ms.** `T3000UsbLiveReader.cs:130` faz UMA leitura do "OK" com pipe timeout 150 ms (`WinUsbT3000Channel:38`); o web provado usa `transferIn` bloqueante que nunca expira. Se o ACK da Injepro chegar >150 ms pós-open, o handshake reprova e o supervisor reabre em loop. Latência real de ACK **desconhecida**. Mitigação opcional já hoje: reler em laço curto (~1–2 s) antes de reprovar. **Confirmar na bancada.**
- **HW2 — Produção ao vivo do .exe nunca exercitada ponta-a-ponta.** `MainWindow.Live.cs:117`. O caminho `--producao` está correto e testado, mas produção (`cockpit-bubi-live`) nunca recebeu publish ao vivo do .exe. Sem código a mexer. **Validar na pista** com app/Box no mesmo canal + queda/retomada de rede.

## 3. Risco meta (crítico de completude) — o mais importante

**O replay é a régua do projeto, mas roda um pipeline DIFERENTE do ao vivo.** `SessaoReplay.Carregar` (`SessaoReplay.cs:82-129`) aplica **`fix>=3` + `hacc<50` + caixa de Brasília + decimação por movimento (>=3 m)** antes de entregar ao maestro; o ao vivo (`MainWindow.Live.cs:431`) entrega tudo com `fix>=3`, cru. Consequência: **"verde no replay" NÃO cobre o ao vivo** — tudo que depende de densidade/qualidade do GPS está validado numa pipeline que não é a de produção.

Riscos que decorrem disso (mais grave primeiro):
1. **[validação] O replay não exerce a pipeline do ao vivo** — H3 é estrutural, não esquecimento. Correção real: filtro+decimação num **helper único** que replay e live compartilhem, e re-rodar o replay contra ele.
2. **[alto] Jitter de carro PARADO gera curva/ápice falsos no ao vivo** (decorre do #1; o próprio `SessaoReplay` decima por isso).
3. **[alto] Janela de deceleração da freada a 25 Hz cru** cobre ~0,2 s — o limiar −0,5 G pode disparar errado/não disparar; o replay (decimado) nunca exercita. `TrechoDetector.cs:126-134` + `FreadaJanela=5`.
4. **[médio] Caminho `HeadingDeg != null` nunca validado** (replay E live hoje descartam heading; se o RaceBox passar a preencher, entra cru).
5. **[médio] `IniciarFeedReal(segs)` recebe vazio se o arquivo de Brasília não for achado** (`.exe` empacotado fora da árvore do repo) → cockpit **sem curva/ápice/freada/delta, em silêncio** (`catch{}` mudo em `StartLive:66-74`). Validar `ResolveRepoRoot` no diretório de instalação real.
6. **[médio] Threading não é exercitado por nenhum teste** (o replay roda single-thread na UI); toda a Fase 1 de threading está sem cobertura que a exercite.

## 4. Ordem de ataque recomendada
- **Bloco 1 — durabilidade ponta-a-ponta:** H1 (`RecuperarOrfas` no boot + aceitar "interrompida") + M6 (assinar `Closed` cedo + flag).
- **Bloco 2 — honestidade da tela crítica:** H2 (expirar motor no silêncio) + H6 (mostrar `Alarme`) + M1 (SEM_DADOS/SEM_GPS automáticos).
- **Bloco 3 — precisão do cérebro:** H3 (filtro GPS num helper único replay↔live) + H5 (guarda BLE) + H4 (retag saída/pace) + M2 (congelar ângulo do ápice).
- **Bloco 4 — falsos-positivos e segmentação:** M3 + M4 (lambda=0→null, gate sob carga) + M5 (AutoCaptura ou registrar decisão).
- **Bloco 5 — limpezas:** L1–L6.
- **Depois:** validação de campo HW1 (bancada) + HW2 (`--producao` na pista). Sem isso, "100%" não é declarável.

## 5. Anexo — gaps de paridade web × C# (frente do iMac, autorizados pelo Flávio 02/07)
Auditoria de paridade do iMac (`msg 20260702T193928Z`), decisões do Flávio:
- **Gap 1 — Vmin na tela do piloto:** Flávio **AUTORIZOU** (reabre a regra §4/§9 "Sem Vmin no painel do piloto" — atualizar a fonte da verdade ao implementar). Célula Vmin entre Freio e Ápice, verde/vermelho vs melhor histórica; aceitar papel `vmin` em `CockpitState.cs:236`.
- **Gaps 5 (bolinha do ápice, visual) + 6 (modo crítico central+borda):** Flávio **AUTORIZOU** mexer na `MainWindow.xaml`.
- **Gaps 2 (reação da marcha), 3 (reação do freio), 4 (3 modos da luz):** Flávio **AUTORIZOU** portar (lógica Domain). Ampliar `CockpitStateParidadeTests.cs` (PAR_01..13) com 1 teste por item.
