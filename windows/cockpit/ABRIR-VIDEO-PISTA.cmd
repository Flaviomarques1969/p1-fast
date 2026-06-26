@echo off
REM ============================================================================
REM  ABRIR VIDEO DA PISTA (local) - Central de Pista no PROPRIO notebook
REM  Sobe o servidor de video local e abre http://localhost:8765/ no navegador.
REM  Use no 1o uso pra PERMITIR A CAMERA uma vez (o navegador pergunta -> "Permitir").
REM  Depois disso, o ICONE "P1 FAST - AO VIVO" liga tudo sozinho (video atras).
REM  A pagina servida aqui ja e a CORRIGIDA (sem o loop de religar do 429).
REM ============================================================================
setlocal
chcp 65001 >nul
title ABRIR VIDEO DA PISTA (local)

REM 1) servidor de video local (se ja roda, ele sai sozinho)
start "Servidor de video P1 Fast" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor-video-local.ps1"

REM 2) tempo do servidor subir
timeout /t 3 >nul

echo.
echo  Abrindo a Central de Pista (video + GPS) no navegador...
echo    http://localhost:8765/
echo.
echo  Conecte a Osmo Action 6 (webcam USB). Se o navegador pedir, clique PERMITIR
echo  na camera - so precisa uma vez.
echo.
start "" "http://localhost:8765/"
timeout /t 3 >nul
exit /b 0
