$imgFolder = "C:\ATLAS\INBOX\dev\Html_css\Site_perso_2025\flobehejohn.github.io\assets\images\people"
Get-ChildItem $imgFolder -Filter *.webp | ForEach-Object {
    $webp = $_.Name
    $base = [System.IO.Path]::GetFileNameWithoutExtension($webp)
    $altBase = $base -replace "_", " "
    $altClean = ($altBase.Substring(0,1).ToUpper() + $altBase.Substring(1)).Trim()
    $alt = "Portrait de $altClean"
    $png = "$base.png"
    Write-Output "<picture>"
    Write-Output "  <source srcset='assets/images/people/$webp' type='image/webp' />"
    Write-Output "  <source srcset='assets/images/people/$png' type='image/png' />"
    Write-Output "  <img src='assets/images/people/$png' loading='lazy' alt='$alt'>"
    Write-Output "</picture>"
}
