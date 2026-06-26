@echo off
REM ============================================================================
REM  LIGA o inicio automatico: P1 Fast abre sozinho quando o notebook liga (login).
REM  Cria um atalho pra P1FAST-AO-VIVO.cmd na pasta de Inicializar do Windows.
REM  Para desligar, rode DESLIGAR-INICIO-AUTOMATICO.cmd.
REM ============================================================================
setlocal
set "HERE=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$startup=[Environment]::GetFolderPath('Startup'); $lnk=Join-Path $startup 'P1 FAST - AO VIVO (inicio automatico).lnk'; $here='%HERE%'.TrimEnd('\'); $cmd=Join-Path $here 'P1FAST-AO-VIVO.cmd'; $exe=Join-Path $here 'P1Fast.Cockpit.UI\bin\x64\Debug\net8.0-windows10.0.19041.0\P1Fast.Cockpit.UI.exe'; $w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut($lnk); $s.TargetPath=$cmd; $s.WorkingDirectory=$here; $s.IconLocation=\"$exe,0\"; $s.WindowStyle=7; $s.Description='P1 Fast inicio automatico'; $s.Save(); if(Test-Path $lnk){Write-Host ''; Write-Host 'LIGADO: P1 Fast vai abrir sozinho quando o notebook ligar.'}else{Write-Host 'Falhou.'}"
echo.
pause
