param(
  [string]$BaseUrl,
  [string]$Email   = "tester@example.com",
  [string]$Pass    = "Passw0rd-123!",
  [string]$ApiKey  = "AIzaSyDxV2BjLqqKQHYURDwSQcgN9EBEvPXiyA4",
  [string]$Id      = "demo-cancel-001"
)

function Resolve-BaseUrl {
  param([string[]]$Candidates)
  foreach ($u in $Candidates) {
    try {
      $r = Invoke-WebRequest -Uri "$u/api/health" -TimeoutSec 2 -ErrorAction Stop
      if ($r.StatusCode -eq 200) { return $u }
    } catch { }
  }
  return $null
}

if (-not $BaseUrl) {
  $BaseUrl = Resolve-BaseUrl @("http://localhost:3000", "http://localhost:3001")
  if (-not $BaseUrl) {
    Write-Host "❌ Server no responde en 3000/3001. Asegurate de correr 'npm run dev' y reintenta." -ForegroundColor Red
    exit 1
  }
}
Write-Host "➡️  Usando BaseUrl: $BaseUrl"

# SignIn -> token
$signin = Invoke-RestMethod -Method Post -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$ApiKey" `
  -Headers @{ "Content-Type"="application/json" } `
  -Body (@{ email=$Email; password=$Pass; returnSecureToken=$true } | ConvertTo-Json)
$token = $signin.idToken
"$Email → SignIn OK"

$uriPrev  = "$BaseUrl/api/cancellations/$Id/docs/preview"
$uriIssue = "$BaseUrl/api/cancellations/$Id/docs/issue"

# OPTIONS preview
$res = Invoke-WebRequest -Method Options -Uri $uriPrev -Headers @{
  Origin="http://localhost:3000"
  "Access-Control-Request-Method"="GET"
  "Access-Control-Request-Headers"="authorization"
}
"OPTIONS preview => $($res.StatusCode)"

# GET preview (pdf + etag)
New-Item -ItemType Directory -Force -Path "$PSScriptRoot\..\tmp" | Out-Null
$pdf = Join-Path "$PSScriptRoot\..\tmp" "preview.pdf"
$res = Invoke-WebRequest -Method Get -Uri $uriPrev -Headers @{
  Authorization="Bearer $token"; Accept="application/pdf"
} -OutFile $pdf -PassThru
"GET preview => $($res.StatusCode)"; $etag = $res.Headers.ETag; "ETag: $etag"

# GET preview con If-None-Match → 304/200
if ($etag) {
  try {
    $null = Invoke-WebRequest -Method Get -Uri $uriPrev -Headers @{ Authorization="Bearer $token"; "If-None-Match"=$etag }
    "GET preview If-None-Match => 200"
  } catch {
    $resp = $_.Exception.Response
    if ($resp -and $resp.StatusCode.value__ -eq 304) { "GET preview If-None-Match => 304" } else { throw }
  }
}

# OPTIONS issue
$res = Invoke-WebRequest -Method Options -Uri $uriIssue -Headers @{
  Origin="http://localhost:3000"
  "Access-Control-Request-Method"="POST"
  "Access-Control-Request-Headers"="authorization,content-type,if-match,if-none-match"
}
"OPTIONS issue => $($res.StatusCode)"

# POST issue + descarga
$body = @{ templateVersion="v1"; notes="Prueba automática" } | ConvertTo-Json -Depth 3
$res = Invoke-RestMethod -Method Post -Uri $uriIssue -Headers @{
  Authorization="Bearer $token"; "Content-Type"="application/json"
} -Body $body

# Compatibilidad PS5/PS7 (sin operador ??)
$status = if ($res.PSObject.Properties.Match('status').Count -gt 0) { $res.status } else { 'OK' }
"POST issue => $status"
$res | ConvertTo-Json -Depth 8

if ($res.signedUrl) {
  $out = Join-Path "$PSScriptRoot\..\tmp" "cancellation_issued.pdf"
  Invoke-WebRequest -Uri $res.signedUrl -OutFile $out
  "Descarga emitido => OK ($out)"
}
