#!/usr/bin/env bash
# Deploys the current code from this PC to the server (Git Bash on Windows, or any bash):
#   SSH_TARGET=user@76.13.55.161 SSH_KEY=~/.ssh/claude_sourcing bash deploy/deploy.sh
# It builds the web and mobile apps here (API on the same address: /api), sends them with the
# backend code over SSH, installs the backend's packages on the server and restarts it with PM2.
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
echo "== build the mobile app"
(cd "$ROOT/mobile" && VITE_API_BASE_URL=/api npm run build >/dev/null)

echo "== pack"
tar czf "$PACK/web.tgz" -C "$ROOT/frontend/build" .
tar czf "$PACK/m.tgz" -C "$ROOT/mobile/dist" .
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
for part in web m; do
  rm -rf "$APP/$part.new" && mkdir "$APP/$part.new"
  tar xzf "/tmp/$part.tgz" -C "$APP/$part.new"
  rm -rf "$APP/$part.old" && mv "$APP/$part" "$APP/$part.old" && mv "$APP/$part.new" "$APP/$part"
done
tar xzf /tmp/backend.tgz -C "$APP/backend"
chown -R sourcing:sourcing "$APP"
chmod 750 "$APP/web" "$APP/m"
rm -f /tmp/web.tgz /tmp/m.tgz /tmp/backend.tgz
cd "$APP/backend"
sudo -u sourcing -H npm ci --omit=dev --no-audit --no-fund
if sudo -u sourcing -H pm2 describe sourcing-backend >/dev/null 2>&1; then
  sudo -u sourcing -H pm2 reload ecosystem.config.js
else
  sudo -u sourcing -H pm2 start ecosystem.config.js
fi
sudo -u sourcing -H pm2 save
sleep 2
curl -fsS http://127.0.0.1:3000/ && echo
REMOTE
echo "== deployed"
