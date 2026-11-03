import os
import tempfile
from datetime import UTC, datetime, timedelta
from decimal import Decimal

# Point the app at the test database before anything imports the settings.
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://returndesk:returndesk@localhost:5432/returndesk_test",
)
os.environ["UPLOAD_DIR"] = tempfile.mkdtemp(prefix="returndesk-uploads-")
os.environ["ENVIRONMENT"] = "test"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Product, Purchase, PurchaseItem, StoreSettings, User  # noqa: E402
from app.models.enums import Role  # noqa: E402

PASSWORD = "Testing#123"
_PASSWORD_HASH = hash_password(PASSWORD)


@pytest.fixture(scope="session", autouse=True)
def create_schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    engine.dispose()


@pytest.fixture(autouse=True)
def clean_tables():
    yield
    tables = ", ".join(t.name for t in Base.metadata.sorted_tables)
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()


class Api:
    """A TestClient signed in as one user, sending the CSRF header automatically."""

    def __init__(self, user: User | None = None):
        self.client = TestClient(app)
        self.user = user
        self.csrf = ""
        if user is not None:
            res = self.client.post(
                "/api/auth/login", json={"email": user.email, "password": PASSWORD}
            )
            assert res.status_code == 200, res.text
            self.csrf = res.json()["csrf_token"]

    def _headers(self, kwargs):
        headers = kwargs.pop("headers", {}) or {}
        if self.csrf:
            headers.setdefault("X-CSRF-Token", self.csrf)
        return headers

    def get(self, url, **kwargs):
        return self.client.get(url, **kwargs)

    def post(self, url, **kwargs):
        return self.client.post(url, headers=self._headers(kwargs), **kwargs)

    def patch(self, url, **kwargs):
        return self.client.patch(url, headers=self._headers(kwargs), **kwargs)


class Factory:
    def __init__(self, db):
        self.db = db
        self.counter = 0
        db.merge(StoreSettings(id=1, return_window_days=30))
        db.commit()

    def user(self, role=Role.CUSTOMER, active=True, name=None) -> User:
        self.counter += 1
        user = User(
            name=name or f"{role.value.title()} {self.counter}",
            email=f"{role.value}{self.counter}@example.com",
            password_hash=_PASSWORD_HASH,
            role=role,
            active=active,
        )
        self.db.add(user)
        self.db.commit()
        return user

    def product(self, warranty_days=365, category="Electronics", price="50.00") -> Product:
        self.counter += 1
        product = Product(
            sku=f"SKU-{self.counter}",
            name=f"Product {self.counter}",
            category=category,
            price=Decimal(price),
            warranty_days=warranty_days,
        )
        self.db.add(product)
        self.db.commit()
        return product

    def item(self, customer: User, days_ago=5, quantity=2, product=None) -> PurchaseItem:
        self.counter += 1
        product = product or self.product()
        purchase = Purchase(
            customer_id=customer.id,
            order_number=f"ORD-T{self.counter}",
            purchased_at=datetime.now(UTC) - timedelta(days=days_ago),
        )
        item = PurchaseItem(
            purchase=purchase, product=product, quantity=quantity, unit_price=product.price
        )
        self.db.add_all([purchase, item])
        self.db.commit()
        return item


@pytest.fixture
def factory(db):
    return Factory(db)


@pytest.fixture
def customer(factory):
    return factory.user(Role.CUSTOMER, name="Casey Customer")


@pytest.fixture
def employee(factory):
    return factory.user(Role.EMPLOYEE, name="Erin Employee")


@pytest.fixture
def admin(factory):
    return factory.user(Role.ADMIN, name="Alex Admin")


def return_payload(item_id, **overrides):
    payload = {
        "purchase_item_id": item_id,
        "request_type": "return",
        "quantity": 1,
        "reason": "defective",
        "description": "It stopped charging after two days.",
        "requested_resolution": "refund",
    }
    payload.update(overrides)
    return payload


@pytest.fixture
def make_request(factory):
    """Create a return request through the API and return (customer_api, request_json)."""

    def _make(customer, **overrides):
        item = factory.item(customer)
        api = Api(customer)
        res = api.post("/api/returns", json=return_payload(item.id, **overrides))
        assert res.status_code == 201, res.text
        return api, res.json()

    return _make
