@echo off
REM ============================================================================
REM  P1 FAST - AO VIVO (tela do piloto)
REM  Sobe SO o cockpit do piloto AO VIVO em PRODUCAO (.exe --live --producao),
REM  em tela cheia. Le T4000 (USB) + RaceBox (Bluetooth) e publica no canal
REM  cockpit-bubi-live (que o app e o Command Box assistem).
REM  O VIDEO (p1tv) NAO abre aqui de proposito: ele vai entrar sozinho e POR TRAS
REM  quando a pagina estiver com auto-inicio (em construcao). A tela do piloto
REM  nunca deve sair pra mostrar o navegador.
REM  Para ENSAIO sem ir ao ar, use IR-AO-VIVO-TESTE.cmd.
REM ============================================================================
setlocal
chcp 65001 >nul
title P1 FAST - AO VIVO

set "EXE=%~dp0P1Fast.Cockpit.UI\bin\x64\Debug\net8.0-windows10.0.19041.0\P1Fast.Cockpit.UI.exe"

if not exist "%EXE%" (
  echo.
  echo [ERRO] Nao encontrei o cockpit em:
  echo   %EXE%
  echo.
  pause
  exit /b 1
)

start "" "%EXE%" --live --producao
exit /b 0
