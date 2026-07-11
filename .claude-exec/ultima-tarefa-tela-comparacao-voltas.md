# TASK — Tela de comparação de voltas (frenagem + aceleração, ghost da melhor volta)

> Arquivo próprio: o `ultima-tarefa.md` foi assumido por outra sessão (estudo de Vmin) durante esta
> tarefa. Pra não atropelar, mantenho meu registro aqui. Minha TASK_INIT completa ficou preservada em
> `.claude-exec/ultima-tarefa.backup-2026-06-27-pre-estudo-vmin.md`.

## Pedido original de Flávio
"em p1 fast quero desenvolver uma tela com um gráfico na horizontal mostrando frenagem e aceleração de
uma volta completa e nele fazer um ghost da melhor volta. e na mesma tela ir mostrando volta a volta
adicionando as novas voltas para irmos vendo cada uma delas na tela e podendo comparar."

## ATUALIZAÇÃO 27/06 — refeito em PADRÃO SUPER PREMIUM (pedido do Flávio)
Mesmo arquivo `_design-reference/mockup-command-box-comparar-voltas.html` (v1 funcional preservada em
`.claude-exec/backup-comparar-voltas-v1-funcional-2026-06-27.html`). Acréscimos premium, tudo com dado REAL:
- Visual premium: vidro/profundidade, curva suave (Catmull-Rom) com preenchimento e brilho, ghost luminoso.
- FAIXA DE DELTA pro ghost (onde ganha/perde tempo ao longo da volta) — calculada do tempo real por ponto.
- MAPA REAL de Brasília (`pista-oficial-brasilia.js`, traçado oficial 823×799) com a BOLINHA andando na
  posição da volta, pinos das 8 curvas (`apices-semente-brasilia.js`) e linha de chegada.
- CURVAS DE BRASÍLIA nomeadas ao longo do eixo (ápices projetados na volta): C1, C2, Junção, Bruxa,
  Reta Oposta, Placar, "S", Vitória.
- Cartões de volta premium (mini-curva, delta, vmax, km, selo dourado da melhor).
- Leitura flutuante no toque + reprodução automática (bolinha percorre a volta quando ocioso).
- Suavização leve do traço (sinal de GPS ~1Hz) sem apagar zonas de freio.
- Reuso de casas oficiais (freio-trecho.js, geo.js, pista-oficial-brasilia.js, apices) — nada recriado.
- Trava `npm run smoke:arquitetura` = 32 ok / 0 fail. Chrome real (CDP) = 0 exceção; 8 curvas projetadas,
  mapa+bolinha, delta, adicionar volta e empilhar OK. Print de referência: `.claude-exec/_shot-graf2.png`.

## TASK_DONE
- Pedido original conferido: sim
- Ambiente trabalhado: DESENVOLVIMENTO
- Produção foi alterada: NÃO
- Autorização explícita registrada: não se aplica (produção intocada)
- Arquivos reais inspecionados: sim
- Alterações feitas: sim (1 arquivo, refeito em premium; v1 preservada em backup)
- Testes/validação executados: sim (trava 32/0; Chrome real 0 exceção; print conferido a olho)
- Resultado: CONCLUÍDO (tela premium com dado real, aberta no navegador; aguarda reação do Flávio)
- Pendências reais: ver abaixo

## Arquivo criado
- `_design-reference/mockup-command-box-comparar-voltas.html` (tela nova de análise do Command Box)

## O que a tela faz (com dado REAL)
- Gráfico horizontal da VOLTA INTEIRA: acima do meio = acelerando (verde), abaixo = freando (vermelho).
- GHOST da melhor volta (a mais rápida) sempre fixado como referência.
- Voltas do stint numa lista; clica pra mostrar/esconder; "Adicionar próxima volta" revela uma a uma.
- Dois modos no próprio gráfico: SOBREPOR (todas numa) e EMPILHAR (uma faixa por volta).
- Leitura no ponto (passa o mouse): % de cada volta e diferença pro ghost.

## De onde vem o número (regra dura respeitada)
- Motor de produção: `web/cockpit/freio-trecho.js` (`comDistanciaAcumulada` + `simularFreioPelaFisica`).
- Casas reusadas: `geo.js` (distância) — sem recriar conta.
- Dado real: sessão gravada do Bubi em Brasília 23/05 (`web/command-box/fixtures/volta-real-gps-23-05.json`),
  fatiada volta a volta pelo cruzamento da linha de chegada (`marco` de `replay-hoje-mapa.json`).
- 3 voltas reais (158/159/163 s; vmax 162–164 km/h). Velocidade derivada do GPS com filtro de mediana
  (mata picos tipo "318 km/h" de salto de GPS).
- Honestidade: frenagem/aceleração = efeito físico medido pelo GPS, rótulo `simulado-fisica`. Quando o
  sensor de pedal/pressão entrar na T4000, o mesmo gráfico passa a usar o dado real sem mudar a tela.
- SEM conexão própria (sem createClient), SEM dado fictício. Passa em `npm run smoke:arquitetura` (32/0).

