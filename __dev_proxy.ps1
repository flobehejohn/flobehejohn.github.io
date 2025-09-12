Add-Type -AssemblyName System.Net.Http
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://127.0.0.1:9090/')
$listener.Start()
Write-Host "[proxy] listening http://127.0.0.1:9090 -> https://gestioncommandesapi.agreeablepebble-e135b62f.westeurope.azurecontainerapps.io"
$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromSeconds(60)

while (True) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request; $res = $ctx.Response
  try {
    if ($req.HttpMethod -eq 'OPTIONS') {
      $res.StatusCode = 204
      $res.Headers.Add('Access-Control-Allow-Origin','http://127.0.0.1:8080')
      $res.Headers.Add('Access-Control-Allow-Methods','GET,POST,PUT,PATCH,DELETE,OPTIONS')
      $res.Headers.Add('Access-Control-Allow-Headers','*, Authorization, Content-Type, X-Requested-With')
      $res.Headers.Add('Access-Control-Allow-Credentials','true')
      $res.Close(); continue
    }
    $pq = $req.Url.PathAndQuery
    if (-not $pq.StartsWith('/api')) { $res.StatusCode = 404; $res.Close(); continue }
    $uri = 'https://gestioncommandesapi.agreeablepebble-e135b62f.westeurope.azurecontainerapps.io' + $pq

    $msg = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($req.HttpMethod), $uri)
    foreach ($h in $req.Headers.AllKeys) { if ($h -in @('Host','Origin','Referer','Content-Length')) { continue } $msg.Headers.TryAddWithoutValidation($h, $req.Headers[$h]) | Out-Null }
    if ($req.HasEntityBody) {
      $ms = New-Object IO.MemoryStream; $req.InputStream.CopyTo($ms); $ms.Position = 0
      $content = New-Object System.Net.Http.StreamContent($ms)
      if ($req.ContentType) { $content.Headers.ContentType = $req.ContentType }
      $msg.Content = $content
    }
    $resp = $client.SendAsync($msg).GetAwaiter().GetResult()
    $res.StatusCode = [int]$resp.StatusCode
    foreach ($h in $resp.Headers) { $res.Headers[$h.Key] = [string]::Join(',', $h.Value) }
    if ($resp.Content) {
      foreach ($h in $resp.Content.Headers) { $res.Headers[$h.Key] = [string]::Join(',', $h.Value) }
      $bytes = $resp.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
      $res.OutputStream.Write($bytes,0,$bytes.Length)
    }
    $res.Headers['Access-Control-Allow-Origin'] = 'http://127.0.0.1:8080'
    $res.Headers['Vary'] = 'Origin'
    $res.Close()
  } catch {
    $res.StatusCode = 502
    $res.Headers['Access-Control-Allow-Origin'] = 'http://127.0.0.1:8080'
    $msg = [Text.Encoding]::UTF8.GetBytes(.Exception.Message)
    $res.OutputStream.Write($msg,0,$msg.Length)
    $res.Close()
  }
}
