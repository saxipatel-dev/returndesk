"""Return and warranty business rules.

Every function that changes a request's status locks the row first
(SELECT ... FOR UPDATE) and writes the history event in the same transaction,
so two employees clicking at the same time can't both make a decision.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import PurchaseItem, ReturnEvent, ReturnRequest, StoreSettings, User
from app.models.enums import (
    OPEN_STATUSES,
    RELEASED_STATUSES,
    Decision,
    EventType,
    RequestStatus,
    RequestType,
    Resolution,
    Role,
)
from app.schemas import ReturnCreate
from app.services.notifications import notify, notify_status_change

S = RequestStatus

ALLOWED_TRANSITIONS: dict[RequestStatus, set[RequestStatus]] = {
    S.PENDING_REVIEW: {S.UNDER_REVIEW, S.CANCELLED},
    S.UNDER_REVIEW: {S.PENDING_REVIEW, S.APPROVED, S.REJECTED, S.CANCELLED},
    S.APPROVED: {S.FULFILLED},
    S.REJECTED: {S.CLOSED},
    S.FULFILLED: {S.CLOSED},
    S.CLOSED: set(),
    S.CANCELLED: set(),
}

RESOLUTIONS_BY_TYPE = {
    RequestType.RETURN: {Resolution.REFUND, Resolution.REPLACEMENT},
    RequestType.WARRANTY: {Resolution.REPAIR, Resolution.REPLACEMENT},
}


def conflict(message: str) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, message)


def get_store_settings(db: Session) -> StoreSettings:
    settings = db.get(StoreSettings, 1)
    if settings is None:
        settings = StoreSettings(id=1)
        db.add(settings)
        db.flush()
    return settings


# --- Eligibility ----------------------------------------------------------


@dataclass
class ItemEligibility:
    returnable_quantity: int
    return_window_ends: datetime
    can_return: bool
    return_blocked_reason: str | None
    warranty_claimable_quantity: int
    warranty_ends: datetime
    can_claim_warranty: bool
    warranty_blocked_reason: str | None


def reserved_quantity(db: Session, item_id: int, request_type: RequestType) -> int:
    """Quantity already tied up in requests of this type that weren't rejected or cancelled."""
    total = db.scalar(
        select(func.coalesce(func.sum(ReturnRequest.quantity), 0)).where(
            ReturnRequest.purchase_item_id == item_id,
            ReturnRequest.request_type == request_type,
            ReturnRequest.status.not_in(RELEASED_STATUSES),
        )
    )
    return int(total)


def check_eligibility(
    db: Session,
    item: PurchaseItem,
    return_window_days: int,
    now: datetime | None = None,
) -> ItemEligibility:
    now = now or datetime.now(UTC)
    purchased_at = item.purchase.purchased_at

    return_ends = purchased_at + timedelta(days=return_window_days)
    returnable = max(item.quantity - reserved_quantity(db, item.id, RequestType.RETURN), 0)
    return_reason = None
    if now > return_ends:
        return_reason = f"The {return_window_days}-day return window has ended."
    elif returnable == 0:
        return_reason = "All units already have an open or completed return."

    warranty_days = item.product.warranty_days
    warranty_ends = purchased_at + timedelta(days=warranty_days)
    claimable = max(item.quantity - reserved_quantity(db, item.id, RequestType.WARRANTY), 0)
    warranty_reason = None
    if warranty_days == 0:
        warranty_reason = "This product has no warranty."
    elif now > warranty_ends:
        warranty_reason = "The warranty period has ended."
    elif claimable == 0:
        warranty_reason = "All units already have a warranty claim."

    return ItemEligibility(
        returnable_quantity=returnable,
        return_window_ends=return_ends,
        can_return=return_reason is None,
        return_blocked_reason=return_reason,
        warranty_claimable_quantity=claimable,
        warranty_ends=warranty_ends,
        can_claim_warranty=warranty_reason is None,
        warranty_blocked_reason=warranty_reason,
    )


# --- Helpers --------------------------------------------------------------


def add_event(
    db: Session,
    request: ReturnRequest,
    actor: User,
    event_type: EventType,
    from_status: RequestStatus | None = None,
    to_status: RequestStatus | None = None,
    note: str | None = None,
):
    db.add(
        ReturnEvent(
            request_id=request.id,
            actor_id=actor.id,
            event_type=event_type,
            from_status=from_status,
            to_status=to_status,
            note=note,
        )
    )


