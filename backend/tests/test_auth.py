from fastapi.testclient import TestClient

from app.main import app
from app.models.enums import Role
from tests.conftest import PASSWORD, Api


def test_health_reports_database():
    res = TestClient(app).get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "database": "ok"}


def test_register_creates_customer_and_signs_in():
    client = TestClient(app)
    res = client.post(
        "/api/auth/register",
        json={"name": "New Person", "email": "New@Example.com", "password": "abc12345"},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["user"]["role"] == "customer"
    assert body["user"]["email"] == "new@example.com"
    assert body["csrf_token"]
    assert client.get("/api/auth/me").status_code == 200


def test_register_ignores_role_sent_by_browser():
    res = TestClient(app).post(
        "/api/auth/register",
        json={
            "name": "Sneaky",
            "email": "sneaky@example.com",
            "password": "abc12345",
            "role": "admin",
        },
    )
    assert res.status_code == 201
    assert res.json()["user"]["role"] == "customer"


def test_register_rejects_duplicate_email(customer):
    res = TestClient(app).post(
        "/api/auth/register",
        json={"name": "Copy", "email": customer.email.upper(), "password": "abc12345"},
    )
    assert res.status_code == 409


def test_register_validates_password_and_email():
    client = TestClient(app)
    weak = client.post(
        "/api/auth/register", json={"name": "Weak", "email": "w@example.com", "password": "short"}
    )
    assert weak.status_code == 422
    letters_only = client.post(
        "/api/auth/register",
        json={"name": "Weak", "email": "w@example.com", "password": "onlyletters"},
    )
    assert letters_only.status_code == 422
    bad_email = client.post(
        "/api/auth/register", json={"name": "Bad", "email": "not-an-email", "password": "abc12345"}
    )
    assert bad_email.status_code == 422


def test_login_with_wrong_password_fails(customer):
    res = TestClient(app).post(
        "/api/auth/login", json={"email": customer.email, "password": "wrong-pass1"}
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "Email or password is incorrect."


def test_login_unknown_email_gives_same_error():
    res = TestClient(app).post(
        "/api/auth/login", json={"email": "nobody@example.com", "password": PASSWORD}
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "Email or password is incorrect."


def test_session_cookie_is_http_only(customer):
    res = TestClient(app).post(
        "/api/auth/login", json={"email": customer.email, "password": PASSWORD}
    )
    cookie = res.headers["set-cookie"].lower()
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert PASSWORD.lower() not in res.text.lower()


def test_protected_route_requires_login():
    assert TestClient(app).get("/api/auth/me").status_code == 401
    assert TestClient(app).get("/api/returns").status_code == 401


def test_logout_ends_session(customer):
    api = Api(customer)
    assert api.post("/api/auth/logout").status_code == 204
    assert api.get("/api/auth/me").status_code == 401


def test_state_changing_request_needs_csrf_token(customer):
    api = Api(customer)
    res = api.client.patch("/api/auth/me", json={"name": "No Token"})
    assert res.status_code == 403
    res = api.patch("/api/auth/me", json={"name": "With Token"})
    assert res.status_code == 200
    assert res.json()["name"] == "With Token"


def test_deactivated_user_cannot_sign_in(factory):
    user = factory.user(Role.EMPLOYEE, active=False)
    res = TestClient(app).post("/api/auth/login", json={"email": user.email, "password": PASSWORD})
    assert res.status_code == 403


def test_change_password(customer):
    api = Api(customer)
    wrong = api.post(
        "/api/auth/password", json={"current_password": "nope12345", "new_password": "fresh#456"}
    )
    assert wrong.status_code == 400
    ok = api.post(
        "/api/auth/password", json={"current_password": PASSWORD, "new_password": "fresh#456"}
    )
    assert ok.status_code == 204
    relogin = TestClient(app).post(
        "/api/auth/login", json={"email": customer.email, "password": "fresh#456"}
    )
    assert relogin.status_code == 200


def test_admin_deactivation_signs_user_out(admin, employee):
    employee_api = Api(employee)
    admin_api = Api(admin)
    res = admin_api.patch(f"/api/users/{employee.id}", json={"active": False})
    assert res.status_code == 200
    assert employee_api.get("/api/auth/me").status_code == 401


def test_roles_are_distinct(customer, employee, admin):
    assert customer.role == Role.CUSTOMER
    assert Api(employee).get("/api/auth/me").json()["user"]["role"] == "employee"
    assert Api(admin).get("/api/auth/me").json()["user"]["role"] == "admin"
