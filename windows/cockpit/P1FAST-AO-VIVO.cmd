@echo off
REM ============================================================================
REM  P1 FAST - AO VIVO (um clique faz tudo)
REM  Ordem proposital, pra a tela do piloto NUNCA sair:
REM   1) abre o video da pista (p1tv) - a pagina liga SOZINHA (camera + GPS da nuvem).
REM      Ela abre primeiro, entao fica POR TRAS.
REM   2) sobe a tela do piloto (.exe --live --producao) em TELA CHEIA, POR CIMA.
REM  Observacao (uma vez): no 1o uso, o navegador pede "permitir camera?". Faca esse
REM  permitir UMA vez com o ABRIR-VIDEO-PISTA.cmd (video visivel); depois ele lembra e
REM  o auto-inicio funciona escondido atras do cockpit.
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

REM 1) video por tras (liga sozinho)
start "" "https://p1tv.vercel.app/"

REM 2) tempo pra a pagina carregar e a transmissao comecar
timeout /t 4 >nul

REM 3) tela do piloto em TELA CHEIA, POR CIMA
start "" "%EXE%" --live --producao
exit /b 0
