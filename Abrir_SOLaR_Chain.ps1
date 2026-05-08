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
    throw 'No se pudo resolver la raiz del proyecto (backend/frontend).'
}

$backendDir = Join-Path $rootDir 'backend'
$frontendDir = Join-Path $rootDir 'frontend'
$ganacheCmd = Join-Path $backendDir 'node_modules\.bin\ganache.cmd'
$deployScript = Join-Path $backendDir 'scripts\deploy-contract-standalone.cjs'
$frontendServerScript = Join-Path $backendDir 'scripts\serve-frontend-dist.cjs'
$backendAppScript = Join-Path $backendDir 'src\app.js'

$bundleDirs = @(
    (Join-Path $rootDir 'instalacion-solarchain\paquetes-nativos'),
    (Join-Path $PSScriptRoot 'paquetes-nativos')
)

$frontendUrl = 'http://127.0.0.1:5173'
$backendUrl = 'http://127.0.0.1:3001/api/auth/status'
$rpcUrl = 'http://127.0.0.1:8545'

$runtimeDir = Join-Path $rootDir '.runtime-native'
$chromeProfileDir = Join-Path $env:LOCALAPPDATA 'SOLaR-Chain-ChromeProfile'

$pidGanache = Join-Path $runtimeDir 'ganache.pid'
$pidBackend = Join-Path $runtimeDir 'backend.pid'
$pidFrontend = Join-Path $runtimeDir 'frontend.pid'

function Get-ChromePath {
    $candidates = @(
        'C:\Program Files\Google\Chrome\Application\chrome.exe',
        'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
        (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
    )

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            return $candidate
        }
    }

    throw 'No se encontro Google Chrome. Instala Chrome en la PC de planta.'
}

function Assert-NodeInstalled {
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCmd) {
        throw 'No se encontro Node.js. Instala Node.js 20 LTS x64 en la PC.'
    }

    return $nodeCmd.Source
}

