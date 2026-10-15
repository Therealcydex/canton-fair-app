#!/usr/bin/env bash
# One-time setup of the server (Debian 12/13) for the Sourcing app. Run as root (or with sudo):
#   sudo bash server-setup.sh 76-13-55-161.sslip.io you@example.com
# Arguments: the address of the app, and an e-mail for Let's Encrypt (certificate expiry notices).
# Safe to run again: each step checks what is already there.
#
# It installs Node 20, PM2, nginx and certbot; creates the user "sourcing" and /opt/sourcing;
# sets up the nginx site and the https certificate; starts PM2 at boot; schedules the nightly
# backup. It does not touch MariaDB or any other site.
set -euo pipefail

HOST="${1:?address of the app, e.g. 76-13-55-161.sslip.io}"
EMAIL="${2:?e-mail for the certificate notices}"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP=/opt/sourcing

echo "== packages"
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx curl ca-certificates gzip

echo "== Node 20"
if ! command -v node >/dev/null || [[ "$(node -v)" != v20.* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi
node -v
command -v pm2 >/dev/null || npm install -g pm2@5

echo "== user and folders"
id sourcing >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/sourcing --shell /usr/sbin/nologin sourcing
mkdir -p "$APP"/backend/uploads "$APP"/web "$APP"/m "$APP"/backups
chown -R sourcing:sourcing "$APP"
chmod 750 "$APP"/backups

echo "== nginx"
sed "s/__HOST__/$HOST/g" "$HERE/nginx-sourcing.conf" > /etc/nginx/sites-available/sourcing
ln -sf /etc/nginx/sites-available/sourcing /etc/nginx/sites-enabled/sourcing
# nginx (www-data) reads the built files and the photos.
usermod -aG sourcing www-data
chmod 750 "$APP" "$APP"/backend "$APP"/backend/uploads "$APP"/web "$APP"/m
nginx -t
systemctl reload nginx

echo "== https certificate (Let's Encrypt)"
if [[ ! -d "/etc/letsencrypt/live/$HOST" ]]; then
  certbot --nginx -d "$HOST" --non-interactive --agree-tos -m "$EMAIL" --redirect
fi
systemctl reload nginx

echo "== PM2 at boot (user sourcing)"
pm2 startup systemd -u sourcing --hp /home/sourcing >/dev/null

echo "== nightly backup (02:30)"
install -m 750 -o sourcing -g sourcing "$HERE/backup.sh" "$APP"/backup.sh
echo "30 2 * * * sourcing $APP/backup.sh >> $APP/backups/backup.log 2>&1" > /etc/cron.d/sourcing-backup
chmod 644 /etc/cron.d/sourcing-backup

echo "== done: https://$HOST (the app itself is installed by deploy.sh from the PC)"
