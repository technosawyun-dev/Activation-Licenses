# Deploying this License Activation server

This is a fresh deployment — nothing is currently live at `activate.sawyuntech.com`,
so there's no existing data or downtime risk to worry about.

## 0. What's already prepared for you

- `.env` — filled in with real, randomly generated secrets (`ENCRYPTION_KEY`, `SECRET_KEY`,
  `POSTGRES_PASSWORD`) and `BASE_URL=https://activate.sawyuntech.com` (the domain
  Global_Link's desktop app is hardcoded to call). **This file contains real secrets —
  transfer it to the VPS over SSH/SCP, never paste it into chat, email, or a public repo.**
- `ADMIN_USERNAME=admin` / `ADMIN_PASSWORD` in `.env` — the first login. Change the
  password after your first login (there's no "change password" self-service yet;
  use the Users page to reset it, or edit `.env` and restart before first boot).
- `Caddyfile.example` — a minimal reverse-proxy config if your VPS doesn't already
  have one (Caddy gets you HTTPS for free with zero cert management).

## 1. Get the code onto the VPS

From your dev machine:

```bash
rsync -avz --exclude .venv --exclude __pycache__ \
  "/home/hein-htet-nyan/Desktop/License Activation/" \
  youruser@your-vps:/opt/license-activation/
```

(Or `git init` + push to a private repo + `git clone` on the VPS — either works.
Just make sure `.env` actually makes it over; it's gitignored on purpose so a plain
`git push` won't carry it.)

## 2. Point the domain at this VPS

In your DNS provider, create an A record: `activate.sawyuntech.com` → your VPS's IP.
(Skip this if it's already pointed there.)

## 3. Set up HTTPS (pick one)

**Option A — Caddy (simplest, recommended if nothing else is running):**
```bash
sudo apt install caddy   # or see caddyserver.com/docs/install
sudo cp Caddyfile.example /etc/caddy/Caddyfile
sudo systemctl reload caddy
```
Caddy will automatically get and renew a Let's Encrypt certificate for the domain.

**Option B — your VPS already runs nginx/Caddy for other services:**
Add a matching site block for `activate.sawyuntech.com` proxying to `localhost:8010`,
using whatever pattern your existing config already follows.

## 4. Build and start the app

```bash
cd /opt/license-activation
docker compose up -d --build
docker compose logs -f web   # watch it come up; Ctrl+C to stop watching (container keeps running)
```

The app listens on `localhost:8010` on the VPS (mapped from the container's port 8000);
the reverse proxy from step 3 is what actually exposes it as `https://activate.sawyuntech.com`.

## 5. Verify it's up

```bash
curl -I http://localhost:8010/admin/login   # should return 200 from the VPS itself
curl -I https://activate.sawyuntech.com/admin/login   # should also return 200, from anywhere
```

Then log in at `https://activate.sawyuntech.com/admin/login` with the `ADMIN_USERNAME`/
`ADMIN_PASSWORD` from `.env`.

## 6. Create the Global_Link project

In the admin UI: **Projects → New Project**
- Name: `Repair & Sales ServiceDesk` (internal name — never shown to end users)
- Slug: `global-link` (or similar)
- Deep Link Scheme: `sawyuntech`
- **Import Private Key**: paste the existing Ed25519 private key whose public key is
  `vLFuyZSXIXMCAUS9os/G2/5BFhqEvep9T4kB4KQdRas=` — this is NOT stored anywhere in this
  repo; you need to supply it (from wherever it was originally generated/saved).
  If you don't have it anymore, you'll need to generate a new key pair here instead
  and update the public key hardcoded in Global_Link's `license.rs` to match — but
  that breaks any licenses already signed with the old key, so only do this if the
  old private key is genuinely lost.
- After creating it, confirm the **Public Key** shown on the project page matches
  `vLFuyZSXIXMCAUS9os/G2/5BFhqEvep9T4kB4KQdRas=` exactly.

## 7. Issue a test token and activate

1. **Tokens → New Token** — pick the Global_Link project, a test customer, any license number.
2. Copy the activation link it generates (`https://activate.sawyuntech.com/activate?token=...`).
3. Open it in a browser — it should show the deep-link redirect page for `sawyuntech://`.
4. From a real Global_Link install (or via `curl -X POST https://activate.sawyuntech.com/activate
   -H "Content-Type: application/json" -d '{"token":"<token>","computerId":"test-machine"}'`),
   confirm you get back a signed certificate JSON, and the token shows as `used` afterward.

## 8. Before calling it production-ready

- [ ] Change `ADMIN_PASSWORD` to something only you know (the generated one is in `.env` in plaintext).
- [ ] Set up a backup for the `postgres_data` docker volume (e.g. a nightly `pg_dump` cron job).
- [ ] Confirm `docker compose ps` shows `restart: unless-stopped` is working (reboot the VPS once and verify it comes back up on its own).
- [x] Port `8010` is already bound to `127.0.0.1` only in `docker-compose.yml` — not reachable from the public internet directly, only via whatever reverse proxy runs on the VPS itself. (Postgres was never host-exposed to begin with.) Still worth a quick `sudo ufw status` / provider security-group check to confirm nothing else opened it up.
