param(
    [Alias("NoRun")]
    [switch]$NoRunFlag,
    [Alias("Fresh")]
    [switch]$FreshFlag
)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command,
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Arguments
    )

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code ${LASTEXITCODE}: $Command $($Arguments -join ' ')"
    }
}

$noRun = $NoRunFlag -or $args -contains "--no-run" -or $args -contains "-NoRun"
$fresh = $FreshFlag -or $args -contains "--fresh" -or $args -contains "-Fresh"

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
$venvPip = Join-Path $venvDir "Scripts\pip.exe"

if (-not (Test-Path $venvPython)) {
    Write-Host "Creating virtual environment in $venvDir..."
    if ($pythonBin -eq "py") {
        Invoke-Checked py -3 -m venv $venvDir
    } else {
        Invoke-Checked $pythonBin -m venv $venvDir
    }
}

if (-not (Test-Path $venvPython)) {
    throw "Virtual environment was not created successfully at $venvDir."
}

if (-not (Test-Path $venvPip)) {
    Invoke-Checked $venvPython -m ensurepip --upgrade
}

Invoke-Checked $venvPython -m pip install --upgrade pip setuptools wheel
Invoke-Checked $venvPython -m pip install -r requirements.txt

if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
    } else {
        Write-Warning ".env.example was not found; continuing without creating .env."
    }
}

if ($fresh) {
    Write-Host "--fresh: removing db.sqlite3 and any auto-generated migration files."
    if (Test-Path "db.sqlite3") {
        Remove-Item "db.sqlite3" -Force
    }
    foreach ($app in @("users", "households", "core", "posts", "receipts")) {
        $migrationsDir = Join-Path $app "migrations"
        if (Test-Path $migrationsDir) {
            Get-ChildItem -Path $migrationsDir -File |
                Where-Object { $_.Name -ne "__init__.py" } |
                Remove-Item -Force
        }
    }
}

Invoke-Checked $venvPython scripts/rename_receipts_app.py
Invoke-Checked $venvPython manage.py makemigrations users households core posts receipts
Invoke-Checked $venvPython manage.py migrate

Write-Host "Backend dependencies are installed and migrations are up to date."
Write-Host "Use '.\$venvDir\Scripts\Activate.ps1' if you want the virtualenv in your shell."

if (-not $noRun) {
    Invoke-Checked $venvPython manage.py runserver
}
