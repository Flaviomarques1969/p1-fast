<!-- Gerado 2026-06-19 a partir de leitura do codigo real (workflow padrao-central-dados). Cada item tem evidencia arquivo:linha. -->

# PADRAO CANONICO — Central de Pista P1 Fast

Documento de referencia da arquitetura ao vivo. Cada afirmacao tem evidencia (arquivo:linha). Onde nao foi comprovado no codigo, esta escrito "nao confirmado".

---

## 1. Visao geral da Central (o fluxo de ponta a ponta)

A Central de Pista e o conjunto de pecas que pega o dado bruto no carro e faz ele aparecer ao vivo nas telas. O caminho canonico tem 4 estagios:

```
CARRO (sensores)  ->  NOTEBOOK (le e publica)  ->  CANAL NA NUVEM  ->  TELAS / COMMAND BOX
   T3000 (motor)        cockpit/main-t3000.js       Supabase Realtime      cockpit, painel,
   RaceBox (GPS)        teste-aparelhos/index.html  "cockpit-bubi-live"    Central, Command Box
   camera DJI/iPhone    (video via Daily.co)
```

Tres fontes de dado, cada uma com seu transporte ate o notebook:
- **CARRO (motor)**: central Injepro T3000 lida por WebUSB pelo cockpit do piloto (`web/cockpit/main-t3000.js`).
- **GPS**: RaceBox lido por Web Bluetooth pela Central de Pista (`web/teste-aparelhos/index.html`).
- **VIDEO**: camera (DJI / iPhone) transmitida por Daily.co a partir da Central de Pista.

O notebook publica o dado do motor e do GPS num unico canal na nuvem chamado `cockpit-bubi-live` (Supabase Realtime broadcast, projeto `fvhwltzhytpnhlqbttmd`). Qualquer tela que assina esse canal recebe o mesmo dado no mesmo instante. O video corre por fora, dentro de uma sala Daily.co.

Principio da arquitetura definitiva (`docs/ARQUITETURA_DEFINITIVA.md:24-33`): sao 3 telas; o Command Box NAO calcula nada, so exibe; quem processa (ex.: converter GPS cru em posicao na pista) e o app na nuvem (`tools/nuvem-posicao.mjs`); o notebook do carro fica focado no piloto.

Regra dura confirmada no codigo: **ASSINAR (ler) o canal e livre; PUBLICAR no `cockpit-bubi-live` e PRODUCAO.** Os scripts de dev/replay recusam publicar sem autorizacao explicita (`tools/nuvem-posicao.mjs:38-41`, `tools/nuvem-replay-gps.mjs`, `tools/_sim-publish-teste.mjs`).

---

## 2. FONTES (PORTAS) que funcionam hoje

### 2.1 CARRO — motor via Injepro T3000 (WebUSB)  —  STATUS: funcionando

**Transporte.** Carro -> notebook: WebUSB (`navigator.usb`, bulk transferIn/transferOut). Protocolo proprietario Injepro: handshake "ACK" (0x41 0x43 0x4B) no endpoint OUT, espera "OK" (0x4F 0x4B) no IN; depois loop ~10 Hz mandando "RI" (0x52 0x49 = Read Instruments), acumula bloco binario little-endian (~410-490 bytes) e decodifica com `t3000-usb-parser.js` (PARSER_VERSION 2.0.0).
Evidencia: `web/cockpit/main-t3000.js:803-826` (connectAndRun, requestDevice, handshake, startCloudBridge), `:881-921` (runReadLoop), `web/cockpit/t3000-usb-parser.js:75-229` (parser), `web/cockpit/index-t3000.html:83` (botao "Autorizar T3000 via WebUSB").

Notebook -> nuvem: a cada amostra lida, `runReadLoop` chama `bridge.ingestT4000(sample)` (painel local) E `publishSample(sample)` (espelha pra nuvem). Confirmado: `web/cockpit/main-t3000.js:904-905`.

ATENCAO sobre nomes de arquivo: `t4000-packet-parser.js` e `t4000-provider.js` NAO existem. O parser real e `t3000-usb-parser.js` (verificado por ls). Nao ha "provider" separado: a leitura USB vive direto em `main-t3000.js`. A pagina `t4000-usb-test.html` e so diagnostico (conta bytes/seg, sentinelas, baixa .bin) e NAO publica nada.

