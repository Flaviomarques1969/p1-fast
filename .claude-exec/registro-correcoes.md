# Registro de correções — P1 Fast

Formato: data · CATEGORIA · arquivo/sintoma · o que era · correção · teste/prova. Consultar ANTES de editar.

## 2026-07-05 · CONDUTA · harness temporário de preview foi parar num commit (auto-save)
Sintoma: pra fotografar a tela "Alertas" no simulador, modifiquei TEMPORARIAMENTE o entry point
(P1FastApp.swift) e o .task da SetupAvancadoView. O auto-save da IDE COMMITOU o harness sem eu pedir.
Correção: restaurei os 2 arquivos do backup + `git commit` de reversão; conferi `git show HEAD:...`
= 0 marcas de harness e a seção Alertas real intacta. Prova: harness no HEAD dos 2 arquivos = 0.
Lição: ao fazer harness/modificação temporária em projeto com auto-save, SEMPRE reverter E conferir
o HEAD (não só o working tree) antes de fechar — o auto-save pode ter versionado o temporário.

## 2026-07-05 · CÓDIGO · dotnet test dá "exit 0" mesmo sem rodar os testes
Sintoma: `dotnet test` do domínio retornou exit 0, mas NÃO rodou os testes — abortou com "You must install
or update .NET to run this application" (testhost é net8.0; neste iMac só há runtime .NET 10).
Correção: rodar com `DOTNET_ROLL_FORWARD=Major dotnet test ...` (roll-forward do net8 pro runtime 10). NÃO
alterei o .csproj (é compartilhado com o notebook). Prova: passou de "Anulada" pra 396/396 aprovados.
Lição: nunca confiar só no exit code do `dotnet test` — conferir a linha "Aprovado/Com falha" na saída.

## 2026-07-05 · CÓDIGO · AprendizadoTemperatura.cs · salto no padrão após pausa longa
Sintoma (achado na auto-auditoria): intervalo grande entre amostras (box, religada, buraco na captura) fazia
`dt` gigante → aprendizado dava um salto e podia erodir a máxima normal com temperatura de box frio →
alarme falso na volta seguinte. Correção: teto `DtMaxS=5s` no dt do aprendizado (configurável). Prova:
396/396 verdes (ATP_06 reescrito pra amostras reais em vez do atalho dt=300).

## 2026-10-27 · CÓDIGO · MainWindow.Live.cs + T4000Capture/Program.cs · religação derrubava a conexão do celular
Sintoma: teste de rua — no Wi-Fi o ao-vivo funcionava, no celular nunca voltou. Causa: o laço marcava a hora da
tentativa ANTES do ConnectAsync, que volta antes do phx_reply; conectar no celular > 2 s → o giro seguinte via
"offline há > 2 s" e derrubava a conexão nova antes da entrada, em laço. Correção 42535e946: Domain/ReligacaoNuvem.cs
(regra única; espera do FIM da tentativa; socket aberto sem join até 10 s). Prova: ReligacaoNuvemTests 3/3, controle
com a regra antiga reprova 2; Domain.Tests 609/609. Prova de campo (notebook, troca Wi-Fi → celular): NÃO VERIFICADO.
Lição: laço de religação nunca conta prazo a partir do INÍCIO de uma tentativa assíncrona que não terminou de verdade.

## 2026-10-27 — CÓDIGO — web/teste-aparelhos/index.html (vídeo do notebook: laço entra/sai na sala, 429, sala lotada)
Sintoma: "câmera não entrou no TV box", Meeting is full + /api/room 429. Causa: daily-js 0.93.0 emite 'left-meeting' quando a própria página
destrói a chamada velha; onVideoDown tratava como queda nova (laço), e 'error' + join rejeitado agendavam 2 religações. Correção c399a9fc3:
geração por chamada + uma religação marcada. Prova: tests/node-smoke-religacao-video-notebook.mjs 8/8 (558→4 e 202→2 entradas; controle 1b9857db6
reprova). Prova de campo no notebook: NÃO VERIFICADO. Lição: aviso de "saí da sala" de chamada que EU destruí nunca é queda.

## 2026-10-28 · CÓDIGO · TV do box (_design-reference/mockup-command-box-vista-piloto.html, coluna do mapa) · "ACEL"/"FREIO" do círculo G com 3,9 px
O que era: ao levar o círculo G para a coluna (52 px), os rótulos de dentro do desenho caíram de ~7,5 para 3,9 px na tela; a régua provar-coluna.mjs dava 9 px porque media letra de SVG pela escala da coluna, não do desenho (régua cega).
Correção: na coluna os rótulos saem do desenho e ficam ao lado (::before/::after, 9,76 px); régua mede SVG pela escala real e mede os ::before/::after.
Prova: provar-coluna.mjs fim e --pior: 0 letras < 9,7 px, 0 cobertos/cortes/fora; controle --controle-antigo acusa ACEL/FREIO 3,9 px.

## 2026-10-28 · CÓDIGO · TV do box (mockup, desenharTrechosMapa) · «N,N m do ápice» cortado na borda direita do mapa
O que era: texto sempre à direita da cruz; curva encostada na beira direita (giro da pista) saía cortada. medir-apice.mjs só olhava UM instante (fim do 21/06), onde não acontecia — régua cega.
Correção: texto que passa da borda da .b-map vai para a esquerda da cruz (text-anchor end). Prova: medir-perda-vivo.mjs seção C (cena sintética da volta 4 reproduz o corte) APROVADO; TV anterior REPROVA («15,1 m do ápice» sai do mapa). CORRIGIDO.
