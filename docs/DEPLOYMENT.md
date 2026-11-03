# Deployment

The app ships as two containers (API and web) plus a PostgreSQL database. Any host that can
run Docker images and provide Postgres will work. A ready-made [Render](https://render.com)
Blueprint is included as `render.yaml`.

> **Status:** the deployment configuration is written and the same images run locally with
> Docker Compose, but nothing has been deployed yet: it needs a hosting account, so there is
> no live URL. Don't add one to the README until a deployment has been checked.

## What production needs

| Setting | Value |
|---|---|
| `ENVIRONMENT` | `production` |
| `DATABASE_URL` | Managed Postgres URL (`postgres://` and `postgresql://` are both accepted) |
| `COOKIE_SECURE` | `true` (the site must be served over HTTPS) |
| `CORS_ORIGINS` | The public web URL. Not strictly needed when nginx proxies `/api`, but keep it accurate |
| `SEED_DEMO_DATA` | `true` only for a public demo, `false` for anything real |
| `API_UPSTREAM` (web container) | URL of the API service, e.g. `https://returndesk-api.onrender.com` |

Migrations run automatically when the API container starts (`docker-entrypoint.sh`).

## Option A: Render Blueprint

1. Push the repository to GitHub (`saxipatel-dev/returndesk`).
2. In Render, choose **New → Blueprint** and select the repository. Render reads `render.yaml`
   and proposes a database plus two web services.
3. Before applying, fill in the two `sync: false` variables:
   * `returndesk-api` → `CORS_ORIGINS` = the web service URL
   * `returndesk-web` → `API_UPSTREAM` = the API service URL
4. Apply. When both services are live, check:
   ```bash
   curl https://<web-url>/health          # {"status":"ok","database":"ok"}
   ```
   Then sign in with a demo account and walk through the [demo script](demo-script.md).

Free-plan caveats: services sleep when idle (the first request takes a while), the free database
expires after a limited period, and the container disk is temporary, so **uploaded files are lost on
redeploy**. For anything beyond a demo, attach a persistent disk at `/data/uploads` or move uploads
to object storage.

## Option B: any Docker host / VM

```bash
git clone https://github.com/saxipatel-dev/returndesk.git && cd returndesk
cp .env.example .env     # set a strong POSTGRES_PASSWORD, COOKIE_SECURE=true, SEED_DEMO_DATA=false
docker compose up -d --build
```

Put a TLS-terminating proxy (Caddy, Traefik, a cloud load balancer) in front of port `8080`.

## Creating the first admin on a real deployment

With `SEED_DEMO_DATA=false` there are no accounts. Create an admin once from the API container:

```bash
docker compose exec api python -c "
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import User
from app.models.enums import Role
import getpass
email = input('Admin email: ')
db = SessionLocal()
db.add(User(name='Administrator', email=email.lower(), role=Role.ADMIN,
            password_hash=hash_password(getpass.getpass('Password: '))))
db.commit()
print('Created', email)
"
```

## Smoke test checklist after deploying

- [ ] `GET /health` returns `ok` for the database
- [ ] Customer can sign in, submit a return and see it on the dashboard
- [ ] Employee sees it in the queue, assigns and approves it
- [ ] Customer sees "Approved" and a notification
- [ ] Admin analytics loads with charts
- [ ] Session cookie has `Secure` and `HttpOnly` (browser dev tools → Application → Cookies)