**Campos + unidade** (o que o parser entrega; offset no bloco RI):

| campo | unidade | observacao |
|---|---|---|
| rpm | rpm | uint16 off 0 |
| batteryV | V | uint16 off 2 /10 |
| mapBar | bar | int16 off 4 /100 |
| tpsPct | % | borboleta 1, uint16 off 46 /10 |
| tps2Pct | % | borboleta 2, off 48 — NAO vai pra nuvem |
| tpsTargetPct | % | TPS alvo, off 50 /10 |
| airTempC | C | int16 off 56 (null se sonda ausente) |
| waterTempC | C | int16 off 58 (null se ausente) |
| lambda | lambda (adim.) | sonda WB (banda larga, ativa no Bubi), uint16 off 62 /1000 |
| lambdaNB | mV raw | NB desligada no Bubi, off 60 — NAO vai pra nuvem |
| mapaAtual | indice 1-based | byte off 108 +1 |
| consumoBorboleta | (/100) | int16 off 104 /100 |
| pedalAceleradorPct | % | uint16 off 52 /10 |
| pedalFreioPct | % | pedal 2/freio, off 54 /10 |
| pressaoFreioBar | bar | int16 off 268 /100 (null se bloco < 270 bytes) |
| speedKmh | km/h | uint16 off 102 /10 |
| accelXg/Yg/Zg | g | int16 off 270/272/274 /1000 (null se bloco curto) |
| fuelInjectionBalanced | bool | spread dos 4 tempos <= 200 |
| fuelInjectionSpread | (tempo raw) | diferenca max-min entre cilindros |
| fuelTimeA | array uint16 | tempo de injecao banca A |
| alarmes | objeto de bits | 11 flags do bitfield off 288 (excessoRotacao, excessoTempMotor, baixaPressaoOleo, wbMinimo/Maximo, etc.) |
| statusSinais | objeto de bits | byte 100 (corteArrancada, sinalNitro, saidaTrocaMarcha, alarme, etc.) |
| cronometroParcialS / cronometroTotalS | s | uint32 off 292/296 /1000 |
| source | string | "t3000-usb" |
| parserVersion | string | "2.0.0" |
| tMono | ms | performance.now no momento da captura |
| bytesLen | bytes | tamanho do bloco RI |

NAO existem na T3000: **marcha, EGT, pressao/temperatura de oleo** (parser devolve null/undefined; oleo so como bit em `alarmes`). `t3000-usb-parser.js:219-224`.

**LAYOUT EXATO do payload publicado** (subconjunto montado por `stripSample`, `cloud-bridge.js:165-202`):

```json
{
  "source": "t3000-usb", "parserVersion": "2.0.0", "tMono": 12345.6,
  "tWall": 1750360000000, "bytesLen": 460,
  "rpm": 5800, "batteryV": 13.8, "mapBar": 0.95, "tpsPct": 62, "tpsTargetPct": 62,
  "airTempC": 35, "waterTempC": 88, "lambda": 0.95, "mapaAtual": 1, "consumoBorboleta": 12,
  "pedalAceleradorPct": 62, "pedalFreioPct": 0, "pressaoFreioBar": 0, "speedKmh": 110,
  "accelXg": 0.1, "accelYg": 0.2, "accelZg": 1.0,
  "fuelInjectionBalanced": true, "fuelInjectionSpread": 50, "fuelTimeA": [1200,1180,1210,1195],
  "alarmes": { "excessoRotacao": false }, "statusSinais": {},
  "cronometroParcialS": 34.2, "cronometroTotalS": 120.5
}
```
NAO entram no payload (descartados por stripSample): tps2Pct, lambdaNB, anguloInjecao, atuacaoCorteIgnicao, marcha, egtC, oilPressBar, oilTempC. `tWall` e reescrito com `Date.now()` no momento do ENVIO (`cloud-bridge.js:171`), nao da captura — o tempo fiel de captura e `tMono` (monotonico local, nao comparavel entre maquinas).

