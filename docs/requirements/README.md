# Requirements and scope

This summarizes the build specification (the "ReturnDesk Development Blueprint") and how
each part maps to the code. It's the checklist I used while building.

## Scope

| Release | Included | Status |
|---|---|---|
| MVP | Accounts, seeded purchases, return request, queue, decision, history, dashboard | Done |
| Extension | Warranty requests, attachments, comments, notifications, analytics | Done |
| Polish | Tests, CI, Docker, screenshots, README, deployment config | Done (live deployment needs a hosting account) |
| Out of scope | Payments, real order-system integration, ML, multi-tenant SaaS, microservices | Not built, on purpose |

## Roles

| Role | Can | Can't |
|---|---|---|
| Customer | Register, view own purchases, submit/track/cancel own returns and warranty claims, comment, upload evidence | See anyone else's data or any staff page |
| Employee | Work the queue, assign themselves, decide on assigned requests, record fulfillment, internal notes | Manage products, users or settings; assign others |
| Admin | Everything an employee can, plus assign anyone, manage products, staff accounts, return policy, analytics export | Deactivate or demote themselves |

Public sign-up only ever creates customers. Staff are created by an admin; the first admin comes
from the seed script (demo) or can be created with a one-off script on a real deployment.

## Screens

| Route | Audience | Status |
|---|---|---|
| `/login`, `/register` | Public | Done |
| `/dashboard` | Customer | Done |
| `/purchases` | Customer | Done |
| `/returns/new` | Customer | Done |
| `/returns`, `/returns/:id` | Customer | Done |
| `/staff` | Employee/Admin | Done (dashboard with workload) |
| `/staff/queue` | Employee/Admin | Done |
| `/staff/returns/:id` | Employee/Admin | Done |
| `/admin/analytics` | Admin | Done (4 KPIs, 7 charts, filters, CSV) |
| `/admin/products`, `/admin/users`, `/admin/settings` | Admin | Done |
| `/profile`, `/notifications` | All | Done |

## Business rules

| Rule | Where it's enforced | Tested in |
|---|---|---|
| Request must reference the customer's own purchase item | `services/returns.py:create_request` | `test_returns.py::test_cannot_return_someone_elses_item` |
| Quantity > 0 and ≤ remaining returnable quantity | schema + `create_request` | `test_quantity_*`, `test_second_request_only_gets_remaining_quantity` |
| Return window from store settings | `check_eligibility` | `test_return_outside_window_is_blocked`, `test_return_window_comes_from_store_settings` |
| Warranty uses product warranty period, separate from return policy | `check_eligibility` | `test_warranty_*`, `test_product_without_warranty` |
| Valid transitions only | `ALLOWED_TRANSITIONS` | `test_workflow.py` |
| Rejection needs a reason | `decide_request` | `test_rejection_requires_reason` |
| No duplicate decisions or fulfillment, safe under concurrency | row locks + checks | `test_cannot_decide_twice`, `test_cannot_fulfill_twice`, `test_simultaneous_decisions_only_one_wins` |
| History event in the same transaction as each status change | `change_status` | `test_full_approval_path` |
| Cancellation only before a decision | `cancel_request` | `test_cancel_only_before_decision` |
| Safe uploads (type, content, size, private storage) | `services/uploads.py` | `test_collaboration.py` |
