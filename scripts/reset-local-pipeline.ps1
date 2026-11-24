param(
    [Parameter(Mandatory)]
    [ValidateSet('Leads', 'AI')]
    [string]$Stage,
    [switch]$PreserveHistory
)

$ErrorActionPreference = 'Stop'
$aiRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$workspace = Split-Path -Parent $aiRoot
$leadsRoot = (Resolve-Path -LiteralPath (Join-Path $workspace 'leadflow-leads')).Path
$backupRoot = Join-Path $workspace 'leadflow-local-backups'
$archive = Join-Path $backupRoot ("{0}-{1}" -f $Stage.ToLowerInvariant(), (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
$origin = 'http://127.0.0.1:8787'

function Stop-LocalService([string]$Root, [string]$Match, [int]$Port) {
    $processes = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
        $_.CommandLine -and
        $_.CommandLine.IndexOf($Root + '\node_modules\', [StringComparison]::OrdinalIgnoreCase) -ge 0 -and
        $_.CommandLine -match $Match
    })
    foreach ($process in $processes) {
        if (Get-Process -Id $process.ProcessId -ErrorAction SilentlyContinue) {
            taskkill.exe /PID $process.ProcessId /T /F | Out-Null
            if ($LASTEXITCODE -ne 0 -and (Get-Process -Id $process.ProcessId -ErrorAction SilentlyContinue)) {
                throw "Unable to stop $($process.Name) with process ID $($process.ProcessId)."
            }
        }
    }
    if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
        throw "Port $Port is still in use. Stop that server before running this reset."
    }
}

