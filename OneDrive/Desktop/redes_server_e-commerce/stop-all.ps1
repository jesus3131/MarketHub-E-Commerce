# Script para detener todos los servicios del e-commerce MarketHub
# Uso: PowerShell -ExecutionPolicy Bypass -File stop-all.ps1

Write-Host "Deteniendo todos los servicios Node.js..." -ForegroundColor Yellow

$stopped = @()
Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object {
    $id = $_.Id
    try {
        $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId = $id").CommandLine
        if ($cmd -match "server\.js|vite") {
            Stop-Process -Id $id -Force
            $stopped += $id
        }
    } catch {
        # Process might have ended
    }
}

if ($stopped.Count -gt 0) {
    Write-Host "Detenidos $($stopped.Count) procesos (PIDs: $($stopped -join ', '))" -ForegroundColor Green
} else {
    Write-Host "No se encontraron procesos Node.js activos." -ForegroundColor Cyan
}

Start-Sleep -Seconds 1

# Verify ports are free
$usedPorts = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in @(3001,3002,3003,3004,3005,5173) }
if ($usedPorts) {
    Write-Host "Puertos aun en uso:" -ForegroundColor Yellow
    $usedPorts | ForEach-Object { Write-Host "  Puerto $($_.LocalPort) - PID $($_.OwningProcess)" }
} else {
    Write-Host "Todos los puertos estan libres." -ForegroundColor Green
}
