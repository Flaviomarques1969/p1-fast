@echo off
REM ============================================================================
REM  Cria/recria o icone "P1 FAST - AO VIVO" na area de trabalho deste notebook.
REM  Rode 1 vez (ou de novo se o icone sumir). Aponta pro P1FAST-AO-VIVO.cmd.
REM ============================================================================
setlocal
set "HERE=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$here='%HERE%'.TrimEnd('\'); $cmd=Join-Path $here 'P1FAST-AO-VIVO.cmd'; $exe=Join-Path $here 'P1Fast.Cockpit.UI\bin\x64\Debug\net8.0-windows10.0.19041.0\P1Fast.Cockpit.UI.exe'; $d=[Environment]::GetFolderPath('Desktop'); $lnk=Join-Path $d 'P1 FAST - AO VIVO.lnk'; $w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut($lnk); $s.TargetPath=$cmd; $s.WorkingDirectory=$here; $s.IconLocation=\"$exe,0\"; $s.WindowStyle=7; $s.Description='P1 Fast - cockpit ao vivo (producao) + video da pista.'; $s.Save(); if(Test-Path $lnk){Write-Host ''; Write-Host 'OK: icone P1 FAST - AO VIVO criado na area de trabalho.'}else{Write-Host 'FALHOU ao criar o icone.'}"
echo.
pause
