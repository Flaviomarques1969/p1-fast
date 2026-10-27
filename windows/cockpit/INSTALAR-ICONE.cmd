@echo off
REM ============================================================================
REM  Cria/recria os icones na area de trabalho deste notebook. Rode 1 vez (ou de
REM  novo se um icone sumir):
REM   "P1 FAST - AO VIVO"        -> P1FAST-AO-VIVO.cmd  (PRODUCAO: app e Box recebem)
REM   "P1 FAST - TESTE AO VIVO"  -> TESTE-AO-VIVO.cmd   (canal de TESTE, sem T4000) - E4 27/10/2026
REM  O desenho do icone vem do .exe RELEASE (ou do Debug, se o Release ainda nao existe).
REM ============================================================================
setlocal
set "HERE=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$here='%HERE%'.TrimEnd('\'); $exe=Join-Path $here 'P1Fast.Cockpit.UI\bin\x64\Release\net8.0-windows10.0.19041.0\P1Fast.Cockpit.UI.exe'; if(-not (Test-Path $exe)){ $exe=Join-Path $here 'P1Fast.Cockpit.UI\bin\x64\Debug\net8.0-windows10.0.19041.0\P1Fast.Cockpit.UI.exe' }; $d=[Environment]::GetFolderPath('Desktop'); $w=New-Object -ComObject WScript.Shell; foreach($i in @(@('P1 FAST - AO VIVO','P1FAST-AO-VIVO.cmd','P1 Fast - cockpit ao vivo (producao) + video da pista.',7), @('P1 FAST - TESTE AO VIVO','TESTE-AO-VIVO.cmd','P1 Fast - ensaio no canal de TESTE (nao vai ao ar), sem precisar da T4000.',1))){ $lnk=Join-Path $d ($i[0]+'.lnk'); $s=$w.CreateShortcut($lnk); $s.TargetPath=(Join-Path $here $i[1]); $s.WorkingDirectory=$here; $s.IconLocation=\"$exe,0\"; $s.WindowStyle=$i[3]; $s.Description=$i[2]; $s.Save(); if(Test-Path $lnk){Write-Host ('OK: icone '+$i[0]+' criado na area de trabalho.')}else{Write-Host ('FALHOU ao criar o icone '+$i[0]+'.')} }"
echo.
pause
