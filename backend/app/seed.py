"""Load deterministic demo data.

    python -m app.seed            # seed an empty database
    python -m app.seed --reset    # wipe everything and seed again

All people, orders and requests are fictional. Dates are generated relative to
today so the demo always has recent activity, but the random generator uses a
fixed seed, so the shape of the data is the same on every run.
"""

import argparse
import random
import sys
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import (
    Comment,
    Notification,
    Product,
    Purchase,
    PurchaseItem,
    ReturnEvent,
    ReturnRequest,
    StoreSettings,
    User,
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
from app.services.notifications import STATUS_LABELS

DEMO_PASSWORD = "Demo#2026"
RETURN_WINDOW_DAYS = 30

STAFF = [
    ("Morgan Ellis", "admin@example.com", Role.ADMIN, True),
    ("Priya Raman", "priya@example.com", Role.EMPLOYEE, True),
    ("Daniel Okafor", "daniel@example.com", Role.EMPLOYEE, True),
    ("Sofia Martinez", "sofia@example.com", Role.EMPLOYEE, True),
    ("Ethan Brooks", "ethan@example.com", Role.EMPLOYEE, True),
    ("Grace Liu", "grace@example.com", Role.EMPLOYEE, False),
]

CUSTOMERS = [
    ("Jordan Lee", "customer@example.com"),
    ("Amara Nwosu", "amara@example.com"),
    ("Lucas Bennett", "lucas@example.com"),
    ("Hannah Kim", "hannah@example.com"),
    ("Mateo Alvarez", "mateo@example.com"),
    ("Chloe Dubois", "chloe@example.com"),
    ("Ravi Shah", "ravi@example.com"),
    ("Olivia Carter", "olivia@example.com"),
    ("Noah Fischer", "noah@example.com"),
    ("Mia Thompson", "mia@example.com"),
    ("Samuel Adeyemi", "samuel@example.com"),
    ("Isabella Rossi", "isabella@example.com"),
]

# (sku, name, category, price, warranty_days)
PRODUCTS = [
    ("EL-1001", "Wireless Noise-Cancelling Headphones", "Electronics", "149.99", 365),
    ("EL-1002", "Bluetooth Portable Speaker", "Electronics", "59.99", 365),
    ("EL-1003", "USB-C Charging Hub (7-port)", "Electronics", "39.99", 730),
    ("EL-1004", "Smart Fitness Watch", "Electronics", "199.00", 365),
    ("HK-2001", "Stainless Steel Electric Kettle", "Home & Kitchen", "44.50", 730),
    ("HK-2002", "Non-Stick Cookware Set (8 pc)", "Home & Kitchen", "119.00", 365),
    ("HK-2003", "Cold Brew Coffee Maker", "Home & Kitchen", "32.00", 180),
    ("HK-2004", "Cotton Bath Towel Set", "Home & Kitchen", "29.99", 0),
    ("OD-3001", "2-Person Camping Tent", "Outdoor", "129.00", 365),
    ("OD-3002", "Insulated Water Bottle (1 L)", "Outdoor", "24.95", 365),
    ("OD-3003", "LED Rechargeable Headlamp", "Outdoor", "27.50", 180),
    ("OD-3004", "Folding Camp Chair", "Outdoor", "45.00", 180),
    ("AP-4001", "Waterproof Rain Jacket", "Apparel", "89.00", 90),
    ("AP-4002", "Trail Running Shoes", "Apparel", "110.00", 90),
    ("AP-4003", "Merino Wool Socks (3 pack)", "Apparel", "21.00", 0),
    ("AP-4004", "Everyday Backpack 24 L", "Apparel", "64.00", 365),
    ("FT-5001", "Adjustable Dumbbell Pair", "Fitness", "249.00", 730),
    ("FT-5002", "Non-Slip Yoga Mat", "Fitness", "35.00", 90),
    ("FT-5003", "Resistance Band Set", "Fitness", "19.99", 90),
    ("FT-5004", "Foam Roller", "Fitness", "22.00", 0),
    ("OF-6001", "Ergonomic Office Chair", "Office", "289.00", 730),
    ("OF-6002", "LED Desk Lamp with Dimmer", "Office", "38.00", 365),
    ("OF-6003", "Mechanical Keyboard", "Office", "94.00", 365),
    ("OF-6004", "Monitor Stand with Drawer", "Office", "41.00", 180),
]

RETURN_REASONS = [
    (ReturnReason.DEFECTIVE, 18),
    (ReturnReason.DAMAGED_IN_TRANSIT, 14),
    (ReturnReason.WRONG_ITEM, 9),
    (ReturnReason.NOT_AS_DESCRIBED, 13),
    (ReturnReason.SIZE_OR_FIT, 16),
    (ReturnReason.CHANGED_MIND, 12),
    (ReturnReason.OTHER, 4),
]
WARRANTY_REASONS = [
    (ReturnReason.STOPPED_WORKING, 10),
    (ReturnReason.DEFECTIVE, 8),
    (ReturnReason.OTHER, 2),
]

DESCRIPTIONS = {
    ReturnReason.DEFECTIVE: [
        "The left side cuts out every few minutes, even after a reset.",
        "One of the buttons does nothing when pressed. Tried it a few times.",
        "It won't power on out of the box. The charger works with other devices.",
    ],
    ReturnReason.DAMAGED_IN_TRANSIT: [
        "The box arrived crushed and the item has a cracked corner.",
        "There is a dent on the side and a scratch across the front.",
    ],
    ReturnReason.WRONG_ITEM: [
        "I ordered the black one but received grey.",
        "The package contained a different model than the one on my order.",
    ],
    ReturnReason.NOT_AS_DESCRIBED: [
        "The listing said it was waterproof, but water gets in after light rain.",
        "It's noticeably smaller than the dimensions on the product page.",
    ],
    ReturnReason.SIZE_OR_FIT: [
        "Runs about a size small. I'd like to exchange for the next size up.",
        "Too tight around the shoulders. Wore it once indoors to try it on.",
    ],
    ReturnReason.CHANGED_MIND: [
        "Found that I don't need it after all. It's unopened.",
        "Bought a different one as a gift by mistake, still in the original packaging.",
    ],
    ReturnReason.STOPPED_WORKING: [
        "Worked fine for a few months and now it won't hold a charge.",
        "It stopped turning on last week. No drops or water damage.",
    ],
    ReturnReason.OTHER: [
        "The material smells strongly of chemicals and it hasn't faded after a week.",
    ],
}

REJECTION_REASONS = [
    "The photos show wear that isn't covered by the return policy.",
    "The item was returned without its original accessories.",
    "The damage shown is consistent with a drop, which the warranty doesn't cover.",
    "We couldn't reproduce the problem during inspection.",
]

STAFF_REPLIES = [
    "Thanks for the details. Could you send a photo of the serial number label?",
    "We've received your item and are taking a look.",
    "A prepaid return label has been emailed to you.",
]
CUSTOMER_REPLIES = [
    "Photo attached. Let me know if you need anything else.",
    "Thanks! I dropped it off at the post office today.",
]


def weighted(rng: random.Random, options):
    values, weights = zip(*options, strict=True)
    return rng.choices(values, weights=weights)[0]


def reset_database(db: Session):
    db.execute(
        text(
            "TRUNCATE notifications, attachments, comments, return_events, return_requests, "
            "purchase_items, purchases, products, user_sessions, users RESTART IDENTITY CASCADE"
        )
    )
    db.commit()


class Seeder:
    def __init__(self, db: Session, now: datetime):
        self.db = db
        self.now = now
        self.rng = random.Random(2026)

    def run(self):
        self.ensure_settings()
        password_hash = hash_password(DEMO_PASSWORD)
        self.staff = [
            self.add(User(name=n, email=e, role=r, active=a, password_hash=password_hash))
            for n, e, r, a in STAFF
        ]
        self.customers = [
            self.add(User(name=n, email=e, role=Role.CUSTOMER, password_hash=password_hash))
            for n, e in CUSTOMERS
        ]
        self.products = [
            self.add(
                Product(
                    sku=sku,
                    name=name,
                    category=cat,
                    price=Decimal(price),
                    warranty_days=days,
                    description=f"{name} from the {cat.lower()} range.",
                )
            )
            for sku, name, cat, price, days in PRODUCTS
        ]
        self.db.flush()
        self.reviewers = [u for u in self.staff if u.role == Role.EMPLOYEE] + [self.staff[0]]

        order_number = 100200
        for index, customer in enumerate(self.customers):
            purchase_count = 9 if index == 0 else self.rng.randint(8, 12)
            for p in range(purchase_count):
                order_number += self.rng.randint(3, 17)
                # Everyone gets a couple of recent orders so the work queue has
                # open requests; the demo customer gets an extra one to return.
                recent = p < (3 if index == 0 else 2)
                days_ago = self.rng.randint(2, 24) if recent else self.rng.randint(3, 390)
                purchased_at = self.now - timedelta(days=days_ago, hours=self.rng.randint(0, 23))
                purchase = self.add(
                    Purchase(
                        customer=customer,
                        order_number=f"ORD-{order_number}",
                        purchased_at=purchased_at,
                    )
                )
                for product in self.rng.sample(self.products, self.rng.randint(1, 3)):
                    item = self.add(
                        PurchaseItem(
                            purchase=purchase,
                            product=product,
                            quantity=self.rng.choice([1, 1, 1, 2, 3]),
                            unit_price=product.price,
                        )
                    )
                    self.db.flush()
                    # Keep a couple of the demo customer's recent items untouched for the demo.
                    if index == 0 and p < 2:
                        continue
                    self.maybe_create_request(customer, item)
        self.db.commit()

    def add(self, obj):
        self.db.add(obj)
        return obj

    def ensure_settings(self):
        if self.db.get(StoreSettings, 1) is None:
            self.db.add(StoreSettings(id=1))

    def maybe_create_request(self, customer: User, item: PurchaseItem):
        purchased_at = item.purchase.purchased_at
        age_days = (self.now - purchased_at).days
        roll = self.rng.random()

        warranty_open = item.product.warranty_days > RETURN_WINDOW_DAYS + 10 and age_days > 45
        if roll < 0.45 and age_days >= 1:
            request_type = RequestType.RETURN
            latest = min(RETURN_WINDOW_DAYS - 1, age_days)
            created_at = purchased_at + timedelta(
                days=self.rng.randint(0, latest), hours=self.rng.randint(1, 12)
            )
            reason = weighted(self.rng, RETURN_REASONS)
            resolution = (
                Resolution.REPLACEMENT
                if reason in (ReturnReason.SIZE_OR_FIT, ReturnReason.WRONG_ITEM)
                else self.rng.choice([Resolution.REFUND, Resolution.REFUND, Resolution.REPLACEMENT])
            )
        elif roll < 0.60 and warranty_open:
            request_type = RequestType.WARRANTY
            latest = min(item.product.warranty_days, age_days)
            created_at = purchased_at + timedelta(
                days=self.rng.randint(RETURN_WINDOW_DAYS + 5, latest), hours=self.rng.randint(1, 12)
            )
            reason = weighted(self.rng, WARRANTY_REASONS)
            resolution = self.rng.choice([Resolution.REPAIR, Resolution.REPLACEMENT])
        else:
            return

        if created_at >= self.now:
            created_at = self.now - timedelta(hours=self.rng.randint(2, 20))

        request = self.add(
            ReturnRequest(
                purchase_item=item,
                customer=customer,
                request_type=request_type,
                quantity=self.rng.randint(1, item.quantity),
                reason=reason,
                description=self.rng.choice(DESCRIPTIONS[reason]),
                requested_resolution=resolution,
                status=RequestStatus.PENDING_REVIEW,
                created_at=created_at,
                updated_at=created_at,
            )
        )
        self.db.flush()
        self.event(
            request, customer, EventType.CREATED, created_at, None, RequestStatus.PENDING_REVIEW
        )
        self.notify(
            customer,
            request,
            f"We received your {request_type.value} request {request.reference}.",
            created_at,
        )
        self.play_out(request, customer, created_at)

    def play_out(self, request: ReturnRequest, customer: User, at: datetime):
        """Walk the request forward through the workflow until we reach 'now'."""
        rng = self.rng

        if rng.random() < 0.05:
            at += timedelta(hours=rng.randint(2, 30))
            if at < self.now:
                self.move(
                    request,
                    customer,
                    RequestStatus.CANCELLED,
                    at,
                    EventType.CANCELLED,
                    "Customer no longer needs to return this.",
                )
            return

        # Some requests wait a while in the queue before anyone picks them up.
        at += timedelta(hours=rng.randint(3, 60) if rng.random() < 0.7 else rng.randint(60, 240))
        if at >= self.now:
            return
        employee = (
            rng.choice(self.reviewers[:4]) if rng.random() < 0.85 else rng.choice(self.reviewers)
        )
        request.assigned_employee_id = employee.id
        self.event(request, employee, EventType.ASSIGNED, at, note=f"Assigned to {employee.name}")
        self.move(request, employee, RequestStatus.UNDER_REVIEW, at)

        if rng.random() < 0.35:
            reply_at = at + timedelta(hours=rng.randint(1, 20))
            if reply_at < self.now:
                self.comment(request, employee, rng.choice(STAFF_REPLIES), reply_at)
                answer_at = reply_at + timedelta(hours=rng.randint(1, 30))
                if answer_at < self.now:
                    self.comment(request, customer, rng.choice(CUSTOMER_REPLIES), answer_at)

        # Review takes longer for warranty claims, and got a bit faster over the year.
        months_ago = (self.now - at).days / 30
        review_hours = rng.randint(10, 70) + int(months_ago * 4)
        if request.request_type == RequestType.WARRANTY:
            review_hours += rng.randint(24, 72)
        at += timedelta(hours=review_hours)
        if at >= self.now:
            return

        reject_chance = 0.45 if request.reason == ReturnReason.CHANGED_MIND else 0.22
        if rng.random() < reject_chance:
            reason = rng.choice(REJECTION_REASONS)
            request.decision, request.decision_reason, request.decided_at = (
                Decision.REJECTED,
                reason,
                at,
            )
            self.move(request, employee, RequestStatus.REJECTED, at, EventType.DECISION, reason)
        else:
            request.decision, request.decided_at = Decision.APPROVED, at
            self.move(request, employee, RequestStatus.APPROVED, at, EventType.DECISION)

            at += timedelta(hours=rng.randint(6, 96))
            if at >= self.now:
                return
            resolution = request.requested_resolution.value
            note = f"Simulated {resolution} recorded. No real payment was made."
            request.fulfillment_note, request.fulfilled_at = note, at
            self.move(request, employee, RequestStatus.FULFILLED, at, EventType.FULFILLED, note)

        at += timedelta(hours=rng.randint(2, 72))
        if at >= self.now:
            return
        request.closed_at = at
        self.move(request, employee, RequestStatus.CLOSED, at, EventType.CLOSED)

    def move(self, request, actor, new_status, at, event_type=EventType.STATUS_CHANGED, note=None):
        old = request.status
        request.status = new_status
        request.updated_at = at
        self.event(request, actor, event_type, at, old, new_status, note)
        label = STATUS_LABELS[new_status]
        self.notify(
            request.customer, request, f"Your request {request.reference} is now {label}.", at
        )

    def event(self, request, actor, event_type, at, from_status=None, to_status=None, note=None):
        self.add(
            ReturnEvent(
                request_id=request.id,
                actor_id=actor.id,
                event_type=event_type,
                from_status=from_status,
                to_status=to_status,
                note=note,
                created_at=at,
            )
        )

    def comment(self, request, author, body, at):
        self.add(Comment(request_id=request.id, author_id=author.id, body=body, created_at=at))

    def notify(self, recipient, request, message, at):
        # Older notifications are already read so the demo inbox isn't overwhelming.
        read_at = at + timedelta(hours=2) if (self.now - at).days > 7 else None
        self.add(
            Notification(
                recipient_id=recipient.id,
                request_id=request.id,
                message=message,
                created_at=at,
                read_at=read_at,
            )
        )


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--reset", action="store_true", help="delete existing data first")
    parser.add_argument(
        "--allow-production",
        action="store_true",
        help="required when ENVIRONMENT=production (demo deployments only)",
    )
    args = parser.parse_args(argv)

    if get_settings().is_production and not args.allow_production:
        sys.exit("Refusing to load demo accounts in production without --allow-production.")

    with SessionLocal() as db:
        if args.reset:
            reset_database(db)
        elif db.scalar(select(User.id).limit(1)):
            print("Database already has users; skipping. Use --reset to start over.")
            return
        Seeder(db, datetime.now(UTC)).run()
        counts = {
            "users": db.query(User).count(),
            "products": db.query(Product).count(),
            "purchases": db.query(Purchase).count(),
            "requests": db.query(ReturnRequest).count(),
        }
        print("Seeded demo data:", ", ".join(f"{v} {k}" for k, v in counts.items()))
        print(f"Demo password for every account: {DEMO_PASSWORD}")


if __name__ == "__main__":
    main()
