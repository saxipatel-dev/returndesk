"""Aggregate queries behind the analytics dashboard.

Every metric is computed in PostgreSQL from return_requests. The same filter
set (created date window, current status, request type) is applied to every
query so the KPI cards and charts always describe the same group of requests.
"""

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy import and_, case, extract, func, or_, select
from sqlalchemy.orm import Session

from app.models import Product, PurchaseItem, ReturnRequest, User
from app.models.enums import OPEN_STATUSES, Decision, RequestStatus, RequestType, Role


@dataclass
class Filters:
    date_from: date | None = None
    date_to: date | None = None
    status: RequestStatus | None = None
    request_type: RequestType | None = None

    def conditions(self):
        conds = []
        if self.date_from:
            conds.append(
                ReturnRequest.created_at >= datetime.combine(self.date_from, time.min, UTC)
            )
        if self.date_to:
            end = datetime.combine(self.date_to + timedelta(days=1), time.min, UTC)
            conds.append(ReturnRequest.created_at < end)
        if self.status:
            conds.append(ReturnRequest.status == self.status)
        if self.request_type:
            conds.append(ReturnRequest.request_type == self.request_type)
        return conds


def _month(column):
    return func.to_char(func.date_trunc("month", func.timezone("UTC", column)), "YYYY-MM")


def _resolution_days():
    return extract("epoch", ReturnRequest.closed_at - ReturnRequest.created_at) / 86400.0


def _month_range(first: str, last: str) -> list[str]:
    year, month = map(int, first.split("-"))
    end_year, end_month = map(int, last.split("-"))
    months = []
    while (year, month) <= (end_year, end_month):
        months.append(f"{year:04d}-{month:02d}")
        month += 1
        if month > 12:
            year, month = year + 1, 1
    return months


def summary(db: Session, filters: Filters) -> dict:
    conds = filters.conditions()
    row = db.execute(
        select(
            func.count(ReturnRequest.id),
            func.count().filter(ReturnRequest.status == RequestStatus.PENDING_REVIEW),
            func.count().filter(ReturnRequest.status.in_(OPEN_STATUSES)),
            func.count().filter(
                ReturnRequest.status.in_(OPEN_STATUSES),
                ReturnRequest.assigned_employee_id.is_(None),
            ),
            func.count().filter(ReturnRequest.decision == Decision.APPROVED),
            func.count().filter(ReturnRequest.decision == Decision.REJECTED),
            func.avg(_resolution_days()).filter(ReturnRequest.status == RequestStatus.CLOSED),
            func.count().filter(ReturnRequest.request_type == RequestType.WARRANTY),
        ).where(*conds)
    ).one()
    total, pending, open_count, unassigned, approved, rejected, avg_days, warranty = row
    decided = approved + rejected
    return {
        "total_requests": total,
        "pending_review": pending,
        "open_requests": open_count,
        "unassigned_open": unassigned,
        "approved_decisions": approved,
        "rejected_decisions": rejected,
        # None means "N/A": we never divide by zero or show 0% for no decisions.
        "approval_rate": round(approved / decided * 100, 1) if decided else None,
        "avg_resolution_days": round(float(avg_days), 1) if avg_days is not None else None,
        "warranty_requests": warranty,
    }