### 2.2 GPS — RaceBox via Web Bluetooth  —  STATUS: parcial

**Transporte.** Aparelho -> notebook: Web Bluetooth (`navigator.bluetooth.requestDevice`, filtro `namePrefix:'RaceBox'`), servico Nordic UART (NUS, UUID 6e400001-..., RX 6e400003-...). Pacotes UBX (0xB5 0x62, classe 0xFF id 0x01, payload >=80 bytes) validados por checksum Fletcher em `onNotify()` e decodificados em `decode()`. Evidencia: `web/teste-aparelhos/index.html:395-433,443-449,478`.

O dado e republicado em DOIS caminhos em paralelo, ambos a 5 Hz (intervalos de 200 ms):
1. Canal nuvem `cockpit-bubi-live`, evento `gps`, via `cloudSend('gps',...)` — `index.html:508`. Consumido pelo cockpit do piloto.
2. Sala de video Daily.co, app-message `t:'gps'`, via `call.sendAppMessage` — `index.html:504`. Consumido pelo painel do espectador.

ATENCAO: `src/telemetry/racebox-provider.js` e `racebox-ble-reader.js` NAO existem (confirmado por find e por `docs/hardware/RACEBOX_INTEGRATION_SPEC.md`: "nenhuma classe RaceBoxProvider existe"). RaceBox foi rebaixado em 2026-05-01 (`BLOCKERS.md:48-51`). O parsing vive INLINE no HTML. O modelo "Mini S" so aparece em comentario/doc, nao no codigo — o filtro BLE e generico (`namePrefix:'RaceBox'`).

**Campos + unidade:**

| campo | unidade | UBX |
|---|---|---|
| lat | graus dec. | off 28 (Int32) /1e7 |
| lon (app-msg) / lng (nuvem) | graus dec. | off 24 (Int32) /1e7 |
| spd (app-msg) / kmh (nuvem) | km/h | off 48 (mm/s) /1000*3.6 |
| numSV | satelites | off 23 (byte) — REAL >0; simulador forca 0 |
| fix | codigo (0=sem fix, 3=3D) | off 20 (byte) — simulador forca 3 (igual ao real) |
| hacc (app-msg) / accM (nuvem) | metros | off 40 (Uint32, mm) /1000 |
| hz | Hz | taxa medida em runtime — SO no app-message |
| ver | texto | "sem sinal"/"fraco"/"ok"/"travado" — SO no app-message |
| sim | bool | true so no simulador |
| tWall | epoch ms | SO no payload da nuvem |

**LAYOUT EXATO dos payloads:**

```javascript
// 1) REAL na NUVEM (canal cockpit-bubi-live, evento 'gps') — index.html:508
{ lat:-15.77, lng:-47.93, kmh:142.3, numSV:9, fix:3, accM:1.8, tWall:1750000000000 }

// 2) REAL na SALA DE VIDEO (Daily app-message) — index.html:504
{ t:'gps', fix:3, numSV:9, spd:142.3, lat:-15.77, lon:-47.93, hz:5.0, hacc:1.8, ver:'travado' }

// 3) SIMULADO na nuvem (numSV=0, fix=3 falso, sim:true) — index.html:273
{ lat:-15.77, lng:-47.93, kmh:0, numSV:0, fix:3, accM:2, sim:true, tWall:... }
```
Inconsistencia de nomes entre os dois caminhos: nuvem usa `lng/kmh/accM/tWall`; app-message usa `lon/spd/hacc/hz/ver`. Quem consome precisa tratar os dois esquemas. Taxa publicada e 5 Hz (o RaceBox suporta 25 Hz pela doc; o gargalo e o repasse, nao o aparelho).

### 2.3 VIDEO — camera via Daily.co  —  STATUS: funcionando

**Transporte.** Video + app-messages por Daily.co (`@daily-co/daily-js`, call object). A sala vem de uma ponte de servidor: POST `/api/room` (`web/teste-aparelhos/api/room.js`) que repassa pro backend do fam-racing (`https://fam-racing.vercel.app/api/video/room`) enviando `{ eventId: 'p1-teste-aparelhos', dateISO: <hoje YYYY-MM-DD> }`. Sala deterministica por evento+dia: notebook e espectador caem na mesma sala automaticamente. Evidencia: `api/room.js:7-19` (verificado integralmente).

