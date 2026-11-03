from datetime import UTC, datetime, timedelta

from app.models import ReturnRequest
from app.models.enums import Role
from tests.conftest import Api


def build_history(make_request, customer, employee, db):
    """Three requests: one approved+closed, one rejected, one still pending."""
    staff = Api(employee)
    ids = []
    for _ in range(3):
        _, request = make_request(customer)
        ids.append(request["id"])

    approved, rejected, _pending = ids
    for rid in (approved, rejected):
        staff.post(f"/api/returns/{rid}/assign", json={"employee_id": employee.id})
    staff.post(f"/api/returns/{approved}/decision", json={"decision": "approved"})
    staff.post(f"/api/returns/{approved}/fulfill", json={})
    staff.post(f"/api/returns/{approved}/close", json={})
    staff.post(f"/api/returns/{rejected}/decision", json={"decision": "rejected", "reason": "Worn"})

    # Pretend the closed request was opened four days before it was closed.
    closed = db.get(ReturnRequest, approved)
    closed.created_at = closed.closed_at - timedelta(days=4)
    db.commit()
    return ids


def test_summary_counts(make_request, customer, employee, admin, db):
    build_history(make_request, customer, employee, db)
    summary = Api(admin).get("/api/analytics/summary").json()
    assert summary["total_requests"] == 3
    assert summary["pending_review"] == 1
    assert summary["approved_decisions"] == 1
    assert summary["rejected_decisions"] == 1
    assert summary["approval_rate"] == 50.0
    assert summary["avg_resolution_days"] == 4.0
    assert summary["unassigned_open"] == 1


def test_summary_with_no_data_uses_null_not_zero_percent(admin):
    summary = Api(admin).get("/api/analytics/summary").json()
    assert summary["total_requests"] == 0
    assert summary["approval_rate"] is None
    assert summary["avg_resolution_days"] is None


def test_trends_match_database(make_request, customer, employee, admin, db):
    build_history(make_request, customer, employee, db)
    trends = Api(admin).get("/api/analytics/trends").json()

    assert sum(m["count"] for m in trends["monthly_requests"]) == 3
    assert trends["by_category"] == [{"category": "Electronics", "count": 3}]
    statuses = {s["status"]: s["count"] for s in trends["by_status"]}
    assert statuses == {"pending_review": 1, "rejected": 1, "closed": 1}
    assert trends["by_reason"] == [{"reason": "defective", "count": 3}]
    assert sum(d["approved"] for d in trends["decisions"]) == 1
    assert sum(d["rejected"] for d in trends["decisions"]) == 1
    resolved = [r for r in trends["resolution_time"] if r["closed_count"]]
    assert resolved[0]["avg_days"] == 4.0
    workload = {w["name"]: w["open_requests"] for w in trends["workload"]}
    assert workload == {employee.name: 0}


def test_trends_empty_dataset(admin):
    trends = Api(admin).get("/api/analytics/trends").json()
    assert trends["monthly_requests"] == []
    assert trends["by_status"] == []


def test_date_window_fills_empty_months(admin):
    trends = (
        Api(admin)
        .get("/api/analytics/trends", params={"date_from": "2026-01-01", "date_to": "2026-03-31"})
        .json()
    )
    assert [m["month"] for m in trends["monthly_requests"]] == ["2026-01", "2026-02", "2026-03"]
    assert all(m["count"] == 0 for m in trends["monthly_requests"])


def test_status_filter(make_request, customer, employee, admin, db):
    build_history(make_request, customer, employee, db)
    api = Api(admin)
    summary = api.get("/api/analytics/summary", params={"status": "pending_review"}).json()
    assert summary["total_requests"] == 1
    assert summary["approval_rate"] is None


def test_date_filter(make_request, customer, employee, admin, db):
    ids = build_history(make_request, customer, employee, db)
    old = db.get(ReturnRequest, ids[2])
    old.created_at = datetime(2025, 6, 15, tzinfo=UTC)
    db.commit()
    today = datetime.now(UTC).date()  # filters use UTC calendar days
    api = Api(admin)
    recent = api.get(
        "/api/analytics/summary",
        params={
            "date_from": (today - timedelta(days=30)).isoformat(),
            "date_to": today.isoformat(),
        },
    ).json()
    assert recent["total_requests"] == 2
    june = api.get(
        "/api/analytics/summary", params={"date_from": "2025-06-01", "date_to": "2025-06-30"}
    ).json()
    assert june["total_requests"] == 1


def test_invalid_date_range(admin):
    res = Api(admin).get(
        "/api/analytics/summary", params={"date_from": "2026-05-01", "date_to": "2026-04-01"}
    )
    assert res.status_code == 422


def test_analytics_permissions(factory, customer, employee, admin):
    assert Api(customer).get("/api/analytics/summary").status_code == 403
    assert Api(customer).get("/api/analytics/trends").status_code == 403
    assert Api(employee).get("/api/analytics/summary").status_code == 200
    # The CSV report is admin only.
    assert Api(employee).get("/api/analytics/export.csv").status_code == 403


def test_csv_export(make_request, customer, employee, admin, db):
    build_history(make_request, customer, employee, db)
    res = Api(admin).get("/api/analytics/export.csv")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    lines = res.text.strip().splitlines()
    assert lines[0].startswith("reference,type,status")
    assert len(lines) == 4
    assert "4.0" in res.text


def test_workload_counts_open_assigned_requests(factory, make_request, customer, admin):
    worker = factory.user(Role.EMPLOYEE, name="Busy Bee")
    api = Api(admin)
    for _ in range(2):
        _, request = make_request(customer)
        api.post(f"/api/returns/{request['id']}/assign", json={"employee_id": worker.id})
    trends = api.get("/api/analytics/trends").json()
    assert {
        "employee_id": worker.id,
        "name": "Busy Bee",
        "role": "employee",
        "open_requests": 2,
    } in trends["workload"]
