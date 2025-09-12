@'
<#
.SYNOPSIS
  Fix PJAX / Nuage Magique issues: ensure CSS+Module+placeholder, remove duplicates, mark vendor scripts, add crossorigin to <audio>.
.NOTES
  - Teste d'abord en -WhatIf.
  - Conçu pour PowerShell 7+ (pwsh).
#>

param(
  [Parameter(Mandatory=$true)][string]$Root,
  [string]$NuageCssPath = '/assets/css/nuage_magique.css',
  [string]$NuageModulePath = '/assets/portfolio/nuage/nuage_magique.module.js',
  [string]$VendorRegex = '(jquery|bootstrap|mediaelement|isotope|imagesloaded|min\.js|fontawesome)',
  [switch]$AlsoCssLinks = $false,
  [switch]$WhatIf = $false,
  [switch]$VerboseLogging = $false
)

function Write-Log($msg) { if ($VerboseLogging) { Write-Host $msg } }
function Backup-IfNeeded($file) {
  if ($WhatIf) { Write-Host "[WhatIf] backup would be created for: $file"; return }
  $ts = (Get-Date).ToString('yyyyMMdd_HHmmss')
  $bak = "$file.bak.$ts"
  Copy-Item -LiteralPath $file -Destination $bak -Force
  Write-Host "Backup créé : $bak"
}

if (-not (Test-Path $Root -PathType Container)) { throw "Racine introuvable : $Root" }
Set-Location $Root

# récupérer fichiers HTML en ignorant erreurs de lecture
$allHtml = Get-ChildItem -Path $Root -Recurse -File -Include *.html,*.htm -ErrorAction SilentlyContinue

# detect shell files (contenant main[data-pjax-root])
$shellFiles = @()
foreach ($f in $allHtml) {
  try {
    $content = Get-Content -LiteralPath $f.FullName -Raw -ErrorAction Stop
    $content = $content ?? ''
  } catch { continue }
  if ($content -match '(?is)<main[^>]*\bdata-pjax-root\b') { $shellFiles += $f.FullName }
}
if ($shellFiles.Count -eq 0) {
  $maybeIndex = Join-Path $Root 'index.html'
  if (Test-Path $maybeIndex) { $shellFiles = @($maybeIndex) }
}

