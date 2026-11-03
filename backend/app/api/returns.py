from datetime import UTC, date, datetime, time, timedelta

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, aliased, selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_customer, require_staff
from app.models import (
    Attachment,
    Comment,
    Product,
    Purchase,
    PurchaseItem,
    ReturnEvent,
    ReturnRequest,
    User,
)
from app.models.enums import EventType, RequestStatus, RequestType, Role
from app.schemas import (
    AssignIn,
    AttachmentOut,
    CommentIn,
    CommentOut,
    DecisionIn,
    EventOut,
    NoteIn,
    Page,
    ProductBrief,
    ReturnCreate,
    ReturnDetail,
    ReturnSummary,
    UserBrief,
)
from app.services import returns as workflow
from app.services.notifications import notify
from app.services.uploads import delete_stored, save_upload, stored_path

router = APIRouter(prefix="/api/returns", tags=["returns"])

SORT_FIELDS = {
    "created_at": ReturnRequest.created_at,
    "updated_at": ReturnRequest.updated_at,
    "status": ReturnRequest.status,
    "id": ReturnRequest.id,
}


def to_summary(r: ReturnRequest) -> dict:
    item = r.purchase_item
    return dict(
        id=r.id,
        reference=r.reference,
        request_type=r.request_type,
        status=r.status,
        quantity=r.quantity,
        reason=r.reason,
        requested_resolution=r.requested_resolution,
        product=ProductBrief.model_validate(item.product),
        order_number=item.purchase.order_number,
        customer=UserBrief.model_validate(r.customer),
        assigned_employee=UserBrief.model_validate(r.assigned_employee)
        if r.assigned_employee
        else None,
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


def to_detail(db: Session, r: ReturnRequest, user: User) -> ReturnDetail:
    settings = workflow.get_store_settings(db)
    item = r.purchase_item
    return ReturnDetail(
        **to_summary(r),
        description=r.description,
        decision=r.decision,
        decision_reason=r.decision_reason,
        fulfillment_note=r.fulfillment_note,
        unit_price=item.unit_price,
        purchased_quantity=item.quantity,
        purchased_at=item.purchase.purchased_at,
        decided_at=r.decided_at,
        fulfilled_at=r.fulfilled_at,
        closed_at=r.closed_at,
        allowed_actions=workflow.allowed_actions(user, r, settings),
    )


def get_visible_request(db: Session, request_id: int, user: User) -> ReturnRequest:
    request = db.get(ReturnRequest, request_id)
    # 404 rather than 403 so customers can't probe which request ids exist.
    if request is None or not workflow.can_view(user, request):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found.")
    return request


@router.get("", response_model=Page[ReturnSummary])
def list_requests(
    q: str | None = Query(default=None, max_length=100),
    status_filter: RequestStatus | None = Query(default=None, alias="status"),
    request_type: RequestType | None = None,
    assigned: str | None = Query(
        default=None, description="'me', 'unassigned', 'assigned' or an employee id"
    ),
    date_from: date | None = None,
    date_to: date | None = None,
    open_only: bool = False,
    sort: str = Query(default="-created_at"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    customer = aliased(User)
    stmt = (
        select(ReturnRequest)
        .join(PurchaseItem, PurchaseItem.id == ReturnRequest.purchase_item_id)
        .join(Purchase, Purchase.id == PurchaseItem.purchase_id)
        .join(Product, Product.id == PurchaseItem.product_id)
        .join(customer, customer.id == ReturnRequest.customer_id)
    )
    if user.role == Role.CUSTOMER:
        stmt = stmt.where(ReturnRequest.customer_id == user.id)

    if status_filter:
        stmt = stmt.where(ReturnRequest.status == status_filter)
    if open_only:
        stmt = stmt.where(
            ReturnRequest.status.in_(
                [
                    RequestStatus.PENDING_REVIEW,
                    RequestStatus.UNDER_REVIEW,
                    RequestStatus.APPROVED,
                ]
            )
        )
    if request_type:
        stmt = stmt.where(ReturnRequest.request_type == request_type)
    if date_from:
        stmt = stmt.where(ReturnRequest.created_at >= datetime.combine(date_from, time.min, UTC))
    if date_to:
        stmt = stmt.where(
            ReturnRequest.created_at < datetime.combine(date_to + timedelta(days=1), time.min, UTC)
        )
    if assigned and user.role != Role.CUSTOMER:
        if assigned == "me":
            stmt = stmt.where(ReturnRequest.assigned_employee_id == user.id)
        elif assigned == "unassigned":
            stmt = stmt.where(ReturnRequest.assigned_employee_id.is_(None))
        elif assigned == "assigned":
            stmt = stmt.where(ReturnRequest.assigned_employee_id.is_not(None))
        elif assigned.isdigit():
            stmt = stmt.where(ReturnRequest.assigned_employee_id == int(assigned))
        else:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown assignment filter.")
    if q:
        term = q.strip()
        like = f"%{term}%"
        conditions = [
            Purchase.order_number.ilike(like),
            Product.name.ilike(like),
            Product.sku.ilike(like),
            customer.name.ilike(like),
            customer.email.ilike(like),
        ]
        # "RD-00042", "rd42" or "42" should all find request 42.
        number = term.upper().removeprefix("RD").removeprefix("-")
        if number.isdigit() and len(number) < 10:
            conditions.append(ReturnRequest.id == int(number))
        stmt = stmt.where(or_(*conditions))

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))

    descending = sort.startswith("-")
    column = SORT_FIELDS.get(sort.lstrip("-"))
    if column is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Can't sort by {sort}.")
    order = column.desc() if descending else column.asc()
    stmt = (
        stmt.order_by(order, ReturnRequest.id.desc())
        .options(
            selectinload(ReturnRequest.purchase_item).selectinload(PurchaseItem.product),
            selectinload(ReturnRequest.purchase_item).selectinload(PurchaseItem.purchase),
            selectinload(ReturnRequest.customer),
            selectinload(ReturnRequest.assigned_employee),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [to_summary(r) for r in db.scalars(stmt).all()]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("", response_model=ReturnDetail, status_code=status.HTTP_201_CREATED)
def create_request(
    data: ReturnCreate,
    user: User = Depends(require_customer),
    db: Session = Depends(get_db),
):
    request = workflow.create_request(db, user, data)
    db.commit()
    return to_detail(db, request, user)


@router.get("/{request_id}", response_model=ReturnDetail)
def get_request(
    request_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return to_detail(db, get_visible_request(db, request_id, user), user)


@router.post("/{request_id}/assign", response_model=ReturnDetail)
def assign(
    request_id: int,
    data: AssignIn,
    user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    request = workflow.assign_request(db, request_id, user, data.employee_id)
    db.commit()
    return to_detail(db, request, user)


@router.post("/{request_id}/decision", response_model=ReturnDetail)
def decide(
    request_id: int,
    data: DecisionIn,
    user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    request = workflow.decide_request(db, request_id, user, data.decision, data.reason)
    db.commit()
    return to_detail(db, request, user)


@router.post("/{request_id}/fulfill", response_model=ReturnDetail)
def fulfill(
    request_id: int,
    data: NoteIn,
    user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    request = workflow.fulfill_request(db, request_id, user, data.note)
    db.commit()
    return to_detail(db, request, user)


@router.post("/{request_id}/close", response_model=ReturnDetail)
def close(
    request_id: int,
    data: NoteIn,
    user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    request = workflow.close_request(db, request_id, user, data.note)
    db.commit()
    return to_detail(db, request, user)


@router.post("/{request_id}/cancel", response_model=ReturnDetail)
def cancel(
    request_id: int,
    data: NoteIn,
    user: User = Depends(require_customer),
    db: Session = Depends(get_db),
):
    request = workflow.cancel_request(db, request_id, user, data.note)
    db.commit()
    return to_detail(db, request, user)


@router.get("/{request_id}/events", response_model=list[EventOut])
def list_events(
    request_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_visible_request(db, request_id, user)
    return db.scalars(
        select(ReturnEvent)
        .where(ReturnEvent.request_id == request_id)
        .options(selectinload(ReturnEvent.actor))
        .order_by(ReturnEvent.created_at, ReturnEvent.id)
    ).all()


@router.get("/{request_id}/comments", response_model=list[CommentOut])
def list_comments(
    request_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_visible_request(db, request_id, user)
    stmt = (
        select(Comment)
        .where(Comment.request_id == request_id)
        .options(selectinload(Comment.author))
        .order_by(Comment.created_at, Comment.id)
    )
    if user.role == Role.CUSTOMER:
        stmt = stmt.where(Comment.is_internal.is_(False))
    return db.scalars(stmt).all()


@router.post(
    "/{request_id}/comments",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
)
def add_comment(
    request_id: int,
    data: CommentIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    request = get_visible_request(db, request_id, user)
    is_staff = user.role != Role.CUSTOMER
    comment = Comment(
        request_id=request.id,
        author_id=user.id,
        body=data.body,
        is_internal=data.is_internal and is_staff,
    )
    db.add(comment)

    if is_staff and not comment.is_internal:
        notify(
            db,
            request.customer_id,
            f"New message from support on {request.reference}.",
            request,
        )
    elif not is_staff and request.assigned_employee_id:
        notify(
            db,
            request.assigned_employee_id,
            f"The customer replied on {request.reference}.",
            request,
        )
    db.commit()
    return comment


@router.get("/{request_id}/attachments", response_model=list[AttachmentOut])
def list_attachments(
    request_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_visible_request(db, request_id, user)
    return db.scalars(
        select(Attachment)
        .where(Attachment.request_id == request_id)
        .options(selectinload(Attachment.uploader))
        .order_by(Attachment.id)
    ).all()


@router.post(
    "/{request_id}/attachments",
    response_model=AttachmentOut,
    status_code=status.HTTP_201_CREATED,
)
def upload_attachment(
    request_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    request = get_visible_request(db, request_id, user)
    if request.status in (RequestStatus.CLOSED, RequestStatus.CANCELLED):
        raise HTTPException(status.HTTP_409_CONFLICT, "This request is no longer open.")

    limit = workflow.get_store_settings(db).max_attachments_per_request
    count = db.scalar(select(func.count(Attachment.id)).where(Attachment.request_id == request.id))
    if count >= limit:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"A request can have at most {limit} attachments."
        )

    storage_key, mime_type, size = save_upload(file)
    attachment = Attachment(
        request_id=request.id,
        uploader_id=user.id,
        original_filename=(file.filename or "file")[:255],
        storage_key=storage_key,
        mime_type=mime_type,
        size_bytes=size,
    )
    db.add(attachment)
    workflow.add_event(
        db, request, user, EventType.ATTACHMENT_ADDED, note=attachment.original_filename
    )
    try:
        db.commit()
    except Exception:
        delete_stored(storage_key)
        raise
    return attachment


attachments_router = APIRouter(prefix="/api/attachments", tags=["returns"])


@attachments_router.get("/{attachment_id}")
def download_attachment(
    attachment_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    attachment = db.get(Attachment, attachment_id)
    if attachment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found.")
    get_visible_request(db, attachment.request_id, user)
    return FileResponse(
        stored_path(attachment.storage_key),
        media_type=attachment.mime_type,
        filename=attachment.original_filename,
        content_disposition_type="inline",
        headers={
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )
