<#
.SYNOPSIS
    Sincroniza la base de datos local (Windows PostgreSQL) con el servidor Rocky Linux (WSL).
    Exporta la base local, la copia a WSL y restaura sobre la base ecommerce del servidor.
.NOTES
    Ejecutar en PowerShell como administrador.
    Requiere: PostgreSQL 18 en Windows, WSL Rocky Linux con PostgreSQL 16, PM2.
#>

$ErrorActionPreference = "Stop"

# Configuración
$PG_PATH     = "C:\Program Files\PostgreSQL\18\bin"
$PG_HOST     = "127.0.0.1"
$PG_PORT     = 8001
$PG_USER     = "postgres"
$PG_PASS     = "Jr200131"
$PG_DB       = "ecommerce_db"

$WSL_DISTRO  = "rocky"
$DUMP_FILE   = "$env:TEMP\opencode\ecommerce_dump.sql"
$WSL_TEMP    = "/tmp/ecommerce_dump.sql"

Write-Host "=== Paso 1: Exportando base local $PG_DB ===" -ForegroundColor Cyan
$env:PGPASSWORD = $PG_PASS
& "$PG_PATH\pg_dump.exe" -U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_DB --no-owner --no-acl -f $DUMP_FILE
Write-Host "  Dump guardado: $DUMP_FILE" -ForegroundColor Green

Write-Host "=== Paso 2: Eliminando lineas incompatibles con PG16 ===" -ForegroundColor Cyan
(Get-Content $DUMP_FILE) | Where-Object { $_ -notmatch 'transaction_timeout|\\restrict|\\unrestrict' } | Set-Content $DUMP_FILE
# Asegurar search_path = public
(Get-Content $DUMP_FILE) -replace "SELECT pg_catalog.set_config\('search_path', '', false\)", "SELECT pg_catalog.set_config('search_path', 'public', false)" | Set-Content $DUMP_FILE

Write-Host "=== Paso 3: Copiando dump a WSL ===" -ForegroundColor Cyan
wsl -d $WSL_DISTRO -u root -- bash -c "cp /mnt/c$($DUMP_FILE -replace 'C:', '' -replace '\\', '/') $WSL_TEMP"
Write-Host "  Copiado a WSL: $WSL_TEMP" -ForegroundColor Green

Write-Host "=== Paso 4: Restaurando en servidor WSL ===" -ForegroundColor Cyan
wsl -d $WSL_DISTRO -u root -- bash -c @"
echo "  Deteniendo microservicios..."
pm2 stop all 2>&1 | tail -1

echo "  Eliminando base antigua..."
su - postgres -c "psql -c 'DROP DATABASE IF EXISTS ecommerce;'" 2>&1

echo "  Creando base nueva..."
su - postgres -c "psql -c 'CREATE DATABASE ecommerce OWNER postgres;'" 2>&1

echo "  Importando dump..."
su - postgres -c "psql -d ecommerce -f $WSL_TEMP" 2>&1

echo "  Otorgando permisos..."
su - postgres -c "psql -d ecommerce -c 'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ecommerce;'" 2>&1
su - postgres -c "psql -d ecommerce -c 'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ecommerce;'" 2>&1
su - postgres -c "psql -d ecommerce -c 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ecommerce;'" 2>&1
su - postgres -c "psql -d ecommerce -c 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ecommerce;'" 2>&1

echo "  Sincronización completada. Iniciando microservicios..."
pm2 start all 2>&1 | tail -1
"@

Write-Host "=== Sincronización completada ===" -ForegroundColor Green
Write-Host "Accede a: http://localhost/ (desde WSL) o http://172.28.5.17/ (desde Windows)" -ForegroundColor Yellow
