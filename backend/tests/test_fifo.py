"""Core business logic: FIFO allocation and profit math."""
from datetime import date
from decimal import Decimal

import pytest

from apps.core.analytics import product_financials
from apps.inventory.models import StockLot
from apps.inventory.services import InsufficientStockError, allocate_stock_fifo
from apps.sales.models import SalesOrder, SalesOrderItem

pytestmark = pytest.mark.django_db


def sell(product, quantity, unit_price):
    so = SalesOrder.objects.create(owner=product.owner, order_date=date(2024, 2, 1))
    item = SalesOrderItem.objects.create(
        sales_order=so,
        product=product,
        quantity=Decimal(quantity),
        unit_price=Decimal(unit_price),
    )
    allocate_stock_fifo(item)
    return item


def test_worked_example(product, make_purchase):
    """The spec scenario: buy 100 @ $1, sell 100 @ $10 -> profit 900, margin 900%."""
    make_purchase(product, 100, 1)
    item = sell(product, 100, 10)

    assert item.revenue == Decimal("1000")
    assert item.cogs == Decimal("100")
    assert item.profit == Decimal("900")

    fin = product_financials(product)
    assert fin["revenue"] == Decimal("1000")
    assert fin["cogs"] == Decimal("100")
    assert fin["profit"] == Decimal("900")
    assert fin["margin_percent"] == Decimal("900.00")
    assert fin["quantity_on_hand"] == Decimal("0")


def test_fifo_consumes_oldest_lot_first(product, make_purchase):
    """Two lots at different costs; a sale spanning both takes the cheaper
    (older) lot fully before touching the newer one."""
    make_purchase(product, 100, 1, order_date=date(2024, 1, 1))   # lot A: 100 @ $1
    make_purchase(product, 100, 2, order_date=date(2024, 1, 15))  # lot B: 100 @ $2

    item = sell(product, 150, 10)  # 100 from A, 50 from B

    # COGS = 100*1 + 50*2 = 200
    assert item.cogs == Decimal("200")
    assert item.revenue == Decimal("1500")
    assert item.profit == Decimal("1300")

    lot_a, lot_b = StockLot.objects.order_by("received_date")
    assert lot_a.quantity_remaining == Decimal("0")
    assert lot_b.quantity_remaining == Decimal("50")


def test_overselling_is_rejected(product, make_purchase):
    make_purchase(product, 10, 1)
    with pytest.raises(InsufficientStockError):
        sell(product, 11, 10)


def test_overselling_leaves_stock_untouched(product, make_purchase):
    make_purchase(product, 10, 1)
    with pytest.raises(InsufficientStockError):
        sell(product, 11, 10)
    lot = StockLot.objects.get()
    assert lot.quantity_remaining == Decimal("10")


def test_partial_sale_reports_only_sold_cost(product, make_purchase):
    """Selling half leaves the rest as on-hand inventory value, and COGS only
    reflects what was actually sold."""
    make_purchase(product, 100, 1)
    sell(product, 40, 10)

    fin = product_financials(product)
    assert fin["sold_quantity"] == Decimal("40")
    assert fin["cogs"] == Decimal("40")
    assert fin["revenue"] == Decimal("400")
    assert fin["profit"] == Decimal("360")
    assert fin["quantity_on_hand"] == Decimal("60")
    assert fin["inventory_value"] == Decimal("60")
