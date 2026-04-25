$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$noRun = $args -contains "--no-run" -or $args -contains "-NoRun"

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
}

npm install

Write-Host "Frontend dependencies are installed."

if (-not $noRun) {
    npm run dev -- --host 0.0.0.0
}
