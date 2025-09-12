function Invoke-PjaxNavbarAudit {
  [CmdletBinding()]
  param(
    [int]$Port = 8080,
    [string]$BindHost = "127.0.0.1"
  )

  $ErrorActionPreference = 'Stop'

  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git introuvable dans PATH."
  }

  $root = (git rev-parse --show-toplevel 2>$null | Out-String).Trim()
  if (-not $root) { throw "Pas de dépôt Git détecté ici. Place-toi à la racine du repo." }
  Set-Location $root

  $branch = (git rev-parse --abbrev-ref HEAD 2>$null | Out-String).Trim()
  $status = (git status --porcelain=v1 2>$null | Out-String).Trim()
  $dirty  = [bool]$status

  $auditDir = Join-Path $root ".pjax-audit"
  New-Item -ItemType Directory -Force -Path $auditDir | Out-Null
  $ts      = (Get-Date).ToString("yyyyMMdd_HHmmss")
  $report  = Join-Path $auditDir "report-$ts.json"
  $log     = Join-Path $auditDir "run-$ts.log"

  Write-Host "==== Branche: $branch | Dirty: $dirty ====" -ForegroundColor Cyan
  "===== git status =====`n$((git status))" | Out-File -Encoding UTF8 $log

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js non trouvé (attendu ≥ 18)." }
  Write-Host "Node: $(node -v)" -ForegroundColor DarkCyan

  # Collecte des pages à auditer
  $candidates = @()
  foreach ($p in @("index.html","parcours.html","portfolio.html","contact.html","cv.html")) {
    $f = Join-Path $root $p
    if (Test-Path $f) { $candidates += "/$p" }
  }
  $portfolio = Get-ChildItem -Recurse -Include *.html -Path (Join-Path $root "assets") -ErrorAction SilentlyContinue |
               Where-Object { $_.FullName -match "\\assets\\portfolio\\.+\.html$" } |
               ForEach-Object { $_.FullName.Replace($root,'').Replace('\','/') }

  $urls = @(); $urls += $candidates; $urls += $portfolio; $urls = $urls | Sort-Object -Unique

  # Fallback: lire tools\audit\audit-pages.txt si présent
  $cfg = Join-Path $root "tools\audit\audit-pages.txt"
  if ((-not $urls) -and (Test-Path $cfg)) {
    $custom = Get-Content -Path $cfg | Where-Object { $_ -and -not $_.StartsWith('#') }
    if ($custom) { $urls = $custom }
  }

  if (-not $urls -or $urls.Count -eq 0) {
    throw "Aucune page à auditer (ni racines, ni assets/portfolio, ni tools\audit\audit-pages.txt)."
  }

  # Serveur local (binaire éphémère)
  $serveCmd  = "npx"
  $serveArgs = @("-y","-p","http-server","http-server",".","-p",$Port.ToString(),"-a",$BindHost,"-c","-1","--silent")
  Write-Host ("Démarrage serveur: http://{0}:{1} ..." -f $BindHost,$Port) -ForegroundColor Green
  $serveProc = Start-Process -FilePath $serveCmd -ArgumentList $serveArgs -WorkingDirectory $root -PassThru -WindowStyle Hidden

  try {
    Start-Sleep -Seconds 2

    # Runner Playwright écrit à la volée
    $runner = Join-Path $auditDir "audit-runner.cjs"
    $runnerContent = @"
const { chromium } = require("playwright");
const base  = process.env.AUDIT_BASE;
const paths = JSON.parse(process.env.AUDIT_PATHS || "[]");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const results = [];

  for (const p of paths) {
    const url = `${base}${p}`;
    const page = await context.newPage();

    const consoleLogs = [];
    const pageErrors  = [];
    const networkBad  = [];

    page.on("console", msg => consoleLogs.push({ type: msg.type(), text: msg.text() }));
    page.on("pageerror", err => pageErrors.push({ name: err.name, message: err.message, stack: (err.stack||"").split("\n").slice(0,5).join("\n") }));
    page.on("response", resp => { const s = resp.status(); if (s >= 400) networkBad.push({ url: resp.url(), status: s }); });

    let checks = { pjax: [], navbar: [], scripts: [], overlays: [], meta: [] };

    try {
      await page.goto(url, { waitUntil: "load", timeout: 45000 });
      await page.waitForTimeout(500);

      const inPage = await page.evaluate(() => {
        const out = { pjax: [], navbar: [], scripts: [], overlays: [], meta: [] };

        const pjaxContainers = document.querySelectorAll("[data-pjax-container], #pjax-container");
        if (pjaxContainers.length === 0) out.pjax.push("Aucun conteneur PJAX détecté.");
        if (pjaxContainers.length > 1)  out.pjax.push(`Plusieurs conteneurs PJAX (${pjaxContainers.length}) — risque de collisions.`);

        const heavyKeywords = ["jquery","bootstrap","mediaelement","plyr","player-singleton","pjax","isotope","three","gsap"];
        document.querySelectorAll("[data-pjax-container] script[src]").forEach(s => {
          const src = s.getAttribute("src") || "";
          if (heavyKeywords.some(k => src.toLowerCase().includes(k))) out.pjax.push(`Script lourd DANS le fragment PJAX: ${src}`);
        });

        const navbars = document.querySelectorAll("nav.navbar, #navbar, .navbar");
        if (navbars.length === 0) out.navbar.push("Navbar absente.");
        if (navbars.length > 1)  out.navbar.push(`Plusieurs navbars (${navbars.length}) — dupliquée après PJAX ?`);

        const togglers = [...document.querySelectorAll(".navbar-toggler[data-bs-target], .navbar-toggler[aria-controls]")];
        togglers.forEach(t => {
          const target = t.getAttribute("data-bs-target") || ("#" + (t.getAttribute("aria-controls")||""));
          if (!target || target === "#") out.navbar.push("Navbar toggler sans target/aria-controls.");
          else if (!document.querySelector(target)) out.navbar.push(`Toggler target introuvable: ${target}`);
        });

        const uniqueIds = ["#audio-player","#player-modal","#global-audio","#cv-modal","#navbar-main"];
        uniqueIds.forEach(id => {
          const n = document.querySelectorAll(id).length;
          if (n > 1) out.overlays.push(`Élément unique dupliqué (${id}) x${n} — probable réinjection sur PJAX.`);
        });

        const srcs = [...document.querySelectorAll("script[src]")].map(s => (new URL(s.src, location.href)).pathname.split("/").slice(-1)[0].toLowerCase());
        const dups = (() => { const m = new Map(); srcs.forEach(x => m.set(x,(m.get(x)||0)+1)); return [...m.entries()].filter(([,n])=>n>1).map(([k,n])=>`${k} x${n}`); })();
        if (dups.length) out.scripts.push("Scripts inclus plusieurs fois: " + dups.join(", "));

        if (!document.querySelector('meta[name="viewport"]')) out.meta.push("meta viewport manquante.");
        if (!document.querySelector('meta[charset], meta[http-equiv="Content-Type"]')) out.meta.push("charset/meta Content-Type manquante.");

        return out;
      });

      checks = inPage;
    } catch (e) { pageErrors.push({ name: e.name, message: e.message }); }

    results.push({ url, console: consoleLogs, errors: pageErrors, network: networkBad, checks });
    await page.close();
  }

  await browser.close();
  process.stdout.write(JSON.stringify({ results }, null, 2));
})().catch(e => { console.error("Runner fatal:", e); process.exit(2); });
"@
    Set-Content -Encoding UTF8 -Path $runner -Value $runnerContent

    # Playwright éphémère (npm récent : pas de --ignore-existing)
    & npx -y -p playwright@1.47.2 playwright --version | Out-Null
    & npx -y -p playwright@1.47.2 playwright install chromium | Out-Null

    # Scan statique (robuste)
    $static = [System.Collections.ArrayList]::new()
    $htmlFiles = Get-ChildItem -Recurse -Include *.html -File
    foreach ($f in $htmlFiles) {
      try { [string]$txt = Get-Content -Raw -LiteralPath $f.FullName -ErrorAction Stop } catch { $txt = '' }

      $jqCount  = ([regex]::Matches($txt, 'script[^>]+src\s*=\s*["''][^"'']*jquery([^"'']*)["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)).Count
      $bsCount  = ([regex]::Matches($txt, 'script[^>]+src\s*=\s*["''][^"'']*bootstrap([^"'']*)["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)).Count
      if ($jqCount -gt 1) { $null = $static.Add([pscustomobject]@{ file=$f.FullName; issue="jquery dupliqué"; count=$jqCount }) }
      if ($bsCount -gt 1) { $null = $static.Add([pscustomobject]@{ file=$f.FullName; issue="bootstrap dupliqué"; count=$bsCount }) }

      if ($txt -match "data-pjax-container") {
        $heavy = @("jquery","bootstrap","mediaelement","plyr","player-singleton","pjax","isotope","three","gsap")
        foreach ($h in $heavy) {
          $pattern = "<script[^>]+src\s*=\s*['""]([^'""]*{0}[^'""]*)['""][^>]*>" -f ([regex]::Escape($h))
          if ($txt -match $pattern) { $null = $static.Add([pscustomobject]@{ file=$f.FullName; issue="script lourd dans fragment PJAX"; hint=$Matches[1] }) }
        }
      }

      $togglers = [regex]::Matches($txt,'class\s*=\s*["''][^"'']*navbar-toggler[^"'']*["''][\s\S]*?(data-bs-target\s*=\s*["'']([^"'']+)["'']|aria-controls\s*=\s*["'']([^"'']+)["''])',[System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
      foreach ($m in $togglers) {
        $target = $m.Groups[2].Value
        if (-not $target) { $target = "#"+$m.Groups[3].Value }
        if (-not $target -or $target -eq "#") { $null = $static.Add([pscustomobject]@{ file=$f.FullName; issue="navbar toggler sans target/aria-controls"; hint="" }) }
      }
    }

    $env:AUDIT_BASE  = "http://$($BindHost):$Port"
    $env:AUDIT_PATHS = ($urls | ConvertTo-Json -Compress)
    Write-Host "Audit headless Chromium sur $($urls.Count) page(s)..." -ForegroundColor Green

    $stderrPath = Join-Path $auditDir "runner-stderr-$ts.txt"
    $nodeOut = & npx -y -p playwright@1.47.2 node $runner 2> $stderrPath
    if (-not $nodeOut) { throw "Le runner n'a rien renvoyé. Regarde: $stderrPath" }

    $json = $nodeOut | ConvertFrom-Json

    $out = [ordered]@{
      branch  = $branch
      dirty   = $dirty
      started = (Get-Date).ToString("s")
      base    = $env:AUDIT_BASE
      pages   = $urls
      static  = $static
      runner  = $json.results
    }
    ($out | ConvertTo-Json -Depth 6) | Out-File -Encoding UTF8 $report

    Write-Host "`n===== RÉSUMÉ AUDIT =====" -ForegroundColor Yellow
    $totalPages = $json.results.Count
    $sumConsole = ($json.results | ForEach-Object { $_.console.Count } | Measure-Object -Sum).Sum
    $sumErrors  = ($json.results | ForEach-Object { $_.errors.Count }  | Measure-Object -Sum).Sum
    $sumNetBad  = ($json.results | ForEach-Object { $_.network.Count } | Measure-Object -Sum).Sum

    $pjaxWarn = 0; $navWarn = 0; $scriptDup = 0; $overlayDup = 0
    foreach ($r in $json.results) {
      $pjaxWarn   += $r.checks.pjax.Count
      $navWarn    += $r.checks.navbar.Count
      $scriptDup  += $r.checks.scripts.Count
      $overlayDup += $r.checks.overlays.Count
    }

    "{0,-20} {1}" -f "Pages auditées:",        $totalPages | Write-Host
    "{0,-20} {1}" -f "Console (items):",       $sumConsole | Write-Host
    "{0,-20} {1}" -f "Exceptions JS:",         $sumErrors  | Write-Host
    "{0,-20} {1}" -f "Ressources 4xx/5xx:",    $sumNetBad  | Write-Host
    "{0,-20} {1}" -f "Alertes PJAX:",          $pjaxWarn   | Write-Host
    "{0,-20} {1}" -f "Alertes Navbar:",        $navWarn    | Write-Host
    "{0,-20} {1}" -f "Dup scripts:",           $scriptDup  | Write-Host
    "{0,-20} {1}" -f "Dup overlays:",          $overlayDup | Write-Host

    Write-Host "`nRapport:" -NoNewline
    Write-Host " $report" -ForegroundColor Cyan
    Write-Host "Logs:    $log" -ForegroundColor DarkCyan
  }
  finally {
    if ($serveProc -and -not $serveProc.HasExited) { Stop-Process -Id $serveProc.Id -Force }
  }
}
