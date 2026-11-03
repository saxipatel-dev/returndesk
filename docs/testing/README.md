# Testing guide

Results from the latest run are in [TESTING_REPORT.md](../../TESTING_REPORT.md).

## Layers

| Layer | Tool | Location | Needs |
|---|---|---|---|
| API, rules, permissions, analytics | Pytest + FastAPI TestClient | `backend/tests` | PostgreSQL database `returndesk_test` |
| Components, forms, utilities | Vitest + React Testing Library (jsdom) | `frontend/tests/unit` | nothing |
| Full user journeys (11 tests) | Playwright (Chromium) | `frontend/tests/e2e` | PostgreSQL database `returndesk_e2e`, backend venv |

Backend tests run against real PostgreSQL rather than SQLite, because the app relies on
Postgres behavior (row locks, `date_trunc`, check constraints). Tables are created once per run
and truncated after each test.

## Commands

```bash
# backend
cd backend
.venv/bin/pytest                         # all
.venv/bin/pytest tests/test_workflow.py  # one file
TEST_DATABASE_URL=postgresql+psycopg://user:pass@host/db .venv/bin/pytest

# frontend
cd frontend
npm test                                 # unit tests once
npm run test:watch                       # watch mode
npx playwright test --project=e2e        # end-to-end (starts its own servers on :8001 and :5174)
npx playwright test --project=screenshots  # regenerate docs/screenshots
npx playwright show-report               # after a failure
```

## Writing new backend tests

`tests/conftest.py` provides:

* `factory`: create users, products and purchase items (`factory.item(customer, days_ago=45)`)
* `customer`, `employee`, `admin` fixtures
* `Api(user)`: a signed-in client that adds the CSRF header automatically
* `make_request(customer, **overrides)`: submit a return through the API
