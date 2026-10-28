# Contrato de Dados — UMA entrada, UM cérebro, todos consomem

**Este é o registro único da arquitetura do dado do P1 Fast.** Vale para o Command Box,
o cockpit do app e qualquer tela que mostre dado da pista.

Regra de ouro (Flávio, 2026-06-23 — alinhada a `docs/ARQUITETURA_DEFINITIVA.md`):
**o dado parte de um lugar só, é processado num lugar só, e as telas só EXIBEM o resultado pronto.**
Nenhuma tela conecta na nuvem por conta própria. Nenhuma tela refaz uma conta que já existe.
Garantia mecânica: `tests/node-smoke-arquitetura-dado.mjs` (roda em `npm run smoke`) reprova quem furar.

---

## 1. A ENTRADA (uma só)

| O quê | Onde |
|---|---|
| Canal ao vivo (vindo do notebook do carro) | `cockpit-bubi-live` (Supabase Realtime) |
| Ponte única (a ÚNICA que toca o canal) | `web/cockpit/cloud-bridge.js` |
| Cópia embarcada no app iOS | `ios/p1fast-ios/Resources/Cockpit/cloud-bridge.js` (espelho da de cima) |

**Quem consome o canal usa a ponte** — `import` de `cloud-bridge.js` e os ganchos
`onSample()` / `onGpsPoint()` / `startCloudBridge()`. **Proibido** `createClient(...)` numa tela.

### Contrato de campos que trafegam (definido em `cloud-bridge.js` → `stripSample`)
Motor: `rpm`, `batteryV`, `mapBar`, `tpsPct`, `airTempC`, `waterTempC`, **`lambda`** (banda larga),
`mapaAtual`, `consumoBorboleta`.
Pilotagem: `pedalAceleradorPct`, `pedalFreioPct`, `pressaoFreioBar`, `speedKmh`, `accelXg/Yg/Zg`.
Cilindros: `fuelInjectionBalanced`, `fuelInjectionSpread`, `fuelTimeA`.
Status: `alarmes`, `statusSinais`, `cronometroParcialS`, `cronometroTotalS`.
GPS (evento `gps`): `lat`, `lng`, `kmh`, `tWall` (+ `numSV`, `fix`, `accM`, `gx/gy/gz`, `source`).
G do carro no mesmo evento `gps` (item 5, 27/10/2026): `gLong` (+ acelera / − freia), `gLat` (lateral),
`zeroOk` (zero do box valendo). Calculados UMA vez no notebook pela peça `AceleracaoCarro.Converter`
(zero + eixos provados; não aprende de novo) — nenhuma tela recalcula G a partir de `gx/gy/gz`.
`gVert` (item 7, 27/10/2026): G vertical (+ para cima, sem a gravidade = gz − zero de gz da mesma parada;
1 G nominal até a 1ª parada) — mesma peça, mesmo evento, também gravado no `.jsonl`; `null` sem gz.
`giroZ` (item 9, 27/10/2026): giro do aparelho em torno do eixo vertical (°/s, CRU do RaceBox; o sinal depende
da montagem e é aprendido em curva pelo cérebro) — mesmo evento, também no `.jsonl`. Offset no pacote vem da
documentação e ainda NÃO foi conferido em gravação (conferir pela 1ª gravação com `rawHex`).
**Fonte única de posição = RaceBox** (publicado pelo Cockpit com `source: 'racebox'`; Flávio 27/10/2026,
painel `p1fast-gps-fonte-unica-0911` = C). O iPhone não publica mais `gps`; ponto `source: 'iphone…'`
é descartado na ponte (`web/cockpit/gps-fonte-unica.js`, catraca `tests/node-smoke-gps-fonte-unica.mjs`).
**Lote** (E2 da obra TV do box ao vivo, 27/10/2026): o Cockpit publica 1 mensagem `gps` a cada ~200 ms (5/s, contra a cota do Supabase). O TOPO é o fix mais novo, com as chaves acima (consumidor antigo vê 5 Hz e não quebra); a chave aditiva `lote` = lista dos fixes anteriores do intervalo, em ordem de tempo (fidelidade 25 Hz). Só a ponte desmonta (`pontosDoGps`) e entrega ponto a ponto a cada ouvinte; reenvio do Cockpit depois de queda repete pontos — a ponte descarta o repetido pelo `tWall` (`criarFiltroRepetidos`). O ao vivo leva só os últimos ~10 s; o passado sobe pela gravação (`sessao_dumps`). Provas: `GpsLivePublisherTests`, `tests/node-smoke-tv-envio-lote.mjs`, `tests/node-smoke-gps-fonte-unica.mjs`.

