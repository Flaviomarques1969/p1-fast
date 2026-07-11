@echo off
REM ============================================================================
REM  DESFAZ o PERMITIR-CAMERA-SEM-CLIQUE.cmd: remove a politica que autorizava
REM  a camera pra http://localhost:8765 no Edge e no Chrome. O navegador volta
REM  a perguntar "Permitir?" uma vez (e a lembrar no perfil, como antes).
REM  Rode COMO ADMINISTRADOR.
REM ============================================================================
setlocal
chcp 65001 >nul
title DESFAZER camera sem clique (P1 Fast)

net session >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [ERRO] Este script precisa rodar COMO ADMINISTRADOR.
  echo  Botao direito no arquivo ^> "Executar como administrador" e rode de novo.
  echo.
  pause
  exit /b 1
)

reg delete "HKLM\SOFTWARE\Policies\Microsoft\Edge\VideoCaptureAllowedUrls" /v 1 /f >nul 2>&1
reg delete "HKLM\SOFTWARE\Policies\Google\Chrome\VideoCaptureAllowedUrls" /v 1 /f >nul 2>&1

echo.
echo  PRONTO: politica removida. O navegador volta a pedir "Permitir" uma vez.
echo.
pause
exit /b 0
