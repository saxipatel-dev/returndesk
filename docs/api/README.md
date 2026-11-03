# API reference

All routes live under `/api` and speak JSON. Interactive docs (Swagger UI) are served by the
running API at **`/api/docs`**; the raw schema is checked in as [`openapi.json`](openapi.json)
(regenerate with the command at the bottom).

## Conventions

* **Auth**: sign in with `POST /api/auth/login`. The API sets an `HttpOnly` `rd_session` cookie
  and returns a `csrf_token`. Send that token as `X-CSRF-Token` on every `POST`/`PATCH`.
* **Errors** always look like `{"detail": "Readable message"}`, or a list of field errors for 422.

| Status | Meaning |
|---|---|
| 400 | Business rule failed (outside return window, too many units, bad upload) |
| 401 | Not signed in / session expired |
| 403 | Signed in but not allowed (wrong role, missing CSRF token) |
| 404 | Not found **or** belongs to someone else |
| 409 | Conflict with current state (invalid transition, already decided, duplicate SKU/email) |
| 413 | Upload too large |
| 422 | Validation error |

* **Lists** support `page` / `page_size` and return `{items, total, page, page_size}`.
* **Dates** in filters are `YYYY-MM-DD` and interpreted as UTC calendar days (inclusive).

## Endpoints

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | public | Always creates a **customer**; any `role` field is ignored |
| POST | `/api/auth/login` | public | Same error for unknown email and wrong password |
| POST | `/api/auth/logout` | signed in | Deletes the server-side session |
| GET / PATCH | `/api/auth/me` | signed in | Current user + CSRF token / update name |
| POST | `/api/auth/password` | signed in | Signs out the user's other sessions |
| GET | `/api/products` | signed in | `q`, `category`, `include_archived` (admin) |
| GET | `/api/products/categories` | signed in | |
| POST / PATCH | `/api/products`, `/api/products/{id}` | admin | Archive with `{"archived": true}` |
| GET | `/api/purchases`, `/api/purchases/{id}` | signed in | Own purchases only, with return/warranty eligibility per item |
| GET | `/api/returns` | signed in | Customers see their own; staff see all. Filters: `q`, `status`, `request_type`, `assigned` (`me`/`unassigned`/`assigned`/id), `open_only`, `date_from`, `date_to`, `sort` (`created_at`, `-created_at`, `updated_at`, `status`, `id`) |
| POST | `/api/returns` | customer | Eligibility, window and quantity checked server-side |
| GET | `/api/returns/{id}` | owner or staff | Includes `allowed_actions` for the current user |
| POST | `/api/returns/{id}/assign` | staff | `{"employee_id": n}` or `null` to release. Employees can only assign themselves |
| POST | `/api/returns/{id}/decision` | assigned employee or admin | `{"decision": "approved"\|"rejected", "reason": "…"}`; reason required to reject |
| POST | `/api/returns/{id}/fulfill` | assigned employee or admin | Simulated; can only happen once |
| POST | `/api/returns/{id}/close` | assigned employee or admin | From `fulfilled` or `rejected` |
| POST | `/api/returns/{id}/cancel` | owning customer | Before a decision, if the store allows it |
| GET | `/api/returns/{id}/events` | owner or staff | Timeline |
| GET / POST | `/api/returns/{id}/comments` | owner or staff | Internal notes hidden from customers |
| GET / POST | `/api/returns/{id}/attachments` | owner or staff | multipart `file`; JPG/PNG/WEBP/PDF ≤ 5 MB, content checked |
| GET | `/api/attachments/{id}` | owner or staff | Streams the file with `nosniff` |
| GET | `/api/staff` | staff | Active staff with open workload |
| GET / POST / PATCH | `/api/users`, `/api/users/{id}` | admin | Create staff, change role, (de)activate |
| GET | `/api/settings` | signed in | Return policy |
| PATCH | `/api/settings` | admin | |
| GET | `/api/analytics/summary` | staff | KPIs. Filters: `date_from`, `date_to`, `status`, `request_type` |
| GET | `/api/analytics/trends` | staff | All chart series in one response |
| GET | `/api/analytics/export.csv` | admin | Same filters, one row per request |
| GET | `/api/notifications` | signed in | `unread_only`, `limit`; includes `unread_count` |
| PATCH | `/api/notifications/{id}` | recipient | `{"read": true\|false}` |
| POST | `/api/notifications/read-all` | signed in | |
| GET | `/health` | public | `{"status":"ok","database":"ok"}` or 503 |

## Metric definitions (analytics)

All metrics are computed in SQL over `return_requests` after applying the same filters
(created date window, current status, request type).

| Metric | Definition |
|---|---|
| Total requests | Count of requests created in the window |
| Pending review | Count currently `pending_review` |
| Approval rate | approved decisions ÷ (approved + rejected decisions) × 100; `null` (shown as N/A) when there are no decisions |
| Avg. resolution days | Mean of `closed_at − created_at` over **closed** requests; `null` when none |
| Monthly requests | Count grouped by month of `created_at` |
| By category | Count grouped by the purchased product's category |
| Status distribution | Count grouped by current status |
| Reasons | Count grouped by reason |
| Resolution time trend | Mean resolution days grouped by month of `closed_at` |
| Workload | Open requests (`pending_review`, `under_review`, `approved`) per active staff member; unassigned reported separately |
| Approval vs. rejection | Decisions grouped by month of `decided_at` |

## Example with curl

```bash
# Sign in and keep the cookie
curl -c cookies.txt -H "Content-Type: application/json" \
  -d '{"email":"customer@example.com","password":"Demo#2026"}' \
  http://localhost:8080/api/auth/login
# → {"user": {...}, "csrf_token": "abc..."}

# List own purchases with eligibility
curl -b cookies.txt http://localhost:8080/api/purchases

# Submit a return (use the csrf_token from the login response)
curl -b cookies.txt -H "Content-Type: application/json" -H "X-CSRF-Token: abc..." \
  -d '{"purchase_item_id": 12, "request_type": "return", "quantity": 1,
       "reason": "defective", "requested_resolution": "refund",
       "description": "Stopped charging after two days."}' \
  http://localhost:8080/api/returns

# Attach a photo
curl -b cookies.txt -H "X-CSRF-Token: abc..." -F "file=@photo.jpg" \
  http://localhost:8080/api/returns/121/attachments
```

## Regenerating `openapi.json`

```bash
cd backend
.venv/bin/python -c "import json; from app.main import app; json.dump(app.openapi(), open('../docs/api/openapi.json','w'), indent=2)"
```