O nome literal da sala e os tokens (`roomName/roomUrl/tokenPiloto/tokenBox`) sao montados no backend fam-racing, FORA deste repositorio. O formato literal "evento-p1-teste-aparelhos-AAAAMMDD" NAO esta nesta base — **nao confirmado** aqui.

- O notebook (Central) entra como PILOTO (`tokenPiloto`), transmite video (setLocalVideo true, setLocalAudio false). `index.html:356-358`.
- O painel (espectador) entra como BOX (`tokenBox`), so assiste. `painel.html:88,98-106`.

Junto do video, o notebook envia 3 tipos de app-message:

```javascript
// t:'carro' — 500ms (index.html:200-202), so se amostra < 3s
{ t:'carro', rpm:3200, kmh:118, agua:62, lam:0.95, bat:13.4, sim:false }

// t:'painel' — 1000ms (index.html:208-212)
{ t:'painel', voltaN:3, voltaS:42.7, ultimaS:61.2, melhorS:59.8, trecho:'Curva 7', deltaS:-0.31, sim:false }

// t:'gps' — 200ms (index.html:504) [ver secao 2.2]
```

IMPORTANTE: o painel do espectador (`painel.html:84`) so registra handler para `t:'gps'`. Os app-messages `t:'carro'` e `t:'painel'` sao ENVIADOS mas NAO tem leitor no painel atual — esforco de envio sem consumidor. Os dados do carro chegam no painel SO pela nuvem (`painel.html:130`).

---

## 3. CATALOGO DO CANAL cockpit-bubi-live

Canal Supabase Realtime broadcast, projeto `fvhwltzhytpnhlqbttmd` (`https://fvhwltzhytpnhlqbttmd.supabase.co`). Config: `broadcast: { ack:false, self:false }`, `eventsPerSecond` 10-20. Chave anon (role=anon) hardcoded em `supabase-config.js` e nos HTML/tools. 4 eventos:

### Evento `sample` (motor T3000, ~5 Hz)
- **Payload**: ver secao 2.1 (stripSample). `source:"sim-replay"` marca simulador.
- **Quem publica (PRODUCAO)**: `cloud-bridge.js:119-139` (publishSample, throttle 5 Hz), acionado pelo cockpit do piloto em `main-t3000.js:905`. Tambem `tools/sim-publish.mjs:45` (sintetico, DEV — ver lacuna).
- **Quem assina**: `cloud-bridge.js:87` (modo sem fio), `teste-aparelhos/index.html:129` (Central), `teste-aparelhos/painel.html:130` (espectador), monitores em `tools/`, Command Box (`mockup-command-box-vista-piloto.html:7900-7916`).

### Evento `gps` (ponto GPS cru, ~5 Hz)
- **Payload**: `{ lat, lng, kmh, numSV, fix, accM, tWall }` (`index.html:508`). Simulador acrescenta `sim:true`. Replay usa `fonte:'replay-<id>'` (`nuvem-replay-gps.mjs:50`).
- **Quem publica (PRODUCAO)**: `teste-aparelhos/index.html:508` (RaceBox real). DEV: `nuvem-replay-gps.mjs:50` (recusa canal real sem PERMITIR_PROD_CANAL=1).
- **Quem assina**: `cloud-bridge.js:81` -> `onGpsPoint` -> `main-t3000.js:456-471` (detector de trecho/chegada/box, le lat/lng/kmh/accM/tWall/sim, descarta numSV/fix/hz/ver), `painel.html:131`, auditores em `tools/`.

### Evento `evento` (volta/trecho/delta, baixa frequencia)
- **Payload**: sempre tem `tipo` + `tWall` (injetado em `cloud-bridge.js:146`). Tipos: `{tipo:'volta', n}` (`main-t3000.js:628`); `{tipo:'trecho', segmentId}` (`:373`); `{tipo:'delta', segmentId, deltaS}` (`:376`). Simulador acrescenta `source:'sim-replay'`.
- **Quem publica (PRODUCAO)**: `cloud-bridge.js:143-153` (publishEvento).
- **Quem assina**: `teste-aparelhos/index.html:130` -> onEvento (repassa via Daily app-message). Cerebro vivo le `evento` tipo volta (`cerebro-vivo.js:25-32`).

