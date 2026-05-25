#!/bin/bash
set -e

# ================================================================
# Script de instalación para E-Commerce en Rocky Linux 9.7
# Sin Docker. Usa Apache + Node.js + PostgreSQL + PM2
# ================================================================

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err() { echo -e "${RED}[ERROR]${NC} $1"; }

# Detectar la IP pública/privada del servidor
SERVER_IP=$(ip -4 addr show enp0s3 | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1)
if [ -z "$SERVER_IP" ]; then
  SERVER_IP=$(hostname -I | awk '{print $1}')
fi

log "=========================================="
log "Instalando E-Commerce en Rocky Linux 9.7"
log "Servidor IP: $SERVER_IP"
log "=========================================="

# ─── 1. Actualizar sistema ──────────────────────────────────────
log "Actualizando sistema..."
dnf update -y
dnf install -y epel-release dnf-plugins-core

# ─── 2. Instalar Node.js 20 ─────────────────────────────────────
log "Instalando Node.js 20 LTS..."
dnf module enable -y nodejs:20
dnf install -y nodejs
node -v && npm -v

# ─── 3. Instalar PostgreSQL 15 ─────────────────────────────────
log "Instalando PostgreSQL 15..."
dnf install -y postgresql-server postgresql-contrib
/usr/bin/postgresql-setup --initdb
systemctl enable --now postgresql

# ─── 4. Configurar PostgreSQL ──────────────────────────────────
log "Configurando PostgreSQL..."
su - postgres -c "psql -c \"CREATE USER ecommerce WITH PASSWORD 'ecommerce123';\"" 2>/dev/null || true
su - postgres -c "psql -c \"CREATE DATABASE ecommerce OWNER ecommerce;\"" 2>/dev/null || true
su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE ecommerce TO ecommerce;\"" 2>/dev/null || true

# Configurar autenticación local (md5 para conexiones locales)
PG_HBA=$(find /var/lib/pgsql -name pg_hba.conf 2>/dev/null | head -1)
if [ -n "$PG_HBA" ]; then
  sed -i 's/^local\s\+all\s\+all\s\+peer/local   all             all                                     md5/' "$PG_HBA"
  sed -i 's/^host\s\+all\s\+all\s\+127.0.0.1\/32\s\+scram-sha-256/host    all             all             127.0.0.1\/32            md5/' "$PG_HBA"
  systemctl restart postgresql
fi

log "Esperando que PostgreSQL esté listo..."
for i in $(seq 1 10); do
  if su - postgres -c "psql -c 'SELECT 1'" &>/dev/null; then
    break
  fi
  sleep 1
done

# ─── 5. Instalar Apache ────────────────────────────────────────
log "Instalando Apache HTTPD..."
dnf install -y httpd mod_ssl
systemctl enable --now httpd

# Habilitar módulos de proxy
for mod in proxy proxy_http proxy_wstunnel rewrite headers; do
  if [ ! -f "/etc/httpd/conf.modules.d/00-$mod.conf" ] && [ ! -f "/etc/httpd/conf.modules.d/01-$mod.conf" ]; then
    cat > "/etc/httpd/conf.modules.d/99-$mod.load" <<EOF
LoadModule ${mod}_module modules/mod_${mod}.so
EOF
  fi
done

# ─── 6. Instalar PM2 globalmente ───────────────────────────────
log "Instalando PM2..."
npm install -g pm2

# ─── 7. Crear estructura del proyecto ──────────────────────────
log "Creando estructura en /opt/ecommerce..."
mkdir -p /opt/ecommerce
mkdir -p /var/www/html

# ─── 8. Copiar archivos del proyecto (se transfieren por SCP) ──
# NOTA: Los archivos deben estar en /root/redes_server_e-commerce/
# Se copiarán automáticamente si están en el directorio de extracción
SRC_DIR="/root/redes_server_e-commerce"

if [ -d "$SRC_DIR" ]; then
  log "Copiando microservicios a /opt/ecommerce/..."
  for service in auth-service product-service order-service report-service carousel-service; do
    if [ -d "$SRC_DIR/$service" ]; then
      mkdir -p "/opt/ecommerce/$service"
      cp -r "$SRC_DIR/$service/"* "/opt/ecommerce/$service/"
      log "  -> $service copiado"
    fi
  done

  log "Copiando frontend a /var/www/html/..."
  if [ -d "$SRC_DIR/frontend/dist" ]; then
    cp -r "$SRC_DIR/frontend/dist/"* /var/www/html/
    log "  -> Frontend copiado"
  fi

  log "Copiando configuración de Apache..."
  if [ -f "$SRC_DIR/ecommerce-apache.conf" ]; then
    cp "$SRC_DIR/ecommerce-apache.conf" /etc/httpd/conf.d/ecommerce.conf
    log "  -> Apache config copiada"
  fi

  log "Copiando SQL de inicialización..."
  if [ -f "$SRC_DIR/init.sql" ]; then
    cp "$SRC_DIR/init.sql" /opt/ecommerce/init.sql
  fi
  if [ -f "$SRC_DIR/migration.sql" ]; then
    cp "$SRC_DIR/migration.sql" /opt/ecommerce/migration.sql
  fi

  log "Copiando ecosystem.config.js..."
  if [ -f "$SRC_DIR/deploy/ecosystem.config.js" ]; then
    cp "$SRC_DIR/deploy/ecosystem.config.js" /opt/ecommerce/ecosystem.config.js
  fi
else
  warn "Directorio $SRC_DIR no encontrado."
  warn "Transfiere los archivos primero con SCP desde Windows:"
  echo "  scp -r C:\Users\roble\OneDrive\Desktop\redes_server_e-commerce\* root@$SERVER_IP:/root/redes_server_e-commerce/"
  warn "Luego vuelve a ejecutar este script."
