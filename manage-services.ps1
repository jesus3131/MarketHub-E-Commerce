<#
.SYNOPSIS
    Start, stop, restart, or inspect the local microservices on Windows.

.DESCRIPTION
    This script avoids PowerShell child-process issues by starting detached Node
    processes with absolute script paths, per-service logs, and health checks.
#>

[CmdletBinding()]
param(
    [ValidateSet('start', 'stop', 'restart', 'status')]
    [string]$Action = 'status',

    [ValidateSet('all', 'auth', 'product', 'order', 'report', 'carousel')]
    [string[]]$Service = @('all'),

    [string]$DatabaseUrl = 'postgresql://postgres:Jr200131@127.0.0.1:8001/ecommerce_db',
    [string]$JwtSecret = 'super-secret-key-cambiar-en-produccion'
)

$ErrorActionPreference = 'Stop'

$repoRoot = $PSScriptRoot
$runtimeDir = Join-Path $repoRoot '.runtime'
$pidDir = Join-Path $runtimeDir 'pids'
$logDir = Join-Path $runtimeDir 'logs'
$nodePath = (Get-Command node).Source

$null = New-Item -ItemType Directory -Force -Path $runtimeDir, $pidDir, $logDir

$services = @(
    [pscustomobject]@{ Name = 'auth'; Port = 3001; Dir = Join-Path $repoRoot 'auth-service'; Script = Join-Path $repoRoot 'auth-service\server.js'; Health = '/health' }
    [pscustomobject]@{ Name = 'product'; Port = 3002; Dir = Join-Path $repoRoot 'product-service'; Script = Join-Path $repoRoot 'product-service\server.js'; Health = '/health' }
    [pscustomobject]@{ Name = 'order'; Port = 3003; Dir = Join-Path $repoRoot 'order-service'; Script = Join-Path $repoRoot 'order-service\server.js'; Health = '/health' }
    [pscustomobject]@{ Name = 'report'; Port = 3004; Dir = Join-Path $repoRoot 'report-service'; Script = Join-Path $repoRoot 'report-service\server.js'; Health = '/health' }
    [pscustomobject]@{ Name = 'carousel'; Port = 3005; Dir = Join-Path $repoRoot 'carousel-service'; Script = Join-Path $repoRoot 'carousel-service\server.js'; Health = '/health' }
)

function Get-SelectedServices {
    param([string[]]$RequestedNames)

    if ($RequestedNames -contains 'all') {
        return $services
    }

    $selected = foreach ($name in $RequestedNames) {
        $serviceDef = $services | Where-Object Name -eq $name
        if (-not $serviceDef) {
            throw "Servicio desconocido: $name"
        }
        $serviceDef
    }

    return $selected
}

function Get-ServicePaths {
    param($ServiceDef)

    [pscustomobject]@{
        Pid = Join-Path $pidDir "$($ServiceDef.Name).pid"
        StdOut = Join-Path $logDir "$($ServiceDef.Name).out.log"
        StdErr = Join-Path $logDir "$($ServiceDef.Name).err.log"
    }
}

function ConvertTo-CmdLiteral {
    param([string]$Value)

    return $Value.Replace('%', '%%')
}

function Get-ListeningPids {
    param([int]$Port)

    $pattern = "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$"
    $matches = foreach ($line in (netstat -ano -p TCP)) {
        if ($line -match $pattern) {
            [int]$Matches[1]
        }
    }

    return @($matches | Sort-Object -Unique)
}

function Test-ServiceHealth {
    param($ServiceDef)

    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:$($ServiceDef.Port)$($ServiceDef.Health)" -TimeoutSec 2
        return $response.status -eq 'ok'
    } catch {
        return $false
    }
}

function Stop-ServiceProcess {
    param($ServiceDef)

    $paths = Get-ServicePaths -ServiceDef $ServiceDef
    $pids = @(Get-ListeningPids -Port $ServiceDef.Port)

    if ((-not $pids) -and (Test-Path $paths.Pid)) {
        $storedPid = Get-Content $paths.Pid -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($storedPid -match '^\d+$') {
            $pids = @([int]$storedPid)
        }
    }

    $pids = @($pids | Sort-Object -Unique)

    if (-not $pids) {
        Write-Host "[$($ServiceDef.Name)] no estaba en ejecucion."
        Remove-Item $paths.Pid -ErrorAction SilentlyContinue
        return
    }

    foreach ($processId in $pids) {
        try {
            Stop-Process -Id $processId -Force -ErrorAction Stop
            Write-Host "[$($ServiceDef.Name)] proceso detenido (PID $processId)."
        } catch {
            Write-Warning "[$($ServiceDef.Name)] no se pudo detener PID ${processId}: $($_.Exception.Message)"
        }
    }

    for ($i = 0; $i -lt 20; $i++) {
        if (-not (Get-ListeningPids -Port $ServiceDef.Port)) {
            break
        }
        Start-Sleep -Milliseconds 250
    }

    Remove-Item $paths.Pid -ErrorAction SilentlyContinue
}

