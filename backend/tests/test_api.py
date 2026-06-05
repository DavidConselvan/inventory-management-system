"""API endpoint tests: auth, the end-to-end flow, and data isolation."""
import pytest
from rest_framework.test import APIClient

from apps.products.models import Product

pytestmark = pytest.mark.django_db

PRODUCTS = "/api/products/"
PURCHASE_ORDERS = "/api/purchase-orders/"
SALES_ORDERS = "/api/sales-orders/"
STOCK_LOTS = "/api/stock-lots/"


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
def test_authentication_required(api):
    assert api.get(PRODUCTS).status_code == 401


def test_register_then_login_then_me(api):
    resp = api.post(
        "/api/auth/register/",
        {"username": "carol", "email": "c@example.com", "password": "pw-strong-123"},
        format="json",
    )
    assert resp.status_code == 201

    resp = api.post(
        "/api/auth/token/",
        {"username": "carol", "password": "pw-strong-123"},
        format="json",
    )
    assert resp.status_code == 200
    access = resp.data["access"]

    api.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    me = api.get("/api/auth/me/")
    assert me.status_code == 200
    assert me.data["username"] == "carol"


# ---------------------------------------------------------------------------
# CRUD + end-to-end flow
# ---------------------------------------------------------------------------
def test_create_product_sets_owner(auth, user):
    resp = auth.post(
        PRODUCTS, {"name": "Kombucha", "sku": "KB-1", "unit": "L"}, format="json"
    )
    assert resp.status_code == 201
    product = Product.objects.get(id=resp.data["id"])
    assert product.owner == user


def test_duplicate_sku_returns_400(auth):
    auth.post(PRODUCTS, {"name": "A", "sku": "X1", "unit": "UNIT"}, format="json")
    resp = auth.post(PRODUCTS, {"name": "B", "sku": "X1", "unit": "UNIT"}, format="json")
    assert resp.status_code == 400


def test_purchase_order_creates_stock_lot(auth):
    product = auth.post(
        PRODUCTS, {"name": "Beans", "sku": "BN-1", "unit": "KG"}, format="json"
    ).data

    resp = auth.post(
        PURCHASE_ORDERS,
        {
            "order_date": "2024-01-01",
            "items": [{"product": product["id"], "quantity": "100", "unit_cost": "1"}],
        },
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["total_cost"] == "100.0000"

    lots = auth.get(STOCK_LOTS).data["results"]
    assert len(lots) == 1
    assert lots[0]["quantity_remaining"] == "100.0000"


def test_end_to_end_sale_computes_profit(auth):
    """Full flow through the API reproduces the worked example."""
    product = auth.post(
        PRODUCTS, {"name": "Beans", "sku": "BN-2", "unit": "KG"}, format="json"
    ).data
    auth.post(
        PURCHASE_ORDERS,
        {
            "order_date": "2024-01-01",
            "items": [{"product": product["id"], "quantity": "100", "unit_cost": "1"}],
        },
        format="json",
    )

    resp = auth.post(
        SALES_ORDERS,
        {
            "order_date": "2024-02-01",
            "items": [{"product": product["id"], "quantity": "100", "unit_price": "10"}],
        },
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["total_revenue"] == "1000.0000"
    assert resp.data["total_cogs"] == "100.0000"
    assert resp.data["total_profit"] == "900.0000"

    dash = auth.get("/api/dashboard/").data
    assert dash["totals"]["profit"] == "900.0000"
    assert dash["totals"]["margin_percent"] == "900.00"


def test_oversell_returns_400(auth):
    product = auth.post(
        PRODUCTS, {"name": "Beans", "sku": "BN-3", "unit": "KG"}, format="json"
    ).data
    auth.post(
        PURCHASE_ORDERS,
        {
            "order_date": "2024-01-01",
            "items": [{"product": product["id"], "quantity": "10", "unit_cost": "1"}],
        },
        format="json",
    )
    resp = auth.post(
        SALES_ORDERS,
        {
            "order_date": "2024-02-01",
            "items": [{"product": product["id"], "quantity": "11", "unit_price": "10"}],
        },
        format="json",
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Data isolation
# ---------------------------------------------------------------------------
def test_user_cannot_see_others_products(auth, user, other_user):
    mine = auth.post(
        PRODUCTS, {"name": "Mine", "sku": "M-1", "unit": "UNIT"}, format="json"
    ).data

    bob = APIClient()
    bob.force_authenticate(other_user)

    assert bob.get(PRODUCTS).data["count"] == 0
    assert bob.get(f"{PRODUCTS}{mine['id']}/").status_code == 404


def test_user_cannot_buy_for_others_product(auth, user, other_user):
    mine = auth.post(
        PRODUCTS, {"name": "Mine", "sku": "M-2", "unit": "UNIT"}, format="json"
    ).data

    bob = APIClient()
    bob.force_authenticate(other_user)
    resp = bob.post(
        PURCHASE_ORDERS,
        {
            "order_date": "2024-01-01",
            "items": [{"product": mine["id"], "quantity": "5", "unit_cost": "1"}],
        },
        format="json",
    )
    assert resp.status_code == 400
