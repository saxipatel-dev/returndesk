"""Return eligibility rules and customer-facing access control."""

from app.models.enums import Role
from tests.conftest import Api, return_payload


def test_customer_creates_valid_return(factory, customer):
    item = factory.item(customer, quantity=3)
    res = Api(customer).post("/api/returns", json=return_payload(item.id, quantity=2))
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "pending_review"
    assert body["reference"] == f"RD-{body['id']:05d}"
    assert body["quantity"] == 2
    assert "cancel" in body["allowed_actions"]


def test_creation_writes_history_event_and_notification(make_request, customer):
    api, request = make_request(customer)
    events = api.get(f"/api/returns/{request['id']}/events").json()
    assert [e["event_type"] for e in events] == ["created"]
    assert events[0]["to_status"] == "pending_review"
    notes = api.get("/api/notifications").json()
    assert notes["unread_count"] == 1
    assert request["reference"] in notes["items"][0]["message"]


def test_quantity_cannot_exceed_purchased(factory, customer):
    item = factory.item(customer, quantity=2)
    res = Api(customer).post("/api/returns", json=return_payload(item.id, quantity=3))
    assert res.status_code == 400
    assert "at most 2" in res.json()["detail"]


def test_quantity_must_be_positive(factory, customer):
    item = factory.item(customer)
    res = Api(customer).post("/api/returns", json=return_payload(item.id, quantity=0))
    assert res.status_code == 422


def test_second_request_only_gets_remaining_quantity(factory, customer):
    item = factory.item(customer, quantity=2)
    api = Api(customer)
    assert api.post("/api/returns", json=return_payload(item.id, quantity=1)).status_code == 201
    too_many = api.post("/api/returns", json=return_payload(item.id, quantity=2))
    assert too_many.status_code == 400
    assert "at most 1" in too_many.json()["detail"]
    assert api.post("/api/returns", json=return_payload(item.id, quantity=1)).status_code == 201
    none_left = api.post("/api/returns", json=return_payload(item.id, quantity=1))
    assert none_left.status_code == 400


def test_cancelled_request_releases_quantity(factory, customer):
    item = factory.item(customer, quantity=1)
    api = Api(customer)
    first = api.post("/api/returns", json=return_payload(item.id)).json()
    assert api.post("/api/returns", json=return_payload(item.id)).status_code == 400
    assert api.post(f"/api/returns/{first['id']}/cancel", json={}).status_code == 200
    assert api.post("/api/returns", json=return_payload(item.id)).status_code == 201


def test_return_outside_window_is_blocked(factory, customer):
    item = factory.item(customer, days_ago=45)
    res = Api(customer).post("/api/returns", json=return_payload(item.id))
    assert res.status_code == 400
    assert "return window" in res.json()["detail"]


def test_return_window_comes_from_store_settings(factory, customer, admin):
    item = factory.item(customer, days_ago=45)
    Api(admin).patch("/api/settings", json={"return_window_days": 60})
    res = Api(customer).post("/api/returns", json=return_payload(item.id))
    assert res.status_code == 201


def test_cannot_return_someone_elses_item(factory, customer):
    other = factory.user(Role.CUSTOMER)
    item = factory.item(other)
    res = Api(customer).post("/api/returns", json=return_payload(item.id))
    assert res.status_code == 404


def test_staff_cannot_submit_returns(factory, employee):
    item = factory.item(employee)
    res = Api(employee).post("/api/returns", json=return_payload(item.id))
    assert res.status_code == 403


def test_resolution_must_match_request_type(factory, customer):
    item = factory.item(customer)
    res = Api(customer).post(
        "/api/returns", json=return_payload(item.id, requested_resolution="repair")
    )
    assert res.status_code == 422


