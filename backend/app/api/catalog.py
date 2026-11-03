"""Products (admin managed) and the customer's own purchase history."""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models import Product, Purchase, PurchaseItem, User
from app.models.enums import Role
from app.schemas import (
    Eligibility,
    ProductBrief,
    ProductIn,
    ProductOut,
    ProductUpdate,
    PurchaseItemOut,
    PurchaseOut,
)
from app.services.returns import check_eligibility, get_store_settings

router = APIRouter(prefix="/api", tags=["catalog"])


@router.get("/products", response_model=list[ProductOut])
def list_products(
    q: str | None = None,
    category: str | None = None,
    include_archived: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = select(Product).order_by(Product.category, Product.name)
    if not (include_archived and user.role == Role.ADMIN):
        stmt = stmt.where(Product.archived.is_(False))
    if category:
        stmt = stmt.where(Product.category == category)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Product.name.ilike(like), Product.sku.ilike(like)))
    return db.scalars(stmt).all()


@router.get("/products/categories", response_model=list[str])
def list_categories(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Product.category).distinct().order_by(Product.category)).all()


@router.post("/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    data: ProductIn, _: User = Depends(require_admin), db: Session = Depends(get_db)
):
    sku = data.sku.upper()
    if db.scalar(select(Product.id).where(func.upper(Product.sku) == sku)):
        raise HTTPException(status.HTTP_409_CONFLICT, f"SKU {sku} is already in use.")
    product = Product(**data.model_dump(exclude={"sku"}), sku=sku)
    db.add(product)
    db.commit()
    return product


@router.patch("/products/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    data: ProductUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found.")
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(product, field, value.strip() if isinstance(value, str) else value)
    db.commit()
    return product


def purchase_out(db: Session, purchase: Purchase, return_window_days: int) -> PurchaseOut:
    items = []
    total = Decimal("0")
    for item in purchase.items:
        total += item.unit_price * item.quantity
        eligibility = check_eligibility(db, item, return_window_days)
        items.append(
            PurchaseItemOut(
                id=item.id,
                product=ProductBrief.model_validate(item.product),
                quantity=item.quantity,
                unit_price=item.unit_price,
                eligibility=Eligibility(**eligibility.__dict__),
            )
        )
    return PurchaseOut(
        id=purchase.id,
        order_number=purchase.order_number,
        purchased_at=purchase.purchased_at,
        total=total,
        items=items,
    )


@router.get("/purchases", response_model=list[PurchaseOut])
def list_purchases(
    q: str | None = Query(default=None, max_length=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Everyone (including staff) only sees purchases on their own account here.
    stmt = (
        select(Purchase)
        .where(Purchase.customer_id == user.id)
        .options(selectinload(Purchase.items).selectinload(PurchaseItem.product))
        .order_by(Purchase.purchased_at.desc())
    )
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Purchase.order_number.ilike(like),
                Purchase.items.any(PurchaseItem.product.has(Product.name.ilike(like))),
            )
        )
    window = get_store_settings(db).return_window_days
    return [purchase_out(db, p, window) for p in db.scalars(stmt).all()]


@router.get("/purchases/{purchase_id}", response_model=PurchaseOut)
def get_purchase(
    purchase_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    purchase = db.get(Purchase, purchase_id)
    if purchase is None or purchase.customer_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Purchase not found.")
    return purchase_out(db, purchase, get_store_settings(db).return_window_days)
