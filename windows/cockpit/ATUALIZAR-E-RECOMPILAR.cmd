@echo off
REM ============================================================================
REM  ATUALIZAR E RECOMPILAR - cockpit do piloto (.exe)
REM  Use quando o aplicativo mudou (voce pediu pro Claude, ou veio do iMac) e
REM  precisa gerar o .exe novo. Faz: baixa do GitHub -> fecha o .exe -> recompila.
REM  Depois, e so abrir o icone "P1 FAST - AO VIVO".
REM ============================================================================
setlocal
chcp 65001 >nul
title ATUALIZAR E RECOMPILAR - P1 Fast Cockpit

set "HERE=%~dp0"
set "REPO=%HERE%..\.."
set "DOTNET=C:\Program Files\dotnet\dotnet.exe"
set "PROJ=%HERE%P1Fast.Cockpit.UI\P1Fast.Cockpit.UI.csproj"

echo.
echo  [1/3] Baixando atualizacoes do GitHub...
pushd "%REPO%"
git pull --ff-only
popd

echo.
echo  [2/3] Fechando o cockpit, se estiver aberto...
taskkill /IM P1Fast.Cockpit.UI.exe /F >nul 2>&1

echo.
echo  [3/3] Recompilando o aplicativo... (pode levar ~1 min)
if not exist "%DOTNET%" (
  echo  [ERRO] .NET nao encontrado em: %DOTNET%
  echo.
  pause
  exit /b 1
)
"%DOTNET%" build "%PROJ%" -c Debug -p:Platform=x64 --nologo
if errorlevel 1 (
  echo.
  echo  [FALHOU] A recompilacao deu erro acima.
  echo  Abra o Claude Code aqui no notebook e mostre este erro.
  echo.
  pause
  exit /b 1
)

echo.
echo  ====================================================
echo    PRONTO! Aplicativo atualizado e recompilado.
echo    Agora abra o icone "P1 FAST - AO VIVO".
echo  ====================================================
echo.
pause
