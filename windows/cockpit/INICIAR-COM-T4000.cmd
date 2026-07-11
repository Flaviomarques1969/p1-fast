@echo off
REM ============================================================================
REM  INICIAR COM A T4000 - liga a VIGIA que espera a injecao energizar.
REM  Quando a T4000 aparecer na USB, o P1 FAST AO VIVO sobe SOZINHO (video/camera
REM  + tela do piloto; RaceBox e motor conectam sozinhos dentro do .exe).
REM  Sem T4000, nada vai ao ar. E o que a pasta Inicializar chama no boot
REM  (LIGAR-INICIO-AUTOMATICO.cmd). Pra parar: feche a janela da vigia.
REM ============================================================================
setlocal
chcp 65001 >nul
title VIGIA T4000 (P1 Fast)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0VIGIA-T4000.ps1"
exit /b 0