### Evento `posicao` (posicao calculada na pista, DERIVADO)
- **Payload**: `{ frac, x, y, fonte, tWall }` (`tools/nuvem-posicao.mjs:25,50`). `frac` = fracao de arco 0..1; `x,y` = metros no Command Box.
- **Quem publica**: SO o processador da nuvem `nuvem-posicao.mjs` (ouve `gps`, republica `posicao`). NAO liga no canal de producao sem `PERMITIR_PROD_CANAL=1` (`:38-41`, verificado).
- **Quem assina**: SO `tools/auditar-cadeia-nuvem.mjs:23`. NAO ha consumidor de TELA lendo `posicao` no codigo atual (cadeia gps->posicao->tela esta PARCIAL).

**Regra de acesso (confirmada no codigo):** assinar (`.on()` + `.subscribe()`) e leitura, sempre permitido. Publicar (`.send()`) e producao. Como broadcast nao tem RLS, qualquer cliente com a chave anon pode publicar — a guarda e por convencao nos scripts, nao no servidor.

---

## 4. TELAS (consumidores) e o que cada uma mostra

### 4.1 Central de Pista (`web/teste-aparelhos/index.html`) — notebook da pista
Coluna centralizada (max 760px). Faixa de 4 luzes de status no topo: **VIDEO / GPS / CARRO / NUVEM** (`:44-49`). Abaixo, 3 cartoes:
- Cartao 1 "Video (camera DJI)": elemento video 16:9 + pill Transmissao + botao "Iniciar transmissao".
- Cartao 2 "GPS (RaceBox)": pill Aparelho + 6 linhas (Sinal, Satelites, Velocidade, Taxa, Latitude, Longitude) + botao "Conectar RaceBox por Bluetooth".
- Cartao 3 "Dados do carro (T4000)": 6 linhas (Chegando, Ritmo, RPM, Agua, Bateria, Fonte) + botao "Simular carro".
- Cartao "Registro": log.
Esta tela PUBLICA (nuvem + sala de video) e e consumidora ao mesmo tempo.

### 4.2 Painel do Espectador (`web/teste-aparelhos/painel.html`) — overlay sobre o video
Video em tela cheia. Barra superior com 2 pills (video, carro). Overlay inferior em 2 linhas:
- Linha 1 (GPS, da sala de video): km/h, satelites, qualidade (`:110-119`).
- Linha 2 (carro, da nuvem): RPM, agua, lambda (so se >0), borboleta (tpsPct), bateria (`:146-155`).
So escuta, nunca publica. NAO mostra volta/trecho/delta (mesmo a Central enviando `t:'painel'`).

### 4.3 Cockpit do Piloto (`web/cockpit/index-t3000.html` + cockpit-renderer.js + cockpit-state.js) — tela 10,5"
Barra de conexao WebUSB no topo (botao "Autorizar T3000 via WebUSB" + status + HUD RPM + botoes STINT/BOX/ULTIMA VOLTA). Palco canonico 956x440:
- shift-light (17 LEDs) na base;
- 4 widgets de curva: ENTRADA (km/h), FREIO (m, distancia da freada vs melhor passagem), APICE (m + angulo, bolinha aponta direcao do ponto ideal), SAIDA (km/h);
- bloco central com delta (s) + acao (texto curto);
- bloco de alerta/mensagem a direita;
- barra de stint no topo.
Os valores das curvas vem do CockpitState. Quem alimenta o state com dado real e `main-t3000.js` + LiveDataBridge (`live-data-bridge.js`). Esta tela e a que LE a T3000 via WebUSB e PUBLICA na nuvem.

