@echo off
REM ============================================================================
REM  LIGA o inicio automatico: quando o notebook liga (login), sobe a VIGIA DA
REM  T4000 (INICIAR-COM-T4000.cmd). A vigia espera a injecao energizar e SO
REM  ENTAO sobe o P1 FAST AO VIVO sozinho (video/camera + tela do piloto;
REM  RaceBox e motor conectam sozinhos). Sem T4000, nada vai ao ar (notebook
REM  ligado em casa nao transmite). Decisao Flavio 2026-07-11 - antes o atalho
REM  chamava P1FAST-AO-VIVO.cmd direto, sem olhar a T4000.
REM  Para desligar, rode DESLIGAR-INICIO-AUTOMATICO.cmd.
REM ============================================================================
setlocal
set "HERE=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$startup=[Environment]::GetFolderPath('Startup'); $lnk=Join-Path $startup 'P1 FAST - AO VIVO (inicio automatico).lnk'; $here='%HERE%'.TrimEnd('\'); $cmd=Join-Path $here 'INICIAR-COM-T4000.cmd'; $exe=Join-Path $here 'P1Fast.Cockpit.UI\bin\x64\Release\net8.0-windows10.0.19041.0\P1Fast.Cockpit.UI.exe'; $w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut($lnk); $s.TargetPath=$cmd; $s.WorkingDirectory=$here; $s.IconLocation=\"$exe,0\"; $s.WindowStyle=7; $s.Description='P1 Fast inicio automatico (espera a T4000)'; $s.Save(); if(Test-Path $lnk){Write-Host ''; Write-Host 'LIGADO: no boot a vigia espera a T4000 energizar e sobe o P1 FAST sozinho.'}else{Write-Host 'Falhou.'}"
echo.
pause
