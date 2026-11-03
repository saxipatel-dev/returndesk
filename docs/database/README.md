# Database

PostgreSQL 16 (CI and Docker) / 14+ (local). Schema is managed by Alembic:
`backend/alembic/versions/20261102_0001_initial_schema.py`.

## Entity relationship diagram

```mermaid
erDiagram
    users ||--o{ purchases : "places"
    users ||--o{ user_sessions : "signs in with"
    purchases ||--|{ purchase_items : "contains"
    products ||--o{ purchase_items : "sold as"
    purchase_items ||--o{ return_requests : "returned via"
    users ||--o{ return_requests : "submits (customer)"
    users |o--o{ return_requests : "handles (assigned employee)"
    return_requests ||--o{ return_events : "history"
    return_requests ||--o{ comments : "conversation"
    return_requests ||--o{ attachments : "evidence"
    users ||--o{ notifications : "receives"
    return_requests |o--o{ notifications : "about"

    users {
        int id PK
        varchar name
        varchar email UK
        varchar password_hash
        varchar role "customer | employee | admin"
        bool active
        timestamptz created_at
    }
    user_sessions {
        int id PK
        int user_id FK
        varchar token_hash UK "sha256 of cookie"
        varchar csrf_token
        timestamptz expires_at
    }
    products {
        int id PK
        varchar sku UK
        varchar name
        varchar category
        numeric price "10,2"
        int warranty_days
        bool archived
    }
    purchases {
        int id PK
        int customer_id FK
        varchar order_number UK
        timestamptz purchased_at
    }
    purchase_items {
        int id PK
        int purchase_id FK
        int product_id FK
        int quantity "> 0"
        numeric unit_price "price at purchase"
    }
    return_requests {
        int id PK
        int purchase_item_id FK
        int customer_id FK
        int assigned_employee_id FK "nullable"
        varchar request_type "return | warranty"
        int quantity "> 0"
        varchar reason
        text description
        varchar requested_resolution "refund | replacement | repair"
        varchar status
        varchar decision "approved | rejected, nullable"
        text decision_reason
        text fulfillment_note
        timestamptz created_at
        timestamptz decided_at
        timestamptz fulfilled_at
        timestamptz closed_at
    }
    return_events {
        int id PK
        int request_id FK
        int actor_id FK
        varchar event_type
        varchar from_status
        varchar to_status
        text note
        timestamptz created_at
    }
    comments {
        int id PK
        int request_id FK
        int author_id FK
        text body
        bool is_internal "staff-only note"
    }
    attachments {
        int id PK
        int request_id FK
        int uploader_id FK
        varchar original_filename
        varchar storage_key UK
        varchar mime_type
        int size_bytes
    }
    notifications {
        int id PK
        int recipient_id FK
        int request_id FK "nullable"
        varchar message
        timestamptz read_at "nullable"
    }
    store_settings {
        int id PK "always 1"
        varchar store_name
        varchar support_email
        int return_window_days
        bool allow_customer_cancellation
        int max_attachments_per_request
    }
```

## Notes on the design

* **Money** is `NUMERIC(10,2)`, never float. `purchase_items.unit_price` keeps the price paid,
  so editing a product's price later doesn't change past orders.
* **Timestamps** are all `timestamptz` and written in UTC.
* **Enums** are stored as `VARCHAR` with `CHECK` constraints (SQLAlchemy `native_enum=False`).
  Adding a value later is a simple migration instead of an `ALTER TYPE`.
* **Indexes**: unique on `users.email`, `products.sku`, `purchases.order_number`; plain indexes on
  every foreign key plus `return_requests.status` and `return_requests.created_at` (queue filters
  and analytics both use them).
* **Extra columns beyond the blueprint**: `decision`, `decided_at`, `fulfilled_at`, `closed_at` make
  the analytics exact (approval trends by decision month, resolution time from `closed_at`) without
  re-reading the event log. `comments.is_internal` supports staff-only notes. `store_settings` holds
  the configurable return policy. `user_sessions` backs server-side sessions.
* **Returnable quantity** isn't stored; it's computed as
  `purchased quantity − Σ quantity of requests of the same type that aren't rejected or cancelled`.
  Return and warranty requests are counted separately.

## Seed data

`python -m app.seed --reset` creates deterministic fictional data: 1 admin, 5 employees
(one deactivated), 12 customers, 24 products in 6 categories, ~120 purchases and ~120 requests
spread over the last 12 months in every status. Dates are relative to the day you run it, so the
demo always has recent activity. All emails use the reserved `example.com` domain.
