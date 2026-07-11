@echo off
REM ============================================================================
REM  DESLIGA o inicio automatico: P1 Fast NAO abre mais sozinho quando liga o note.
REM  (Remove o atalho da pasta de Inicializar do Windows E mata a vigia da T4000
REM  que estiver rodando agora - senao ela continuaria disparando ate reiniciar.)
REM  Para religar, use LIGAR-INICIO-AUTOMATICO.cmd.
REM ============================================================================
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$lnk=Join-Path ([Environment]::GetFolderPath('Startup')) 'P1 FAST - AO VIVO (inicio automatico).lnk'; if(Test-Path $lnk){Remove-Item $lnk -Force; Write-Host ''; Write-Host 'DESLIGADO: P1 Fast nao abre mais sozinho no boot.'}else{Write-Host 'Ja estava desligado (sem atalho no boot).'}; $vigias=Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -match 'VIGIA-T4000' }; if($vigias){ $vigias | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Write-Host ('Vigia da T4000 que estava rodando: encerrada (' + @($vigias).Count + ' processo(s)).') } else { Write-Host 'Nenhuma vigia rodando agora.' }"
echo.
pause
