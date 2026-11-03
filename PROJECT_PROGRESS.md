# Project progress

Milestone log. "Verified" means the listed checks were actually run and passed; see
[TESTING_REPORT.md](TESTING_REPORT.md) for the commands and numbers.

| # | Milestone | Status | Commit(s) |
|---|---|---|---|
| 0 | Planning and architecture | Done | docs in `docs/` |
| 1 | Project setup | Verified | `chore: scaffold FastAPI backend…`, `chore: add Docker Compose…` |
| 2 | Database and authentication | Verified | `feat: add database models, migrations, seed data and session auth` |
| 3 | Customer portal | Verified | `feat: build customer portal…` |
| 4 | Employee portal | Verified | `feat: implement return eligibility, review workflow…`, `feat: build employee work queue…` |
| 5 | Administrator portal | Verified | `feat: add analytics, staff management…`, `feat: add admin analytics dashboard…` |
| 6 | Analytics and visualizations | Verified | same as 5 |
| 7 | Warranty, uploads, comments, notifications | Verified | included in 2–5 |
| 8 | Testing and bug fixing | Verified | `test: …` commits |
| 9 | Deployment and GitHub preparation | Pushed to GitHub, CI green; **not deployed** | `ci: …`, `docs: …` |
| 10 | Final verification | Done (local) | this file + TESTING_REPORT.md |

---

### Milestone 0: Planning and architecture
- **Built:** read the blueprint; fixed the scope, roles, screens, ERD, API list and business rules
  (`docs/requirements`, `docs/architecture`, `docs/database`, `docs/api`); wrote down decisions where
  the blueprint left room (`DECISIONS.md`).
- **Verification:** documentation review.

### Milestone 1: Project setup
- **Built:** FastAPI app with settings from env vars and `/health` (checks the DB); Vite + React +
  Tailwind app with a dev proxy; pinned dependencies; `.gitignore`, `.env.example`; Dockerfiles for
  API and web (nginx), `docker-compose.yml` with Postgres health checks and volumes.
- **Tests:** health test in pytest; `docker compose up --build` brought all three containers up healthy.
- **Issues:** Docker Desktop wasn't running at first; it was started and the stack verified later in the build.

### Milestone 2: Database and authentication
- **Built:** 11 tables via SQLAlchemy 2 models and one reviewed Alembic migration (FKs, uniques,
  check constraints, indexes, `NUMERIC` money, `timestamptz`); deterministic seed; Argon2 password
  hashing; server-side sessions with HttpOnly cookie and CSRF token; role dependencies; registration,
  login, logout, profile, password change.
- **Tests:** migration up/down/up + `alembic check`; 15 auth tests.
- **Errors fixed:** `.test` email domain is rejected by `email-validator`, so demo accounts use `example.com`.

### Milestone 3: Customer portal
- **Built:** dashboard (KPIs, recent requests, return windows closing soon), purchases with
  eligibility badges, new request form (type, item, quantity limits, reason, outcome, files),
  request list with search/filter/sort/paging, request detail with progress bar, timeline,
  conversation, attachments and cancel.
- **Tests:** 20 return-rule/authorization tests; E2E customer flow.

### Milestone 4: Employee portal
- **Built:** workflow service with transition table, row locks and same-transaction events;
  assign/release, approve/reject (reason required), simulated fulfillment, close; work queue with
  URL-persisted filters; review screen with next-step card and confirmation dialogs; employee
  dashboard with own work, unassigned queue, workload and status charts; internal notes.
- **Tests:** 18 workflow tests including a concurrent-decision test; E2E approve and reject flows.

### Milestone 5: Administrator portal
- **Built:** product create/edit/archive; staff creation, role changes and deactivation (ends
  sessions); return policy settings; request monitor (queue with assign-to-anyone).
- **Tests:** permission and validation tests in `test_collaboration.py`; E2E product flow.

### Milestone 6: Analytics and visualizations
- **Built:** summary and trends endpoints (SQL aggregates with shared filters), CSV export; 4 KPI
  cards and 7 Recharts charts with metric definitions, screen-reader summaries, empty states, consistent
  status colors, date/status/type filters.
- **Tests:** 11 analytics tests comparing results to known data, zero-data and filter cases; E2E
  dashboard test; visual check in the browser.

### Milestone 7: Warranty, uploads, comments, notifications
- **Built:** warranty eligibility from product warranty days; uploads validated by extension and
  magic bytes, stored privately, served through an authorized endpoint; comments with internal notes;
  notifications on every status change, assignment and reply, with bell dropdown and full page.
- **Tests:** warranty and collaboration tests (see TESTING_REPORT.md).

### Milestone 8: Testing and bug fixing
- **Built:** Vitest + RTL unit/component tests, Playwright E2E with its own database, screenshot script.
- **Result:** 85 backend + 36 frontend + 5 E2E tests passing; lint and format clean. Bugs found and fixed
  are listed in TESTING_REPORT.md.

### Milestone 9: Deployment and GitHub preparation
- **Built:** GitHub Actions workflow (backend lint/migrations/tests, frontend lint/tests/build, E2E,
  Docker build), Render blueprint, deployment guide, README, architecture/ER diagrams, API docs and
  OpenAPI schema, screenshots, MIT license.
- **Pushed** to https://github.com/saxipatel-dev/returndesk on 2026-11-03; the first CI run passed all 4 jobs.
- **Not done:** cloud deployment (needs a hosting account, see docs/DEPLOYMENT.md).

### Milestone 10: Final verification
- Full local run of every check in TESTING_REPORT.md on 2026-11-02: all passing.