### 4.4 Command Box (`_design-reference/mockup-command-box-vista-piloto.html`) — TV 32" no box
Fire TV Stick 4K Max abre o app do Command Box num navegador. So EXIBE; nao calcula. Assina `cockpit-bubi-live` em modo SO LEITURA (`self:false`, nunca `.send()`) — `:7900-7916`. Hoje 4 campos sao REAIS (rotacao, velocidade, lambda, agua) + posicao na pista; o resto esta marcado "aguardando ligacao"/"aguardando sensor". E mockup/prototipo, ainda nao publicado como app na nuvem.

---

## 5. COMO CONECTAR ao SISTEMA e ao COMMAND BOX — receita canonica

Qualquer tela nova (incluindo o Command Box) consome a fonte ao vivo do MESMO jeito: assinando o canal em modo so leitura. Receita confirmada em `mockup-command-box-vista-piloto.html:7900-7916` e `docs/FONTE_DADOS_AO_VIVO.md:91-107`:

```javascript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// 1) cliente apontando para o projeto de producao
const client = createClient(
  'https://fvhwltzhytpnhlqbttmd.supabase.co',
  SUPABASE_ANON,                                  // chave anon (role=anon)
  { realtime: { params: { eventsPerSecond: 20 } } }
);

// 2) canal canonico, modo SO LEITURA (self:false = nao recebe o que ele mesmo manda)
const ch = client.channel('cockpit-bubi-live', { config: { broadcast: { ack:false, self:false } } });

// 3) registrar listeners para os eventos
ch.on('broadcast', { event:'sample'  }, msg => onSample(msg.payload));   // motor: rpm, lambda, waterTempC, speedKmh...
ch.on('broadcast', { event:'gps'     }, msg => onGps(msg.payload));      // { lat, lng, kmh, numSV, fix, accM }
ch.on('broadcast', { event:'evento'  }, msg => onEvento(msg.payload));   // { tipo:'volta'|'trecho'|'delta', ... }
ch.on('broadcast', { event:'posicao' }, msg => onPosicao(msg.payload));  // { frac, x, y } JA calculado pela nuvem

// 4) assinar — NUNCA chamar ch.send() numa tela consumidora
ch.subscribe();
```

Passo a passo:
1. Use a URL e a chave anon do projeto `fvhwltzhytpnhlqbttmd`.
2. Crie o canal com nome exato `cockpit-bubi-live` e `broadcast.self:false`.
3. Registre `.on('broadcast', {event:...})` para os eventos que a tela precisa.
4. Chame `.subscribe()`. NAO chame `.send()` — publicar e producao.
5. Trate os nomes de campo: no evento `gps` da nuvem use `lng/kmh/accM`; se for ler app-message Daily, use `lon/spd/hacc`.
6. Para video, entre na sala Daily via POST `/api/room` e use `tokenBox` (assistir).

Especifico do Command Box: e so um navegador no Fire TV Stick abrindo o app na nuvem. Ele assina o canal e exibe. A posicao na pista (`frac`) deve vir pronta do evento `posicao` (calculada pela nuvem em `nuvem-posicao.mjs`); a TV nao deve calcular.

---

## 6. LACUNAS / O QUE FALTA

### 6.1 O carro REAL chega ao canal? Sim — mas so se a ponte estiver "online"
**Verificado:** `main-t3000.js:904-905` chama `bridge.ingestT4000(sample)` (painel local) E `publishSample(sample)` (nuvem) a cada amostra. A leitura real REALMENTE publica. Porem `publishSample` (`cloud-bridge.js:119-139`) so envia se `_status === 'online'`. Ele DESCARTA a amostra, sem erro visivel ao piloto, quando:
- (a) a ponte ainda nao assinou / falhou (status off/connecting/error) -> `_stats.dropped` (`:120-122`);
- (b) throttle de 5 Hz: metade das amostras de 10 Hz cai por design (`:125-128`);
- (c) erro no `_channel.send` -> `_stats.errors` (`:134-138`).

**Causa provavel de "so aparece na tela local":** a cloud bridge nao chegou a `online` (Starlink oscilando, timeout de 8 s ao assinar — `:106`, ou queda apos horas com religamento em backoff 2s->15s — `:33-41`). Nesse intervalo o painel local continua, mas o Command Box e o monitor remoto ficam sem dado.
**Conserto sugerido:** alerta forte ao piloto/operador quando a nuvem cai (hoje so muda o chip "nuvem: erro", `main-t3000.js`); expor `getStats()` (sent/dropped/errors) numa tela de diagnostico; reduzir/avaliar o timeout de 8 s.

