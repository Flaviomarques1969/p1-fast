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
