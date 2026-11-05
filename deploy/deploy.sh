#!/usr/bin/env bash
# Deploys the current code from this PC to the server (Git Bash on Windows, or any bash):
#   SSH_TARGET=user@76.13.55.161 SSH_KEY=~/.ssh/claude_sourcing bash deploy/deploy.sh
# It builds the web app here (API on the same address: /api; it is also the iPhone app, D52), sends
# it with the backend code over SSH, installs the backend's packages on the server and restarts it
# with PM2.
# Never sent: .env, node_modules, uploads/ (the server keeps its own), tests.
# The server must have been prepared once with server-setup.sh, and have backend/.env.
set -euo pipefail

: "${SSH_TARGET:?SSH_TARGET=user@server}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/claude_sourcing}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SSH=(ssh -i "$SSH_KEY" -o BatchMode=yes "$SSH_TARGET")
PACK="$(mktemp -d)"
trap 'rm -rf "$PACK"' EXIT

echo "== build the web app"
(cd "$ROOT/frontend" && REACT_APP_API_BASE_URL=/api CI=true npm run build >/dev/null)

echo "== pack"
tar czf "$PACK/web.tgz" -C "$ROOT/frontend/build" .
tar czf "$PACK/backend.tgz" -C "$ROOT/backend" \
  --exclude=node_modules --exclude=.env --exclude=uploads --exclude=tests \
  .
ls -lh "$PACK"

echo "== send"
scp -i "$SSH_KEY" -o BatchMode=yes "$PACK"/*.tgz "$SSH_TARGET:/tmp/"

echo "== install on the server"
"${SSH[@]}" 'sudo bash -s' <<'REMOTE'
set -euo pipefail
APP=/opt/sourcing
test -f "$APP/backend/.env" || { echo "Missing $APP/backend/.env (deploy/README.md, step 4)"; exit 1; }
rm -rf "$APP/web.new" && mkdir "$APP/web.new"
tar xzf /tmp/web.tgz -C "$APP/web.new"
rm -rf "$APP/web.old" && mv "$APP/web" "$APP/web.old" && mv "$APP/web.new" "$APP/web"
tar xzf /tmp/backend.tgz -C "$APP/backend"
chown -R sourcing:sourcing "$APP"
chmod 750 "$APP/web"
rm -f /tmp/web.tgz /tmp/backend.tgz
cd "$APP/backend"
sudo -u sourcing -H npm ci --omit=dev --no-audit --no-fund
# D77: Base64 catalogues -> files on disk (safe if already done).
sudo -u sourcing -H node sql/update_supplier_catalog_files.js || true
if sudo -u sourcing -H pm2 describe sourcing-backend >/dev/null 2>&1; then
  sudo -u sourcing -H pm2 reload ecosystem.config.js
else
  sudo -u sourcing -H pm2 start ecosystem.config.js
fi
sudo -u sourcing -H pm2 save
# D77: raise nginx body size and timeouts without rewriting the certbot SSL blocks.
NGINX=/etc/nginx/sites-available/sourcing
if [[ -f "$NGINX" ]]; then
  if grep -q 'client_max_body_size' "$NGINX"; then
    sed -i -E 's/client_max_body_size[[:space:]]+[0-9]+[kKmMgG]?;/client_max_body_size 500m;/' "$NGINX"
  else
    sed -i '/server_name /a\    client_max_body_size 500m;' "$NGINX"
  fi
  if grep -q 'client_body_timeout' "$NGINX"; then
    sed -i -E 's/client_body_timeout[[:space:]]+[0-9]+s;/client_body_timeout 600s;/' "$NGINX"
  else
    sed -i '/client_max_body_size/a\    client_body_timeout 600s;' "$NGINX"
  fi
  if grep -q 'proxy_read_timeout' "$NGINX"; then
    sed -i -E 's/proxy_read_timeout[[:space:]]+[0-9]+s;/proxy_read_timeout 600s;/' "$NGINX"
  else
    sed -i '/proxy_pass http:\/\/127.0.0.1:3000;/a\        proxy_read_timeout 600s;' "$NGINX"
  fi
  if grep -q 'proxy_send_timeout' "$NGINX"; then
    sed -i -E 's/proxy_send_timeout[[:space:]]+[0-9]+s;/proxy_send_timeout 600s;/' "$NGINX"
  else
    sed -i '/proxy_read_timeout/a\        proxy_send_timeout 600s;' "$NGINX"
  fi
  if ! grep -q 'proxy_request_buffering' "$NGINX"; then
    sed -i '/proxy_send_timeout/a\        proxy_request_buffering off;' "$NGINX"
  fi
  nginx -t && systemctl reload nginx
fi
sleep 2
curl -fsS http://127.0.0.1:3000/ && echo
REMOTE
echo "== deployed"