def change_status(
    db: Session,
    request: ReturnRequest,
    actor: User,
    new_status: RequestStatus,
    event_type: EventType = EventType.STATUS_CHANGED,
    note: str | None = None,
):
    old_status = request.status
    if new_status not in ALLOWED_TRANSITIONS[old_status]:
        raise conflict(f"Can't move a request from {old_status.value} to {new_status.value}.")
    request.status = new_status
    request.updated_at = datetime.now(UTC)
    add_event(db, request, actor, event_type, old_status, new_status, note)
    notify_status_change(db, request)


def lock_request(db: Session, request_id: int) -> ReturnRequest:
    request = db.scalar(
        select(ReturnRequest).where(ReturnRequest.id == request_id).with_for_update()
    )
    if request is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found.")
    return request


def can_view(user: User, request: ReturnRequest) -> bool:
    return user.role in (Role.EMPLOYEE, Role.ADMIN) or request.customer_id == user.id


def can_act_as_reviewer(user: User, request: ReturnRequest) -> bool:
    """Admins can act on anything; employees only on requests assigned to them."""
    if user.role == Role.ADMIN:
        return True
    return user.role == Role.EMPLOYEE and request.assigned_employee_id == user.id


def allowed_actions(user: User, request: ReturnRequest, settings: StoreSettings) -> list[str]:
    actions = ["comment"]
    is_staff = user.role in (Role.EMPLOYEE, Role.ADMIN)
    if request.status not in (S.CLOSED, S.CANCELLED):
        actions.append("upload")
    if is_staff and request.status in OPEN_STATUSES:
        actions.append("assign")
    if can_act_as_reviewer(user, request):
        if request.status == S.UNDER_REVIEW:
            actions.append("decide")
        if request.status == S.APPROVED:
            actions.append("fulfill")
        if request.status in (S.REJECTED, S.FULFILLED):
            actions.append("close")
    if (
        user.id == request.customer_id
        and settings.allow_customer_cancellation
        and request.status in (S.PENDING_REVIEW, S.UNDER_REVIEW)
    ):
        actions.append("cancel")
    return actions


# --- Workflow actions -----------------------------------------------------


def create_request(db: Session, customer: User, data: ReturnCreate) -> ReturnRequest:
    # Lock the purchased item so two simultaneous submissions can't both
    # claim the last returnable unit.
    item = db.scalar(
        select(PurchaseItem).where(PurchaseItem.id == data.purchase_item_id).with_for_update()
    )
    if item is None or item.purchase.customer_id != customer.id:
        # Same response whether it doesn't exist or belongs to someone else.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Purchase item not found.")

    if data.requested_resolution not in RESOLUTIONS_BY_TYPE[data.request_type]:
        allowed = ", ".join(sorted(r.value for r in RESOLUTIONS_BY_TYPE[data.request_type]))
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"A {data.request_type.value} request can ask for: {allowed}.",
        )

    settings = get_store_settings(db)
    eligibility = check_eligibility(db, item, settings.return_window_days)
    if data.request_type == RequestType.RETURN:
        allowed, available, blocked = (
            eligibility.can_return,
            eligibility.returnable_quantity,
            eligibility.return_blocked_reason,
        )
    else:
        allowed, available, blocked = (
            eligibility.can_claim_warranty,
            eligibility.warranty_claimable_quantity,
            eligibility.warranty_blocked_reason,
        )
    if not allowed:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, blocked)
    if data.quantity > available:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"You can request at most {available} unit(s) for this item.",
        )

    request = ReturnRequest(
        purchase_item_id=item.id,
        customer_id=customer.id,
        request_type=data.request_type,
        quantity=data.quantity,
        reason=data.reason,
        description=data.description,
        requested_resolution=data.requested_resolution,
        status=S.PENDING_REVIEW,
    )
    db.add(request)
    db.flush()
    add_event(db, request, customer, EventType.CREATED, None, S.PENDING_REVIEW)
    notify(
        db,
        customer.id,
        f"We received your {data.request_type.value} request {request.reference}.",
        request,
    )
    return request