function Start-ServiceProcess {
    param($ServiceDef)

    $paths = Get-ServicePaths -ServiceDef $ServiceDef
    $existingPids = @(Get-ListeningPids -Port $ServiceDef.Port)

    if ($existingPids) {
        throw "[$($ServiceDef.Name)] el puerto $($ServiceDef.Port) ya esta ocupado por PID(s): $($existingPids -join ', ')"
    }

    $envMap = @{
        PORT = [string]$ServiceDef.Port
        DATABASE_URL = $DatabaseUrl
        JWT_SECRET = $JwtSecret
    }

    if (Test-Path $paths.StdOut) { Remove-Item $paths.StdOut -Force }
    if (Test-Path $paths.StdErr) { Remove-Item $paths.StdErr -Force }

    $startCommand = @(
        "cd /d ""$(ConvertTo-CmdLiteral $ServiceDef.Dir)"""
        "set ""PORT=$(ConvertTo-CmdLiteral $envMap.PORT)"""
        "set ""DATABASE_URL=$(ConvertTo-CmdLiteral $envMap.DATABASE_URL)"""
        "set ""JWT_SECRET=$(ConvertTo-CmdLiteral $envMap.JWT_SECRET)"""
        "start """" /min cmd.exe /c """"$(ConvertTo-CmdLiteral $nodePath)"""" """"$(ConvertTo-CmdLiteral $ServiceDef.Script)"""" 1>>""""$(ConvertTo-CmdLiteral $paths.StdOut)"""" 2>>""""$(ConvertTo-CmdLiteral $paths.StdErr)"""""""
    ) -join ' && '

    Start-Process -FilePath $env:ComSpec -ArgumentList @('/c', $startCommand) -WindowStyle Hidden | Out-Null

    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Milliseconds 500
        if (Test-ServiceHealth -ServiceDef $ServiceDef) {
            $startedPids = @(Get-ListeningPids -Port $ServiceDef.Port)
            if ($startedPids) {
                Set-Content -Path $paths.Pid -Value ($startedPids -join [Environment]::NewLine)
            }
            Write-Host "[$($ServiceDef.Name)] servicio arriba en puerto $($ServiceDef.Port) (PID $($startedPids -join ', '))."
            return
        }
    }

    $stderrPreview = if (Test-Path $paths.StdErr) {
        (Get-Content $paths.StdErr -ErrorAction SilentlyContinue | Select-Object -Last 10) -join [Environment]::NewLine
    }

    $stdoutPreview = if (Test-Path $paths.StdOut) {
        (Get-Content $paths.StdOut -ErrorAction SilentlyContinue | Select-Object -Last 10) -join [Environment]::NewLine
    }

    throw "[$($ServiceDef.Name)] no respondio a /health. STDERR:`n$stderrPreview`nSTDOUT:`n$stdoutPreview"
}

function Show-ServiceStatus {
    param($ServiceDef)

    $pids = @(Get-ListeningPids -Port $ServiceDef.Port)
    $status = if ($pids) { 'up' } else { 'down' }
    $health = if ($pids) { if (Test-ServiceHealth -ServiceDef $ServiceDef) { 'ok' } else { 'no-health' } } else { '-' }
    $pidText = if ($pids) { $pids -join ', ' } else { '-' }

    Write-Host ("{0,-10} port {1,-5} status {2,-4} health {3,-9} pid {4}" -f $ServiceDef.Name, $ServiceDef.Port, $status, $health, $pidText)
}

$selectedServices = @(Get-SelectedServices -RequestedNames $Service)

switch ($Action) {
    'stop' {
        foreach ($serviceDef in $selectedServices) {
            Stop-ServiceProcess -ServiceDef $serviceDef
        }
    }
    'start' {
        foreach ($serviceDef in $selectedServices) {
            Start-ServiceProcess -ServiceDef $serviceDef
        }
    }
    'restart' {
        foreach ($serviceDef in $selectedServices) {
            Stop-ServiceProcess -ServiceDef $serviceDef
        }
        foreach ($serviceDef in $selectedServices) {
            Start-ServiceProcess -ServiceDef $serviceDef
        }
    }
    'status' {
        foreach ($serviceDef in $selectedServices) {
            Show-ServiceStatus -ServiceDef $serviceDef
        }
    }
}
