$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$noRun = $args -contains "--no-run" -or $args -contains "-NoRun"

if ($env:PYTHON_BIN) {
    $pythonBin = $env:PYTHON_BIN
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonBin = "python"
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    $pythonBin = "py"
} else {
    throw "Python was not found. Install Python 3 and rerun setup."
}

$venvDir = if ($env:VENV_DIR) { $env:VENV_DIR } else { ".venv" }
$venvPython = Join-Path $venvDir "Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    if ($pythonBin -eq "py") {
        & py -3 -m venv $venvDir
    } else {
        & $pythonBin -m venv $venvDir
    }
}

& $venvPython -m pip install --upgrade pip setuptools wheel
& $venvPython -m pip install -r requirements.txt

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
}

& $venvPython manage.py migrate

Write-Host "Backend dependencies are installed and migrations are up to date."
Write-Host "Use '.\$venvDir\Scripts\Activate.ps1' if you want the virtualenv in your shell."

if (-not $noRun) {
    & $venvPython manage.py runserver
}
