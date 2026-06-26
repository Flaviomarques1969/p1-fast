@echo off
REM ============================================================================
REM  ENSAIO (TESTE) - cockpit do piloto
REM  Abre o .exe lendo o hardware (T4000 + RaceBox), mas publicando no canal de
REM  TESTE (seguro) - o app/Command Box de producao NAO recebem.
REM  Equivale a:  P1Fast.Cockpit.UI.exe --live
REM  Para ir AO VIVO de verdade, use IR-AO-VIVO-PRODUCAO.cmd.
REM ============================================================================
setlocal
chcp 65001 >nul
title ENSAIO (TESTE) - P1 Fast Cockpit

set "EXE=%~dp0P1Fast.Cockpit.UI\bin\x64\Debug\net8.0-windows10.0.19041.0\P1Fast.Cockpit.UI.exe"

if not exist "%EXE%" (
  echo.
  echo [ERRO] Nao encontrei o cockpit em:
  echo   %EXE%
  echo.
  pause
  exit /b 1
)

echo.
echo  Modo ENSAIO (canal de TESTE - seguro, nao vai ao ar).
echo  Subindo o cockpit...
REM Abre na 2a tela (a do carro). Se cair na tela errada, troque 2 por 1 (ou 3).
start "" "%EXE%" --live --display-index 2
exit /b 0
