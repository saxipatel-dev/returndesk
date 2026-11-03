from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import (
    Decision,
    EventType,
    RequestStatus,
    RequestType,
    Resolution,
    ReturnReason,
    Role,
)


def str_enum(enum_cls, name: str):
    # Stored as VARCHAR + CHECK constraint, which keeps migrations simple.
    return Enum(
        enum_cls,
        name=name,
        native_enum=False,
        create_constraint=True,
        length=32,
        values_callable=lambda e: [member.value for member in e],
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(str_enum(Role, "user_role"), default=Role.CUSTOMER)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    purchases: Mapped[list["Purchase"]] = relationship(back_populates="customer")


class UserSession(TimestampMixin, Base):
    __tablename__ = "user_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # Only a hash of the cookie value is stored, so a database leak does not leak sessions.
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    csrf_token: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship()


class Product(TimestampMixin, Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("price >= 0", name="ck_products_price_positive"),
        CheckConstraint("warranty_days >= 0", name="ck_products_warranty_days"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(160))
    category: Mapped[str] = mapped_column(String(60), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    warranty_days: Mapped[int] = mapped_column(Integer, default=365)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)


class Purchase(Base):
    __tablename__ = "purchases"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    order_number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    purchased_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    customer: Mapped[User] = relationship(back_populates="purchases")
    items: Mapped[list["PurchaseItem"]] = relationship(
        back_populates="purchase", order_by="PurchaseItem.id"
    )


class PurchaseItem(Base):
    __tablename__ = "purchase_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_purchase_items_quantity"),
        CheckConstraint("unit_price >= 0", name="ck_purchase_items_unit_price"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    purchase_id: Mapped[int] = mapped_column(ForeignKey("purchases.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))

    purchase: Mapped[Purchase] = relationship(back_populates="items")
    product: Mapped[Product] = relationship()
    requests: Mapped[list["ReturnRequest"]] = relationship(back_populates="purchase_item")


class ReturnRequest(Base):
    __tablename__ = "return_requests"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_return_requests_quantity"),
        Index("ix_return_requests_status", "status"),
        Index("ix_return_requests_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    purchase_item_id: Mapped[int] = mapped_column(ForeignKey("purchase_items.id"), index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    assigned_employee_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), index=True, nullable=True
    )
    request_type: Mapped[RequestType] = mapped_column(str_enum(RequestType, "request_type"))
    quantity: Mapped[int] = mapped_column(Integer)
    reason: Mapped[ReturnReason] = mapped_column(str_enum(ReturnReason, "return_reason"))
    description: Mapped[str] = mapped_column(Text)
    requested_resolution: Mapped[Resolution] = mapped_column(str_enum(Resolution, "resolution"))
    status: Mapped[RequestStatus] = mapped_column(
        str_enum(RequestStatus, "request_status"), default=RequestStatus.PENDING_REVIEW
    )
    decision: Mapped[Decision | None] = mapped_column(str_enum(Decision, "decision"), nullable=True)
    decision_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    fulfillment_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    fulfilled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    purchase_item: Mapped[PurchaseItem] = relationship(back_populates="requests")
    customer: Mapped[User] = relationship(foreign_keys=[customer_id])
    assigned_employee: Mapped[User | None] = relationship(foreign_keys=[assigned_employee_id])
    events: Mapped[list["ReturnEvent"]] = relationship(
        back_populates="request", order_by="ReturnEvent.id"
    )

    @property
    def reference(self) -> str:
        return f"RD-{self.id:05d}"


class ReturnEvent(TimestampMixin, Base):
    __tablename__ = "return_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("return_requests.id"), index=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    event_type: Mapped[EventType] = mapped_column(str_enum(EventType, "event_type"))
    from_status: Mapped[RequestStatus | None] = mapped_column(
        str_enum(RequestStatus, "event_from_status"), nullable=True
    )
    to_status: Mapped[RequestStatus | None] = mapped_column(
        str_enum(RequestStatus, "event_to_status"), nullable=True
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    request: Mapped[ReturnRequest] = relationship(back_populates="events")
    actor: Mapped[User] = relationship()


class Comment(TimestampMixin, Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("return_requests.id"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    # Internal notes are only visible to employees and admins.
    is_internal: Mapped[bool] = mapped_column(Boolean, default=False)

    author: Mapped[User] = relationship()


class Attachment(TimestampMixin, Base):
    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("return_requests.id"), index=True)
    uploader_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    original_filename: Mapped[str] = mapped_column(String(255))
    storage_key: Mapped[str] = mapped_column(String(255), unique=True)
    mime_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)

    uploader: Mapped[User] = relationship()


class Notification(TimestampMixin, Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    recipient_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    request_id: Mapped[int | None] = mapped_column(ForeignKey("return_requests.id"), nullable=True)
    message: Mapped[str] = mapped_column(String(500))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class StoreSettings(Base):
    """Single-row table holding the configurable return policy."""

    __tablename__ = "store_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    store_name: Mapped[str] = mapped_column(String(120), default="ReturnDesk Demo Store")
    support_email: Mapped[str] = mapped_column(String(255), default="support@example.com")
    return_window_days: Mapped[int] = mapped_column(Integer, default=30)
    allow_customer_cancellation: Mapped[bool] = mapped_column(Boolean, default=True)
    max_attachments_per_request: Mapped[int] = mapped_column(Integer, default=5)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