> Se um dado NÃO está nesta lista, o carro não transmite hoje → nenhuma tela pode mostrá-lo
> como real (ex.: temperatura de pneu, curso de amortecedor — sensor não existe).

---

## 2. O CÉREBRO (uma casa por conta)

Cada cálculo tem UMA casa. Telas usam a casa; **proibido** recriar a conta dentro da tela.

| Conta | Casa única (arquivo) |
|---|---|
| Caminho ao vivo (canal → pacote pronto) | `web/command-box/cerebro/cerebro-vivo.js` |
| Consolidação do painel (PainelPronto) | `web/command-box/cerebro/cerebro-painel.js` |
| Velocidade | `web/command-box/cerebro/cerebro-velocidade.js` |
| Coach (lições) | `web/command-box/cerebro/cerebro-coach.js` |
| Alerta preditivo (temperatura) | `web/command-box/cerebro/cerebro-preditivo.js` |
| Chegada / linha por GPS | `web/command-box/cerebro/chegada-gps.js` |
| TV do box: mapa com km/h e G, círculo de G, voltas e setores (item 5 do GPS); pancadas, lugares repetidos e consistência das voltas (item 7); km rodados na sessão (`kmSessao`, odômetro do velocímetro — a camada RaceBox não soma mais distância) e o km/h do velocímetro na TV (`agora.kmh`), 28/10 | `web/command-box/cerebro/cerebro-gps-tv.js` |
| TV do box: o selo AO VIVO / ATRASADO / SEM SINAL / AGUARDANDO / SEM CONEXÃO (idade do dado pelo carimbo tWall, ordem, fix ≥ 3; E1 da obra TV do box ao vivo, 27/10) — a TV só pinta o estado | `web/command-box/cerebro/cerebro-tv-sinal.js` |
| TV do box: blocos que saem do GPS — stint (voltas, tempos, melhor, média), Δ acumulado contra a melhor da sessão, curva da vez (passagem entrada/mínima/saída × melhor passagem, frenagem pelo G MEDIDO do RaceBox: início da freada, pico, trail na mínima, soltou progressivo/de uma vez, retomada; vmin × distância) e coach pela maior perda (E2b da obra TV do box ao vivo, 27/10) — a TV só pinta o pacote; o que não sai do GPS (recorde histórico, pneu, preditivo) fica "—"; 28/10: `faixa` = a volta INTEIRA por posição (G atual × melhor — medido com o zero do box nas duas, senão o G das duas pela velocidade do GPS, fonte escrita na tela —, Δ de tempo por posição, cursor, curvas) e `plano` = plano do stint aprovado no celular × voltas feitas (plano de outro dia só como "último plano, de <dia>"); stint ganhou `idealS`, `voltas[].ultima/descarte`. Catraca `tests/node-smoke-tv-faixa-volta.mjs`; 28/10 (tarde): `quadro` = quadro de curvas da TV (por curva: MELHOR passagem × ÚLTIMA passagem × diferença em entrada/freada/mínima/saída/tempo, curva em curso com o progresso e a trilha acelera/freia, soma das diferenças e ideal pelos trechos), lido de `voltaAtual.trechos` do cérebro do GPS. Catraca `tests/node-smoke-tv-quadro-curvas.mjs` | `web/command-box/cerebro/cerebro-tv-blocos-gps.js` |
| Leitura do último plano do stint do carro (com o dia, fuso de Brasília; só leitura de `envelopes_seguranca_stint`) — TV lê a cada 60 s | `web/cockpit/treino-stint.js` → `lerUltimoPlanoStint` |
| TV do box: câmera do carro ao vivo (E3 da obra TV do box ao vivo, 27/10) — o vídeo NÃO passa pelo canal `cockpit-bubi-live`: a TV pede a sala do dia à ponte do próprio site (`/api/room`, papel `tv` = só assiste, sem acesso do piloto), escolhe a trilha do carro e pinta o selo CÂMERA AO VIVO / SEM VÍDEO HÁ X / AGUARDANDO A CÂMERA / SEM CONEXÃO (ao vivo só com quadro novo ≤ 3 s), religa 3→60 s e renova a sala a cada 30 min; biblioteca Daily com versão fixa e selo de integridade (fonte: `DAILY_JS`). Catraca `tests/node-smoke-tv-video.mjs` | `web/command-box/video-tv.js` |
| Página da volta e comparação entre 2 voltas no celular (item 6 do GPS; volta/setor vêm da MESMA peça da TV) | `web/command-box/cerebro/cerebro-pagina-volta.js` |
| Troca de marcha PROVÁVEL pelo G longitudinal (item 8 do GPS; critério da análise de 27/10, em fluxo; só com zero do box; a TV recebe por volta `trocas`/`trocaBuracoMedioS` e `s.trocas` do cérebro da TV) | `web/command-box/cerebro/troca-marcha-g.js` |
| Traseira saiu PROVÁVEL pelo giro (item 9 do GPS; giro do carro acima do que a curva explica = G lateral ÷ velocidade; sinal aprendido em curva; só com zero do box; a TV recebe por volta `traseira`/`traseiraMaxDps` e `s.traseira` do cérebro da TV; saída de FRENTE não se mede sem ângulo do volante) | `web/command-box/cerebro/traseira-giro.js` |
| Frenagem | `web/command-box/frenagem-real.js` · `frenagem-curvas-reais.js` |
| Passagem (tempo por trecho) | `web/command-box/passagem-real.js` · `passagem-curvas-reais.js` |
| Mínima de curva (vmin) | `web/command-box/vmin-curvas-reais.js` · `vmin-aprendizado.js` |
| Marcha | `web/command-box/marcha-real.js` |
| Forma do trail por tipo de curva | `web/command-box/forma-trail-tipo.js` |
| Traçado da pista | `web/command-box/pista-cb-polyline.js` |
| Tipos de curva de Brasília | `web/command-box/tipos-curva-brasilia.js` |

