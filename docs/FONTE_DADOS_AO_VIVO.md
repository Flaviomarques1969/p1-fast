# Fonte de dados ao vivo — coração do sistema

> Estabelecido 2026-05-26. **Esta é a referência permanente da fonte de dados do P1 Fast.** Não jogar fora, não substituir sem decisão explícita do Flávio. Validado em campo (carro estacionado, motor ligado) com 2.901 amostras + conferência contra software oficial INJEPRO T LINE v3.3.5 via foto da tela.

## Em uma frase

O painel `p1t4000.vercel.app` lê a Injepro T3000 pelo cabo USB no notebook e **espelha cada amostra em tempo real num canal de broadcast da nuvem**. Qualquer cliente que assina o canal (Claude no Mac monitorando, painel remoto, futuro Command Box do engenheiro/mecânico/chefe) vê o que está acontecendo no carro **no mesmo instante**.

## Arquitetura

```
[T3000 no carro] --USB--> [notebook Windows] -- WebUSB --> [p1t4000.vercel.app] -- broadcast --> [Supabase Realtime]
                                                                                                       |
                                                                                                       ├── Claude monitora (Mac local, terminal ou HTML)
                                                                                                       ├── Painel remoto futuro
                                                                                                       └── Command Box (engenheiro/mecânico/chefe)
```

### Fluxo detalhado

1. **Notebook plugado no carro** com a T3000 conectada via USB proprietário.
2. **Página `p1t4000.vercel.app`** aberta no navegador (Edge/Chrome).
3. Flávio clica **"Autorizar T3000 via WebUSB"**.
4. Handshake: navegador manda `ACK` na porta USB OUT, T3000 responde `OK`.
5. **Loop a 10 Hz**: navegador pede `RI` (Read Instruments) → T3000 manda ~460 bytes → `t3000-usb-parser.js` decodifica em objeto JSON com 30+ sensores.
6. Cada amostra alimenta dois caminhos em paralelo:
   - **Local:** `LiveDataBridge` → `CockpitState` → renderiza painel (RPM, shift light, alertas).
   - **Nuvem:** `cloud-bridge.js` → `publishSample()` → broadcast no canal `cockpit-bubi-live` do Supabase (throttle 5 Hz, não-bloqueante).
7. **Qualquer ouvinte** que assina o canal `cockpit-bubi-live` recebe a amostra reduzida.

## Arquivos canônicos (NÃO mover sem refletir aqui)

| Arquivo | Responsabilidade |
|---|---|
| `web/cockpit/main-t3000.js` | Bootstrap WebUSB, handshake, loop de leitura, atualiza painel local + chama `publishSample()` |
| `web/cockpit/t3000-usb-parser.js` | Decodifica os ~460 bytes da T3000 em objeto JSON (30+ sensores). v2 baseado em engenharia reversa do software oficial T LINE v3.3.7 |
| `web/cockpit/cloud-bridge.js` | Conecta no Supabase Realtime, mantém assinatura no canal, publica amostras (5 Hz, não-bloqueante, expõe status) |
| `web/cockpit/index-t3000.html` | Página HTML do painel com botão de conexão + indicadores de status (USB + nuvem) |
| `tools/monitor-bubi-live.html` | Página standalone que escuta o canal e mostra todos os sensores ao vivo. Uso interno do Claude no Mac |
| `tools/listen-stream.mjs` | Ouvinte de terminal que grava amostras em `/tmp/bubi-live.log` (JSONL). Usado em background |
| `tools/sim-publish.mjs` + `sim-listen.mjs` | Testes ponta-a-ponta sem hardware |

## Onde está hospedado

