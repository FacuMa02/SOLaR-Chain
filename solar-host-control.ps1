param(
    [Parameter(Mandatory = $true)]
    [string]$ChromeProfileDir,
    [string]$ListenPrefix = 'http://127.0.0.1:53921/',
    [string]$PidFilePath = ''
)

$ErrorActionPreference = 'Stop'

function Write-JsonResponse {
    param(
        [Parameter(Mandatory = $true)]$Response,
        [int]$StatusCode = 200,
        [string]$Body = '{"ok":true}'
    )

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
    $Response.StatusCode = $StatusCode
    $Response.ContentType = 'application/json; charset=utf-8'
    $Response.ContentLength64 = $bytes.Length
    $Response.AddHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
    $Response.AddHeader('Access-Control-Allow-Credentials', 'true')
    $Response.AddHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    $Response.AddHeader('Access-Control-Allow-Headers', 'Content-Type')
    $Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Response.OutputStream.Close()
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
            } catch {
            }
        }
    }
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($ListenPrefix)
$listener.Start()

if ($PidFilePath) {
    Set-Content -Path $PidFilePath -Value $PID -Encoding ASCII
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        if ($request.HttpMethod -eq 'OPTIONS') {
            Write-JsonResponse -Response $response -StatusCode 204 -Body ''
            continue
        }

        if ($request.HttpMethod -eq 'POST' -and $request.Url.AbsolutePath -eq '/close') {
            Write-JsonResponse -Response $response -StatusCode 202 -Body '{"ok":true}'
            Close-SolarChromeWindow -TargetProfileDir $ChromeProfileDir
            continue
        }

        Write-JsonResponse -Response $response -StatusCode 404 -Body '{"ok":false,"error":"Not found"}'
    }
} finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }

    $listener.Close()

    if ($PidFilePath -and (Test-Path $PidFilePath)) {
        Remove-Item -Path $PidFilePath -Force -ErrorAction SilentlyContinue
    }
}
