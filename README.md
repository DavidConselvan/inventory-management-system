# Inventory Management System

A small operations platform for Food & Beverage CPG brands. You register
products, bring stock in with purchase orders, sell it with sales orders, and
see profit per product and across the whole business. Every user only sees their
own data.

The worked example from the brief (buy 100 units at $1, sell them at $10 for
$1,000 revenue, $900 profit, 900% margin) is reproduced by the demo seed and
checked by the test suite.

## Live demo

A live instance runs on Render's free tier, so the first request after it has
been idle can take 30-60s to wake up:

- App: https://inventory-frontend-47k5.onrender.com
- API docs (Swagger): https://inventory-backend-h9o5.onrender.com/api/docs/

Log in with `demo` / `demo12345`.

## Contents

- [Live demo](#live-demo)
- [Quick start (Docker)](#quick-start-docker)
- [Tech stack](#tech-stack)
- [Architecture and key decisions](#architecture-and-key-decisions)
- [Data model](#data-model)
- [How profit is calculated](#how-profit-is-calculated)
- [Project structure](#project-structure)
- [API reference](#api-reference)
- [Authentication and data isolation](#authentication-and-data-isolation)
- [Testing](#testing)
- [Local development without Docker](#local-development-without-docker)
- [Deployment (Render)](#deployment-render)
- [Known limitations and next steps](#known-limitations-and-next-steps)

## Quick start (Docker)

You only need Docker. From the repository root:

```bash
docker compose up --build
```

That brings up three services:

| Service    | URL                     | Notes                            |
| ---------- | ----------------------- | -------------------------------- |
| `db`       | localhost:5432          | PostgreSQL 16                    |
| `backend`  | http://localhost:8000   | Django REST API (auto-migrates)  |
| `frontend` | http://localhost:5173   | React app (Vite dev server)      |

On first start the backend seeds a demo account so the app isn't empty. Open
http://localhost:5173 and log in with:

```
username: demo
password: demo12345
```

Seeding only runs when the demo user doesn't already exist, so restarting won't
wipe anything. To reset back to the sample data:

```bash
docker compose exec backend python manage.py seed_demo
```

API docs (Swagger UI) live at http://localhost:8000/api/docs/. For the Django
admin, create a superuser with
`docker compose exec backend python manage.py createsuperuser`.

## Tech stack

Backend: Python 3.12, Django 5.2, Django REST Framework, PostgreSQL, SimpleJWT
for auth, drf-spectacular for the OpenAPI schema, django-filter, WhiteNoise and
Gunicorn. Tests use pytest and pytest-django.

Frontend: TypeScript and React 19 (Vite), Mantine for components, Tailwind for
the bits of utility styling Mantine doesn't cover, TanStack Query for server
state, Axios for HTTP, and React Router.

Infra: Docker Compose for local dev and a Render Blueprint (`render.yaml`) for
deployment.

## Architecture and key decisions

**Two independent pieces.** `backend/` and `frontend/` talk only over the REST
API, so either can be deployed or scaled on its own.

**Stock is tracked as lots, costed FIFO.** The brief says each stock has a unique
identifier and that "product stocks are sold", so I modelled stock as discrete
lots (`StockLot`), each with its own cost basis. A sale draws from the oldest
lots first and records exactly how much it took from each. That gives a precise
cost of goods sold per sale rather than a running-average approximation, matches
how batch-based food goods actually move, and leaves an audit trail. The
[profit section](#how-profit-is-calculated) walks through it.

**JWT auth.** A React SPA fits stateless bearer tokens well. SimpleJWT issues an
access and a refresh token; the frontend refreshes the access token on its own
when it expires.

**Data isolation is built into the base classes, not bolted on per view.** Every
owned model has an `owner` foreign key. A shared viewset base (`OwnedQuerysetMixin`)
filters every queryset to the current user and stamps the owner on create, and an
`IsOwner` object permission backs it up. Serializers also reject foreign keys
that point at another user's objects, so you can't, say, file a purchase order
against someone else's product.

**Business logic sits in plain functions, not views.** FIFO allocation is in
`apps/inventory/services.py` and the profit math is in `apps/core/analytics.py`.
Both are easy to unit test and are reused by the per-product endpoint and the
dashboard.

## Data model

```mermaid
erDiagram
    User ||--o{ Product : owns
    User ||--o{ PurchaseOrder : owns
    User ||--o{ SalesOrder : owns
    User ||--o{ StockLot : owns

    Product ||--o{ PurchaseOrderItem : "bought as"
    Product ||--o{ SalesOrderItem : "sold as"
    Product ||--o{ StockLot : "stocked as"

    PurchaseOrder ||--|{ PurchaseOrderItem : contains
    PurchaseOrderItem ||--o| StockLot : creates

    SalesOrder ||--|{ SalesOrderItem : contains
    SalesOrderItem ||--|{ StockAllocation : "drawn from"
    StockLot ||--o{ StockAllocation : "consumed by"

    User {
        bigint id PK
        string username
        string email
    }
    Product {
        bigint id PK
        bigint owner_id FK
        string name
        string description
        string sku "unique per owner"
        string unit "kg, g, L, mL, unit"
    }
    PurchaseOrder {
        bigint id PK
        bigint owner_id FK
        string reference
        string supplier
        date order_date
        string status
        string notes
    }
    PurchaseOrderItem {
        bigint id PK
        bigint purchase_order_id FK
        bigint product_id FK
        decimal quantity
        decimal unit_cost
    }
    StockLot {
        bigint id PK
        bigint owner_id FK
        bigint product_id FK
        bigint source_item_id FK "null when manual"
        string lot_code "unique"
        decimal unit_cost
        decimal quantity_received
        decimal quantity_remaining
        datetime received_date
    }
    SalesOrder {
        bigint id PK
        bigint owner_id FK
        string reference
        string customer
        date order_date
        string status
        string notes
    }
    SalesOrderItem {
        bigint id PK
        bigint sales_order_id FK
        bigint product_id FK
        decimal quantity
        decimal unit_price
    }
    StockAllocation {
        bigint id PK
        bigint sales_order_item_id FK
        bigint stock_lot_id FK
        decimal quantity
        decimal unit_cost "lot cost snapshot"
    }
```

Cardinality (crow's foot): `||--o{` is one-to-many, `||--|{` is one-to-one-or-more
(every order has at least one line), and `||--o|` is one-to-zero-or-one (a received
purchase line creates one lot; manually added lots have none). Every table also
has `created_at` and `updated_at` timestamps, omitted above for brevity.

- **Product**: name, description, SKU (unique per owner), and a unit. Units fall
  into three dimensions — mass (kg, g), volume (L, mL) and discrete count (unit);
  discrete-unit products are constrained to whole-number quantities.
- **PurchaseOrder / PurchaseOrderItem**: buying stock. Each received item creates
  a `StockLot`.
- **StockLot**: a batch with a `unit_cost`, `quantity_received`,
  `quantity_remaining`, `received_date` and a unique `lot_code`. Manually added
  stock is just a lot with no source purchase item.
- **SalesOrder / SalesOrderItem**: selling stock. Each item is filled FIFO.
- **StockAllocation**: the FIFO ledger row recording which lot a sale drew from,
  how much, and at what cost. A sale item's COGS is the sum of its allocations.

## How profit is calculated

When a sales-order item for some quantity is created, `allocate_stock_fifo` in
`apps/inventory/services.py`:

1. Locks the product's open lots (`select_for_update`) ordered oldest first.
2. Draws the quantity across those lots, writing one `StockAllocation` per lot it
   touches and decrementing each lot's remaining quantity.
3. Rejects the whole sale and rolls back if there isn't enough stock, so you
   can't oversell.

`apps/core/analytics.py` then derives the numbers for a product or the whole
account:

```
revenue = sum(sold_qty * unit_price)
cogs    = sum(allocation cost)        # the actual lot costs consumed
profit  = revenue - cogs
margin  = profit / cogs * 100         # 900% for the worked example
```

Editing or deleting a sales order stays consistent with this: it releases the
order's existing allocations (returning stock to the lots) and, on an edit,
re-allocates the new lines FIFO — the whole change rolls back if the new lines no
longer fit available stock. Purchase-order lines can only change while none of
their received stock has been sold.

## Project structure

```
backend/
  config/                 # settings (env-driven), urls, wsgi
  apps/
    core/                 # base owned model, owner-scoped viewset, IsOwner,
                          #   profit analytics, dashboard, seed_demo
    accounts/             # register / me / JWT endpoints
    products/             # Product + per-product financials endpoint
    purchasing/           # PurchaseOrder + items (creates stock lots)
    inventory/            # StockLot, StockAllocation, FIFO service
    sales/                # SalesOrder + items (consumes stock FIFO)
  tests/                  # pytest: FIFO, worked example, API, isolation
frontend/
  src/
    api/                  # axios client (JWT refresh) + typed TanStack hooks
    auth/                 # AuthProvider, token storage, ProtectedRoute
    components/           # app shell, data table, forms and reusable UI pieces
    pages/                # auth, dashboard, and list + detail pages per entity
docker-compose.yml        # db + backend + frontend for local dev
render.yaml               # one-click cloud deploy
```

## API reference

Base URL is `/api`. Resource endpoints need an `Authorization: Bearer <access>`
header.

The **Swagger UI** is auto-generated from the code by drf-spectacular, so it
always matches the running API. Browse it at `/api/docs/`
([live](https://inventory-backend-h9o5.onrender.com/api/docs/)); the raw OpenAPI
document is at `/api/schema/`.

### Auth

| Method | Path                   | Purpose                         |
| ------ | ---------------------- | ------------------------------- |
| POST   | `/auth/register/`      | Create an account               |
| POST   | `/auth/token/`         | Log in, returns access+refresh  |
| POST   | `/auth/token/refresh/` | Exchange a refresh token        |
| GET    | `/auth/me/`            | Current user                    |

### Resources (CRUD via viewsets, scoped to the current user)

| Path                         | Notes                                                     |
| ---------------------------- | --------------------------------------------------------- |
| `/products/`                 | CRUD. Search with `?search=`, filter with `?unit=`.       |
| `/products/{id}/financials/` | Revenue, COGS, profit, margin and on-hand for a product.  |
| `/stock-lots/`               | Full CRUD; POST adds stock manually, PUT corrects a lot.  |
| `/purchase-orders/`          | CRUD with nested `items`; receiving creates stock lots.   |
| `/sales-orders/`             | CRUD with nested `items`; selling and editing allocate FIFO. |
| `/dashboard/`                | Account-wide totals plus a per-product breakdown.         |

Create a purchase order and receive stock in one request:

```jsonc
POST /api/purchase-orders/
{
  "order_date": "2024-01-05",
  "supplier": "Acme Wholesale",
  "items": [{ "product": 1, "quantity": "100", "unit_cost": "1.00" }]
}
```

Record a sale (COGS is computed FIFO on the server):

```jsonc
POST /api/sales-orders/
{
  "order_date": "2024-02-01",
  "items": [{ "product": 1, "quantity": "100", "unit_price": "10.00" }]
}
// response includes total_revenue 1000, total_cogs 100, total_profit 900
```

## Authentication and data isolation

Logging in returns a short-lived access token (60 min) and a longer refresh
token (7 days), kept in `localStorage`. The Axios client in
`frontend/src/api/client.ts` adds the access token to every request; on a 401 it
uses the refresh token to get a new access token and retries the original
request, sharing one in-flight refresh so parallel requests don't each trigger
their own. If the refresh fails the session is cleared and the user goes back to
login.

On the server, every owned queryset is filtered to the requesting user and
serializers reject foreign keys to other users' objects. The data-isolation
tests cover both read and write paths.

## Testing

```bash
docker compose run --rm backend pytest -q
```

The suite focuses on the business logic and the API contract:

- FIFO and profit: the worked example, oldest-lot-first consumption across
  multiple lots, partial sales, and blended COGS.
- Guards: overselling is rejected and leaves stock untouched; deleting an
  in-use product returns 409 rather than erroring.
- Editing: sales-order edits re-allocate FIFO and roll back when stock no longer
  fits; stock lots are full CRUD; purchase-order lines lock once their stock
  sells; discrete-unit products reject fractional quantities.
- Aggregation: product- and dashboard-level revenue, COGS, profit and margin.
- Validation: SKU is unique per owner (and reusable across owners).
- API: auth is required, register/login works, orders are created and edited
  with their line items, and users can't see or touch each other's data.

## Local development without Docker

The backend needs Python 3.12+ and a PostgreSQL instance.

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # set POSTGRES_HOST=localhost, adjust as needed
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

```bash
cd frontend
npm install
echo "VITE_API_BASE_URL=http://localhost:8000/api" > .env.local
npm run dev
```

## Deployment (Render)

Live instance:

- App: https://inventory-frontend-47k5.onrender.com
- API + Swagger: https://inventory-backend-h9o5.onrender.com/api/docs/

`render.yaml` is a Render Blueprint: a managed Postgres database, the backend as
a Dockerised web service, and the frontend as a static site.

1. Push the repo to GitHub.
2. On Render, choose New, then Blueprint, and pick the repo.
3. After the first deploy, fill in the two cross-service URLs and redeploy:
   `CORS_ALLOWED_ORIGINS` on the backend points at the frontend URL, and
   `VITE_API_BASE_URL` on the frontend points at the backend URL plus `/api`.

Both services fit the free tier. On deploy the backend runs migrations, seeds
the demo account (so you can log in at the live URL with demo / demo12345), and
serves its static files through WhiteNoise. Note that free services cold-start
after a period of inactivity, so the first request may take a little while.

## Known limitations and next steps

- Sales orders are fully editable — an edit releases the order's FIFO
  allocations, returns the stock, and re-allocates the new lines, rejecting the
  change if stock no longer covers it. Purchase-order lines, by contrast, lock
  once any of their received stock has been sold (only the header stays editable
  then), because rewriting lots that downstream sales already drew from would
  corrupt historical COGS. Allowing a guided "rebuild with reconciliation" on
  consumed purchase orders would be a reasonable next step.
- Deleting a product that is referenced by orders or stock is blocked with a 409;
  remove the dependent orders first. Deleting a purchase order keeps the lots it
  brought in, since reversing received stock that may already be sold isn't safe.
- Margin is profit over COGS (markup), which is what the brief's 900% example
  asks for. Gross margin (profit over revenue) would be a one-line addition in
  `analytics.py`.
- Auth tokens are stored in `localStorage`. That keeps the client simple and
  survives refreshes and multiple tabs, but JavaScript can read it, so a
  cross-site-scripting hole could leak a token. The usual hardening is to keep
  the refresh token in an httpOnly, Secure, SameSite cookie and hold only a
  short-lived access token in memory, behind a strict content-security policy.
  I left it in `localStorage` here given the scope.
- Each product has one unit. Converting within a dimension (e.g. receiving a
  kilogram product in grams) would be a natural extension — the unit dimensions
  are already modelled, so it's mostly a conversion layer on input.
- Worth adding later: low-stock and expiry alerts for perishables, CSV
  import/export, rotating refresh tokens, and rate limiting.
