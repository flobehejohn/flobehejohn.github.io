$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Repo = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $Repo

$Ts = Get-Date -Format 'yyyyMMdd_HHmmss'
$AuditDir = Join-Path $Repo 'audit\_latest'
New-Item -ItemType Directory -Force -Path $AuditDir | Out-Null

$Log = Join-Path $AuditDir "validate-full_$Ts.log"

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)] [string] $Name,
    [Parameter(Mandatory = $true)] [scriptblock] $Action
  )

  Write-Host "`n=== $Name ==="
  & $Action 2>&1 | Tee-Object -FilePath $Log -Append
}

"[validate-full] repo=$Repo" | Tee-Object -FilePath $Log -Append | Out-Null
"[validate-full] ts=$Ts" | Tee-Object -FilePath $Log -Append | Out-Null

Invoke-Step -Name 'npm ci' -Action { npm ci }
Invoke-Step -Name 'lint' -Action { npm run ci:validate -- --help > $null; npm run lint }
Invoke-Step -Name 'typecheck' -Action { npm run typecheck }
Invoke-Step -Name 'build docs' -Action { npm run build }
Invoke-Step -Name 'seo audit' -Action { npm run audit:seo }
Invoke-Step -Name 'build guard' -Action { npm run audit:build }

Write-Host "`n[OK] Validate full terminé. Log: $Log"
