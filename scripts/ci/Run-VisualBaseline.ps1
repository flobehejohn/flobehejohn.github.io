$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Repo = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $Repo

$Ts = Get-Date -Format 'yyyyMMdd_HHmmss'
$AuditDir = Join-Path $Repo 'audit\_latest'
New-Item -ItemType Directory -Force -Path $AuditDir | Out-Null

$Log = Join-Path $AuditDir "visual-baseline_$Ts.log"

Write-Host "`n=== Visual baseline ==="
npm run ci:visual 2>&1 | Tee-Object -FilePath $Log -Append
Write-Host "`n[OK] Visual baseline terminé. Screenshots: audit/pass0-baseline/screenshots | Log: $Log"
