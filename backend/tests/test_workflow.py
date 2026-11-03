"""Employee review workflow and status transitions."""

from sqlalchemy import select

from app.models import ReturnEvent
from app.models.enums import Role
from tests.conftest import Api


def assign(api, request_id, employee_id):
    return api.post(f"/api/returns/{request_id}/assign", json={"employee_id": employee_id})


def test_full_approval_path(make_request, customer, employee, db):
    customer_api, request = make_request(customer)
    rid = request["id"]
    staff = Api(employee)

    res = assign(staff, rid, employee.id)
    assert res.status_code == 200
    assert res.json()["status"] == "under_review"
    assert "decide" in res.json()["allowed_actions"]

    res = staff.post(f"/api/returns/{rid}/decision", json={"decision": "approved"})
    assert res.status_code == 200
    assert res.json()["status"] == "approved"

    res = staff.post(f"/api/returns/{rid}/fulfill", json={"note": "Refund of $50.00 simulated."})
    assert res.json()["status"] == "fulfilled"
    assert res.json()["fulfillment_note"] == "Refund of $50.00 simulated."

    res = staff.post(f"/api/returns/{rid}/close", json={})
    assert res.json()["status"] == "closed"
    assert res.json()["closed_at"] is not None

    statuses = [
        (e["from_status"], e["to_status"])
        for e in customer_api.get(f"/api/returns/{rid}/events").json()
        if e["to_status"]
    ]
    assert statuses == [
        (None, "pending_review"),
        ("pending_review", "under_review"),
        ("under_review", "approved"),
        ("approved", "fulfilled"),
        ("fulfilled", "closed"),
    ]
    # Customer sees the final state and was notified at every step.
    assert customer_api.get(f"/api/returns/{rid}").json()["status"] == "closed"
    assert customer_api.get("/api/notifications").json()["unread_count"] == 5


def test_rejection_requires_reason(make_request, customer, employee):
    _, request = make_request(customer)
    staff = Api(employee)
    assign(staff, request["id"], employee.id)
    url = f"/api/returns/{request['id']}/decision"
    assert staff.post(url, json={"decision": "rejected"}).status_code == 422
    assert staff.post(url, json={"decision": "rejected", "reason": "   "}).status_code == 422
    res = staff.post(url, json={"decision": "rejected", "reason": "Item shows heavy use."})
    assert res.status_code == 200
    assert res.json()["status"] == "rejected"
    assert res.json()["decision_reason"] == "Item shows heavy use."


def test_rejected_request_cannot_be_fulfilled(make_request, customer, employee):
    _, request = make_request(customer)
    staff = Api(employee)
    assign(staff, request["id"], employee.id)
    staff.post(
        f"/api/returns/{request['id']}/decision", json={"decision": "rejected", "reason": "No."}
    )
    assert staff.post(f"/api/returns/{request['id']}/fulfill", json={}).status_code == 409
    assert staff.post(f"/api/returns/{request['id']}/close", json={}).status_code == 200


def test_decision_requires_review_first(make_request, customer, admin):
    _, request = make_request(customer)
    res = Api(admin).post(f"/api/returns/{request['id']}/decision", json={"decision": "approved"})
    assert res.status_code == 409


def test_cannot_decide_twice(make_request, customer, employee):
    _, request = make_request(customer)
    staff = Api(employee)
    assign(staff, request["id"], employee.id)
    url = f"/api/returns/{request['id']}/decision"
    assert staff.post(url, json={"decision": "approved"}).status_code == 200
    second = staff.post(url, json={"decision": "rejected", "reason": "Changed my mind"})
    assert second.status_code == 409


def test_cannot_fulfill_twice(make_request, customer, employee, db):
    _, request = make_request(customer)
    rid = request["id"]
    staff = Api(employee)
    assign(staff, rid, employee.id)
    staff.post(f"/api/returns/{rid}/decision", json={"decision": "approved"})
    assert staff.post(f"/api/returns/{rid}/fulfill", json={}).status_code == 200
    assert staff.post(f"/api/returns/{rid}/fulfill", json={}).status_code == 409
    fulfilled = db.scalars(
        select(ReturnEvent).where(
            ReturnEvent.request_id == rid, ReturnEvent.event_type == "fulfilled"
        )
    ).all()
    assert len(fulfilled) == 1


def test_cannot_fulfill_pending_request(make_request, customer, admin):
    _, request = make_request(customer)
    assert Api(admin).post(f"/api/returns/{request['id']}/fulfill", json={}).status_code == 409