def assign_request(db: Session, request_id: int, actor: User, employee_id: int | None):
    request = lock_request(db, request_id)
    if request.status not in OPEN_STATUSES:
        raise conflict("Only open requests can be reassigned.")

    if actor.role == Role.EMPLOYEE and employee_id not in (actor.id, None):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Employees can only assign to themselves.")
    if (
        actor.role == Role.EMPLOYEE
        and employee_id is None
        and request.assigned_employee_id != actor.id
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only release your own requests.")

    if employee_id is None:
        if request.assigned_employee_id is None:
            return request
        request.assigned_employee_id = None
        add_event(db, request, actor, EventType.UNASSIGNED, note="Returned to the queue")
        if request.status == S.UNDER_REVIEW:
            change_status(db, request, actor, S.PENDING_REVIEW)
        return request

    employee = db.get(User, employee_id)
    if employee is None or employee.role not in (Role.EMPLOYEE, Role.ADMIN) or not employee.active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose an active staff member.")
    if request.assigned_employee_id == employee.id:
        return request

    request.assigned_employee_id = employee.id
    request.updated_at = datetime.now(UTC)
    add_event(db, request, actor, EventType.ASSIGNED, note=f"Assigned to {employee.name}")
    if employee.id != actor.id:
        notify(db, employee.id, f"{request.reference} was assigned to you.", request)
    if request.status == S.PENDING_REVIEW:
        change_status(db, request, actor, S.UNDER_REVIEW)
    return request


def decide_request(
    db: Session, request_id: int, actor: User, decision: Decision, reason: str | None
):
    request = lock_request(db, request_id)
    reason = (reason or "").strip() or None
    if not can_act_as_reviewer(actor, request):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Assign this request to yourself before deciding.",
        )
    if request.decision is not None:
        raise conflict("A decision has already been recorded for this request.")
    if request.status != S.UNDER_REVIEW:
        raise conflict("Only requests under review can be approved or rejected.")
    if decision == Decision.REJECTED and not reason:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Explain why the request is rejected.",
        )

    request.decision = decision
    request.decision_reason = reason
    request.decided_at = datetime.now(UTC)
    new_status = S.APPROVED if decision == Decision.APPROVED else S.REJECTED
    change_status(db, request, actor, new_status, EventType.DECISION, reason)
    return request


def fulfill_request(db: Session, request_id: int, actor: User, note: str | None):
    request = lock_request(db, request_id)
    if not can_act_as_reviewer(actor, request):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the assigned employee can fulfill this."
        )
    if request.fulfilled_at is not None:
        raise conflict("This request has already been fulfilled.")
    if request.status != S.APPROVED:
        raise conflict("Only approved requests can be fulfilled.")

    resolution = request.requested_resolution.value
    note = (note or "").strip() or f"Simulated {resolution} recorded. No real payment was made."
    request.fulfillment_note = note
    request.fulfilled_at = datetime.now(UTC)
    change_status(db, request, actor, S.FULFILLED, EventType.FULFILLED, note)
    return request


def close_request(db: Session, request_id: int, actor: User, note: str | None):
    request = lock_request(db, request_id)
    if not can_act_as_reviewer(actor, request):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the assigned employee can close this.")
    if request.status not in (S.REJECTED, S.FULFILLED):
        raise conflict("Only fulfilled or rejected requests can be closed.")
    request.closed_at = datetime.now(UTC)
    change_status(db, request, actor, S.CLOSED, EventType.CLOSED, (note or "").strip() or None)
    return request


def cancel_request(db: Session, request_id: int, actor: User, note: str | None):
    request = lock_request(db, request_id)
    if request.customer_id != actor.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found.")
    if not get_store_settings(db).allow_customer_cancellation:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cancellation is turned off by the store.")
    if request.status not in (S.PENDING_REVIEW, S.UNDER_REVIEW):
        raise conflict("Requests can only be cancelled before a decision is made.")
    change_status(
        db,
        request,
        actor,
        S.CANCELLED,
        EventType.CANCELLED,
        (note or "").strip() or None,
    )
    if request.assigned_employee_id:
        notify(
            db,
            request.assigned_employee_id,
            f"{request.reference} was cancelled by the customer.",
            request,
        )
    return request
