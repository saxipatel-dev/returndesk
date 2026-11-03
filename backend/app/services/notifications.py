from sqlalchemy.orm import Session

from app.models import Notification, ReturnRequest

STATUS_LABELS = {
    "pending_review": "pending review",
    "under_review": "under review",
    "approved": "approved",
    "rejected": "rejected",
    "fulfilled": "fulfilled",
    "closed": "closed",
    "cancelled": "cancelled",
}


def notify(db: Session, recipient_id: int, message: str, request: ReturnRequest | None = None):
    db.add(
        Notification(
            recipient_id=recipient_id,
            message=message,
            request_id=request.id if request else None,
        )
    )


def notify_status_change(db: Session, request: ReturnRequest):
    label = STATUS_LABELS[request.status]
    notify(
        db,
        request.customer_id,
        f"Your request {request.reference} is now {label}.",
        request,
    )
