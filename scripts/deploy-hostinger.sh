#!/usr/bin/env bash
# Despliegue en un VPS de Hostinger (o cualquier Ubuntu/Debian con root).
#
# Uso:
#   HOST=45.152.44.64 USER=root PORT_SSH=22 ./scripts/deploy-hostinger.sh
#   HOST=... USER=... KEY=~/.ssh/minha_chave ./scripts/deploy-hostinger.sh
#
# Hace: instala Node 22, crea usuario, clona el repo, monta systemd + nginx,
# genera contraseña si no existe y deja el servicio activo.

set -euo pipefail

HOST="${HOST:?define HOST (IP o dominio)}"
USER_SSH="${USER:-root}"
PORT_SSH="${PORT_SSH:-22}"
KEY="${KEY:-}"
REPO="${REPO:-https://github.com/josartpsd-cell/finanzas-carpinteria.git}"
BRANCH="${BRANCH:-master}"
APP_DIR="/opt/finanzas"
DOMINIO="${DOMINIO:-}"

SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -p "$PORT_SSH")
[ -n "$KEY" ] && SSH_OPTS+=(-i "$KEY")

remoto() { ssh "${SSH_OPTS[@]}" "$USER_SSH@$HOST" "$@"; }

echo "==> Verificando acceso a $USER_SSH@$HOST:$PORT_SSH"
remoto 'echo ok; . /etc/os-release && echo "$PRETTY_NAME"' || {
  echo "No se pudo entrar por SSH. Revisa usuario, puerto y clave." >&2
  exit 1
}

echo "==> Instalando dependencias del sistema"
remoto "export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git nginx ca-certificates >/dev/null
if ! command -v node >/dev/null || [ \"\$(node -v | cut -c2- | cut -d. -f1)\" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
node -v"

echo "==> Creando usuario y carpetas"
remoto "id -u finanzas >/dev/null 2>&1 || useradd -r -m -d /home/finanzas -s /bin/bash finanzas
mkdir -p $APP_DIR/data $APP_DIR/uploads
touch /var/log/finanzas.log
chown -R finanzas:finanzas $APP_DIR /var/log/finanzas.log"

echo "==> Clonando código"
remoto "if [ -d $APP_DIR/.git ]; then cd $APP_DIR && git fetch --all -q && git reset --hard origin/$BRANCH -q; else rm -rf $APP_DIR && git clone -q -b $BRANCH $REPO $APP_DIR; fi
cd $APP_DIR && npm install --omit=dev --no-audit --no-fund >/dev/null && echo 'dependencias ok'"

echo "==> Configurando servicio"
remoto "cat > /etc/systemd/system/finanzas.service <<'UNIT'
[Unit]
Description=Finanzas Carpinteria
After=network.target

[Service]
Type=simple
User=finanzas
Group=finanzas
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PORT=4173
Environment=DATA_DIR=$APP_DIR/data
Environment=UPLOAD_DIR=$APP_DIR/uploads
EnvironmentFile=-$APP_DIR/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
StandardOutput=append:/var/log/finanzas.log
StandardError=append:/var/log/finanzas.log

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable finanzas >/dev/null 2>&1
systemctl restart finanzas
sleep 3
systemctl is-active finanzas"

echo "==> Configurando nginx"
remoto "cat > /etc/nginx/sites-available/finanzas <<'CONF'
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMINIO:-_};
    client_max_body_size 20m;
    location / {
        proxy_pass http://127.0.0.1:4173;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }
}
CONF
ln -sf /etc/nginx/sites-available/finanzas /etc/nginx/sites-enabled/finanzas
rm -f /etc/nginx/sites-enabled/default
nginx -t >/dev/null 2>&1 && systemctl reload nginx && echo 'nginx ok'"

echo "==> Probando"
remoto "curl -s -o /dev/null -w 'local /login -> %{http_code}\n' http://127.0.0.1:4173/login"

echo
echo "Listo. Abre http://$HOST/login"
echo "Contraseña inicial: la que aparezca en /var/log/finanzas.log (o APP_PASSWORD en $APP_DIR/.env)"
echo "Para HTTPS con dominio: certbot --nginx -d tudominio.com"
