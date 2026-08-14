$ErrorActionPreference = 'Stop'
$dest = Join-Path $PSScriptRoot '..\public\uploads\tiles' | Resolve-Path -ErrorAction SilentlyContinue | ForEach-Object { $_.Path }
if (-not $dest) { $dest = Join-Path $PSScriptRoot '..\public\uploads\tiles'; New-Item -ItemType Directory -Force -Path $dest | Out-Null }

$urls = @(
    'https://unsplash.com/photos/SeS08Ow9Lu0',
    'https://unsplash.com/photos/T3WvaiVHWx4',
    'https://unsplash.com/photos/xU_a0JilD9E',
    'https://unsplash.com/photos/YtHLf4k-N1Q'
)

foreach ($u in $urls) {
    try {
        Write-Output "Fetching page: $u"
        $r = Invoke-WebRequest -Uri $u -UseBasicParsing -Headers @{ 'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        if ($r.Content -match 'property="og:image" content="([^"]+)"') { $img = $matches[1] } elseif ($r.Content -match 'property="og:image" content=\'([^\']+)\'') { $img = $matches[1] } else { Write-Warning "og:image not found for $u"; continue }
        # normalize image URL (remove query to get stable filename)
        $uri = [System.Uri]$img
        $filename = [System.IO.Path]::GetFileName($uri.AbsolutePath)
        if (-not $filename) { $filename = [System.Guid]::NewGuid().ToString() + '.jpg' }
        $out = Join-Path $dest $filename
        Write-Output "Downloading $img -> $out"
        Invoke-WebRequest -Uri $img -OutFile $out -UseBasicParsing -Headers @{ 'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    } catch {
        Write-Warning "Error for $u: $_"
    }
}

Write-Output "Done. Saved files to: $dest"
Get-ChildItem -Path $dest -File | Select-Object Name,Length | Format-Table -AutoSize
