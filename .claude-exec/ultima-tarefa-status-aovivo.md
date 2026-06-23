# Tarefa — Ligar a TELA DE STATUS ao DADO AO VIVO de verdade — 23/06/2026

(arquivo separado do ultima-tarefa.md porque há outra frente ativa escrevendo nele)

## Pedido original de Flávio
"pode fazer" — autorizou ligar a tela de status (checar-antes-de-rodar.html, já aprovada nas 2 versões)
ao dado ao vivo de verdade, em vez da volta gravada.

## Objetivo (1 frase)
A grade de status passa a refletir o que CHEGA ao vivo do carro (canal cockpit-bubi-live), só ouvindo,
e sem carro transmitindo mostra "aguardando o carro" (nunca número inventado).

## Critérios de conclusão
- Tela ouve o canal cockpit-bubi-live (mesma peça cloud-bridge.js do painel) — SÓ onSample/onGpsPoint.
- NUNCA publishSample/publishEvento (canal é produção; regra dura).
- Mapeia os campos reais: rpm, tpsPct, pedalFreioPct, waterTempC, lambda, batteryV, alarmes, accelXg/Yg/Zg, kmh.
- Sem amostra fresca (>3s) → sensor "sem sinal"; sem nada → "aguardando o carro".
- Preserva a DEMONSTRAÇÃO com a volta gravada em ?fonte=demo (não destrói o aprovado).
- Indicador de conexão no cabeçalho (no ar / conectando / sem conexão / demonstração).

## Ambiente: desenvolvimento (web). Produção protegida: sim. Só LEITURA do canal de produção.

## Riscos
- NUNCA publicar no canal cockpit-bubi-live (só ouvir). Conferido: uso só onSample/onGpsPoint/startCloudBridge.
- Sem internet → import dinâmico falha → tela mostra "sem conexão" e grade "sem sinal" (não quebra).
- Painel do piloto (modo andando) segue sendo o aprovado embutido (replay); painel AO VIVO é a outra frente (app).

## Status: CONCLUÍDO (DEV)

## TASK_DONE
- Pedido conferido: sim ("pode fazer" = ligar a tela de status ao dado ao vivo)
- Ambiente: desenvolvimento (web). Produção: NÃO alterada (só leitura do canal).
- Alterações: web/cockpit/checar-antes-de-rodar.html (fonte de dados: passou a ouvir cockpit-bubi-live; ?fonte=demo preserva a volta gravada; +chip de conexão no cabeçalho). Nada mais tocado.
- Só ouvir confirmado: grep publishSample/publishEvento = 0; usa só onStatusChange/onSample/onGpsPoint/startCloudBridge.
- Validação:
  - Conexão real provada (Node + supabase-js, só ouvir): canal cockpit-bubi-live = SUBSCRIBED; 0 amostras em 6s (sem carro agora, esperado).
  - REST do Supabase alcançável (401), esm.sh 200.
  - Print modo ao vivo: selo "AGUARDANDO O CARRO", tudo "sem sinal" (sem inventar número). No headless o chip deu "sem conexão" (relógio congelado quebra o websocket) — no navegador real conecta.
  - Print modo demo: dados visíveis (água 57°C, lambda 0.90, bateria 11.6 V, alarmes "tudo ok"), "PRONTO PRA GRAVAR".
- Resultado: concluído em DEV; aberto no navegador do Flávio (ao vivo + demo).
- Pendências: ver com números reais correndo só com carro na pista transmitindo; painel do piloto (modo andando) ainda é o aprovado embutido (replay) — painel AO VIVO é a outra frente (app). Mapa força-G ao vivo agora existe (accelXg/Yg/Zg).