fi

# ─── 9. Ejecutar SQL de inicialización ─────────────────────────
log "Ejecutando scripts SQL..."
if [ -f "/opt/ecommerce/init.sql" ]; then
  PGPASSWORD=ecommerce123 psql -U ecommerce -d ecommerce -h localhost -f /opt/ecommerce/init.sql 2>/dev/null || \
  su - postgres -c "psql -d ecommerce -f /opt/ecommerce/init.sql"
  log "  -> init.sql ejecutado"
fi

if [ -f "/opt/ecommerce/migration.sql" ]; then
  PGPASSWORD=ecommerce123 psql -U ecommerce -d ecommerce -h localhost -f /opt/ecommerce/migration.sql 2>/dev/null || \
  su - postgres -c "psql -d ecommerce -f /opt/ecommerce/migration.sql"
  log "  -> migration.sql ejecutado"
fi

# ─── 10. Instalar dependencias de cada servicio ────────────────
log "Instalando dependencias npm..."
for service_dir in /opt/ecommerce/*/; do
  if [ -f "${service_dir}package.json" ]; then
    name=$(basename "$service_dir")
    log "  Instalando dependencias de $name..."
    cd "$service_dir"
    npm install --production --no-fund --no-audit 2>&1 | tail -1
  fi
done

# Crear directorios de uploads si es necesario
mkdir -p /opt/ecommerce/carousel-service/uploads
mkdir -p /opt/ecommerce/product-service/uploads
chmod 755 /opt/ecommerce/carousel-service/uploads
chmod 755 /opt/ecommerce/product-service/uploads

# ─── 11. Configurar Apache ─────────────────────────────────────
log "Configurando Apache..."
if [ -f "/etc/httpd/conf.d/ecommerce.conf" ]; then
  # Reemplazar localhost por 127.0.0.1 si es necesario
  sed -i 's/ServerName ecommerce.local/ServerName '"$SERVER_IP"'/' /etc/httpd/conf.d/ecommerce.conf

  # Verificar y habilitar módulos requeridos
  for mod in proxy proxy_http proxy_wstunnel rewrite headers; do
    if ! httpd -M 2>/dev/null | grep -qi "${mod}_module"; then
      warn "  Módulo $mod no está habilitado, intentando cargarlo..."
      if [ -f "/usr/lib64/httpd/modules/mod_${mod}.so" ]; then
        echo "LoadModule ${mod}_module modules/mod_${mod}.so" > "/etc/httpd/conf.modules.d/99-${mod}.load"
      fi
    fi
  done

  # Probar configuración
  if httpd -t 2>&1; then
    systemctl restart httpd
    log "  Apache configurado y reiniciado"
  else
    err "  Error en la configuración de Apache. Revisa: httpd -t"
  fi
else
  warn "  No se encontró /etc/httpd/conf.d/ecommerce.conf"
fi

# Configurar firewall
log "Configurando firewall..."
if systemctl is-active firewalld &>/dev/null; then
  firewall-cmd --permanent --add-service=http
  firewall-cmd --permanent --add-service=https
  firewall-cmd --reload
  log "  Puerto 80 y 443 abiertos en firewall"
else
  warn "  firewalld no está activo, omite configuración de firewall"
fi

# ─── 12. Iniciar servicios con PM2 ─────────────────────────────
log "Iniciando microservicios con PM2..."
cd /opt/ecommerce
if [ -f "ecosystem.config.js" ]; then
  pm2 delete all 2>/dev/null || true
  pm2 start ecosystem.config.js
  pm2 save
  pm2 startup systemd -u root --hp /root 2>/dev/null || pm2 startup
  log "  Microservicios iniciados con PM2"
else
  warn "  No se encontró ecosystem.config.js"
fi

# ─── 13. Verificar instalación ────────────────────────────────
log "=========================================="
log "✅ Instalación completada"
log "=========================================="
echo ""
echo "  Frontend:     http://$SERVER_IP/"
echo "  PostgreSQL:   localhost:5432 (user: ecommerce, pass: ecommerce123)"
echo ""
echo "  Microservicios:"
echo "    Auth Service:     http://$SERVER_IP/auth"
echo "    Product Service:  http://$SERVER_IP/products"
echo "    Order Service:    http://$SERVER_IP/orders"
echo "    Report Service:   http://$SERVER_IP/reports"
echo "    Carousel Service: http://$SERVER_IP/carousel"
echo ""
echo "  Comandos útiles:"
echo "    pm2 status                    # Ver estado de servicios"
echo "    pm2 logs                      # Ver logs"
echo "    pm2 restart all               # Reiniciar todos"
echo "    systemctl status httpd        # Estado de Apache"
echo "    systemctl status postgresql   # Estado de PostgreSQL"
echo ""

# Verificar cada servicio
log "Verificando servicios..."
sleep 3
for port in 3001 3002 3003 3004 3005; do
  if ss -tlnp | grep -q ":$port "; then
    log "  ✅ Puerto $port - OK"
  else
    err "  ❌ Puerto $port - NO RESPONDE"
  fi
done

if systemctl is-active httpd &>/dev/null; then
  log "  ✅ Apache HTTPD - OK"
else
  err "  ❌ Apache HTTPD - NO RESPONDE"
fi

if systemctl is-active postgresql &>/dev/null; then
  log "  ✅ PostgreSQL - OK"
else
  err "  ❌ PostgreSQL - NO RESPONDE"
fi

log "=========================================="
log "Ya puedes acceder desde cualquier red"
log "usando http://$SERVER_IP/"
log "=========================================="
