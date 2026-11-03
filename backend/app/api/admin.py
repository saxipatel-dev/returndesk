"""Staff accounts, store settings, analytics and notifications."""

import csv
import io
from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin, require_staff
from app.core.security import hash_password
from app.models import Notification, User, UserSession
from app.models.enums import RequestStatus, RequestType, Role
from app.schemas import (
    EmployeeWorkload,
    NotificationList,
    NotificationOut,
    NotificationUpdate,
    Page,
    StaffCreate,
    StoreSettingsOut,
    StoreSettingsUpdate,
    UserOut,
    UserUpdate,
)
from app.services import analytics
from app.services.returns import get_store_settings

router = APIRouter(prefix="/api", tags=["admin"])


# --- Users ----------------------------------------------------------------


@router.get("/users", response_model=Page[UserOut])
def list_users(
    role: Role | None = None,
    q: str | None = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    stmt = select(User)
    if role:
        stmt = stmt.where(User.role == role)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(User.name.ilike(like) | User.email.ilike(like))
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    users = db.scalars(
        stmt.order_by(User.role, User.name).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return {"items": users, "total": total, "page": page, "page_size": page_size}


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_staff(
    data: StaffCreate, _: User = Depends(require_admin), db: Session = Depends(get_db)
):
    email = data.email.lower()
    if db.scalar(select(User.id).where(func.lower(User.email) == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    user = User(
        name=data.name,
        email=email,
        password_hash=hash_password(data.password),
        role=data.role,
    )
    db.add(user)
    db.commit()
    return user


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    data: UserUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    if user.id == admin.id and (data.active is False or data.role not in (None, Role.ADMIN)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't deactivate or demote yourself.")
    if data.role is not None and data.role != user.role:
        if Role.CUSTOMER in (data.role, user.role):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Customer accounts can't be turned into staff.",
            )
        user.role = data.role
    if data.name is not None:
        user.name = data.name.strip()
    if data.active is not None:
        user.active = data.active
        if not data.active:
            # Sign the user out everywhere right away.
            db.execute(delete(UserSession).where(UserSession.user_id == user.id))
    db.commit()
    return user


@router.get("/staff", response_model=list[EmployeeWorkload])
def list_staff(_: User = Depends(require_staff), db: Session = Depends(get_db)):
    """Active staff with their open workload; used for the assignment picker."""
    counts = {row["employee_id"]: row["open_requests"] for row in analytics.workload(db)}
    staff = db.scalars(
        select(User)
        .where(User.role.in_([Role.EMPLOYEE, Role.ADMIN]), User.active.is_(True))
        .order_by(User.name)
    ).all()
    return [
        EmployeeWorkload(
            id=u.id,
            name=u.name,
            email=u.email,
            role=u.role,
            active=u.active,
            open_requests=counts.get(u.id, 0),
        )
        for u in staff
    ]


# --- Store settings -------------------------------------------------------


@router.get("/settings", response_model=StoreSettingsOut)
def read_settings(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    settings = get_store_settings(db)
    db.commit()
    return settings


@router.patch("/settings", response_model=StoreSettingsOut)
def update_settings(
    data: StoreSettingsUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    settings = get_store_settings(db)
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(settings, field, value)
    db.commit()
    db.refresh(settings)
    return settings


# --- Analytics ------------------------------------------------------------


def analytics_filters(
    date_from: date | None = None,
    date_to: date | None = None,
    status_filter: RequestStatus | None = Query(default=None, alias="status"),
    request_type: RequestType | None = None,
) -> analytics.Filters:
    if date_from and date_to and date_from > date_to:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "The start date must be before the end date.",
        )
    return analytics.Filters(date_from, date_to, status_filter, request_type)


@router.get("/analytics/summary")
def analytics_summary(
    filters: analytics.Filters = Depends(analytics_filters),
    _: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    return analytics.summary(db, filters)


@router.get("/analytics/trends")
def analytics_trends(
    filters: analytics.Filters = Depends(analytics_filters),
    _: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    return analytics.trends(db, filters)


@router.get("/analytics/export.csv")
def analytics_export(
    filters: analytics.Filters = Depends(analytics_filters),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "reference", "type", "status", "decision", "reason", "resolution", "quantity",
            "sku", "product", "category", "customer_email", "assigned_to",
            "created_at", "decided_at", "closed_at", "resolution_days",
        ]
    )  # fmt: skip
    for row in analytics.export_rows(db, filters):
        values = list(row)
        values[0] = f"RD-{values[0]:05d}"
        for i in (1, 2, 3, 4, 5):
            values[i] = values[i].value if values[i] is not None else ""
        for i in (12, 13, 14):
            values[i] = values[i].isoformat() if values[i] else ""
        values[15] = f"{float(values[15]):.1f}" if values[15] is not None else ""
        writer.writerow(["" if v is None else v for v in values])

    filename = f"returndesk-report-{datetime.now(UTC):%Y%m%d}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# --- Notifications --------------------------------------------------------


@router.get("/notifications", response_model=NotificationList)
def list_notifications(
    unread_only: bool = False,
    limit: int = Query(default=30, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = select(Notification).where(Notification.recipient_id == user.id)
    if unread_only:
        stmt = stmt.where(Notification.read_at.is_(None))
    items = db.scalars(
        stmt.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit)
    ).all()
    unread = db.scalar(
        select(func.count(Notification.id)).where(
            Notification.recipient_id == user.id, Notification.read_at.is_(None)
        )
    )
    return {"items": items, "unread_count": unread}


@router.patch("/notifications/{notification_id}", response_model=NotificationOut)
def mark_notification(
    notification_id: int,
    data: NotificationUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification = db.get(Notification, notification_id)
    if notification is None or notification.recipient_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found.")
    notification.read_at = datetime.now(UTC) if data.read else None
    db.commit()
    return notification


@router.post("/notifications/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(
        update(Notification)
        .where(Notification.recipient_id == user.id, Notification.read_at.is_(None))
        .values(read_at=datetime.now(UTC))
    )
    db.commit()
