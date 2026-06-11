"""Financial aggregation helpers.

Centralises the profit math so the product endpoint and the dashboard agree.
Margin is profit / COGS (so the spec's "buy 100 @ $1, sell 100 @ $10" yields
profit 900 and margin 900%).
"""
from decimal import Decimal

from django.db.models import DecimalField, ExpressionWrapper, F, Sum
from django.db.models.functions import Coalesce

from apps.inventory.models import StockAllocation, StockLot
from apps.purchasing.models import PurchaseOrderItem
from apps.sales.models import SalesOrderItem

ZERO = Decimal("0")
_money = DecimalField(max_digits=18, decimal_places=4)


def _sum(qs, expr):
    return qs.aggregate(v=Coalesce(Sum(expr, output_field=_money), ZERO, output_field=_money))["v"]


def _product_expr(field_a, field_b):
    return ExpressionWrapper(F(field_a) * F(field_b), output_field=_money)


def _margin(profit: Decimal, cost: Decimal):
    if cost and cost > 0:
        return (profit / cost * 100).quantize(Decimal("0.01"))
    return None


def _assemble(*, purchased_qty, purchased_cost, sold_qty, revenue, cogs, on_hand,
              inventory_value) -> dict:
    profit = revenue - cogs
    return {
        "purchased_quantity": purchased_qty,
        "purchased_cost": purchased_cost,
        "sold_quantity": sold_qty,
        "revenue": revenue,
        "cogs": cogs,
        "profit": profit,
        "margin_percent": _margin(profit, cogs),
        "quantity_on_hand": on_hand,
        "inventory_value": inventory_value,
    }


def financials_for(*, purchase_items, sales_items, allocations, lots) -> dict:
    return _assemble(
        purchased_qty=_sum(purchase_items, "quantity"),
        purchased_cost=_sum(purchase_items, _product_expr("quantity", "unit_cost")),
        sold_qty=_sum(sales_items, "quantity"),
        revenue=_sum(sales_items, _product_expr("quantity", "unit_price")),
        cogs=_sum(allocations, _product_expr("quantity", "unit_cost")),
        on_hand=_sum(lots, "quantity_remaining"),
        inventory_value=_sum(lots, _product_expr("quantity_remaining", "unit_cost")),
    )


def product_financials(product) -> dict:
    return financials_for(
        purchase_items=PurchaseOrderItem.objects.filter(product=product),
        sales_items=SalesOrderItem.objects.filter(product=product),
        allocations=StockAllocation.objects.filter(sales_order_item__product=product),
        lots=StockLot.objects.filter(product=product),
    )


def products_breakdown(products) -> dict:
    """Per-product financials for many products in a fixed number of grouped
    queries, keyed by product id (avoids a per-product query fan-out)."""
    ids = [p.pk for p in products]

    def grouped(qs, group, **annotations):
        return {r[group]: r for r in qs.values(group).annotate(**annotations)}

    purchased = grouped(
        PurchaseOrderItem.objects.filter(product_id__in=ids), "product",
        qty=Sum("quantity", output_field=_money),
        cost=Sum(_product_expr("quantity", "unit_cost"), output_field=_money),
    )
    sold = grouped(
        SalesOrderItem.objects.filter(product_id__in=ids), "product",
        qty=Sum("quantity", output_field=_money),
        revenue=Sum(_product_expr("quantity", "unit_price"), output_field=_money),
    )
    cogs = grouped(
        StockAllocation.objects.filter(sales_order_item__product_id__in=ids),
        "sales_order_item__product",
        v=Sum(_product_expr("quantity", "unit_cost"), output_field=_money),
    )
    lots = grouped(
        StockLot.objects.filter(product_id__in=ids), "product",
        on_hand=Sum("quantity_remaining", output_field=_money),
        inv=Sum(_product_expr("quantity_remaining", "unit_cost"), output_field=_money),
    )

    rows = {}
    for pid in ids:
        rows[pid] = _assemble(
            purchased_qty=purchased.get(pid, {}).get("qty") or ZERO,
            purchased_cost=purchased.get(pid, {}).get("cost") or ZERO,
            sold_qty=sold.get(pid, {}).get("qty") or ZERO,
            revenue=sold.get(pid, {}).get("revenue") or ZERO,
            cogs=cogs.get(pid, {}).get("v") or ZERO,
            on_hand=lots.get(pid, {}).get("on_hand") or ZERO,
            inventory_value=lots.get(pid, {}).get("inv") or ZERO,
        )
    return rows


def user_financials(user) -> dict:
    """Roll up every owned record for the dashboard headline numbers."""
    return financials_for(
        purchase_items=PurchaseOrderItem.objects.filter(purchase_order__owner=user),
        sales_items=SalesOrderItem.objects.filter(sales_order__owner=user),
        allocations=StockAllocation.objects.filter(sales_order_item__sales_order__owner=user),
        lots=StockLot.objects.filter(owner=user),
    )
