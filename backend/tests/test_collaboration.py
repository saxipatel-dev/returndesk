"""Comments, attachments, notifications, products, users and settings."""

from app.models.enums import Role
from tests.conftest import Api

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
PDF = b"%PDF-1.4\n%fake but valid header\n"


def upload(api, request_id, name, content, mime="application/octet-stream"):
    return api.post(f"/api/returns/{request_id}/attachments", files={"file": (name, content, mime)})


def test_internal_comments_hidden_from_customer(make_request, customer, employee):
    api, request = make_request(customer)
    rid = request["id"]
    staff = Api(employee)
    staff.post(f"/api/returns/{rid}/comments", json={"body": "Can you send a photo?"})
    staff.post(f"/api/returns/{rid}/comments", json={"body": "Looks legit", "is_internal": True})

    customer_view = api.get(f"/api/returns/{rid}/comments").json()
    assert [c["body"] for c in customer_view] == ["Can you send a photo?"]
    staff_view = staff.get(f"/api/returns/{rid}/comments").json()
    assert len(staff_view) == 2


def test_customer_cannot_post_internal_comment(make_request, customer):
    api, request = make_request(customer)
    res = api.post(
        f"/api/returns/{request['id']}/comments", json={"body": "hi", "is_internal": True}
    )
    assert res.status_code == 201
    assert res.json()["is_internal"] is False


def test_staff_reply_notifies_customer(make_request, customer, employee):
    api, request = make_request(customer)
    api.post("/api/notifications/read-all")
    Api(employee).post(f"/api/returns/{request['id']}/comments", json={"body": "On it."})
    notes = api.get("/api/notifications").json()
    assert notes["unread_count"] == 1
    assert "New message from support" in notes["items"][0]["message"]


def test_empty_comment_rejected(make_request, customer):
    api, request = make_request(customer)
    assert (
        api.post(f"/api/returns/{request['id']}/comments", json={"body": "   "}).status_code == 422
    )


def test_upload_and_download_attachment(make_request, customer, employee):
    api, request = make_request(customer)
    res = upload(api, request["id"], "receipt.png", PNG, "image/png")
    assert res.status_code == 201
    attachment = res.json()
    assert attachment["mime_type"] == "image/png"
    assert attachment["size_bytes"] == len(PNG)

    download = api.get(f"/api/attachments/{attachment['id']}")
    assert download.status_code == 200
    assert download.content == PNG
    assert download.headers["x-content-type-options"] == "nosniff"
    assert Api(employee).get(f"/api/attachments/{attachment['id']}").status_code == 200

    events = api.get(f"/api/returns/{request['id']}/events").json()
    assert events[-1]["event_type"] == "attachment_added"


def test_other_customer_cannot_download_attachment(factory, make_request, customer):
    api, request = make_request(customer)
    attachment = upload(api, request["id"], "receipt.pdf", PDF).json()
    intruder = Api(factory.user(Role.CUSTOMER))
    assert intruder.get(f"/api/attachments/{attachment['id']}").status_code == 404
    assert upload(intruder, request["id"], "x.pdf", PDF).status_code == 404


def test_upload_rejects_disallowed_extension(make_request, customer):
    api, request = make_request(customer)
    res = upload(api, request["id"], "script.html", b"<script>alert(1)</script>", "text/html")
    assert res.status_code == 400


def test_upload_rejects_content_mismatch(make_request, customer):
    api, request = make_request(customer)
    res = upload(api, request["id"], "photo.png", b"MZ\x90\x00 definitely not a png", "image/png")
    assert res.status_code == 400
    assert "doesn't match" in res.json()["detail"]


def test_upload_size_limit(make_request, customer):
    api, request = make_request(customer)
    big = b"%PDF-" + b"0" * (5 * 1024 * 1024)
    assert upload(api, request["id"], "big.pdf", big).status_code == 413


def test_attachment_count_limit(make_request, customer, admin):
    api, request = make_request(customer)
    Api(admin).patch("/api/settings", json={"max_attachments_per_request": 1})
    assert upload(api, request["id"], "a.pdf", PDF).status_code == 201
    assert upload(api, request["id"], "b.pdf", PDF).status_code == 409


def test_notifications_mark_read(make_request, customer):
    api, _ = make_request(customer)
    notes = api.get("/api/notifications").json()
    nid = notes["items"][0]["id"]
    assert api.patch(f"/api/notifications/{nid}", json={"read": True}).json()["read_at"]
    assert api.get("/api/notifications").json()["unread_count"] == 0


def test_cannot_touch_other_users_notifications(factory, make_request, customer):
    api, _ = make_request(customer)
    nid = api.get("/api/notifications").json()["items"][0]["id"]
    intruder = Api(factory.user(Role.CUSTOMER))
    assert intruder.patch(f"/api/notifications/{nid}", json={"read": True}).status_code == 404


def test_product_management_is_admin_only(customer, employee, admin):
    payload = {"sku": "new-1", "name": "Desk Fan", "category": "Home", "price": "25.00"}
    assert Api(customer).post("/api/products", json=payload).status_code == 403
    assert Api(employee).post("/api/products", json=payload).status_code == 403

    api = Api(admin)
    res = api.post("/api/products", json=payload)
    assert res.status_code == 201
    product = res.json()
    assert product["sku"] == "NEW-1"
    assert api.post("/api/products", json=payload).status_code == 409

    assert (
        Api(employee).patch(f"/api/products/{product['id']}", json={"archived": True}).status_code
        == 403
    )
    assert api.patch(f"/api/products/{product['id']}", json={"archived": True}).json()["archived"]
    assert Api(customer).get("/api/products").json() == []
    assert len(api.get("/api/products", params={"include_archived": True}).json()) == 1


def test_product_validation(admin):
    api = Api(admin)
    bad_price = {"sku": "X-1", "name": "Thing", "category": "Misc", "price": "-1"}
    assert api.post("/api/products", json=bad_price).status_code == 422
    bad_sku = {"sku": "has space", "name": "Thing", "category": "Misc", "price": "1"}
    assert api.post("/api/products", json=bad_sku).status_code == 422


def test_admin_creates_staff_account(customer, admin):
    payload = {"name": "New Hire", "email": "hire@example.com", "password": "welcome#1"}
    assert Api(customer).post("/api/users", json=payload).status_code == 403
    res = Api(admin).post("/api/users", json=payload)
    assert res.status_code == 201
    assert res.json()["role"] == "employee"
    as_customer = Api(admin).post(
        "/api/users", json={**payload, "email": "x@example.com", "role": "customer"}
    )
    assert as_customer.status_code == 422


def test_admin_cannot_deactivate_self(admin):
    assert Api(admin).patch(f"/api/users/{admin.id}", json={"active": False}).status_code == 400


def test_customer_cannot_become_staff(customer, admin):
    res = Api(admin).patch(f"/api/users/{customer.id}", json={"role": "employee"})
    assert res.status_code == 400


def test_user_list_is_admin_only(customer, employee, admin):
    assert Api(employee).get("/api/users").status_code == 403
    users = Api(admin).get("/api/users", params={"role": "customer"}).json()
    assert users["total"] == 1


def test_settings(customer, admin):
    assert Api(customer).get("/api/settings").json()["return_window_days"] == 30
    assert Api(customer).patch("/api/settings", json={"return_window_days": 10}).status_code == 403
    res = Api(admin).patch(
        "/api/settings", json={"return_window_days": 45, "store_name": "Test Shop"}
    )
    assert res.json()["return_window_days"] == 45
    assert Api(admin).patch("/api/settings", json={"return_window_days": 0}).status_code == 422