> Hoje esses módulos ainda rodam no navegador da tela. O passo DEFINITIVO é hospedá-los como
> serviço na nuvem (a TV/celular só exibem). A casa de cada conta é a MESMA nos dois cenários —
> por isso o cérebro é escrito como módulo puro "dado entra → pacote pronto sai".

---

## 3. AS TELAS (só exibem)

Telas cobertas pela trava (lista `TELAS` em `tests/node-smoke-arquitetura-dado.mjs`):
Vista Piloto, Vista Engenheiro, Engenharia Lambda, Engenharia PAce, Engenharia Motor-Saúde,
Engenharia Saúde-do-Carro, Cockpit do app (iOS), Checar-antes-de-rodar, Página da volta do celular
(`web/volta/pagina-volta.html` e a cópia idêntica do app iOS).

Cada tela: **lê o pacote do cérebro**. Não conecta. Não calcula. Não inventa dado.

---

## 4. DÍVIDA LEGADA (a migrar — o baseline só encolhe)

Estado em 2026-06-23 (medido no código):

| Tela | Dívida | A fazer |
|---|---|---|
| Vista Piloto | ~~conexão própria (2x)~~ **QUITADA 23/06** (usa a ponte única) · resta: dado fictício (preview-local, FAKE_LAPS) | trocar o feed de demonstração por dado real/cérebro |
| Vista Engenheiro | dado fictício (FAKE_LAPS, 3 voltas em loop) | ligar no cérebro/pacote pronto |

