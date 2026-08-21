# VPS deployment (169.58.213.171)

Deployment assets for the self-managed Ubuntu 24.04 VPS. This is a **separate
target** from the CloudJiffy/Jelastic setup that the repo-root
`ecosystem.config.js` describes — that file is not used here.

## Topology

```
internet ──► nginx :80/:443 ──► 127.0.0.1:3000 (node, PM2, user `erp`)
             (terminates TLS)         │
                                      ├──► 127.0.0.1:5432  PostgreSQL 18
                                      └──► 127.0.0.1:6379  Redis 7
```

Postgres, Redis and Node listen on loopback only; ufw admits 22/80/443 and
nothing else.

| Path | What |
| --- | --- |
| `/opt/erp-server/app` | git clone (branch `DEV-v1`), owned by `erp` |
| `/opt/erp-server/app/.env` | config, mode 600 — **not in git** |
| `/opt/erp-server/ecosystem.config.js` | PM2 config (`ecosystem.vps.config.js` here) |
| `/opt/erp-server/bin/` | the scripts in this directory |
| `/opt/erp-server/logs/` | PM2 stdout/stderr |
| `/root/.erp-deploy-secrets` | DB password, JWT secret, superuser URL (mode 600) |

The PM2 config lives **outside** the git tree on purpose: `deploy.sh` runs
`git reset --hard`, which would otherwise overwrite it. Its `env` block is
deliberately empty so `.env` is the single source of truth — `src/env.preload.ts`
runs `dotenv.config()`, and dotenv does **not** override variables already in
`process.env`, so anything pinned in PM2 would silently win over `.env`.

## Redeploying

```bash
ssh root@169.58.213.171 /opt/erp-server/bin/deploy.sh          # current branch
ssh root@169.58.213.171 /opt/erp-server/bin/deploy.sh main     # another branch
```

Fetch → `npm ci` → build → migrate → re-grant → ensure partitions → `pm2 reload`
→ health check. Fail-fast: nothing reaches PM2 unless the build and migrations
succeeded. On a failed health check it prints the rollback command.

After editing anything here, copy it to the server:

```bash
scp deploy/deploy.sh deploy/verify-db.sh deploy/grant-app-privileges.sql \
    root@169.58.213.171:/opt/erp-server/bin/
scp deploy/nginx/erp.conf       root@169.58.213.171:/etc/nginx/sites-available/erp
scp deploy/nginx/erp-proxy.conf root@169.58.213.171:/etc/nginx/snippets/erp-proxy.conf
```

## Two things that make a naive deploy fail

**1. Migrations need a superuser; the app must not be one.** Seven migrations
carry pgAdmin-style `ALTER TABLE ... OWNER to postgres`, which fails as any other
role with `42501: must be able to SET ROLE "postgres"`. Dev never hits this
because dev connects as `postgres`.

So `deploy.sh` applies migrations with a superuser URL (`MIGRATE_DATABASE_URL`)
while the app connects as the unprivileged `erp_app` — a SQL injection under a
superuser role reaches `COPY ... PROGRAM`, and therefore a shell. Because
migration-created objects end up owned by `postgres`,
`grant-app-privileges.sql` re-grants `erp_app` after every migrate, including
`ALTER DEFAULT PRIVILEGES` so future objects are covered automatically.
`erp_app` also needs `CREATE` on `public`: the seed runner creates
`public._erp_seed_history` on first boot.

**2. PostgreSQL 18 is mandatory.** The schema defaults columns to `uuidv7()` and
no migration defines that function — it relies on the native PG18 builtin.
Ubuntu 24.04 ships PG16, where every insert would fail, so the box uses the PGDG
apt repo. Required extensions: `pgcrypto`, `btree_gist`.

## Accounting-year partitions

Bill/order/quotation tables are LIST-partitioned by accounting year, and a year
with no partition makes every save fail. The bootstrap block in the acc_year
migration reads `public.fiscal_years`, which is **empty after seeding** — so it
creates nothing. `deploy.sh` therefore calls `ensure_acc_year_partitions()` for
the current and next fiscal year (April–March) on every run.

## TLS

Two vhosts. `https://169-58-213-171.sslip.io` carries a real Let's Encrypt
certificate and is the hostname browsers and the Vercel frontend should use;
sslip.io is wildcard DNS that resolves the embedded IP, so no domain purchase was
needed. The bare IP `https://169.58.213.171` keeps a self-signed certificate so
curl/Postman still work.

Renewal runs from `certbot.timer`, with
`/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` reloading nginx
afterwards — `certonly` does not do that by itself, so without the hook a renewed
cert would sit unused on disk.

To move to a real domain: point DNS at the IP, then

```bash
certbot certonly --webroot -w /var/www/html -d api.example.com
# add a server block in nginx/erp.conf pointing at the new cert, then reload
```

and add the new origin to `CORS_ORIGINS` in `.env` — in production `main.ts` uses
*only* that list, so an origin missing from it is blocked outright.

## Checking a deployment

```bash
ssh root@169.58.213.171 /opt/erp-server/bin/verify-db.sh
curl https://169-58-213-171.sslip.io/api/v1/health
ssh root@169.58.213.171 'sudo -u erp HOME=/opt/erp-server pm2 logs erp-api --lines 50'
```