def test_warranty_claim_within_warranty_period(factory, customer):
    product = factory.product(warranty_days=365)
    item = factory.item(customer, days_ago=200, product=product)
    api = Api(customer)
    # The return window has passed, but the warranty still applies.
    assert api.post("/api/returns", json=return_payload(item.id)).status_code == 400
    res = api.post(
        "/api/returns",
        json=return_payload(
            item.id,
            request_type="warranty",
            reason="stopped_working",
            requested_resolution="repair",
        ),
    )
    assert res.status_code == 201
    assert res.json()["request_type"] == "warranty"


def test_warranty_claim_after_expiry_is_blocked(factory, customer):
    product = factory.product(warranty_days=90)
    item = factory.item(customer, days_ago=120, product=product)
    res = Api(customer).post(
        "/api/returns",
        json=return_payload(item.id, request_type="warranty", requested_resolution="repair"),
    )
    assert res.status_code == 400
    assert "warranty period has ended" in res.json()["detail"]


def test_product_without_warranty(factory, customer):
    product = factory.product(warranty_days=0)
    item = factory.item(customer, product=product)
    res = Api(customer).post(
        "/api/returns",
        json=return_payload(item.id, request_type="warranty", requested_resolution="repair"),
    )
    assert res.status_code == 400
    assert "no warranty" in res.json()["detail"]


def test_purchases_show_eligibility(factory, customer):
    item = factory.item(customer, quantity=2)
    api = Api(customer)
    api.post("/api/returns", json=return_payload(item.id, quantity=1))
    purchases = api.get("/api/purchases").json()
    eligibility = purchases[0]["items"][0]["eligibility"]
    assert eligibility["returnable_quantity"] == 1
    assert eligibility["can_return"] is True


def test_purchases_are_private(factory, customer):
    other = factory.user(Role.CUSTOMER)
    item = factory.item(other)
    api = Api(customer)
    assert api.get("/api/purchases").json() == []
    assert api.get(f"/api/purchases/{item.purchase_id}").status_code == 404


def test_customer_cannot_read_another_customers_request(factory, make_request, customer):
    _, request = make_request(customer)
    intruder = Api(factory.user(Role.CUSTOMER))
    rid = request["id"]
    assert intruder.get(f"/api/returns/{rid}").status_code == 404
    assert intruder.get(f"/api/returns/{rid}/events").status_code == 404
    assert intruder.get(f"/api/returns/{rid}/comments").status_code == 404
    assert intruder.post(f"/api/returns/{rid}/comments", json={"body": "hi"}).status_code == 404
    assert intruder.post(f"/api/returns/{rid}/cancel", json={}).status_code == 404
    assert intruder.get("/api/returns").json()["total"] == 0


def test_customer_list_only_shows_own_requests(factory, make_request, customer):
    make_request(customer)
    make_request(factory.user(Role.CUSTOMER))
    res = Api(customer).get("/api/returns").json()
    assert res["total"] == 1


def test_staff_can_search_and_filter(factory, make_request, customer, employee):
    _, request = make_request(customer)
    make_request(
        factory.user(Role.CUSTOMER), reason="size_or_fit", requested_resolution="replacement"
    )
    api = Api(employee)
    assert api.get("/api/returns").json()["total"] == 2
    by_ref = api.get("/api/returns", params={"q": request["reference"]}).json()
    assert [r["id"] for r in by_ref["items"]] == [request["id"]]
    by_customer = api.get("/api/returns", params={"q": "Casey"}).json()
    assert by_customer["total"] == 1
    assert api.get("/api/returns", params={"assigned": "unassigned"}).json()["total"] == 2
    assert api.get("/api/returns", params={"status": "approved"}).json()["total"] == 0
    assert api.get("/api/returns", params={"sort": "nonsense"}).status_code == 422


def test_pagination(factory, customer):
    api = Api(customer)
    for _ in range(3):
        item = factory.item(customer)
        api.post("/api/returns", json=return_payload(item.id))
    page = api.get("/api/returns", params={"page_size": 2, "page": 2}).json()
    assert page["total"] == 3
    assert len(page["items"]) == 1