def test_only_assigned_employee_can_decide(factory, make_request, customer, employee):
    _, request = make_request(customer)
    other = factory.user(Role.EMPLOYEE)
    assign(Api(employee), request["id"], employee.id)
    res = Api(other).post(f"/api/returns/{request['id']}/decision", json={"decision": "approved"})
    assert res.status_code == 403


def test_employee_can_only_assign_to_self(factory, make_request, customer, employee):
    _, request = make_request(customer)
    other = factory.user(Role.EMPLOYEE)
    assert assign(Api(employee), request["id"], other.id).status_code == 403


def test_admin_can_assign_anyone_and_employee_gets_notified(
    make_request, customer, employee, admin
):
    _, request = make_request(customer)
    res = assign(Api(admin), request["id"], employee.id)
    assert res.status_code == 200
    assert res.json()["assigned_employee"]["id"] == employee.id
    notes = Api(employee).get("/api/notifications").json()
    assert any("assigned to you" in n["message"] for n in notes["items"])


def test_cannot_assign_to_customer_or_inactive_staff(factory, make_request, customer, admin):
    _, request = make_request(customer)
    inactive = factory.user(Role.EMPLOYEE, active=False)
    assert assign(Api(admin), request["id"], customer.id).status_code == 400
    assert assign(Api(admin), request["id"], inactive.id).status_code == 400


def test_unassign_returns_request_to_queue(make_request, customer, employee):
    _, request = make_request(customer)
    staff = Api(employee)
    assign(staff, request["id"], employee.id)
    res = assign(staff, request["id"], None)
    assert res.json()["status"] == "pending_review"
    assert res.json()["assigned_employee"] is None


def test_customer_cannot_use_staff_endpoints(make_request, customer):
    api, request = make_request(customer)
    rid = request["id"]
    assert (
        api.post(f"/api/returns/{rid}/assign", json={"employee_id": customer.id}).status_code == 403
    )
    assert (
        api.post(f"/api/returns/{rid}/decision", json={"decision": "approved"}).status_code == 403
    )
    assert api.post(f"/api/returns/{rid}/fulfill", json={}).status_code == 403
    assert api.post(f"/api/returns/{rid}/close", json={}).status_code == 403


def test_cancel_only_before_decision(make_request, customer, employee):
    api, request = make_request(customer)
    staff = Api(employee)
    assign(staff, request["id"], employee.id)
    staff.post(f"/api/returns/{request['id']}/decision", json={"decision": "approved"})
    assert api.post(f"/api/returns/{request['id']}/cancel", json={}).status_code == 409


def test_cancel_can_be_turned_off(make_request, customer, admin):
    api, request = make_request(customer)
    Api(admin).patch("/api/settings", json={"allow_customer_cancellation": False})
    assert "cancel" not in api.get(f"/api/returns/{request['id']}").json()["allowed_actions"]
    assert api.post(f"/api/returns/{request['id']}/cancel", json={}).status_code == 403


def test_closed_request_cannot_be_reassigned(make_request, customer, employee):
    api, request = make_request(customer)
    api.post(f"/api/returns/{request['id']}/cancel", json={})
    assert assign(Api(employee), request["id"], employee.id).status_code == 409


def test_staff_list_includes_workload(make_request, customer, employee, admin):
    _, request = make_request(customer)
    assign(Api(admin), request["id"], employee.id)
    staff = Api(employee).get("/api/staff").json()
    mine = next(s for s in staff if s["id"] == employee.id)
    assert mine["open_requests"] == 1


def test_simultaneous_decisions_only_one_wins(make_request, customer, employee, admin):
    """Two reviewers clicking at once: the row lock lets exactly one decision through."""
    from concurrent.futures import ThreadPoolExecutor

    _, request = make_request(customer)
    rid = request["id"]
    staff, boss = Api(employee), Api(admin)
    assign(staff, rid, employee.id)

    def decide(args):
        api, body = args
        return api.post(f"/api/returns/{rid}/decision", json=body).status_code

    jobs = [
        (staff, {"decision": "approved"}),
        (boss, {"decision": "rejected", "reason": "Outside policy"}),
    ]
    with ThreadPoolExecutor(max_workers=2) as pool:
        codes = sorted(pool.map(decide, jobs))
    assert codes == [200, 409]
    decisions = [
        e for e in staff.get(f"/api/returns/{rid}/events").json() if e["event_type"] == "decision"
    ]
    assert len(decisions) == 1