function Move-LocalState([string]$Root, [string]$RelativePath, [string]$BackupName) {
    $path = [IO.Path]::GetFullPath((Join-Path $Root $RelativePath))
    if (!(Test-Path -LiteralPath $path)) { return }
    if (!$path.StartsWith($Root + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw "Unexpected local state path: $path"
    }
    foreach ($location in @($Root, (Split-Path -Parent $path), $path)) {
        if ((Get-Item -LiteralPath $location -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Cannot archive linked local state: $location"
        }
    }
    if (!(Test-Path -LiteralPath $backupRoot)) {
        New-Item -ItemType Directory -Path $backupRoot | Out-Null
    }
    $backupItem = Get-Item -LiteralPath $backupRoot -Force
    if ($backupItem.FullName -ne $backupRoot -or ($backupItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "Unexpected backup location: $backupRoot"
    }
    if (!(Test-Path -LiteralPath $archive)) {
        New-Item -ItemType Directory -Path $archive | Out-Null
    }
    $archiveItem = Get-Item -LiteralPath $archive -Force
    if ($archiveItem.FullName -ne $archive -or ($archiveItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "Unexpected backup location: $archive"
    }
    Move-Item -LiteralPath $path -Destination (Join-Path $archive $BackupName)
    Write-Host "Archived $RelativePath in $archive"
}

function Invoke-Npm([string[]]$Arguments) {
    & npm.cmd @Arguments
    if ($LASTEXITCODE -ne 0) { throw "npm $($Arguments -join ' ') failed with exit code $LASTEXITCODE." }
}

if ($Stage -eq 'Leads') {
    Stop-LocalService $leadsRoot '\bwrangler\.js\b.*\bdev\b' 8787
    if ($PreserveHistory) {
        & python (Join-Path $aiRoot 'scripts\reset-overhaul-db.py') $archive
        if ($LASTEXITCODE -ne 0) { throw 'Database backup or reset failed' }
    } else {
        Move-LocalState $leadsRoot '.wrangler\state' 'worker-state'
        Move-LocalState $leadsRoot '.wrangler\state-source-verification' 'worker-verification-state'
        Move-LocalState $leadsRoot '.wrangler\tmp' 'worker-tmp'
    }

    Push-Location -LiteralPath $leadsRoot
    try {
        Invoke-Npm @('run', 'db:local', '--', '--persist-to', '.wrangler/state')
        Invoke-Npm @('run', 'dev', '--', '--port', '8787', '--ip', '127.0.0.1', '--persist-to', '.wrangler/state')
    } finally {
        Pop-Location
    }
    return
}

try {
    $health = Invoke-RestMethod -Uri "$origin/health" -TimeoutSec 5
    if (!$health.ok) { throw 'The local API reported unhealthy.' }
} catch {
    throw "Start the Leads stage and wait for $origin to respond before running the AI stage."
}

$workerSettings = Join-Path $leadsRoot '.dev.vars'
$token = & node -e "const fs = require('node:fs'); const { parseEnv } = require('node:util'); process.stdout.write(parseEnv(fs.readFileSync(process.argv[1], 'utf8')).API_TOKEN || '');" $workerSettings
if ($LASTEXITCODE -ne 0 -or !$token) { throw 'The local Worker API_TOKEN is missing from leadflow-leads/.dev.vars.' }
$env:EXTERNAL_LEADS_API_TOKEN = $token
try {
    $stats = Invoke-RestMethod -Uri "$origin/stats" -Headers @{ Authorization = "Bearer $token" } -TimeoutSec 5
} catch {
    throw 'Could not verify the local database using the API token from leadflow-leads/.dev.vars.'
}
if (!$stats.ok -or (!$PreserveHistory -and $stats.total -ne 0)) { throw 'The local Worker database must be empty. Run the Leads stage first.' }

Stop-LocalService $aiRoot '\bvite\.js\b.*apps[/\\]web[/\\]vite\.config\.ts' 5174
$activeRun = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
    $_.CommandLine -match '\bexternal-pipeline\.ts\b'
}
if ($activeRun) { throw 'An external pipeline run is active. Wait for it to finish before resetting the ledger.' }

$data = Join-Path $aiRoot 'data'
if (Test-Path -LiteralPath $data -PathType Container) {
    Get-ChildItem -LiteralPath $data -File -Filter 'external-*.json*' | ForEach-Object {
        $isLedger = $PreserveHistory -and $_.Extension -eq '.json'
        $cooldowns = if ($isLedger) { (Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json).cooldowns }
        $oldPath = $_.FullName
        Move-LocalState $aiRoot ('data\' + $_.Name) $_.Name
        if ($cooldowns) {
            @{cooldowns=$cooldowns} | ConvertTo-Json -Compress -Depth 10 | Set-Content -LiteralPath $oldPath -Encoding ascii
        }
    }
}
Move-LocalState $aiRoot 'data\external-profiles' 'consumer-profiles'
Move-LocalState $aiRoot 'outputs\external' 'consumer-outputs'
Move-LocalState $aiRoot 'data\local-business\latest.json' 'local-business-latest.json'
Move-LocalState $aiRoot 'data\local-business\metros.json' 'local-business-metros.json'
Move-LocalState $aiRoot 'outputs\local-business' 'local-business-drafts'

$env:EXTERNAL_LOCAL_PROFILE = ''
$env:LEADFLOW_LOCAL_PROFILE = ''
$env:EXTERNAL_LEADS_ENABLED = 'true'
$env:EXTERNAL_LEADS_API_ORIGIN = $origin
$env:EXTERNAL_LEADS_SOURCES = 'hackernews,wordpress_jobs_rss,himalayas,jobicy_rss,remotive,uk_tender'
$env:FREELANCE_QUALIFICATION_MODE = 'shadow'
$env:TELEGRAM_ENABLED = 'false'
$env:SAFE_OWNER_EMAIL_TEST = 'false'
$env:REQUALIFY_MISSING = 'false'
$env:FORCE_REQUALIFY = 'false'

Push-Location -LiteralPath $aiRoot
try {
    if ($PreserveHistory) {
        $env:LEADFLOW_FRESH_ONLY = 'true'
        $env:LEADFLOW_FRESH_SINCE = [DateTime]::UtcNow.ToString('o').Substring(0,23) + 'Z'
        $env:EXTERNAL_DISCOVERY_AI_MAX_REQUESTS = '30'
        & npm.cmd run external:collect -- --limit=100 --max-candidates=500 --fresh-days=14 --pages=5
    } else {
        & npm.cmd run external:collect
    }
    if ($LASTEXITCODE -ne 0) { Write-Warning 'Some feed requests failed. Importing the candidates available in the local database.' }
    Invoke-Npm @('run', 'external:run', '--', '--drain')
    Remove-Item Env:\EXTERNAL_LEADS_ENABLED -ErrorAction SilentlyContinue
    Invoke-Npm @('run', 'dev', '--', '--port', '5174', '--strictPort')
} finally {
    Pop-Location
}