Quando uma dessas for limpa, **remover do `BASELINE`** em `node-smoke-arquitetura-dado.mjs`.
A trava avisa quando uma linha do baseline já pode ser removida.

---

## 5. COMO A TRAVA GARANTE (mecânico, não promessa)

`npm run smoke:arquitetura` (e `npm run smoke`) reprova a entrega se:
1. uma tela abrir conexão própria (`createClient`) fora da ponte;
2. uma tela usar dado fictício (`preview-local`, `FAKE_LAPS`) fora do baseline;
3. uma tela nova do Command Box aparecer com conexão/feed falso sem registro;
4. este registro sumir ou perder a citação da fonte única;
5. uma casa-de-conta do cérebro deixar de existir.

Ficou vermelho = não entra. É a catraca: só aperta, nunca afrouxa.

---

## 6. O ARQUIVO DURÁVEL (à parte do ao-vivo — pro app estudar TODAS as voltas)

A nuvem tem **dois papéis** (`docs/ARQUITETURA_DEFINITIVA.md` §3, `PLANO_ENVIO_DADOS_NUVEM.md`):
o **barramento ao vivo** (seções 1-3 acima, efêmero) **e** a **guarda do arquivo completo**
(durável, pro app rodar as contas sobre o conjunto inteiro). São coisas separadas — o arquivo
durável **NÃO** é um 2º feed ao vivo nem uma 2ª conexão de tela.

| O quê | Onde | Estado |
|---|---|---|
| GPS ao vivo SEM perder fix (fila + reenvio) | `GpsLivePublisher` (espelha o motor) | ✅ Parte A feita (2026-06-30) |
| Upload da gravação `.jsonl` completa | `p1fast-upload` → tabela `sessao_dumps` | ✅ Parte B (produtor) |
| Disparo automático no fim da sessão | `MainWindow.Live.cs` `StopLive` (processo destacado, só `--producao`) | ✅ §7.4 feito (2026-06-30) |
| Consumidor: lê o dump → calcula → grava | nuvem (iMac): `cerebro-coach vminKmh` → `segment_executions.vmin_*` / `padroes_telemetria_por_volta` | ⏳ lado do iMac |
| Porta ÚNICA de leitura do arquivo (GET com a chave pública, sessão inteira ou erro) | `web/cockpit/arquivo-sessoes.js` | ✅ item 6 do GPS (27/10/2026) |

**Regra que NÃO muda:** as telas continuam só EXIBINDO (seção 3). O arquivo durável é lido pelo
**consumidor da nuvem** (não por uma tela), que grava o resultado nas tabelas que já existem; a tela
do app lê o **resultado pronto**. O uploader sobe **RAW** (fidelidade total); a nuvem normaliza/calcula.
**Exceção registrada (item 6 do GPS, 27/10/2026):** a página da volta do celular
(`web/volta/pagina-volta.html`) ainda lê o arquivo pela porta única `arquivo-sessoes.js` e roda o
cérebro `cerebro-pagina-volta.js` no próprio aparelho — mesma situação dos módulos da seção 2 que
"ainda rodam no navegador". A página não calcula nada (a trava `npm run smoke:pagina-volta` reprova
quem pôr conta nela). Passo definitivo: o consumidor da nuvem roda o MESMO cérebro e a página lê o
pacote pronto — sem mudar a casa da conta.
Visibilidade: o `.exe` avisa no `StatusText` se está em PRODUÇÃO ou TESTE (lição do bug de 28/06).
