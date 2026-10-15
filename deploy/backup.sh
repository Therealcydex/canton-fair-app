#!/usr/bin/env bash
# Nightly backup of the Sourcing app (cron, set up by server-setup.sh): the app's tables only
# (never the ERP's), and the photos. Keeps 14 days in /opt/sourcing/backups.
# Restore: gunzip -c db-<date>.sql.gz | mariadb <database>   and   tar xzf uploads-<date>.tar.gz -C /opt/sourcing/backend
set -euo pipefail

APP=/opt/sourcing
DEST="$APP/backups"
STAMP="$(date +%Y-%m-%d)"
KEEP_DAYS=14

# Database settings from the backend's .env (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME).
set -a
# shellcheck disable=SC1091
source <(grep -E '^DB_(HOST|PORT|USER|PASSWORD|NAME)=' "$APP/backend/.env")
set +a

# The app's tables and views (docs/sourcing-status.md); the ERP's tables are left out.
TABLES="companies users suppliers contacts booths products product_images product_shares china_province canton_fair_category shipping_types"

# The password goes through a temporary option file, never on the command line (visible in ps).
OPTS="$(mktemp)"
trap 'rm -f "$OPTS"' EXIT
chmod 600 "$OPTS"
printf '[client]\nhost=%s\nport=%s\nuser=%s\npassword=%s\n' "${DB_HOST:-127.0.0.1}" "${DB_PORT:-3306}" "$DB_USER" "$DB_PASSWORD" > "$OPTS"

mariadb-dump --defaults-extra-file="$OPTS" --single-transaction --routines=false --triggers=false \
  "$DB_NAME" $TABLES | gzip > "$DEST/db-$STAMP.sql.gz"
tar czf "$DEST/uploads-$STAMP.tar.gz" -C "$APP/backend" uploads

find "$DEST" -name 'db-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
find "$DEST" -name 'uploads-*.tar.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) backup ok: $(du -h "$DEST/db-$STAMP.sql.gz" | cut -f1) database, $(du -h "$DEST/uploads-$STAMP.tar.gz" | cut -f1) photos"