def trends(db: Session, filters: Filters) -> dict:
    conds = filters.conditions()

    created_month = _month(ReturnRequest.created_at)
    monthly = dict(
        db.execute(select(created_month, func.count()).where(*conds).group_by(created_month)).all()
    )

    by_category = db.execute(
        select(Product.category, func.count(ReturnRequest.id))
        .join(PurchaseItem, PurchaseItem.id == ReturnRequest.purchase_item_id)
        .join(Product, Product.id == PurchaseItem.product_id)
        .where(*conds)
        .group_by(Product.category)
        .order_by(func.count(ReturnRequest.id).desc(), Product.category)
    ).all()

    by_status = dict(
        db.execute(
            select(ReturnRequest.status, func.count()).where(*conds).group_by(ReturnRequest.status)
        ).all()
    )

    by_reason = db.execute(
        select(ReturnRequest.reason, func.count())
        .where(*conds)
        .group_by(ReturnRequest.reason)
        .order_by(func.count().desc(), ReturnRequest.reason)
    ).all()

    closed_month = _month(ReturnRequest.closed_at)
    resolution = {
        month: (avg, n)
        for month, avg, n in db.execute(
            select(closed_month, func.avg(_resolution_days()), func.count())
            .where(*conds, ReturnRequest.status == RequestStatus.CLOSED)
            .group_by(closed_month)
        ).all()
    }

    decided_month = _month(ReturnRequest.decided_at)
    decisions = {
        month: (approved, rejected)
        for month, approved, rejected in db.execute(
            select(
                decided_month,
                func.count().filter(ReturnRequest.decision == Decision.APPROVED),
                func.count().filter(ReturnRequest.decision == Decision.REJECTED),
            )
            .where(*conds, ReturnRequest.decision.is_not(None))
            .group_by(decided_month)
        ).all()
    }

    months_seen = sorted(set(monthly) | set(resolution) | set(decisions))
    if filters.date_from and filters.date_to:
        months = _month_range(
            filters.date_from.strftime("%Y-%m"), filters.date_to.strftime("%Y-%m")
        )
    elif months_seen:
        months = _month_range(months_seen[0], months_seen[-1])
    else:
        months = []

    status_order = list(RequestStatus)
    return {
        "monthly_requests": [{"month": m, "count": monthly.get(m, 0)} for m in months],
        "by_category": [{"category": c, "count": n} for c, n in by_category],
        "by_status": [
            {"status": s.value, "count": by_status[s]} for s in status_order if by_status.get(s)
        ],
        "by_reason": [{"reason": r.value, "count": n} for r, n in by_reason],
        "resolution_time": [
            {
                "month": m,
                "avg_days": round(float(resolution[m][0]), 1) if m in resolution else None,
                "closed_count": resolution[m][1] if m in resolution else 0,
            }
            for m in months
        ],
        "decisions": [
            {
                "month": m,
                "approved": decisions.get(m, (0, 0))[0],
                "rejected": decisions.get(m, (0, 0))[1],
            }
            for m in months
        ],
        "workload": workload(db, filters),
    }


def workload(db: Session, filters: Filters | None = None) -> list[dict]:
    """Open requests per staff member. Unassigned requests are reported by summary()."""
    conds = filters.conditions() if filters else []
    open_count = func.count(ReturnRequest.id)
    join_on = and_(
        ReturnRequest.assigned_employee_id == User.id,
        ReturnRequest.status.in_(OPEN_STATUSES),
        *conds,
    )
    rows = db.execute(
        select(User.id, User.name, User.role, open_count)
        .outerjoin(ReturnRequest, join_on)
        .where(User.active.is_(True))
        .where(User.role.in_([Role.EMPLOYEE, Role.ADMIN]))
        .group_by(User.id)
        .having(or_(User.role == Role.EMPLOYEE, open_count > 0))
        .order_by(open_count.desc(), User.name)
    ).all()
    return [
        {"employee_id": uid, "name": name, "role": role.value, "open_requests": n}
        for uid, name, role, n in rows
    ]


def export_rows(db: Session, filters: Filters):
    """Rows for the CSV report, oldest first."""
    customer = User.__table__.alias("customer")
    employee = User.__table__.alias("employee")
    stmt = (
        select(
            ReturnRequest.id,
            ReturnRequest.request_type,
            ReturnRequest.status,
            ReturnRequest.decision,
            ReturnRequest.reason,
            ReturnRequest.requested_resolution,
            ReturnRequest.quantity,
            Product.sku,
            Product.name,
            Product.category,
            customer.c.email,
            employee.c.name,
            ReturnRequest.created_at,
            ReturnRequest.decided_at,
            ReturnRequest.closed_at,
            case(
                (ReturnRequest.closed_at.is_not(None), _resolution_days()),
                else_=None,
            ),
        )
        .join(PurchaseItem, PurchaseItem.id == ReturnRequest.purchase_item_id)
        .join(Product, Product.id == PurchaseItem.product_id)
        .join(customer, customer.c.id == ReturnRequest.customer_id)
        .outerjoin(employee, employee.c.id == ReturnRequest.assigned_employee_id)
        .where(*filters.conditions())
        .order_by(ReturnRequest.created_at)
    )
    return db.execute(stmt).all()