### 6.2 RISCO DE PRODUCAO — `tools/sim-publish.mjs` publica direto no canal real SEM guarda
**Verificado integralmente:** o script aponta para `cockpit-bubi-live` (`:9`) e faz `ch.send({event:'sample'})` (`:45`) com dados sinteticos, SEM nenhuma checagem de `PERMITIR_PROD_CANAL`. Diferente de `nuvem-posicao.mjs`/`nuvem-replay-gps.mjs` (exigem autorizacao) e de `_sim-publish-teste.mjs` (aborta no canal real). Rodar esse script injeta amostras FALSAS no canal de producao, violando a regra dura.
**Conserto:** adicionar a mesma guarda dos outros scripts (recusar `cockpit-bubi-live` sem `PERMITIR_PROD_CANAL=1`) ou apontar para um canal de teste por padrao.

### 6.3 Arquivos pedidos que NAO existem
- `t4000-packet-parser.js` e `t4000-provider.js`: nao existem. Parser real = `t3000-usb-parser.js`; leitura USB vive em `main-t3000.js`.
- `src/telemetry/racebox-provider.js` e `racebox-ble-reader.js`: nao existem (RaceBox rebaixado 2026-05-01, parsing inline no HTML).

### 6.4 Dados publicados sem consumidor (esforco perdido)
- App-messages `t:'carro'` e `t:'painel'` sao enviados pela Central, mas o `painel.html` so trata `t:'gps'`. Carro chega no painel so pela nuvem; volta/trecho/delta nao aparecem no espectador.
- Evento `posicao` so e lido pelo auditor (`auditar-cadeia-nuvem.mjs`); nenhuma TELA assina. A cadeia gps->posicao->tela esta calculada mas nao exibida.

### 6.5 `ligarNoCanal()` do cerebro vivo nao existe
**Verificado por grep:** `ligarNoCanal` aparece SO em comentario (`cerebro-vivo.js:8`), nunca implementado. O arquivo so tem `feedSample/feedVolta/snapshot`. Quem liga o cerebro vivo no canal real nao foi localizado neste arquivo.

### 6.6 Command Box ainda nao publicado como app na nuvem
E o arquivo `mockup-command-box-vista-piloto.html` em `_design-reference/`, nao um endereco hospedado que o Fire TV Stick abre. Falta publicar. Tudo depende do carro transmitindo de verdade. So 4 campos sao reais hoje; marcha e rpmLuz dependem do notebook passar a envia-los. Posicao na pista depende do processador da nuvem (`nuvem-posicao.mjs`) estar no ar — caso contrario a tela cai no fallback de projetar GPS localmente, o que contraria o principio "a TV nao calcula".

### 6.7 Sensores inexistentes no Bubi (nunca exibir como medido)
Marcha, EGT, pressao/temp de oleo, combustivel em litros, temp/pressao de pneu, cambio — NAO tem sensor na T3000/no carro. Oleo aparece so como bit booleano em `alarmes`. Quem consome a nuvem nao recebe esses campos numericos.

### 6.8 Outras observacoes verificadas
- Chave anon e URL de producao estao HARDCODED em multiplos arquivos (`supabase-config.js`, 2 HTML, varios .mjs). E chave anon publica (aceitavel pra broadcast), mas como broadcast nao tem RLS, qualquer cliente com a chave pode publicar.
- `tWall` do `sample` e do momento do ENVIO, nao da captura — pequeno vies de latencia; o tempo fiel e `tMono` (local, nao comparavel entre maquinas).
- Distincao simulador x real e fragil: o simulador GPS manda `fix:3` igual ao real; a unica marca confiavel e `numSV=0` + `sim:true` (nuvem) / `ver:'simulador'` (video).
- Nome literal da sala Daily ("evento-p1-teste-aparelhos-AAAAMMDD") **nao confirmado** — montado no backend fam-racing, fora deste repo.
