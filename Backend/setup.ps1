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
try {
    Invoke-Checked $venvPython scripts/install_python_certificates.py
} catch {
    Write-Warning "Python certificate bootstrap failed. SMTP over TLS may fail until certificates are configured."
}

if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
    } else {
        Write-Warning ".env.example was not found; continuing without creating .env."
    }
}

if ($fresh) {
    Write-Host "--fresh: removing db.sqlite3 only."
    if (Test-Path "db.sqlite3") {
        Remove-Item "db.sqlite3" -Force
    }
}

Invoke-Checked $venvPython scripts/rename_receipts_app.py
function Ensure-Tesseract {
    $existing = Get-Command tesseract -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "tesseract already installed at $($existing.Source)"
        return
    }

    # Common Windows install locations that may not be on PATH yet.
    $candidatePaths = @(
        "$env:ProgramFiles\Tesseract-OCR\tesseract.exe",
        "${env:ProgramFiles(x86)}\Tesseract-OCR\tesseract.exe",
        "$env:LOCALAPPDATA\Programs\Tesseract-OCR\tesseract.exe"
    )
    foreach ($candidate in $candidatePaths) {
        if (Test-Path $candidate) {
            Write-Host "tesseract already installed at $candidate"
            Write-Warning "Add the containing folder to PATH so pytesseract can find it (then restart your shell)."
            return
        }
    }

    Write-Host "tesseract not found - required by pytesseract for local receipt OCR."

    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "Installing tesseract via winget (UB-Mannheim build)..."
        try {
            winget install --id UB-Mannheim.TesseractOCR -e --accept-source-agreements --accept-package-agreements
        } catch {
            Write-Warning "winget install failed: $_"
            Write-Warning "Install manually from https://github.com/UB-Mannheim/tesseract/wiki and add Tesseract-OCR to PATH."
        }
    } elseif (Get-Command choco -ErrorAction SilentlyContinue) {
        Write-Host "Installing tesseract via Chocolatey..."
        try {
            choco install tesseract -y
        } catch {
            Write-Warning "choco install failed: $_"
            Write-Warning "Install manually from https://github.com/UB-Mannheim/tesseract/wiki and add Tesseract-OCR to PATH."
        }
    } else {
        Write-Warning "Neither winget nor Chocolatey is available."
        Write-Warning "Install tesseract manually from https://github.com/UB-Mannheim/tesseract/wiki"
        Write-Warning "Then add 'C:\Program Files\Tesseract-OCR' to your PATH and restart this shell."
    }
}

Ensure-Tesseract

Invoke-Checked $venvPython manage.py migrate

Write-Host "Using committed Django migrations from the repo."
Write-Host "If you are actively changing models, run 'python manage.py makemigrations' manually."

Write-Host "Backend dependencies are installed and migrations are up to date."
Write-Host "Use '.\$venvDir\Scripts\Activate.ps1' if you want the virtualenv in your shell."

if (-not $noRun) {
    Invoke-Checked $venvPython manage.py runserver
}
