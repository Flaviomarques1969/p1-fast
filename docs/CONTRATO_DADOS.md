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
GPS (evento `gps`): `lat`, `lng`, `kmh`, `tWall`.

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
Engenharia Saúde-do-Carro, Cockpit do app (iOS), Checar-antes-de-rodar.

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
