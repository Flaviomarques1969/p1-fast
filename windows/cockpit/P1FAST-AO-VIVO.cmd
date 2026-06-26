@echo off
REM ============================================================================
REM  P1 FAST - AO VIVO (um clique faz tudo)
REM  1) sobe o cockpit do piloto AO VIVO em PRODUCAO (.exe --live --producao):
REM     le T4000 (USB) + RaceBox (Bluetooth) e publica no canal cockpit-bubi-live
REM     (que o app e o Command Box assistem). O .exe pega o RaceBox PRIMEIRO.
REM  2) depois abre a pagina de video da pista (p1tv) no navegador.
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
  echo Provavel: o .exe ainda nao foi buildado neste notebook.
  echo.
  pause
  exit /b 1
)

echo.
echo  ====================================================
echo     P1 FAST - indo AO VIVO (PRODUCAO)
echo  ====================================================
echo  Confira ligados: T4000 (USB) . RaceBox (Bluetooth) . internet (hotspot iPhone)
echo.

REM 1) cockpit do piloto ao vivo em producao (pega o RaceBox primeiro)
start "" "%EXE%" --live --producao

REM 2) da uns segundos pro cockpit assumir o RaceBox, depois abre o video
echo  Subindo o cockpit... abrindo o video em seguida.
timeout /t 6 >nul
start "" "https://p1tv.vercel.app/"

exit /b 0
