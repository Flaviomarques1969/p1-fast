# ============================================================================
#  Servidor local do vídeo da pista (p1tv) — roda no PRÓPRIO notebook.
#  Serve a página corrigida de web/teste-aparelhos/ em http://localhost:8765/
#  e REPASSA o POST /api/room pro backend de vídeo (porta de room.js).
#  Com isso o vídeo roda sem depender do deploy no Vercel (Mac).
#  localhost é "contexto seguro" -> a câmera funciona normalmente.
# ============================================================================
$ErrorActionPreference = 'SilentlyContinue'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$prefix = 'http://localhost:8765/'
$ROOM_BACKEND = 'https://fam-racing.vercel.app/api/video/room'
$EVENT_ID = 'p1-teste-aparelhos'
# Versao deste servidor (auditoria 2026-07-11): exposta em /api/vivo. Quando um servidor
# NOVO acha a porta ocupada por um VELHO (sem /api/vivo ou ver menor), ele encerra o velho
# e assume — senao um servidor de dias atras seguraria a porta com codigo antigo pra sempre
# (aconteceu de verdade: servidor de 07/07 vivo na auditoria de 11/07).
$VERSAO = 2

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try { $listener.Start() } catch {
  # Porta ocupada: se o dono e desta versao (ou mais novo), sai — ja tem servidor bom.
  $verDoDono = $null
  try { $verDoDono = (Invoke-RestMethod 'http://localhost:8765/api/vivo' -TimeoutSec 3).ver } catch { $verDoDono = $null }
  if ($null -ne $verDoDono -and [int]$verDoDono -ge $VERSAO) {
    Write-Output "Porta 8765 ja em uso por um servidor atual (v$verDoDono). Saindo."
    return
  }
  Write-Output "Porta 8765 em uso por um servidor ANTIGO -> encerrando o antigo e assumindo..."
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
    Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -match 'servidor-video-local' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 2
  # HttpListener que falhou no Start() fica DESCARTADO (.NET) — a nova tentativa
  # precisa de uma instancia NOVA, senao falha sempre (provado em bancada 11/07).
  $listener = New-Object System.Net.HttpListener
  $listener.Prefixes.Add($prefix)
  try { $listener.Start() } catch {
    Write-Output "Nao consegui assumir a porta 8765 (dono nao identificado). Saindo."
    return
  }
}
Write-Output "Servidor de video local em $prefix (raiz: $root). Feche esta janela para parar."

$mime = @{
  '.html'='text/html; charset=utf-8'; '.htm'='text/html; charset=utf-8';
  '.js'='text/javascript; charset=utf-8'; '.mjs'='text/javascript; charset=utf-8';
  '.css'='text/css; charset=utf-8'; '.json'='application/json; charset=utf-8';
  '.svg'='image/svg+xml'; '.ico'='image/x-icon'; '.png'='image/png';
  '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.gif'='image/gif';
  '.woff'='font/woff'; '.woff2'='font/woff2'; '.ttf'='font/ttf'; '.map'='application/json'
}

Add-Type -AssemblyName System.Net.Http
$http = New-Object System.Net.Http.HttpClient
# Timeout CURTO no proxy (auditoria 2026-07-11): o default de 100 s deixava este
# servidor (single-thread) preso atras de uma internet de pista morta — e ai nem
# os arquivos da propria pagina eram mais servidos. 15 s e folga suficiente.
$http.Timeout = [TimeSpan]::FromSeconds(15)

# Batimento da pagina (auditoria 2026-07-11): a pagina POSTa /api/vivo a cada 5 s;
# a VIGIA-T4000 pergunta (GET) e, se nao ha batimento (aba fechada/navegador caiu),
# reabre a pagina sozinha. -1 = nenhum batimento desde que o servidor subiu.
$vivoTs = $null

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    $res.Headers.Add('Access-Control-Allow-Origin','*')
    $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)

    if ($path -eq '/api/vivo') {
      if ($req.HttpMethod -eq 'POST') { $vivoTs = [DateTime]::UtcNow }
      $age = -1
      if ($null -ne $vivoTs) { $age = [int64](([DateTime]::UtcNow - $vivoTs).TotalMilliseconds) }
      $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"ageMs":' + $age + ',"ver":' + $VERSAO + '}')
      $res.ContentType = 'application/json; charset=utf-8'
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      $res.Close()
      continue
    }

    if ($path -eq '/api/room') {
      # porta de room.js: cria/recupera a sala do dia no backend de video (server-to-server).
      # Backend inacessivel = 502 com corpo claro (a pagina ja trata como falha e religa
      # com backoff) — antes a excecao derrubava a resposta no meio (reset sem status).
      $dateISO = (Get-Date).ToString('yyyy-MM-dd')
      $payload = (@{ eventId=$EVENT_ID; dateISO=$dateISO } | ConvertTo-Json -Compress)
      $content = New-Object System.Net.Http.StringContent($payload, [System.Text.Encoding]::UTF8, 'application/json')
      $code = 502
      $text = '{"error":"backend de video inacessivel (internet da pista fora?)"}'
      try {
        $r = $http.PostAsync($ROOM_BACKEND, $content).Result
        if ($null -ne $r) {
          $code = [int]$r.StatusCode
          $text = $r.Content.ReadAsStringAsync().Result
        }
      } catch { }
      $res.StatusCode = $code
      $res.ContentType = 'application/json; charset=utf-8'
      $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      $res.Close()
      continue
    }

    if ($path -eq '/') { $path = '/web/teste-aparelhos/index.html' }
    $file = Join-Path $root ($path.TrimStart('/'))
    if (Test-Path $file -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      $ct = $mime[$ext]; if (-not $ct) { $ct = 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $res.Headers.Add('Cache-Control','no-store, no-cache, must-revalidate')
      $res.ContentType = $ct
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
    }
    $res.Close()
  } catch { try { $ctx.Response.Close() } catch {} }
}