function Ensure-NuageCssInShell([string]$file) {
  try { $html = Get-Content -LiteralPath $file -Raw -ErrorAction Stop } catch { return $false }
  $html = $html ?? ''
  $cssPresent = [regex]::IsMatch($html, [regex]::Escape($NuageCssPath), [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($cssPresent) { Write-Log "CSS nuage déjà présent dans $file"; return $false }
  $linkTag = "<link rel=`"stylesheet`" href=`"$NuageCssPath`" data-pjax-skip=`"1`" />`n"
  if ($WhatIf) { Write-Host "[WhatIf] ajouter lien CSS nuage dans : $file"; return $true }
  Backup-IfNeeded $file
  if ($html -match '(?is)</head>') { $html = [regex]::Replace($html,'(?is)</head>',$linkTag + '</head>',1) }
  elseif ($html -match '(?is)</body>') { $html = [regex]::Replace($html,'(?is)</body>',$linkTag + '</body>',1) }
  else { $html = $html + "`n" + $linkTag }
  Set-Content -LiteralPath $file -Value $html -Encoding UTF8
  Write-Host "✔ Lien CSS nuage ajouté dans : $file"
  return $true
}

function Ensure-NuageModuleInShell([string]$file) {
  try { $html = Get-Content -LiteralPath $file -Raw -ErrorAction Stop } catch { return $false }
  $html = $html ?? ''
  $modulePresent = [regex]::IsMatch($html, [regex]::Escape($NuageModulePath), [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($modulePresent) { Write-Log "Module nuage déjà présent dans $file"; return $false }
  $scriptTag = "<script type=`"module`" src=`"$NuageModulePath`" data-pjax-skip=`"1`"></script>`n"
  if ($WhatIf) { Write-Host "[WhatIf] ajouter script module nuage dans : $file"; return $true }
  Backup-IfNeeded $file
  if ($html -match '(?is)</body>') { $html = [regex]::Replace($html,'(?is)</body>',$scriptTag + '</body>',1) }
  else { $html = $html + "`n" + $scriptTag }
  Set-Content -LiteralPath $file -Value $html -Encoding UTF8
  Write-Host "✔ Script module nuage ajouté dans : $file"
  return $true
}

function Ensure-GlobalCloudPlaceholder([string]$file) {
  try { $html = Get-Content -LiteralPath $file -Raw -ErrorAction Stop } catch { return $false }
  $html = $html ?? ''
  if ($html -match '(?is)<div[^>]*\bid\s*=\s*["'']?cloud-bg["'']?') { Write-Log "#cloud-bg déjà dans $file"; return $false }
  $placeholder = "<div id=`"cloud-bg`" data-pjax-skip=`"1`" aria-hidden=`"true`"></div>`n"
  if ($WhatIf) { Write-Host "[WhatIf] insérer #cloud-bg dans : $file"; return $true }
  Backup-IfNeeded $file
  if ($html -match '(?is)<body[^>]*>') { $html = [regex]::Replace($html, '(?is)(<body[^>]*>)', "`$1`n$placeholder",1) }
  else { $html = $placeholder + $html }
  Set-Content -LiteralPath $file -Value $html -Encoding UTF8
  Write-Host "✔ Placeholder #cloud-bg ajouté dans : $file"
  return $true
}

function Remove-InnerCloudPlaceholders() {
  $removed = 0
  $shellSet = [System.Collections.Generic.HashSet[string]]::new()
  foreach ($s in $shellFiles) { $shellSet.Add((Get-Item $s).FullName) }
  foreach ($f in $allHtml) {
    $full = (Get-Item $f.FullName).FullName
    if ($shellSet.Contains($full)) { continue }
    try { $html = Get-Content -LiteralPath $full -Raw -ErrorAction Stop } catch { continue }
    $html = $html ?? ''
    if ($html -match '(?is)<div[^>]*\bid\s*=\s*["'']?cloud-bg["'']?[^>]*>.*?</div>') {
      if ($WhatIf) { Write-Host "[WhatIf] supprimer #cloud-bg de : $full"; $removed++; continue }
      Backup-IfNeeded $full
      $new = [regex]::Replace($html, '(?is)<div[^>]*\bid\s*=\s*["'']?cloud-bg["'']?[^>]*>.*?</div>', '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
      Set-Content -LiteralPath $full -Value $new -Encoding UTF8
      Write-Host "✔ #cloud-bg supprimé de : $full"
      $removed++
    } else { Write-Log "aucun #cloud-bg dans : $full" }
  }
  return $removed
}

function Mark-VendorScripts() {
  $pattern = "(?is)<script(?![^>]*\bdata-pjax-skip\b)([^>]*\bsrc\s*=\s*(?:\""[^\""]*{0}[^\""]*\""|'[^']*{0}[^']*')[^>]*)>"
  $pattern = $pattern -f $VendorRegex
  $regex = [regex]::new($pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase -bor [System.Text.RegularExpressions.RegexOptions]::Singleline)
  $modifiedCount = 0
  foreach ($f in $allHtml) {
    $full = $f.FullName
    try { $html = Get-Content -LiteralPath $full -Raw -ErrorAction Stop } catch { continue }
    $html = $html ?? ''
    if ($regex.IsMatch($html)) {
      if ($WhatIf) { Write-Host "[WhatIf] marque scripts vendors dans : $full"; $modifiedCount++; continue }
      Backup-IfNeeded $full
      $new = [regex]::Replace($html, $regex, '<script data-pjax-skip="1"$1>')
      Set-Content -LiteralPath $full -Value $new -Encoding UTF8
      Write-Host "✔ data-pjax-skip ajouté aux scripts vendor dans : $full"
      $modifiedCount++
    } else { Write-Log "aucun script vendor à marquer dans : $full" }
  }
  return $modifiedCount
}

function Ensure-AudioCrossOrigin() {
  $audioRegex = [regex]::new('(?is)<audio\b([^>]*?(?:(?:\bsrc\s*=\s*(?:""[^""]+""|''[^'']+'')|[^>])*?)>)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase -bor [System.Text.RegularExpressions.RegexOptions]::Singleline)
  $modified = 0
  foreach ($f in $allHtml) {
    $full = $f.FullName
    try { $html = Get-Content -LiteralPath $full -Raw -ErrorAction Stop } catch { continue }
    $html = $html ?? ''
    $changed = $false
    $new = $html
    $matches = $audioRegex.Matches($html)
    foreach ($m in $matches) {
      $tag = $m.Groups[0].Value
      if ($tag -match '\bcrossorigin\b') { continue }
      $replacement = $tag -replace '>$', ' crossorigin="anonymous">'
      $new = $new.Replace($tag, $replacement)
      $changed = $true
    }
    if ($changed) {
      if ($WhatIf) { Write-Host "[WhatIf] ajouter crossorigin aux <audio> dans : $full"; $modified++; continue }
      Backup-IfNeeded $full
      Set-Content -LiteralPath $full -Value $new -Encoding UTF8
      Write-Host "✔ crossorigin ajouté aux <audio> dans : $full"
      $modified++
    } else { Write-Log "aucun <audio> à modifier dans : $full" }
  }
  return $modified
}

$report = [ordered]@{ NuageCssAdded=0; NuageModuleAdded=0; PlaceholderAdded=0; InnerCloudRemoved=0; VendorScriptsMarked=0; AudioFixed=0 }

foreach ($shell in $shellFiles) {
  if (Ensure-NuageCssInShell -file $shell) { $report.NuageCssAdded++ }
  if (Ensure-NuageModuleInShell -file $shell) { $report.NuageModuleAdded++ }
  if (Ensure-GlobalCloudPlaceholder -file $shell) { $report.PlaceholderAdded++ }
}

$report.InnerCloudRemoved = Remove-InnerCloudPlaceholders
$report.VendorScriptsMarked = Mark-VendorScripts
$report.AudioFixed = Ensure-AudioCrossOrigin

Write-Host "`n=== Rapport d'actions ===" -ForegroundColor Cyan
$report.GetEnumerator() | ForEach-Object { Write-Host ("{0,-25} : {1}" -f $_.Key, $_.Value) }

if ($WhatIf) { Write-Host "`nMode WHATIF activé — aucune écriture effectuée." -ForegroundColor Yellow }
else {
  Write-Host "`nTerminé. Vérifie les backups (*.bak.YYYYMMDD_HHMMSS) si tu veux annuler." -ForegroundColor Green
  Write-Host "Conseil : committe ces changements sur une branche dédiée :"
  Write-Host "`tgit switch -c fix/pjax-nuage && git add -A && git commit -m 'fix: PJAX / nuage - add css/module/placeholder + mark vendors + audio crossorigin'"
}
'@ | Set-Content -LiteralPath .\tools\pjax-nuage-fixer.ps1 -Encoding UTF8

Write-Host "Script réparé et enregistré dans .\tools\pjax-nuage-fixer.ps1"
