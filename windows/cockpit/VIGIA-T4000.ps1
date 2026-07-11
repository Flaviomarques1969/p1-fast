# ============================================================================
#  VIGIA DA T4000 — o gatilho do AO VIVO e a INJECAO ENERGIZADA (Flavio 2026-07-11).
#  Fica rodando em fundo (entra pela pasta Inicializar via LIGAR-INICIO-AUTOMATICO):
#
#    COCKPIT FORA DO AR + T4000 presente na USB (VID_04D8&PID_014A)
#        -> sobe P1FAST-AO-VIVO.cmd (video/camera + tela do piloto; RaceBox e o
#           motor conectam sozinhos dentro do .exe).
#    COCKPIT NO AR -> socorre o resto da corrente se cair:
#        - servidor de video (porta 8765) morto -> religa o servidor;
#        - pagina do video sem batimento (aba fechada/navegador caiu) -> reabre
#          a pagina (a eleicao entre abas garante que NUNCA transmite em dobro).
#    Sem T4000 (notebook ligado em casa/escritorio) -> NADA vai ao ar.
#
#  Blindagens (auditoria 2026-07-11):
#    - instancia UNICA por mutex nomeado (2 vigias = 2 disparos; a 2a sai na hora);
#    - se o disparo falhar (ex.: Release sumiu), NAO martela: 3 falhas seguidas
#      viram espera de 5 min; Release ausente e detectado ANTES de disparar;
#    - tudo o que a vigia faz fica em %USERPROFILE%\p1fast-sessoes\vigia-t4000.log
#      (diagnostico de campo: "por que nao subiu?").
#
#  Pra parar a vigia agora: feche a janela dela. Pra ela nem nascer no boot:
#  DESLIGAR-INICIO-AUTOMATICO.cmd (que tambem mata a que estiver rodando).
# ============================================================================
$ErrorActionPreference = 'SilentlyContinue'

# ── Instancia unica: mutex nomeado. WaitOne(0) falso = ja tem vigia viva. Mutex
#    abandonado (vigia anterior morreu segurando) lanca excecao MAS adquire — herda.
$mutex = New-Object System.Threading.Mutex($false, 'Local\P1FastVigiaT4000')
$sozinha = $false
try { $sozinha = $mutex.WaitOne(0) } catch { $sozinha = $true }
if (-not $sozinha) {
  Write-Output 'Ja existe outra vigia da T4000 rodando neste Windows. Saindo.'
  Start-Sleep -Seconds 3
  exit
}

$aoVivo        = Join-Path $PSScriptRoot 'P1FAST-AO-VIVO.cmd'
$servidorVideo = Join-Path $PSScriptRoot 'servidor-video-local.ps1'
$exeAoVivo     = Join-Path $PSScriptRoot 'P1Fast.Cockpit.UI\bin\x64\Release\net8.0-windows10.0.19041.0\P1Fast.Cockpit.UI.exe'
$T4_ID         = 'USB\VID_04D8&PID_014A'   # Injepro T4000 (chip Microchip) na USB
$EXE           = 'P1Fast.Cockpit.UI'       # nome do processo da tela do piloto
$logPath       = Join-Path $env:USERPROFILE 'p1fast-sessoes\vigia-t4000.log'

