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

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try { $listener.Start() } catch {
  Write-Output "Porta 8765 ja em uso (servidor provavelmente ja rodando). Saindo."
  return
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

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    $res.Headers.Add('Access-Control-Allow-Origin','*')
    $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)

    if ($path -eq '/api/room') {
      # porta de room.js: cria/recupera a sala do dia no backend de video (server-to-server)
      $dateISO = (Get-Date).ToString('yyyy-MM-dd')
      $payload = (@{ eventId=$EVENT_ID; dateISO=$dateISO } | ConvertTo-Json -Compress)
      $content = New-Object System.Net.Http.StringContent($payload, [System.Text.Encoding]::UTF8, 'application/json')
      $r = $http.PostAsync($ROOM_BACKEND, $content).Result
      $text = $r.Content.ReadAsStringAsync().Result
      $res.StatusCode = [int]$r.StatusCode
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
      $res.ContentType = $ct
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
    }
    $res.Close()
  } catch { try { $ctx.Response.Close() } catch {} }
}
