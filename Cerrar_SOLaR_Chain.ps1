$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$candidateRootDirs = @(
    $PSScriptRoot,
    (Split-Path -Parent $PSScriptRoot)
)

$rootDir = $null
foreach ($candidate in $candidateRootDirs) {
    if ((Test-Path (Join-Path $candidate 'backend')) -and (Test-Path (Join-Path $candidate 'frontend'))) {
        $rootDir = $candidate
        break
    }
}

if (-not $rootDir) {
    throw 'No se pudo resolver la raiz del proyecto para detener procesos.'
}

$runtimeDir = Join-Path $rootDir '.runtime-native'
$chromeProfileDir = Join-Path $env:LOCALAPPDATA 'SOLaR-Chain-ChromeProfile'

$pidFiles = @(
    @{ Name = 'Frontend'; Path = (Join-Path $runtimeDir 'frontend.pid') },
    @{ Name = 'Backend'; Path = (Join-Path $runtimeDir 'backend.pid') },
    @{ Name = 'Ganache'; Path = (Join-Path $runtimeDir 'ganache.pid') }
)

function Stop-ManagedProcess {
    param(
        [string]$Name,
        [string]$PidFile
    )

    if (-not (Test-Path $PidFile)) {
        return
    }

    $raw = (Get-Content -Path $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
    if ($raw -match '^\d+$') {
        $processId = [int]$raw
        $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($proc) {
            try {
                Stop-Process -Id $processId -Force -ErrorAction Stop
                Write-Host "$Name detenido (PID $processId)." -ForegroundColor Green
            }
            catch {
                Write-Host "No se pudo detener $Name (PID $processId)." -ForegroundColor Yellow
            }
        }
    }

    Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
}

function Close-SolarChromeWindow {
    param([string]$TargetProfileDir)

    $normalizedProfileDir = $TargetProfileDir.ToLowerInvariant()
    $chromeProcesses = Get-CimInstance Win32_Process -Filter "name = 'chrome.exe'"

    foreach ($process in $chromeProcesses) {
        $commandLine = [string]($process.CommandLine)
        if (-not $commandLine) {
            continue
        }

        if ($commandLine.ToLowerInvariant().Contains($normalizedProfileDir) -and $commandLine.Contains('--app=')) {
            try {
                Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
            }
            catch {
            }
        }
    }
}

foreach ($pidEntry in $pidFiles) {
    Stop-ManagedProcess -Name $pidEntry.Name -PidFile $pidEntry.Path
}

Close-SolarChromeWindow -TargetProfileDir $chromeProfileDir

Write-Host 'SOLaR-Chain detenido en modo nativo.' -ForegroundColor Cyan