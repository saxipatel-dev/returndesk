# Testing report

Every result below was produced by actually running the command, on **2026-11-02**, on macOS
(Apple Silicon), Python 3.12.16, Node 22.23.4, PostgreSQL 14.19. Anything that couldn't be run here is
marked **NOT RUN** with the reason.

## Summary

| Check | Command | Result |
|---|---|---|
| Backend lint | `ruff check .` | **PASS** (no issues) |
| Backend formatting | `ruff format --check .` | **PASS** (30 files) |
| Migrations up → down → up on an empty DB | `alembic upgrade head && alembic downgrade base && alembic upgrade head` | **PASS** |
| Models match migrations | `alembic check` | **PASS** ("No new upgrade operations detected") |
| Backend tests | `pytest` | **PASS**: 85 passed, 0 failed, 0 skipped (~10 s) |
| Frontend lint | `npm run lint` | **PASS** (0 errors, 0 warnings) |
| Frontend formatting | `npm run format:check` | **PASS** |
| Frontend unit/component tests | `npm test` (Vitest + RTL) | **PASS**: 36 passed in 3 files |
| Production build | `npm run build` | **PASS** (routes code-split; largest chunk is Recharts, ~117 kB gzip) |
| End-to-end | `npx playwright test --project=e2e` | **PASS**: 5 passed (~19 s) |
| Docker Compose stack | `docker compose up --build` | **PASS**: db/api healthy, migrations + seed ran, SPA served on :8080, login/analytics/upload via nginx, data persisted across an API restart |
| Dependency audit (shipped code) | `npm audit --omit=dev` | **PASS**: 0 vulnerabilities |
| Dependency audit (dev tools) | `npm audit` | 6 moderate, ESLint toolchain only (see KNOWN_ISSUES.md) |
| Secret scan | `git grep` for key/secret/password literals | **PASS**: only documented demo/test values |
| GitHub Actions | `.github/workflows/ci.yml` | **PASS**: [run 41568261296](https://github.com/saxipatel-dev/returndesk/actions/runs/41568261296) on 2026-11-03, all 4 jobs green (backend 47 s, frontend 20 s, E2E 1 m 35 s, Docker build 26 s) |
| Live deployment smoke test | see docs/DEPLOYMENT.md | **NOT RUN**: needs a hosting account |
| Python dependency audit | `pip-audit` | **NOT RUN**: tool not installed here |

## Backend tests (85)

| File | Tests | Covers |
|---|---|---|
| `test_auth.py` | 15 | health check, registration (role can't be injected, duplicate email, weak password), login errors identical for unknown email/wrong password, HttpOnly + SameSite cookie, logout, CSRF required on writes, deactivated users, password change, deactivation ends sessions |
| `test_returns.py` | 20 | valid return, history event + notification on create, quantity > purchased, quantity 0, remaining-quantity across multiple requests, cancelled request frees quantity, return window (fixed and from settings), other customer's item (404), staff can't submit, resolution must match type, warranty within/after period, product without warranty, eligibility in purchases API, purchases private, **customer A can't read/comment/cancel customer B's request**, list scoping, staff search/filters/sort validation, pagination |
| `test_workflow.py` | 18 | full approve → fulfill → close path with exact event sequence and 5 notifications, rejection reason required (empty and whitespace), rejected can't be fulfilled, decision before review blocked, no double decision, no double fulfillment (one event), fulfill pending blocked, only assignee decides, employees self-assign only, admin assigns + notification, can't assign customer/inactive staff, unassign returns to queue, customer blocked from staff endpoints, cancel only before decision, cancellation toggle, closed can't be reassigned, workload count, **two simultaneous decisions → exactly one 200 and one 409** |
| `test_analytics.py` | 11 | KPI counts/rate/average against known data, N/A (null) with zero data, every chart series matches the DB, empty dataset, month gap filling, status filter, date filter, invalid range 422, permissions (customer 403, employee no CSV), CSV export rows, workload per employee |
| `test_collaboration.py` | 19 | internal notes hidden from customer, customers can't post internal notes, staff reply notifies customer, empty comment rejected, upload + download + nosniff + event, other customer can't download or upload (404), disallowed extension, content/extension mismatch, 5 MB limit (413), attachment count limit, notification read/unread and ownership, product CRUD is admin-only + SKU uniqueness + archive hides from catalog, product validation, staff creation admin-only + no customer role, admin can't deactivate self, customer can't become staff, user list admin-only, settings read/write permissions and validation |
| `test_seed.py` | 2 | seed creates every role and status, each request's last event matches its status, no item over-claimed; seeded customer can sign in and has returnable items |

## Frontend unit/component tests (36)

| File | Tests | Covers |
|---|---|---|
| `utils.test.js` | 16 | registration/request/product/settings validation, file pre-check, N/A formatting, month labels, portal links, date ranges, API error message extraction (string, field list, network) |
| `components.test.jsx` | 14 | status/type badges, empty and error states (retry), confirm dialog (confirm, cancel, Escape, closed), pagination, KPI row (N/A and with data), chart empty state and accessible text summary, requests table links and staff columns, timeline order and notes, progress bar for rejected requests |
| `auth.test.jsx` | 6 | signed-out redirect to login, login validation without API call, server error shown, successful customer login lands on dashboard, customer redirected away from admin page, registration password rule |

## End-to-end tests (5)

Run against a real FastAPI server and PostgreSQL database (`returndesk_e2e`, reset and seeded on each run):

1. Customer submits a return → employee finds it by reference, assigns, approves and records fulfillment → customer sees "Fulfilled", the history, the fulfillment note and an unread notification.
2. Admin assigns a request to an employee and tries to reject without a reason (blocked with a message), then rejects with one.
3. Customer navigating to `/staff/queue` and `/admin/products` is redirected to their dashboard.
4. Admin dashboard shows the 4 KPIs and all 7 chart titles with rendered charts; a filter combination with no matches shows empty states.
5. Admin adds a product and archives it.

## Manual checks

Done in the browser against the dev servers and the Docker stack:

- [x] Login page, demo account buttons, sign out
- [x] Customer dashboard numbers match the API
- [x] New request form shows field errors on empty submit
- [x] All 7 charts render with seed data; resolution and approval charts show sensible values
- [x] Mobile layout (390 px): sidebar collapses to a menu, cards stack, no horizontal scroll on analytics
- [x] Screenshots regenerated with `npx playwright test --project=screenshots` (14 images)

## Bugs found and fixed during testing

| Found by | Problem | Fix |
|---|---|---|
| pytest | Date-filter test used the local date while the API uses UTC days, so it failed in the evening (US time) | Test uses the UTC date; API behavior documented in the UI and docs |
| Code review | `Modal` re-ran its focus effect on every parent render (inline `onClose`), which could move focus while typing | Keep `onClose` in a ref; effect depends only on `open` |
| ESLint (react-hooks) | `setState` inside effects in the settings page and mobile menu | Settings form initialized from props with a `key`; mobile menu state derived from the current path |
| Build | Single 850 kB bundle | Route-level code splitting with `React.lazy` |
| Playwright | Screenshot run raced sign-out and the next sign-in | Wait for the `/login` URL after signing out |
| Playwright | Ambiguous text locators ("Pending review" appears in the KPI, filter and legend) | Scoped locators in the test |
