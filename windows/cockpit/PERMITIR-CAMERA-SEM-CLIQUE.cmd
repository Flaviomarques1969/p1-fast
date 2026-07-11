@echo off
REM ============================================================================
REM  CAMERA SEM CLIQUE - elimina de vez o "Permitir" do navegador.
REM  Grava a politica VideoCaptureAllowedUrls (Edge e Chrome) autorizando a
REM  camera pra http://localhost:8765 (a Central de Pista local). Com isso:
REM    - nunca mais aparece o pedido de permissao da camera pra essa pagina;
REM    - a permissao NAO se perde se o perfil do navegador for limpo/trocado.
REM  Rode UMA vez COMO ADMINISTRADOR (botao direito -> Executar como administrador).
REM  Pra desfazer: DESFAZER-CAMERA-SEM-CLIQUE.cmd.
REM ============================================================================
setlocal
chcp 65001 >nul
title CAMERA SEM CLIQUE (P1 Fast)

net session >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [ERRO] Este script precisa rodar COMO ADMINISTRADOR.
  echo  Botao direito no arquivo ^> "Executar como administrador" e rode de novo.
  echo.
  pause
  exit /b 1
)

reg add "HKLM\SOFTWARE\Policies\Microsoft\Edge\VideoCaptureAllowedUrls" /v 1 /t REG_SZ /d "http://localhost:8765" /f >nul
reg add "HKLM\SOFTWARE\Policies\Google\Chrome\VideoCaptureAllowedUrls" /v 1 /t REG_SZ /d "http://localhost:8765" /f >nul

echo.
echo  PRONTO: a camera em http://localhost:8765 esta autorizada por politica
echo  (Edge e Chrome). Feche e reabra o navegador uma vez pra ele ler a politica.
echo  A Central de Pista agora liga a camera sem NENHUM clique.
echo.
pause
exit /b 0
