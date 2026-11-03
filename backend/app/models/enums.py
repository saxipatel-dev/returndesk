from enum import StrEnum


class Role(StrEnum):
    CUSTOMER = "customer"
    EMPLOYEE = "employee"
    ADMIN = "admin"


class RequestType(StrEnum):
    RETURN = "return"
    WARRANTY = "warranty"


class RequestStatus(StrEnum):
    PENDING_REVIEW = "pending_review"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    FULFILLED = "fulfilled"
    CLOSED = "closed"
    CANCELLED = "cancelled"


# Requests in these states still need someone's attention.
OPEN_STATUSES = (
    RequestStatus.PENDING_REVIEW,
    RequestStatus.UNDER_REVIEW,
    RequestStatus.APPROVED,
)

# Requests in these states no longer hold any of the purchased quantity.
RELEASED_STATUSES = (RequestStatus.REJECTED, RequestStatus.CANCELLED)


class Decision(StrEnum):
    APPROVED = "approved"
    REJECTED = "rejected"


class ReturnReason(StrEnum):
    DEFECTIVE = "defective"
    DAMAGED_IN_TRANSIT = "damaged_in_transit"
    WRONG_ITEM = "wrong_item"
    NOT_AS_DESCRIBED = "not_as_described"
    SIZE_OR_FIT = "size_or_fit"
    CHANGED_MIND = "changed_mind"
    STOPPED_WORKING = "stopped_working"
    OTHER = "other"


class Resolution(StrEnum):
    REFUND = "refund"
    REPLACEMENT = "replacement"
    REPAIR = "repair"


class EventType(StrEnum):
    CREATED = "created"
    ASSIGNED = "assigned"
    UNASSIGNED = "unassigned"
    STATUS_CHANGED = "status_changed"
    DECISION = "decision"
    FULFILLED = "fulfilled"
    CLOSED = "closed"
    CANCELLED = "cancelled"
    ATTACHMENT_ADDED = "attachment_added"
