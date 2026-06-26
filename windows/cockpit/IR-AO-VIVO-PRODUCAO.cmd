@echo off
REM ============================================================================
REM  IR AO VIVO (PRODUCAO) - cockpit do piloto
REM  Abre o .exe lendo o hardware (T4000 + RaceBox) e PUBLICANDO no canal de
REM  PRODUCAO (cockpit-bubi-live) que o app e o Command Box assistem.
REM  Equivale a:  P1Fast.Cockpit.UI.exe --live --producao
REM  Para SO TESTAR sem ir ao ar, use IR-AO-VIVO-TESTE.cmd (canal seguro).
REM ============================================================================
setlocal
chcp 65001 >nul
title IR AO VIVO (PRODUCAO) - P1 Fast Cockpit

set "EXE=%~dp0P1Fast.Cockpit.UI\bin\x64\Debug\net8.0-windows10.0.19041.0\P1Fast.Cockpit.UI.exe"

if not exist "%EXE%" (
  echo.
  echo [ERRO] Nao encontrei o cockpit em:
  echo   %EXE%
  echo.
  echo Provavel: o .exe ainda nao foi buildado neste notebook.
  echo.
  pause
  exit /b 1
)

echo.
echo  ============================================================
echo     ATENCAO: isto vai AO VIVO em PRODUCAO.
echo     O app e o Command Box vao receber os dados deste cockpit.
echo     (canal cockpit-bubi-live)
echo  ============================================================
echo.
echo  Antes de continuar, confira:
echo    [ ] T4000 ligada no cabo USB
echo    [ ] RaceBox ligado (Bluetooth)
echo    [ ] internet do notebook (hotspot do iPhone) ativa
echo.
choice /c SN /n /m "Ir ao vivo agora? (S = sim / N = nao): "
if errorlevel 2 (
  echo Cancelado. Nada foi ao ar.
  timeout /t 2 >nul
  exit /b 0
)

echo.
echo Subindo o cockpit AO VIVO (producao)...
start "" "%EXE%" --live --producao
exit /b 0