# So EVENTOS entram no log (disparos, socorros, falhas) — nunca o tique de 5 s.
function Anota([string]$msg) {
  $linha = ('{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg)
  Write-Output $linha
  try {
    $dir = Split-Path $logPath
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
    $f = Get-Item $logPath -ErrorAction SilentlyContinue
    if ($f -and $f.Length -gt 1MB) { Remove-Item $logPath -Force }   # nunca cresce sem teto
    Add-Content -Path $logPath -Value $linha -Encoding utf8
  } catch { }
}

# Presenca da T4000: filtra por -InstanceId JA no driver (barato; a varredura completa
# de PnP a cada 5 s era pesada a toa). Provado em bancada 2026-07-11.
function T4000Presente {
  $d = Get-PnpDevice -InstanceId "$T4_ID*" -ErrorAction SilentlyContinue |
       Where-Object { $_.Present -and $_.Status -eq 'OK' }
  return [bool]$d
}

Anota 'Vigia da T4000 ligada: esperando a injecao energizar pra subir o AO VIVO sozinho. (Sem T4000 nada vai ao ar.)'

$falhasSeguidas       = 0
$ultimoSocorroServidor = [DateTime]::MinValue
$ultimoSocorroPagina   = [DateTime]::MinValue

while ($true) {
  $exe = Get-Process -Name $EXE -ErrorAction SilentlyContinue

  if (-not $exe) {
    if (T4000Presente) {
      # Release ausente = o AO VIVO pararia num pause invisivel (janela minimizada) e a
      # vigia martelaria pra sempre. Detecta ANTES e espera com aviso claro no log.
      if (-not (Test-Path $exeAoVivo)) {
        Anota "T4000 presente mas o cockpit RELEASE nao existe ($exeAoVivo). Rode: dotnet build P1Fast.Cockpit.UI -c Release -p:Platform=x64. Tento de novo em 2 min."
        Start-Sleep -Seconds 120
        continue
      }
      Anota 'T4000 na USB e cockpit fora do ar -> subindo P1 FAST AO VIVO...'
      Start-Process -FilePath $aoVivo -WorkingDirectory $PSScriptRoot -WindowStyle Minimized
      # Folga pro boot completo (servidor + pagina + exe) antes de voltar a vigiar.
      Start-Sleep -Seconds 60
      if (Get-Process -Name $EXE -ErrorAction SilentlyContinue) {
        $falhasSeguidas = 0
        Anota 'Cockpit no ar.'
      } else {
        $falhasSeguidas++
        Anota "Cockpit NAO subiu depois do disparo (falha seguida n. $falhasSeguidas)."
        if ($falhasSeguidas -ge 3) {
          Anota 'Tres falhas seguidas: passo a tentar a cada 5 min (nao vou martelar).'
          Start-Sleep -Seconds 300
        }
      }
      continue
    }
  }
  else {
    # Cockpit NO AR: socorre o resto da corrente do video, com throttle de 2 min
    # por peca (nunca martela). /api/vivo responde {ageMs}: idade do ultimo
    # batimento da pagina (-1 = nenhum ainda). Sem resposta = servidor morto.
    $vivo = $null
    try { $vivo = Invoke-RestMethod -Uri 'http://localhost:8765/api/vivo' -TimeoutSec 3 } catch { $vivo = $null }
    if ($null -eq $vivo) {
      if (([DateTime]::UtcNow - $ultimoSocorroServidor).TotalSeconds -gt 120) {
        $ultimoSocorroServidor = [DateTime]::UtcNow
        Anota 'Servidor de video (8765) fora do ar com o cockpit vivo -> religando o servidor...'
        Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',$servidorVideo -WindowStyle Minimized
      }
    }
    elseif ($vivo.ageMs -lt 0 -or $vivo.ageMs -gt 300000) {
      # Limiar de 5 min (nao 60 s): navegador estrangula timer de aba escondida ate
      # ~1/min — 60 s dava falso-positivo com a aba VIVA (visto em bancada 11/07).
      # Pagina morta continua morta; e a eleicao entre abas torna duplicata inofensiva.
      if (([DateTime]::UtcNow - $ultimoSocorroPagina).TotalSeconds -gt 120) {
        $ultimoSocorroPagina = [DateTime]::UtcNow
        Anota 'Pagina do video sem batimento (aba fechada/navegador caiu) -> reabrindo http://localhost:8765/ ...'
        Start-Process 'http://localhost:8765/'
      }
    }
  }

  Start-Sleep -Seconds 5
}
