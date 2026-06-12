"""CSV import/export: parsing, validation, grouping, and data isolation."""
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.inventory.models import StockLot
from apps.products.models import Product
from apps.purchasing.models import PurchaseOrder
from apps.sales.models import SalesOrder

pytestmark = pytest.mark.django_db


def _f(text, name="data.csv"):
    return SimpleUploadedFile(name, text.encode(), content_type="text/csv")


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------
def test_export_products_csv(auth, product, make_purchase):
    make_purchase(product, 100, 1)
    resp = auth.get("/api/export/products/")
    assert resp.status_code == 200
    assert resp["Content-Type"].startswith("text/csv")
    body = resp.content.decode()
    assert "quantity_on_hand" in body.splitlines()[0]
    assert product.sku in body


def test_import_template(auth):
    resp = auth.get("/api/import/products/template/")
    assert resp.status_code == 200
    assert resp.content.decode().splitlines()[0].strip() == "name,sku,description,unit"


# ---------------------------------------------------------------------------
# Products import
# ---------------------------------------------------------------------------
def test_import_products_preview_then_commit(auth, user):
    csv = "name,sku,unit\nKombucha,KB-1,L\nMatcha,MT-1,G\n"

    preview = auth.post("/api/import/products/", {"file": _f(csv)}, format="multipart")
    assert preview.status_code == 200
    assert preview.data["would_create"] == 2
    assert preview.data["created"] == 0
    assert Product.objects.filter(owner=user).count() == 0  # dry run wrote nothing

    commit = auth.post(
        "/api/import/products/", {"file": _f(csv), "dry_run": "false"}, format="multipart"
    )
    assert commit.data["created"] == 2
    assert Product.objects.filter(owner=user).count() == 2


def test_import_products_reports_duplicate_sku(auth, user):
    Product.objects.create(owner=user, name="X", sku="DUP", unit="UNIT")
    csv = "name,sku,unit\nNew,DUP,UNIT\n"
    resp = auth.post(
        "/api/import/products/", {"file": _f(csv), "dry_run": "false"}, format="multipart"
    )
    assert resp.data["created"] == 0
    assert resp.data["errors"]
    assert Product.objects.filter(owner=user).count() == 1  # all-or-nothing


def test_import_maps_loosely_named_headers(auth):
    csv = "Product Name,SKU,Unit\nKombucha,KB-9,L\n"
    resp = auth.post("/api/import/products/", {"file": _f(csv)}, format="multipart")
    assert resp.status_code == 200
    assert resp.data["mapping"]["name"] == "Product Name"
    assert resp.data["mapping"]["sku"] == "SKU"
    assert resp.data["would_create"] == 1
    assert not resp.data["errors"]


# ---------------------------------------------------------------------------
# Stock import
# ---------------------------------------------------------------------------
def test_import_stock(auth, user):
    product = Product.objects.create(owner=user, name="Beans", sku="BN-1", unit="KG")
    csv = "product_sku,quantity_received,unit_cost\nBN-1,50,2\n"
    resp = auth.post(
        "/api/import/stock/", {"file": _f(csv), "dry_run": "false"}, format="multipart"
    )
    assert resp.data["created"] == 1
    assert StockLot.objects.filter(owner=user, product=product).count() == 1


def test_import_stock_rejects_fractional_unit(auth, user):
    Product.objects.create(owner=user, name="Widget", sku="W-1", unit="UNIT")
    csv = "product_sku,quantity_received,unit_cost\nW-1,1.5,2\n"
    resp = auth.post(
        "/api/import/stock/", {"file": _f(csv), "dry_run": "false"}, format="multipart"
    )
    assert resp.data["created"] == 0
    assert resp.data["errors"]


def test_import_stock_cannot_reference_other_users_product(auth, user, other_user):
    Product.objects.create(owner=other_user, name="Secret", sku="SS-9", unit="UNIT")
    csv = "product_sku,quantity_received,unit_cost\nSS-9,10,1\n"
    resp = auth.post(
        "/api/import/stock/", {"file": _f(csv), "dry_run": "false"}, format="multipart"
    )
    assert resp.data["created"] == 0
    assert resp.data["errors"]


# ---------------------------------------------------------------------------
# Order import (grouped by reference)
# ---------------------------------------------------------------------------
def test_import_purchase_orders_grouped(auth, user):
    Product.objects.create(owner=user, name="A", sku="A-1", unit="UNIT")
    Product.objects.create(owner=user, name="B", sku="B-1", unit="UNIT")
    csv = (
        "reference,supplier,order_date,product_sku,quantity,unit_cost\n"
        "PO-1,Acme,2024-01-01,A-1,10,1\n"
        "PO-1,Acme,2024-01-01,B-1,5,2\n"
    )
    resp = auth.post(
        "/api/import/purchase-orders/", {"file": _f(csv), "dry_run": "false"}, format="multipart"
    )
    assert resp.data["created"] == 1  # two lines, one order
    assert PurchaseOrder.objects.get(owner=user).items.count() == 2


def test_import_sales_orders_allocates_and_rejects_oversell(auth, user):
    product = Product.objects.create(owner=user, name="A", sku="A-1", unit="UNIT")
    StockLot.objects.create(
        owner=user, product=product, unit_cost="1",
        quantity_received="10", quantity_remaining="10",
    )
    ok = "reference,order_date,product_sku,quantity,unit_price\nSO-1,2024-02-01,A-1,5,10\n"
    resp = auth.post(
        "/api/import/sales-orders/", {"file": _f(ok), "dry_run": "false"}, format="multipart"
    )
    assert resp.data["created"] == 1
    assert SalesOrder.objects.filter(owner=user).count() == 1

    bad = "reference,order_date,product_sku,quantity,unit_price\nSO-2,2024-02-01,A-1,999,10\n"
    resp = auth.post(
        "/api/import/sales-orders/", {"file": _f(bad), "dry_run": "false"}, format="multipart"
    )
    assert resp.data["created"] == 0
    assert resp.data["errors"]
    assert SalesOrder.objects.filter(owner=user).count() == 1  # nothing extra committed
