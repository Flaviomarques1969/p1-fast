# Ultima tarefa — sintese estado da FRENADA (P1 Fast)

## Pedido original
Sintetizar, em linguagem de gestor, o estado REAL da frenada nas 3 telas (cockpit piloto, app iOS, Command Box), no notebook Windows e na nuvem ao vivo, a partir de mapeamentos COM EVIDENCIA. Regra dura do dono (CORRIGIDA 16/06, ver p1-fast-ARQUITETURA-DEFINITIVA): processa em DOIS lugares — notebook Windows (.exe) pro cockpit do piloto + app na NUVEM pras demais funcoes. Command Box (TV via Fire TV Stick 4K Max) NAO calcula, e janela do app na nuvem. (A frase antiga "demais so recebem pronto" estava errada: a nuvem TAMBEM processa.) Sensor de pressao via T4000 instala 15-16/06; sem ele a frenada e estimativa de GPS.

## Objetivo (1 frase)
Entregar mapa honesto por area + por que o que falta nao e tela + proximo passo real + dependencia do sensor + riscos de invencao.

## Criterio de conclusao
StructuredOutput preenchido com prova verificada nos arquivos, sem afirmar nada nao verificado.

## Ambiente alvo
desenvolvimento (leitura/auditoria). Producao NAO alterada. Autorizacao producao: nao recebida.

## Verificacoes feitas (prova)
- freio-trecho.js: simularFreioPelaFisica (fisica GPS) + detectarPresencaSensorFreio (variacao >=3 un) — JS, existe.
- main-t3000.js:159 — "instalacao 15-16/06"; rotulo FREIO: FISICA GPS ate sensor entrar.
- TELEMETRY_SNAPSHOT_SPEC.md:142 — brake_pressure "quando sensor de freio entrar".
- FONTE_DADOS_AO_VIVO.md:70 — "Pressao freio (sensor nao instalado ainda)".
- Command Box mockup: updateFrenagemFromLap (linha 4297) anima por _shortRevealStateForLap (estado por volta), NAO le realtime; bloco 'frenagem' esta em DEP_LIGACAO (7442) = forcado cb-sem-real "aguardando ligacao".
- Windows MainWindow.xaml.cs:370-371 SetApexPonto("freio") com FreioAtualM/RefM de DemoScene (hardcoded). CockpitState.cs:245 ClassifyFreio so classifica, nao calcula.
- iOS CockpitGpsPublisher.swift:29 — 5 Hz max, so GPS (lat/lng/speed), sem IMU/aceleracao no payload, sem pressao de freio.
- tests/node-smoke-frenagem-real.mjs existe (prova que motor roda em JS puro).

## Status
concluido (auditoria/sintese; nada alterado).
