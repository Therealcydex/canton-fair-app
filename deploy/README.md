# Putting Sourcing online

One https address for everything, on the server that already runs the database (76.13.55.161,
Debian 13):

| Address | What |
|---|---|
| `https://76-13-55-161.sslip.io/` | The app, on computers and installed on the iPhone (QR scanner, camera) |
| `https://76-13-55-161.sslip.io/m/` | Old address of the former phone app: opens the app |
| `https://76-13-55-161.sslip.io/api/` | Backend (Node, PM2), only reachable through nginx |

`76-13-55-161.sslip.io` is a free name that always points to 76.13.55.161 (sslip.io), so a real
Let's Encrypt certificate can be issued without buying a domain. A domain can replace it later:
change the name in step 3 and run certbot again.

Files: `nginx-sourcing.conf` (web server), `server-setup.sh` (once, as root), `deploy.sh` (from
the PC, each new version), `backup.sh` (every night), `db-user.sql` (database user of the app).

## 1. SSH access (once)

On the PC, in Git Bash, create a key used only for this server:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/claude_sourcing -C "sourcing deploy"
cat ~/.ssh/claude_sourcing.pub
```

On the server, add that one line (the `.pub`, never the other file) to
`~/.ssh/authorized_keys` of a user that can use `sudo`. Then from the PC:

```bash
ssh -i ~/.ssh/claude_sourcing <user>@76.13.55.161 'sudo -n true && echo ok'
```

## 2. Prepare the server (once)

```bash
scp -i ~/.ssh/claude_sourcing -r deploy <user>@76.13.55.161:/tmp/sourcing-deploy
ssh -i ~/.ssh/claude_sourcing <user>@76.13.55.161 \
  'sudo bash /tmp/sourcing-deploy/server-setup.sh 76-13-55-161.sslip.io <e-mail for certificate notices>'
```

Ports 80 and 443 must be open to the internet (80 is needed by Let's Encrypt).

## 3. Database user of the app (once)

As the database admin on the server: replace `<password>` in `db-user.sql` with a long random
password, then `sudo mariadb < db-user.sql`. The app can then read and write only its own
tables, never the ERP's. To create the app's tables on the real database, or to bring over the
data of `Smart360_copy`, follow [DATABASE.md](DATABASE.md).

## 4. Settings of the backend (once)

Create `/opt/sourcing/backend/.env` on the server (owner `sourcing`, `chmod 600`):

```
PORT=3000
HOST=127.0.0.1
TRUST_PROXY=1
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=sourcing_app
DB_PASSWORD=<the password of step 3>
DB_NAME=Smart360_copy
JWT_SECRET=<new long random value, not the one of the PC>
JWT_EXPIRES_IN=12h
```

Random values: `openssl rand -base64 48`.

## 5. Deploy a version (each time)

From the PC, at the root of the project:

```bash
SSH_TARGET=<user>@76.13.55.161 bash deploy/deploy.sh
```

It builds the web app, sends it with the backend code, installs the backend's
packages and restarts it. `.env` and the photos on the server are never touched.

## 6. Check from China

From the PC, open `https://76-13-55-161.sslip.io/` in Chrome (padlock, no warning). Then test
from Chinese networks with a free multi-city test, for example https://www.itdog.cn/http/ (enter
the address, "快速测试") or https://ping.chinaz.com/76.13.55.161: every city should answer in under
about 1 s. If many cities fail or are slow, the app should move to a server in Hong Kong or
Singapore before the fair.

## 7. Install on the iPhone

On the iPhone, in **Safari** (not Chrome): open `https://76-13-55-161.sslip.io/`, log in, then
Share › **Add to Home Screen** › Add. The app opens full screen from its icon; allow the camera the
first time the QR scanner opens.

## 8. Before the trip (security)

- Change the password of the database user `wassim` (it was written in a chat), and update the
  PC's `backend/.env`.
- Change the admin password of the app (Administration › Utilisateurs › Modifier).
- The boss's own account, role Administrateur; he changes his temporary password at first use.
- Database port 3306 is open to the internet today (the PC connects to it): once the app runs on
  the server, allow it only from the PC's address, or close it and use an SSH tunnel.
- Backups: `/opt/sourcing/backups` (database `db-<date>.sql.gz` and photos), 14 days. Copy one
  off the server from time to time (`scp`).