## Validação executada (provas reais)
- `npm run smoke:arquitetura` → 32 ok / 0 fail (com o arquivo novo).
- Pipeline em Node (mesmo motor): 3 voltas reais, dist ~5,3 km (coerente com Brasília), freioMax/acelMax 100%.
- Chrome headless (CDP): 0 exceção; estado correto — ghost fixado, "adicionar próxima volta" funciona
  (2 de 3 → 3 de 3), modo empilhar gera 3 faixas, modo sobrepor desenha linhas + ghost.
- Aberta no navegador do iMac (atelier 8078).

## Pendências / próximos passos
- Direção visual do Flávio: ele escolhe vendo (sobrepor vs empilhar já estão na tela pra comparar).
- Rótulos de curva de Brasília ao longo do eixo X (hoje mostra metros) — dá pra somar depois.
- Ligar no dado AO VIVO do canal (cloud-bridge) além do gravado — quando ele quiser.
- Sensor de pedal/pressão (T4000) troca o `simulado-fisica` pelo real, sem mudar a tela.
- Produção: intocada. Nada publicado.

## FECHAMENTO 27/06 — ligada ao menu (ida e volta)
- O menu `_design-reference/menu-command-box.html` (construído por outra frente) JÁ linka a tela:
  cartão "Comparar Voltas" (selo "Pronta") → `href="mockup-command-box-comparar-voltas.html"`. NÃO mexi no menu.
- Adicionei na tela um "voltar ao Command Box" (`href="menu-command-box.html"`) pra fechar a ida e volta.
- Prova (Chrome real, CDP): menu → clica card → tela carrega (voltas) → clica voltar → menu. 0 exceção. Trava 32/0.
- STATUS: CONCLUÍDO.

## 27/06 — LIGADA NO AO VIVO (pedido "ligue")
- A tela passou a OUVIR o canal pela ponte ÚNICA `web/cockpit/cloud-bridge.js` (ganchos
  `startCloudBridge`/`onGpsPoint`/`getStatus`/`onStatusChange`). Não abre conexão própria, NUNCA publica.
- Comportamento: acumula GPS ao vivo; quando a volta FECHA (cruza o `marco` da linha de chegada), monta a
  volta com o MESMO motor (`freio-trecho.js`) e ela ENTRA sozinha na lista, marcada "ao vivo"; o ghost recalcula.
- Voltas gravadas seguem como base; chip de status no topo: AO VIVO · recebendo / aguardando o carro / indisponível.
- Canal padrão = produção `cockpit-bubi-live`, só ESCUTA (regra dura). Dev/teste via `?canal=`.
- Limiar de volta = 8s (anti-repique e duração mínima) — seguro p/ pista real (nenhuma volta é menor).
- PROVA (sem carro na pista): `CANAL=cb-dev-flavio node tools/nuvem-replay-gps.mjs 23-05 12` (toca a volta
  gravada no canal de DEV) + tela com `?canal=cb-dev-flavio`. Chrome real (CDP): chip "AO VIVO · recebendo"
  imediato; aos ~33s uma volta entrou sozinha marcada "ao vivo" (2→3 voltas); 0 exceção. Trava 32/0.
- Carga normal (sem ?canal): voltas gravadas seguem, chip "aguardando o carro" (ponte conectou na produção,
  sem carro publicando), 0 exceção.
- Produção INTOCADA; nada publicado nela. Para ver ao vivo agora rodei o replay no canal de DEV `cb-dev-flavio`.

## 27/06 — LIMPEZA PARA PRODUÇÃO (autorizada)
PRODUÇÃO (autorização literal "MIGRAR PARA PRODUÇÃO: esvaziar base de frenagem (melhores_passagens_trecho)"):
- Backup ANTES: `.claude-exec/backup-base-frenagem-PROD-melhores_passagens_trecho-2026-06-27.json` (60 registros completos).
- A chave pública NÃO apaga (regra de segurança bloqueia: DELETE 204 mas 0 removidos — confirmado).
- Apagado pela via OFICIAL `supabase db query --linked "delete from melhores_passagens_trecho;"` (projeto p1-fast,
  vinculado, sem pedir senha). ANTES 60 → DEPOIS 0 (verificado). Só esta tabela; nada mais tocado.
- Reversão: reinserir os 60 do backup.
DESENVOLVIMENTO ("pode"):
- Tela de comparar voltas agora começa VAZIA (sem voltas-demo) e enche com as voltas reais ao vivo; mapa da pista,
  8 curvas e linha de chegada aparecem sem depender de volta; estado "Aguardando as voltas".
- Modo demonstração preservado em `?demo` (carrega a sessão gravada 23/05).
- Provas (Chrome real, CDP): limpo = 0 voltas + mapa + "aguardando o carro", 0 exceção; `?demo` = 2 voltas + 8 curvas;
  tela LIMPA + replay no canal de DEV `cb-dev-flavio` = encheu sozinha com 1 volta "ao vivo" aos ~33s, 0 exceção. Trava 32/0.
