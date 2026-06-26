@echo off
REM ============================================================================
REM  ABRIR VIDEO DA PISTA (p1tv) - pagina "Central de Pista"
REM  Abre p1tv.vercel.app no navegador padrao do notebook. Esta pagina:
REM    - transmite o video (Osmo Action 6 como webcam USB) via Daily.co
REM    - recebe o GPS da NUVEM (publicado pelo .exe) e repassa pro video
REM      *** isto vale para a versao item-3 ja publicada. Se o site no ar
REM          ainda for a versao antiga, ela tenta abrir o RaceBox por BLE e
REM          BRIGA com o .exe pelo aparelho. Confirme o deploy antes da pista. ***
REM  Use junto com IR-AO-VIVO-PRODUCAO.cmd (o cockpit do piloto).
REM ============================================================================
setlocal
chcp 65001 >nul
title ABRIR VIDEO DA PISTA (p1tv)

echo.
echo  Abrindo a Central de Pista (video + GPS) no navegador...
echo    https://p1tv.vercel.app/
echo.
echo  Lembrete: para a CAMERA, conecte a Osmo Action 6 (modo webcam USB) antes,
echo  e deixe esta aba aberta durante a pista.
echo.
start "" "https://p1tv.vercel.app/"
timeout /t 3 >nul
exit /b 0
