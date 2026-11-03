# Decisions

Practical choices made where the blueprint left room, and why. Newest at the bottom.

## Blueprint vs. build instructions

The blueprint asks to stop for approval after every milestone; the build instructions said to
work through all milestones without stopping. I followed the build instructions and kept a
verification record per milestone in [PROJECT_PROGRESS.md](PROJECT_PROGRESS.md) instead.
Commits carry no automated co-author lines, as the blueprint asks.

## Authentication: server-side sessions + CSRF token

* **Choice:** random 32-byte session token in an `HttpOnly`, `SameSite=Lax` cookie; only its
  SHA-256 hash is stored in `user_sessions`. Each session also has a CSRF token that must be sent
  as `X-CSRF-Token` on every non-GET request.
* **Why not JWT in localStorage:** readable by any injected script, and can't be revoked before
  it expires. With DB sessions, logout, password change and deactivation take effect immediately.
* **Why the CSRF token is returned in JSON, not a readable cookie:** it keeps working if the API is
  ever hosted on a different domain than the frontend.
* **Password hashing:** Argon2id via `argon2-cffi`. Login runs a dummy hash for unknown emails so
  response time doesn't reveal which emails exist.

## One origin for frontend and API

Vite (dev) and nginx (Docker/prod) proxy `/api` to FastAPI. The browser only ever talks to one
origin, so cookies work with `SameSite=Lax` and there's no CORS configuration to get wrong.
CORS is still configurable for the case where the API has to live elsewhere.

## Statuses and the extra columns

* Added `cancelled` (blueprint: "cancellation is allowed only before a final decision").
* Unassigning a request that's `under_review` moves it back to `pending_review`, so the queue's
  "pending" really means "nobody is on it".
* Added `decision`, `decided_at`, `fulfilled_at` and `closed_at` to `return_requests`. The blueprint's
  metrics (approval trend by decision month, resolution time from closure) need these, and reading
  them from columns is simpler and faster than reconstructing them from events.
* Employees can only decide on requests assigned to them; admins can act on any request. This keeps
  the "who is responsible" question simple and is enforced in one function (`can_act_as_reviewer`).

## Return quantity rules

Remaining quantity = purchased − requests of the **same type** that aren't rejected or cancelled.
Returns and warranty claims are counted separately, because a unit that was repaired under warranty
could still be returned later and vice versa. Rejected and cancelled requests release their units.
The purchase item row is locked during creation so two simultaneous submissions can't over-claim.

## Return policy is configurable; warranty is per product

`store_settings` (a single row) holds the return window (default 30 days), whether customers can
cancel, and the attachment limit. Warranty length is `products.warranty_days`; 0 means no warranty.
Allowed outcomes: returns → refund or replacement; warranty → repair or replacement.

## Analytics

* Computed with SQL aggregates on every request (no materialized views or caching): easy to check
  against the database, and fast enough for thousands of rows.
* All KPIs and charts share one filter set (created-date window, current status, type), so numbers
  on one screen always describe the same set of requests.
* Dates are interpreted as UTC calendar days. A user in UTC−8 filtering "today" in the evening may
  see a request from the next UTC day excluded; this is documented in the filter bar.
* "N/A" instead of 0% when there are no decisions or closed requests, per the blueprint.
* The workload chart includes admins only if they have open assignments.

## Uploads

Allowed: JPG, PNG, WEBP, PDF up to 5 MB. Checked by extension **and** the file's leading bytes,
stored under a random name outside any web root, and served only through an authorized endpoint with
`X-Content-Type-Options: nosniff`. Original filenames are kept only for display.

## Library versions

Dependencies were the current stable releases when the project was set up (November 2026), pinned
in `requirements.txt` and `package-lock.json`. React Router is pinned to v7 rather than the newest
major because its API is well documented and stable.

## Seed data

Deterministic (`random.Random(2026)`), but dates are relative to the day it runs so the demo always
has recent activity and items inside the return window. All emails use the reserved `example.com`
domain. The seed refuses to run in `ENVIRONMENT=production` without `--allow-production`.

## Things deliberately not built

Email delivery, payment/shipping integrations, background jobs, Redis, microservices: the blueprint
excludes them and the app doesn't need them at this size.
