from sqlalchemy import func, select

from app.models import ReturnEvent, ReturnRequest, User
from app.models.enums import RELEASED_STATUSES, RequestStatus, RequestType
from app.seed import main as seed_main
from tests.conftest import Api


def test_seed_creates_consistent_demo_data(db):
    seed_main(["--reset"])

    roles = dict(db.execute(select(User.role, func.count()).group_by(User.role)).all())
    assert roles["admin"] == 1 and roles["employee"] >= 4 and roles["customer"] >= 10

    statuses = {r.status for r in db.scalars(select(ReturnRequest))}
    assert {
        RequestStatus.PENDING_REVIEW,
        RequestStatus.UNDER_REVIEW,
        RequestStatus.CLOSED,
    } <= statuses

    # Every request has a creation event and its latest status event matches.
    for request in db.scalars(select(ReturnRequest)):
        events = [e for e in request.events if e.to_status]
        assert events[0].event_type == "created"
        assert events[-1].to_status == request.status
        if request.status == RequestStatus.CLOSED:
            assert request.closed_at >= request.created_at

    # No item is over-returned.
    for request in db.scalars(select(ReturnRequest)):
        item = request.purchase_item
        for kind in RequestType:
            claimed = sum(
                r.quantity
                for r in item.requests
                if r.request_type == kind and r.status not in RELEASED_STATUSES
            )
            assert claimed <= item.quantity

    assert db.scalar(select(func.count(ReturnEvent.id))) > 0


def test_seeded_accounts_can_sign_in(db):
    seed_main(["--reset"])
    client = Api().client
    res = client.post(
        "/api/auth/login", json={"email": "customer@example.com", "password": "Demo#2026"}
    )
    assert res.status_code == 200
    purchases = client.get("/api/purchases").json()
    assert any(item["eligibility"]["can_return"] for p in purchases for item in p["items"])
