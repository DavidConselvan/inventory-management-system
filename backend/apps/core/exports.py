"""CSV exports for the four core entities, scoped to one user."""
import csv
import io

from django.http import HttpResponse

from apps.inventory.models import StockLot
from apps.products.models import Product
from apps.purchasing.models import PurchaseOrder
from apps.sales.models import SalesOrder

from .analytics import products_breakdown


def csv_response(filename: str, header: list, rows: list) -> HttpResponse:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    writer.writerows(rows)
    response = HttpResponse(buffer.getvalue(), content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def export_products(user) -> HttpResponse:
    products = list(Product.objects.filter(owner=user))
    breakdown = products_breakdown(products)
    header = [
        "name", "sku", "unit", "description",
        "quantity_on_hand", "revenue", "cogs", "profit", "margin_percent",
    ]
    rows = []
    for p in products:
        b = breakdown[p.id]
        rows.append([
            p.name, p.sku, p.unit, p.description,
            b["quantity_on_hand"], b["revenue"], b["cogs"], b["profit"],
            b["margin_percent"] if b["margin_percent"] is not None else "",
        ])
    return csv_response("products.csv", header, rows)


def export_stock(user) -> HttpResponse:
    lots = StockLot.objects.filter(owner=user).select_related("product")
    header = [
        "lot_code", "product_sku", "product_name", "unit_cost",
        "quantity_received", "quantity_remaining", "received_date",
    ]
    rows = [
        [
            lot.lot_code, lot.product.sku, lot.product.name, lot.unit_cost,
            lot.quantity_received, lot.quantity_remaining,
            lot.received_date.date().isoformat(),
        ]
        for lot in lots
    ]
    return csv_response("stock.csv", header, rows)


def export_purchase_orders(user) -> HttpResponse:
    orders = PurchaseOrder.objects.filter(owner=user).prefetch_related("items__product")
    header = [
        "reference", "supplier", "order_date", "status",
        "product_sku", "product_name", "quantity", "unit_cost", "line_total",
    ]
    rows = []
    for o in orders:
        for item in o.items.all():
            rows.append([
                o.reference, o.supplier, o.order_date.isoformat(), o.status,
                item.product.sku, item.product.name, item.quantity,
                item.unit_cost, item.line_total,
            ])
    return csv_response("purchase_orders.csv", header, rows)


def export_sales_orders(user) -> HttpResponse:
    orders = SalesOrder.objects.filter(owner=user).prefetch_related(
        "items__product", "items__allocations"
    )
    header = [
        "reference", "customer", "order_date", "status",
        "product_sku", "product_name", "quantity", "unit_price",
        "revenue", "cogs", "profit",
    ]
    rows = []
    for o in orders:
        for item in o.items.all():
            rows.append([
                o.reference, o.customer, o.order_date.isoformat(), o.status,
                item.product.sku, item.product.name, item.quantity, item.unit_price,
                item.revenue, item.cogs, item.profit,
            ])
    return csv_response("sales_orders.csv", header, rows)


EXPORTERS = {
    "products": export_products,
    "stock": export_stock,
    "purchase-orders": export_purchase_orders,
    "sales-orders": export_sales_orders,
}
