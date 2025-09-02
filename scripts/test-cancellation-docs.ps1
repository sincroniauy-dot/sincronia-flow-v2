<# 
  Sincronia Flow - Test de documentos de cancelación
  - Quita claves hardcodeadas (NO guardar secretos aquí).
  - Usa variable de entorno FIREBASE_WEB_API_KEY o GOOGLE_API_KEY si existiera.
  - No envía cabecera x-api-key si no hay valor.
#>

param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$CancellationId = "demo-cancel-001",
  [string]$ApiKey = $(if ($env:FIREBASE_WEB_API_KEY) { $env:FIREBASE_WEB_API_KEY } elseif ($env:GOOGLE_API_KEY) { $env:GOOGLE_API_KEY } else { "" })
)

$ErrorActionPreference = "Stop"

# Cabeceras básicas
$Headers = @{ "Content-Type" = "application/json" }
if (-not [string]::IsNullOrWhiteSpace($ApiKey)) {
  # Si algún día necesitás una API key del lado cliente, se envía aquí.
  $Headers["x-api-key"] = $ApiKey
}

$PreviewUrl = "$BaseUrl/api/cancellations/$CancellationId/docs/preview"
$IssueUrl   = "$BaseUrl/api/cancellations/$CancellationId/docs/issue"

# Carpeta de salida
$OutDir = Join-Path $PSScriptRoot "out"
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

# 1) PREVIEW (GET -> PDF)
$PreviewPath = Join-Path $OutDir "preview.pdf"
Write-Host "Descargando preview desde: $PreviewUrl"
Invoke-WebRequest -Uri $PreviewUrl -Headers $Headers -OutFile $PreviewPath -Method GET
Write-Host "Preview guardado en: $PreviewPath"
try { Start-Process $PreviewPath } catch { }

# 2) ISSUE (POST -> JSON con signedUrl)
$Body = @{ templateVersion = "v1"; notes = "test via script" } | ConvertTo-Json -Compress
Write-Host "Emitiendo documento en: $IssueUrl"
$IssueResp = Invoke-RestMethod -Uri $IssueUrl -Headers $Headers -Method POST -Body $Body -ContentType "application/json"

Write-Host "`nRespuesta (issue):"
$IssueResp | ConvertTo-Json -Depth 8

if ($IssueResp.signedUrl) {
  Write-Host "`nAbrir signedUrl temporal..."
  try { Start-Process $IssueResp.signedUrl } catch { }
}

Write-Host "`nListo."
