# Script para iniciar todos los servicios del e-commerce MarketHub
# Uso: PowerShell -ExecutionPolicy Bypass -File start-all.ps1

param(
    [switch]$StopFirst,
    [switch]$Frontend
)

$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$dbUrl = "postgresql://postgres:Jr200131@127.0.0.1:8001/ecommerce_db"
$jwtSecret = "super-secret-key-cambiar-en-produccion"

$services = @(
    @{Name="auth-service";    Port=3001}
    @{Name="product-service"; Port=3002}
    @{Name="order-service";   Port=3003}
    @{Name="report-service";  Port=3004}
    @{Name="carousel-service";Port=3005}
)

if ($StopFirst) {
    Write-Host "Deteniendo servicios existentes..." -ForegroundColor Yellow
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
    Write-Host "Servicios detenidos." -ForegroundColor Green
}

Write-Host "===== INICIANDO SERVICIOS MARKETHub =====" -ForegroundColor Cyan

foreach ($s in $services) {
    $dir = Join-Path $baseDir $s.Name
    $logFile = Join-Path $dir "service.log"
    
    Write-Host "Iniciando $($s.Name) en puerto $($s.Port)..." -NoNewline
    
    # Crear script cmd para lanzar node con entorno limpio
    $cmdContent = @"
@echo off
set DATABASE_URL=$dbUrl
set JWT_SECRET=$jwtSecret
cd /d "$dir"
node server.js
"@
    $cmdFile = Join-Path $dir "start.bat"
    $cmdContent | Set-Content -Path $cmdFile -Encoding ASCII
    
    # Iniciar proceso oculto y completamente independiente
    $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c start /B cmd.exe /c `"$cmdFile`"" -WindowStyle Hidden -PassThru
    Start-Sleep -Milliseconds 500
    Write-Host " PID $($proc.Id)" -ForegroundColor Green
}

Start-Sleep -Seconds 3

Write-Host "`n===== VERIFICANDO SERVICIOS =====" -ForegroundColor Cyan
$listening = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in @(3001,3002,3003,3004,3005) }
$portsUp = $listening | Group-Object LocalPort
$allUp = $true
foreach ($s in $services) {
    $up = $portsUp | Where-Object { $_.Name -eq $s.Port }
    if ($up) {
        Write-Host "  Puerto $($s.Port) ($($s.Name)): ACTIVO" -ForegroundColor Green
    } else {
        Write-Host "  Puerto $($s.Port) ($($s.Name)): INACTIVO" -ForegroundColor Red
        $allUp = $false
    }
}

if ($allUp) {
    Write-Host "`nTodos los servicios backend estan funcionando correctamente." -ForegroundColor Green
} else {
    Write-Host "`nAlgunos servicios no estan respondiendo. Revise los logs." -ForegroundColor Yellow
}

if ($Frontend) {
    Write-Host "`nIniciando Frontend (Vite)..." -ForegroundColor Cyan
    $feDir = Join-Path $baseDir "frontend"
    $vitePath = Join-Path $feDir "node_modules\vite\bin\vite.js"
    
    if (Test-Path $vitePath) {
        $cmdContent = @"
@echo off
cd /d "$feDir"
node "$vitePath" --host 0.0.0.0 --port 5173
"@
        $cmdFile = Join-Path $feDir "start-frontend.bat"
        $cmdContent | Set-Content -Path $cmdFile -Encoding ASCII
        $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c start /B cmd.exe /c `"$cmdFile`"" -WindowStyle Hidden -PassThru
        Write-Host "Frontend iniciado (PID: $($proc.Id))." -ForegroundColor Green
        
        Start-Sleep -Seconds 5
        $feListen = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq 5173 }
        if ($feListen) {
            Write-Host "Frontend disponible en http://localhost:5173/" -ForegroundColor Green
        } else {
            Write-Host "Frontend no responde aun, espere unos segundos mas." -ForegroundColor Yellow
        }
    } else {
        Write-Host "Error: Vite no encontrado en $vitePath. Ejecute 'npm install' en frontend/" -ForegroundColor Red
    }
}

Write-Host "`n===== LISTO =====" -ForegroundColor Cyan
