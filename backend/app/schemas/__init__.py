from datetime import datetime
from decimal import Decimal
from typing import Annotated, Generic, TypeVar

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
)

from app.models.enums import (
    Decision,
    EventType,
    RequestStatus,
    RequestType,
    Resolution,
    ReturnReason,
    Role,
)

T = TypeVar("T")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


def _strip(value):
    return value.strip() if isinstance(value, str) else value


def _check_password_strength(password: str) -> str:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters.")
    if password.isalpha() or password.isdigit():
        raise ValueError("Password must mix letters with numbers or symbols.")
    return password


Trimmed = BeforeValidator(_strip)
NewPassword = Annotated[str, Field(max_length=128), AfterValidator(_check_password_strength)]


# --- Users & auth ---------------------------------------------------------


class RegisterIn(BaseModel):
    name: Annotated[str, Trimmed] = Field(min_length=2, max_length=120)
    email: EmailStr
    password: NewPassword


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class UserOut(ORMModel):
    id: int
    name: str
    email: str
    role: Role
    active: bool
    created_at: datetime


class SessionOut(BaseModel):
    user: UserOut
    csrf_token: str


class ProfileUpdate(BaseModel):
    name: Annotated[str, Trimmed] = Field(min_length=2, max_length=120)


class PasswordChange(BaseModel):
    current_password: str = Field(max_length=128)
    new_password: NewPassword


class StaffCreate(BaseModel):
    name: Annotated[str, Trimmed] = Field(min_length=2, max_length=120)
    email: EmailStr
    password: NewPassword
    role: Role = Role.EMPLOYEE

    @field_validator("role")
    @classmethod
    def staff_role_only(cls, role: Role) -> Role:
        if role == Role.CUSTOMER:
            raise ValueError("Use public registration for customer accounts.")
        return role


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    active: bool | None = None
    role: Role | None = None


class EmployeeWorkload(BaseModel):
    id: int
    name: str
    email: str
    role: Role
    active: bool
    open_requests: int


# --- Products & purchases ------------------------------------------------


class ProductIn(BaseModel):
    sku: Annotated[str, Trimmed] = Field(min_length=2, max_length=40, pattern=r"^[A-Za-z0-9-]+$")
    name: Annotated[str, Trimmed] = Field(min_length=2, max_length=160)
    category: Annotated[str, Trimmed] = Field(min_length=2, max_length=60)
    description: str = Field(default="", max_length=2000)
    price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    warranty_days: int = Field(default=365, ge=0, le=3650)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    category: str | None = Field(default=None, min_length=2, max_length=60)
    description: str | None = Field(default=None, max_length=2000)
    price: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    warranty_days: int | None = Field(default=None, ge=0, le=3650)
    archived: bool | None = None


class ProductOut(ORMModel):
    id: int
    sku: str
    name: str
    category: str
    description: str
    price: Decimal
    warranty_days: int
    archived: bool


class ProductBrief(ORMModel):
    id: int
    sku: str
    name: str
    category: str


class Eligibility(BaseModel):
    returnable_quantity: int
    return_window_ends: datetime
    can_return: bool
    return_blocked_reason: str | None
    warranty_claimable_quantity: int
    warranty_ends: datetime
    can_claim_warranty: bool
    warranty_blocked_reason: str | None


class PurchaseItemOut(BaseModel):
    id: int
    product: ProductBrief
    quantity: int
    unit_price: Decimal
    eligibility: Eligibility


class PurchaseOut(BaseModel):
    id: int
    order_number: str
    purchased_at: datetime
    total: Decimal
    items: list[PurchaseItemOut]


# --- Return requests ------------------------------------------------------


class ReturnCreate(BaseModel):
    purchase_item_id: int
    request_type: RequestType = RequestType.RETURN
    quantity: int = Field(gt=0, le=1000)
    reason: ReturnReason
    description: Annotated[str, Trimmed] = Field(min_length=10, max_length=2000)
    requested_resolution: Resolution


class UserBrief(ORMModel):
    id: int
    name: str
    email: str
    role: Role


class ReturnSummary(BaseModel):
    id: int
    reference: str
    request_type: RequestType
    status: RequestStatus
    quantity: int
    reason: ReturnReason
    requested_resolution: Resolution
    product: ProductBrief
    order_number: str
    customer: UserBrief
    assigned_employee: UserBrief | None
    created_at: datetime
    updated_at: datetime


class ReturnDetail(ReturnSummary):
    description: str
    decision: Decision | None
    decision_reason: str | None
    fulfillment_note: str | None
    unit_price: Decimal
    purchased_quantity: int
    purchased_at: datetime
    decided_at: datetime | None
    fulfilled_at: datetime | None
    closed_at: datetime | None
    allowed_actions: list[str]


class AssignIn(BaseModel):
    employee_id: int | None = None


class DecisionIn(BaseModel):
    decision: Decision
    reason: str | None = Field(default=None, max_length=2000)


class NoteIn(BaseModel):
    note: str | None = Field(default=None, max_length=2000)


class EventOut(ORMModel):
    id: int
    event_type: EventType
    from_status: RequestStatus | None
    to_status: RequestStatus | None
    note: str | None
    actor: UserBrief
    created_at: datetime


class CommentIn(BaseModel):
    body: Annotated[str, Trimmed] = Field(min_length=1, max_length=2000)
    is_internal: bool = False


class CommentOut(ORMModel):
    id: int
    body: str
    is_internal: bool
    author: UserBrief
    created_at: datetime


class AttachmentOut(ORMModel):
    id: int
    original_filename: str
    mime_type: str
    size_bytes: int
    uploader: UserBrief
    created_at: datetime


# --- Notifications & settings -------------------------------------------


class NotificationOut(ORMModel):
    id: int
    message: str
    request_id: int | None
    read_at: datetime | None
    created_at: datetime


class NotificationList(BaseModel):
    items: list[NotificationOut]
    unread_count: int


class NotificationUpdate(BaseModel):
    read: bool = True


class StoreSettingsOut(ORMModel):
    store_name: str
    support_email: str
    return_window_days: int
    allow_customer_cancellation: bool
    max_attachments_per_request: int
    updated_at: datetime


class StoreSettingsUpdate(BaseModel):
    store_name: str | None = Field(default=None, min_length=2, max_length=120)
    support_email: EmailStr | None = None
    return_window_days: int | None = Field(default=None, ge=1, le=365)
    allow_customer_cancellation: bool | None = None
    max_attachments_per_request: int | None = Field(default=None, ge=0, le=20)
