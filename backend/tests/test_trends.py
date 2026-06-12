"""Historical revenue/COGS/profit/margin time series for the dashboard."""
from datetime import date
from decimal import Decimal

import pytest

from apps.core.analytics import revenue_timeseries
from apps.inventory.services import allocate_stock_fifo
from apps.sales.models import SalesOrder, SalesOrderItem

pytestmark = pytest.mark.django_db


def _sell(product, quantity, unit_price, when):
    so = SalesOrder.objects.create(owner=product.owner, order_date=when)
    item = SalesOrderItem.objects.create(
        sales_order=so,
        product=product,
        quantity=Decimal(quantity),
        unit_price=Decimal(unit_price),
    )
    allocate_stock_fifo(item)
    return so


def test_timeseries_buckets_by_month_and_fills_gaps(product, make_purchase):
    make_purchase(product, 100, 1)  # 100 units @ $1 cost
    _sell(product, 10, 10, date(2024, 1, 15))  # Jan: rev 100, cogs 10, profit 90
    _sell(product, 20, 10, date(2024, 3, 10))  # Mar: rev 200, cogs 20, profit 180

    series = revenue_timeseries(product.owner)

    # February has no sales but is filled so the chart line stays continuous.
    assert [p["label"] for p in series] == ["Jan 2024", "Feb 2024", "Mar 2024"]
    assert series[0]["revenue"] == Decimal("100")
    assert series[0]["profit"] == Decimal("90")
    assert series[0]["margin_percent"] == Decimal("900.00")
    assert series[1]["revenue"] == Decimal("0")
    assert series[1]["margin_percent"] is None  # no COGS that month
    assert series[2]["profit"] == Decimal("180")


def test_timeseries_empty_without_sales(product):
    assert revenue_timeseries(product.owner) == []
