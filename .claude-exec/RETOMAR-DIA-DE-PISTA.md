# ★ RETOMAR DIA DE PISTA — P1 Fast (ponto salvo: 23/06/2026, tarde)

> GATILHO do Flávio: **"RETOMAR DIA DE PISTA"** (ou "voltei dia de pista").
> Ao ver o gatilho: LER ESTE ARQUIVO PRIMEIRO, inteiro, e continuar exatamente daqui.
> Não refazer nada listado como FEITO. Não recomeçar do zero.

## EM UMA FRASE
Estamos deixando "tudo pronto pro dia de pista" (carro de verdade). Eu (Mac) fechei os
buracos de software que dava pra provar; uma 2ª sessão do Claude, NO NOTEBOOK Windows, está
montando o programa (.exe) que roda a tela do cockpit + manda os dados pra nuvem.

## O QUE FOI FEITO E PROVADO HOJE (NÃO refazer)
1. Captura automática por movimento PORTADA pro programa do notebook (C#):
   - windows/cockpit/P1Fast.Cockpit.Domain/SessionRecorder.cs ganhou `AutoCaptura`
     (liga >15 km/h, fecha após 12 s parado <6 km/h) + MotivoUltimoFim/VelKmh/Auto/GpsHaMs.
   - Testes: SessionRecorderAutoTests.cs (5). Comportamento antigo intacto.
2. A COSTURA (cérebro único): windows/cockpit/P1Fast.Cockpit.Domain/CapturaDiaDePista.cs —
   um feed só (motor+GPS) que GRAVA (com auto) + ACENDE o painel + MANDA pra nuvem, junto.
   Inclui conversor motor→alerta (sensor inexistente = null, sem alerta falso).
   - Teste: CapturaDiaDePistaTests.cs (1 ponta a ponta).
3. Program.cs (console de captura): 1 linha de segurança (gravador pode não gravar em espera).
4. Bateria completa do domínio: **262 verdes / 0 falha** (23/06 noite: a antiga falha PAN_04 era
   formatação por locale — número com vírgula no Mac; consertada em LivePanel.cs com
   FormattableString.Invariant, igual o arquivo já fazia nas datas. Painel agora mostra ponto em
   qualquer máquina). Console de captura compila 0 erro.
   Rodar com: cd windows/cockpit && DOTNET_ROLL_FORWARD=Major dotnet test P1Fast.Cockpit.Domain.Tests
   - ATENÇÃO sync: o conserto está na MAIN local (auto-save), NÃO na linha sync do notebook ainda.
     É cosmético e não bloqueia o notebook (lá já sai ponto). Levar pra sync só se o Flávio quiser.

## SINCRONIZAÇÃO DAS DUAS MÁQUINAS (crítico)
- Repositório oficial (GitHub Flaviomarques1969/p1-fast) **parou em 14/06**. Os 9 dias seguintes
  (incl. tudo de hoje) só estavam no Mac (1625 registros locais à frente, auto-save, NÃO no oficial).
- AÇÃO FEITA: enviei tudo numa LINHA SEPARADA `sync/notebook-dia-de-pista-2026-06-23` no GitHub.
  A versão oficial (main) NÃO foi tocada; nada foi ao ar (não há publicação automática — conferido:
  só smoke.yml/windows-cockpit.yml, que são testes; sem vercel.json; publicação aqui é manual).
- O notebook puxa dessa linha pra ter o código atual. NÃO dei push em main (histórico diverge +
  risco de produção). Pra mexer em produção/main = só com a frase "MIGRAR PARA PRODUÇÃO".

## A SESSÃO DO NOTEBOOK (Windows)
- Tarefa dela: montar o .exe que roda a tela do cockpit + manda dados pra nuvem.
- Recebeu um BRIEFING (colei pro Flávio passar) mandando: trocar pra a linha sync, NÃO recomeçar,
  e só LIGAR a tela WinUI na CapturaDiaDePista + o leitor USB + o GPS. Regras duras incluídas.
- O .exe é o consumidor da CapturaDiaDePista: MainWindow.IniciarFeedReal cria
  SessionRecorder(FileSessionStore+AutoCaptura) + CockpitOrchestrator(curvas) + LivePublisher,
  embrulha em CapturaDiaDePista; leitor USB onSample => captura.Motor; GPS => captura.Gps.

## O QUE FALTA (e de quem é)
- Meu/da sessão do notebook (precisa Windows): ligar a tela WinUI na costura + GPS do iPhone (1 Hz,
  primeiro; RaceBox é melhoria) + curvas de Brasília no orquestrador + empacotar/rodar o .exe.
- Físico (Flávio): plugar notebook+carro na bancada; rodar na pista; calibrar 15/6 km/h e 12 s.
- Pendente eu oferecer: passo a passo da bancada (o que plugar / o que aparece na tela).

## ⚠️ DIVERGÊNCIA ABERTA (achada 23/06 noite — Flávio decide, NÃO escolher calado)
- A luz de marcha da tela WinUI (.exe) tem **12 luzes**; a versão aprovada 22/06 tem **17**. Se a
  sessão do notebook só "ligar a tela existente", o .exe sai com a barra ANTIGA de 12. Decisão do
  Flávio: portar as 17 pro WinUI antes do dia de pista, ou deixar 12 e trocar depois? (não mexido)

## REGRAS DURAS (não reabrir)
- 17 luzes só do painel do PILOTO; troca na POTÊNCIA (6.050 rpm), não no redline (6.300).
- Injeção lê-se por USB, nunca CAN. Tela 10,5" deitada, largura toda, sem moldura de celular, sem emoji.
- cockpit-bubi-live é PRODUÇÃO: ouvir pode; publicar dev/replay NÃO (sem "MIGRAR PARA PRODUÇÃO").
- Sempre "você", nunca "tu". Não apagar/sobrescrever sem preservar.

## CONFIG / PERMISSÕES
- .claude/settings.json (criado hoje) libera sem perguntar: dotnet test/build, swift run p1fast-smoke,
  swift build, open. O resto (montar/instalar app, mexer no sistema) ainda pede — é a trava de segurança.

## ARQUIVOS-CHAVE (caminhos reais)
- windows/cockpit/P1Fast.Cockpit.Domain/CapturaDiaDePista.cs  (a costura, NOVO)
- windows/cockpit/P1Fast.Cockpit.Domain/SessionRecorder.cs    (gravador + auto)
- windows/cockpit/P1Fast.Cockpit.Domain/CockpitOrchestrator.cs (cérebro do painel)
- windows/cockpit/P1Fast.Cockpit.Domain/T3000UsbLiveReader.cs + SerialPortT3000UsbChannel.cs (USB)
- windows/cockpit/P1Fast.Cockpit.UI/MainWindow.xaml.cs        (a tela WinUI)
- windows/cockpit/P1Fast.Cockpit.T4000Capture/Program.cs      (console de captura grava+nuvem)
- docs/COCKPIT_FONTE_DA_VERDADE.md                            (contrato do cockpit)
- .claude-exec/tarefa-dia-de-pista-2026-06-23-tarde.md        (registro detalhado da tarefa)
- .claude-exec/GUIA-BANCADA-DIA-DE-PISTA.md                   (passo a passo bancada: o que plugar + o que aparece — criado 23/06 noite)
