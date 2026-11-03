# Known issues and limitations

Honest list of what isn't done or has caveats. Nothing here blocks the local demo.

## Not done yet

| Item | Why / what's needed |
|---|---|
| **Public deployment** | `render.yaml` and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) are ready, but deploying needs a hosting account, so there's no live URL yet. |
| Password reset / email verification | Needs an email provider; out of scope for this version. |
| Login rate limiting | Not implemented. A reverse proxy rule or a small in-app limiter would be the next step before real use. |

## Limitations by design

* **Notifications are in-app only**, polled every 30 seconds. No email or push.
* **Refunds, replacements and repairs are simulated.** Fulfillment just records a note; no money moves.
* **Uploads live on local disk** (`UPLOAD_DIR`, a Docker volume). On hosts with temporary disks
  (e.g. Render free plan) they're lost on redeploy. Object storage (S3 or similar) would fix this.
* **Purchases are seeded**, not imported from a real order system. There's no admin UI to create orders.
* **Email addresses can't be changed** from the profile page.
* **Analytics date filters use UTC days** (see DECISIONS.md).
* **The staff tab on the Users page** loads up to 100 employees and 100 admins without paging, which is plenty for a small store.

## Dependency audit

* `npm audit --omit=dev`: **0 vulnerabilities** in packages shipped to the browser.
* `npm audit` (including dev tools): 6 **moderate** findings, all in the ESLint toolchain
  (`minimatch` via `eslint`). They only affect the developer's machine and CI linting, not the app.
  Revisit when ESLint publishes a fixed release.
* Python dependencies were not scanned (no `pip-audit` installed in this environment).
  Suggested: `pip install pip-audit && pip-audit -r backend/requirements.txt`.

## Environment notes

* Local development used PostgreSQL 14 (Homebrew); Docker and CI use PostgreSQL 16. Nothing in the
  schema depends on 16-only features.
* GitHub Actions warns that `actions/checkout@v4`, `setup-python@v5` and `setup-node@v4` target the
  deprecated Node.js 20 runtime (they still run, on Node 24). Bump them when newer majors are available.
* The Starlette test client prints a deprecation notice about `httpx`; it's filtered in
  `pyproject.toml` and doesn't affect results.
