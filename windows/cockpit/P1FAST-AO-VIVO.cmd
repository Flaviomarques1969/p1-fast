@echo off
REM ============================================================================
REM  P1 FAST - AO VIVO (um clique faz tudo) - VIDEO RODA NO PROPRIO NOTEBOOK
REM   1) sobe o servidor de video LOCAL (serve a pagina corrigida + /api/room).
REM      Nao depende do Vercel/Mac. Se ja estiver rodando, ele se encerra sozinho.
REM   2) abre o video (http://localhost:8765/) - a pagina liga SOZINHA (camera+GPS).
REM      Abre primeiro, entao fica POR TRAS.
REM   3) sobe a tela do piloto (.exe --live --producao) em TELA CHEIA, POR CIMA.
REM  1a vez: o navegador pede "permitir camera?" - faca esse permitir UMA vez com o
REM  ABRIR-VIDEO-PISTA.cmd (video visivel). Depois ele lembra e liga sozinho atras.
REM  Para ENSAIO sem ir ao ar, use IR-AO-VIVO-TESTE.cmd.
REM ============================================================================
setlocal
chcp 65001 >nul
title P1 FAST - AO VIVO

REM AO VIVO roda o build RELEASE (otimizado). Nunca subir um binario velho de Debug em
REM silencio: se o Release nao existir, PARA com mensagem clara (nao cai pro Debug).
set "EXE=%~dp0P1Fast.Cockpit.UI\bin\x64\Release\net8.0-windows10.0.19041.0\P1Fast.Cockpit.UI.exe"

if not exist "%EXE%" (
  echo.
  echo [ERRO] Nao encontrei o cockpit RELEASE em:
  echo   %EXE%
  echo.
  echo Provavel: o .exe ainda nao foi buildado em RELEASE neste notebook.
  echo   Build:  dotnet build P1Fast.Cockpit.UI\P1Fast.Cockpit.UI.csproj -c Release -p:Platform=x64
  echo.
  pause
  exit /b 1
)

REM 1) servidor de video local (serve a pagina corrigida + repassa /api/room)
start "Servidor de video P1 Fast" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor-video-local.ps1"

REM 2) tempo do servidor subir
timeout /t 3 >nul

REM 3) video por tras (liga sozinho)
start "" "http://localhost:8765/"

REM 4) tempo da pagina carregar e a transmissao comecar
timeout /t 3 >nul

REM 5) tela do piloto em TELA CHEIA, POR CIMA, na 2a tela (a do carro).
REM    --display-index usa a MESMA numeracao da Configuracao de Tela do Windows.
REM    Se abrir na tela errada, troque 2 por 1 (ou 3) aqui embaixo.
start "" "%EXE%" --live --producao --display-index 2
exit /b 0