function Assert-RequiredPaths {
    $missing = @()
    $required = @(
        $backendDir,
        $frontendDir,
        $backendAppScript,
        $deployScript,
        $frontendServerScript
    )

    foreach ($item in $required) {
        if (-not (Test-Path $item)) {
            $missing += $item
        }
    }

    if ($missing.Count -gt 0) {
        throw "Faltan archivos para modo nativo:`n$($missing -join "`n")"
    }
}

function Get-ExistingBundleDir {
    foreach ($dir in $bundleDirs) {
        if (Test-Path $dir) {
            return $dir
        }
    }

    return $null
}

function Restore-DirectoryFromBundle {
    param(
        [string]$RelativePath,
        [string]$ArchiveName
    )

    $targetPath = Join-Path $rootDir $RelativePath
    if (Test-Path $targetPath) {
        return
    }

    $bundleDir = Get-ExistingBundleDir
    if (-not $bundleDir) {
        return
    }

    $archivePath = Join-Path $bundleDir $ArchiveName
    if (-not (Test-Path $archivePath)) {
        return
    }

    if (-not (Get-Command tar -ErrorAction SilentlyContinue)) {
        throw "No se encontro 'tar' para restaurar $RelativePath desde $archivePath"
    }

    Write-Host "Restaurando $RelativePath desde $ArchiveName..." -ForegroundColor Yellow
    tar -xf $archivePath -C $rootDir
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo restaurar $RelativePath desde $archivePath"
    }
}

function Restore-BundlesIfNeeded {
    Restore-DirectoryFromBundle -RelativePath 'backend\node_modules' -ArchiveName 'backend-node_modules.zip'
    Restore-DirectoryFromBundle -RelativePath 'frontend\node_modules' -ArchiveName 'frontend-node_modules.zip'
    Restore-DirectoryFromBundle -RelativePath 'frontend\dist' -ArchiveName 'frontend-dist.zip'
}

function Assert-FrontendDist {
    $frontendDist = Join-Path $frontendDir 'dist\index.html'
    if (-not (Test-Path $frontendDist)) {
        throw 'No existe frontend/dist. Genera el build antes de instalar offline (npm run build en frontend).'
    }
}

function Assert-NodeModules {
    $backendModules = Join-Path $backendDir 'node_modules'
    $frontendModules = Join-Path $frontendDir 'node_modules'

    if (-not (Test-Path $backendModules)) {
        throw 'Falta backend/node_modules. En la PC de desarrollo ejecuta npm install en backend y copia esa carpeta.'
    }

    if (-not (Test-Path $frontendModules)) {
        throw 'Falta frontend/node_modules. En la PC de desarrollo ejecuta npm install en frontend y copia esa carpeta.'
    }
}

function Get-RunningPid {
    param([string]$PidFile)

    if (-not (Test-Path $PidFile)) {
        return $null
    }

    $raw = (Get-Content -Path $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
    if ($raw -notmatch '^\d+$') {
        Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
        return $null
    }

    $processId = [int]$raw
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if (-not $process) {
        Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
        return $null
    }

    return $processId
}

function Start-ManagedProcess {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkingDirectory,
        [string]$PidFile,
        [string]$DisplayName
    )

    $existingPid = Get-RunningPid -PidFile $PidFile
    if ($existingPid) {
        Write-Host "$DisplayName ya esta en ejecucion (PID $existingPid)." -ForegroundColor DarkGray
        return $existingPid
    }

    $proc = Start-Process -FilePath $FilePath -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory -PassThru -WindowStyle Minimized
    Set-Content -Path $PidFile -Value $proc.Id -Encoding ASCII
    Write-Host "$DisplayName iniciado (PID $($proc.Id))." -ForegroundColor Green
    return $proc.Id
}

function Wait-ForRpc {
    param([int]$TimeoutSeconds = 90)

    $body = '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $rpcUrl -Method Post -Body $body -ContentType 'application/json' -UseBasicParsing -TimeoutSec 4
            if ($response.StatusCode -eq 200) {
                return
            }
        }
        catch {
        }

        Start-Sleep -Seconds 2
    }

    throw 'Ganache no respondio en tiempo esperado.'
}

function Wait-ForUrl {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 120
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return
            }
        }
        catch {
        }
        Start-Sleep -Seconds 2
    }

    throw "El servicio en $Url no respondio en el tiempo esperado."
}

function Initialize-RuntimeDirs {
    New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
    New-Item -ItemType Directory -Force -Path $chromeProfileDir | Out-Null
}

$nodeExe = Assert-NodeInstalled
$chromeExe = Get-ChromePath
Assert-RequiredPaths
Restore-BundlesIfNeeded
Assert-NodeModules
Assert-FrontendDist
Initialize-RuntimeDirs

if (-not (Test-Path $ganacheCmd)) {
    throw 'Falta backend/node_modules/.bin/ganache.cmd. Regenera bundles nativos o reinstala dependencias de backend.'
}

Start-ManagedProcess -FilePath $ganacheCmd -Arguments @(
    '--server.host', '127.0.0.1',
    '--server.port', '8545',
    '--chain.chainId', '1337',
    '--wallet.deterministic', 'true',
    '--database.dbPath', (Join-Path $rootDir 'blockchain_db'),
    '--wallet.totalAccounts', '20',
    '--miner.defaultGasPrice', '0',
    '--miner.blockGasLimit', '0x1fffffffffffff',
    '--chain.allowUnlimitedContractSize', 'true'
) -WorkingDirectory $rootDir -PidFile $pidGanache -DisplayName 'Ganache'

Wait-ForRpc

Write-Host 'Verificando/deployando contrato...' -ForegroundColor Yellow
& $nodeExe $deployScript
if ($LASTEXITCODE -ne 0) {
    throw 'Fallo el deploy standalone del contrato.'
}

Start-ManagedProcess -FilePath $nodeExe -Arguments @($backendAppScript) -WorkingDirectory $backendDir -PidFile $pidBackend -DisplayName 'Backend'
Wait-ForUrl -Url $backendUrl

Start-ManagedProcess -FilePath $nodeExe -Arguments @($frontendServerScript) -WorkingDirectory $backendDir -PidFile $pidFrontend -DisplayName 'Frontend'
Wait-ForUrl -Url $frontendUrl

Start-Process -FilePath $chromeExe -ArgumentList @(
    "--app=$frontendUrl",
    '--new-window',
    "--user-data-dir=$chromeProfileDir"
) | Out-Null

Write-Host ''
Write-Host 'SOLaR-Chain iniciado en modo nativo.' -ForegroundColor Cyan
