# Sessão T3000 Bubi — 2026-05-26 (14:30–15:10)

Primeira sessão usando a ponte ao vivo Notebook → Nuvem. 2.901 amostras capturadas com o carro estacionado, motor parando/ligando, sem rodar.

## O que foi feito

1. Construída a ponte do painel `p1t4000.vercel.app` pra um canal ao vivo na nuvem (Supabase Realtime broadcast). Cada amostra que a página decodifica da T3000 é espelhada na nuvem em tempo real.
2. Criada página de monitor (`/tmp/p1fast-ponte-nuvem/tools/monitor-bubi-live.html`) e ouvinte de terminal (`tools/listen-stream.mjs`) — uso interno do Claude pra acompanhar os números de outro computador.
3. Validado contra o software oficial INJEPRO T LINE v3.3.5 com foto da tela.
4. Corrigido um bug de leitura: o painel estava mostrando a sonda lambda errada (sonda estreita NB em vez da banda larga WB).

## Estado verificado dos sensores do Bubi

| Sensor | Lendo? | Valor exemplo idle | Bate com oficial? |
|---|---|---|---|
| Rotação (RPM) | ✅ | 900-1.100 | sim |
| TPS (borboleta) | ✅ | 0,8-1,1% | sim |
| Bateria | ✅ | 13,0-13,2V | sim |
| Temperatura água | ✅ | 37→84°C ao longo da sessão | sim |
| Sonda Lambda banda larga | ✅ (após conserto) | 0,770-0,777 | sim |
| MAP (vácuo coletor) | ✅ leitura correta | -0,02 bar | sim (valor estranho, mas oficial confirma) |
| Pedal acelerador físico | sensor não instalado | 0% sempre | n/a (Bubi tem cabo mecânico) |
| Pressão freio | sensor não instalado | 0,00 bar | n/a |
| Sonda estreita NB | desligada | 0,000 mV | n/a |
| Temperatura ar admissão | sensor não instalado | -20°C (código da Injepro pra "off") | n/a |
| Pressão óleo | sensor não instalado | -- | n/a |
| Pressão combustível | sensor não instalado | -- | n/a |

## Pendências mecânicas pro Flávio

- **MAP em -0,02 bar em idle** é estranho — motor aspirado em marcha lenta deveria ter vácuo significativo (~-0,4 a -0,6 bar). Hipótese: mangueira do sensor MAP solta, vazando ou desplugada.
- **Bateria 13,0-13,3V** durante motor ligado até 3.000 rpm — baixo, alternador deveria entregar 13,8-14,4V. Hipótese: correia frouxa, alternador fraco ou bateria velha.

## Arquivos da sessão

- `amostras-brutas.jsonl` — 2.901 linhas, uma amostra por linha em JSON. Cobre desde motor frio em 37°C até 84°C, com 1 aceleração até 3.149 rpm.

## Estado da implementação

- Ambiente isolado de trabalho: `/tmp/p1fast-ponte-nuvem`, linha de trabalho `feat/ponte-nuvem-t3000` partindo do servidor.
- Arquivos novos / alterados ainda **NÃO foram incorporados** à versão oficial (`main`).
- Versão atualizada do painel já está no ar em `p1t4000.vercel.app` (subida autorizada pelo Flávio às 14:33).
- Pra incorporar à versão oficial precisa autorização separada do Flávio.

## Conserto técnico aplicado

`web/cockpit/t3000-usb-parser.js` — campo `lambda` agora usa o valor do offset 62 (banda larga) em vez do offset 60 (sonda estreita). A diferença foi descoberta comparando contra foto do software oficial em idle.
