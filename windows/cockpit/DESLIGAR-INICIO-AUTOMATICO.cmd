@echo off
REM ============================================================================
REM  DESLIGA o inicio automatico: P1 Fast NAO abre mais sozinho quando liga o note.
REM  (Remove o atalho da pasta de Inicializar do Windows.) Para religar, use
REM  LIGAR-INICIO-AUTOMATICO.cmd.
REM ============================================================================
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$lnk=Join-Path ([Environment]::GetFolderPath('Startup')) 'P1 FAST - AO VIVO (inicio automatico).lnk'; if(Test-Path $lnk){Remove-Item $lnk -Force; Write-Host ''; Write-Host 'DESLIGADO: P1 Fast nao abre mais sozinho no boot.'}else{Write-Host 'Ja estava desligado.'}"
echo.
pause
