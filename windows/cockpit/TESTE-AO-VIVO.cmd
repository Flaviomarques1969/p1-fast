@echo off
REM ============================================================================
REM  P1 FAST - TESTE AO VIVO (um clique faz o ensaio inteiro, SEM ir ao ar)
REM   1) trava de 2a copia: se o cockpit ja esta aberto, nao sobe nada de novo.
REM   2) compila o cockpit RELEASE (so o que mudou; nunca abre um .exe velho
REM      em silencio - se nao compilar, mostra a data do .exe que vai abrir).
REM   3) sobe o servidor de video LOCAL e abre o video no canal de TESTE
REM      (http://localhost:8765/?canal=cockpit-bubi-dev-teste), por tras.
REM   4) sobe a tela do piloto (.exe --live, SEM --producao) em tela cheia.
REM  Nao precisa da T4000: o GPS (RaceBox) vai pro canal de teste e o cockpit
REM  fica "esperando a T4000" ate ela plugar. O app e o Command Box de PRODUCAO
REM  NAO recebem nada. A TV do box assiste com ?canal=cockpit-bubi-dev-teste.
REM  Para ir AO VIVO de verdade (producao): icone "P1 FAST - AO VIVO".
REM ============================================================================
setlocal
chcp 65001 >nul
title P1 FAST - TESTE AO VIVO (canal de teste)

set "CANAL=cockpit-bubi-dev-teste"
set "EXE=%~dp0P1Fast.Cockpit.UI\bin\x64\Release\net8.0-windows10.0.19041.0\P1Fast.Cockpit.UI.exe"

REM 1) trava de 2a copia (o RaceBox so conversa com um programa por vez)
tasklist /FI "IMAGENAME eq P1Fast.Cockpit.UI.exe" 2>nul | find /I "P1Fast.Cockpit.UI.exe" >nul
if not errorlevel 1 (
  echo.
  echo  O cockpit JA esta aberto - nada a fazer.
  echo  Para recomecar o teste: feche o cockpit e clique de novo.
  timeout /t 5 >nul
  exit /b 0
)

REM 2) compila o RELEASE (incremental: se nada mudou, leva poucos segundos)
echo.
echo  Compilando o cockpit RELEASE (na 1a vez leva alguns minutos)...
set "MSBUILDDISABLENODEREUSE=1"
call dotnet build "%~dp0P1Fast.Cockpit.UI\P1Fast.Cockpit.UI.csproj" -c Release -p:Platform=x64 -nologo -v q -nodeReuse:false
set "RC=%ERRORLEVEL%"
call dotnet build-server shutdown >nul 2>&1
if not "%RC%"=="0" (
  echo.
  echo  [AVISO] O cockpit RELEASE NAO compilou ^(codigo %RC%^) - veja as linhas acima.
  if not exist "%EXE%" (
    echo  E nao existe nenhum RELEASE anterior neste notebook. Nada foi aberto.
    pause
    exit /b 1
  )
  for %%e in ("%EXE%") do echo  Vou abrir o RELEASE ANTERIOR, de %%~te.
  choice /c SN /n /m "  Abrir mesmo assim? (S = sim / N = nao): "
  if errorlevel 2 exit /b 1
)
if not exist "%EXE%" (
  echo  [ERRO] Compilou mas nao achei o .exe em:
  echo    %EXE%
  pause
  exit /b 1
)

REM 3) video no canal de TESTE, por tras (o servidor sai sozinho se ja estiver rodando)
start "Servidor de video P1 Fast" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor-video-local.ps1"
timeout /t 3 >nul
start "" "http://localhost:8765/?canal=%CANAL%"
timeout /t 3 >nul

REM 4) tela do piloto em TELA CHEIA, POR CIMA, na 2a tela (a do carro) - canal de TESTE.
REM    Se abrir na tela errada, troque 2 por 1 (ou 3) aqui embaixo.
echo  Subindo o cockpit no canal de TESTE (%CANAL%)...
start "" "%EXE%" --live --display-index 2
exit /b 0