| Item | Endereço |
|---|---|
| Painel em produção | `https://p1t4000.vercel.app` |
| Projeto Vercel | `flaviomarques-6007s-projects/p1t4000` |
| Pasta local de deploy (linkada) | `/tmp/p1-t4000/` (cópia dos arquivos `web/cockpit/`) |
| Como subir nova versão | `cp` dos arquivos para `/tmp/p1-t4000/` + `cd /tmp/p1-t4000 && npx vercel deploy --prod --yes --scope=flaviomarques-6007s-projects` |
| Projeto Supabase | `fvhwltzhytpnhlqbttmd` (P1 Fast — isolado do CDAI) |
| Canal de broadcast | `cockpit-bubi-live` (sem persistência, latência baixa) |

## Sensores verificados em campo (2026-05-26)

Bateu com software oficial via foto:

| Sensor | Status | Valor exemplo idle |
|---|---|---|
| Rotação (RPM) | ✅ lendo correto | 900-1.100 |
| TPS (borboleta) | ✅ lendo correto | 0,8-1,1% |
| Bateria | ✅ lendo correto | 13,0-13,2V |
| Temperatura água | ✅ lendo correto | 37→84°C ao longo da sessão |
| **Sonda Lambda banda larga (WB)** | ✅ **lendo correto após conserto 2026-05-26** | 0,770-0,777 |
| MAP (vácuo coletor) | ✅ leitura correta | -0,02 bar (valor estranho do sensor, mas oficial confirma) |

## Sensores não instalados no Bubi (marcando zero/vazio — correto)

- Pedal acelerador físico (carro tem cabo mecânico)
- Pressão freio (sensor não instalado ainda)
- Sonda lambda banda estreita (desligada)
- Pressão óleo (sensor não instalado)
- Pressão combustível (sensor não instalado)
- Temperatura ar admissão (sensor não instalado — INJEPRO mostra -20°C como código de "off")

## Conserto técnico aplicado 2026-05-26

**Bug encontrado:** painel mostrava sonda lambda em 0,00 mesmo com motor a 84°C.

**Diagnóstico:** estava lendo do offset 60 (sonda NB estreita, desligada no Bubi) em vez do offset 62 (sonda WB banda larga, ativa).

**Como descobri:** Flávio tirou foto do software oficial INJEPRO T LINE v3.3.5 em idle. Oficial mostrava `Sonda NB: 0,000 mV` + `Sonda WB Int.: 0,786 λ`. O valor de 0,770 está no offset 62 do bloco de dados, não no 60.

**Conserto:** `t3000-usb-parser.js` linha 96-99 — campo `lambda` agora lê `lambdaWBRaw / 1000` em vez de `lambdaNBRaw / 1000`.

## Pendências mecânicas do Bubi (não é software)

- **MAP em -0,02 bar em idle** — motor aspirado em marcha lenta deveria ter vácuo (~-0,4 a -0,6 bar). Hipótese: mangueira do sensor MAP solta, vazando ou desplugada.
- **Alternador entregando só 13,2V** em motor ligado, mesmo em 3.000 rpm — deveria ser 13,8-14,4V. Hipótese: correia frouxa, alternador fraco ou bateria velha.

## Como consumir essa fonte (qualquer cliente)

```js
import { createClient } from '@supabase/supabase-js'; // ou via CDN

const client = createClient(
  'https://fvhwltzhytpnhlqbttmd.supabase.co',
  '<ANON_KEY>' // ver cloud-bridge.js
);
const channel = client.channel('cockpit-bubi-live', {
  config: { broadcast: { ack: false, self: false } }
});
channel.on('broadcast', { event: 'sample' }, (msg) => {
  const sample = msg.payload; // RPM, TPS, λ, MAP, água, freio, etc.
});
channel.subscribe();
```

## Sessão de validação registrada

Pasta: `docs/research/t3000-sessao-2026-05-26/`

- `README.md` — relatório da sessão
- `amostras-brutas.jsonl` — 2.901 amostras brutas (uma JSON por linha) capturadas ao vivo

## Submissão de origem

PR #216 — `feat(cockpit): ponte ao vivo T3000 → Supabase Realtime + conserto lambda WB`. Incorporada à versão oficial 2026-05-26.
