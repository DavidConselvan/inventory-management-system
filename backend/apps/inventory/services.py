"""Inventory allocation logic (FIFO costing).

Sales consume stock from the oldest lots first. Each consumption is recorded
as a StockAllocation carrying the lot's unit cost, so the cost of goods sold
for a sale is the exact, auditable sum of the lots it drew from.
"""
from datetime import datetime, time
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from .models import StockAllocation, StockLot


def create_lot_from_purchase_item(item):
    """Create the StockLot that a received purchase-order item brings into stock.

    The lot's ``received_date`` is derived from the PO's ``order_date`` so FIFO
    consumption respects the real purchase chronology, not row-insert order.
    """
    po = item.purchase_order
    received = timezone.make_aware(datetime.combine(po.order_date, time.min))
    return StockLot.objects.create(
        owner=po.owner,
        product=item.product,
        source_item=item,
        unit_cost=item.unit_cost,
        quantity_received=item.quantity,
        quantity_remaining=item.quantity,
        received_date=received,
    )


class InsufficientStockError(Exception):
    """Raised when a sale requests more units than are in stock."""

    def __init__(self, product, requested, available):
        self.product = product
        self.requested = requested
        self.available = available
        super().__init__(
            f"Insufficient stock for '{product}': requested {requested}, "
            f"only {available} available."
        )


@transaction.atomic
def allocate_stock_fifo(sales_order_item):
    """Draw ``sales_order_item.quantity`` from the product's lots, oldest first.

    Locks the candidate lots for the duration of the transaction to prevent two
    concurrent sales from overselling the same stock. Creates one
    StockAllocation per touched lot and decrements each lot's remaining qty.
    """
    item = sales_order_item
    owner = item.sales_order.owner

    lots = list(
        StockLot.objects.select_for_update()
        .filter(owner=owner, product=item.product, quantity_remaining__gt=0)
        .order_by("received_date", "id")
    )

    available = sum((lot.quantity_remaining for lot in lots), Decimal("0"))
    if available < item.quantity:
        raise InsufficientStockError(item.product, item.quantity, available)

    remaining = item.quantity
    allocations = []
    for lot in lots:
        if remaining <= 0:
            break
        take = min(lot.quantity_remaining, remaining)
        allocations.append(
            StockAllocation(
                sales_order_item=item,
                stock_lot=lot,
                quantity=take,
                unit_cost=lot.unit_cost,
            )
        )
        lot.quantity_remaining -= take
        lot.save(update_fields=["quantity_remaining", "updated_at"])
        remaining -= take

    StockAllocation.objects.bulk_create(allocations)
    return allocations


@transaction.atomic
def release_allocations(sales_order_item):
    """Return a sale item's consumed quantities to their lots, then delete the
    allocations. Used when a sales-order item is edited or deleted so the FIFO
    ledger stays consistent."""
    allocations = list(
        StockAllocation.objects.select_for_update()
        .filter(sales_order_item=sales_order_item)
    )
    for alloc in allocations:
        lot = StockLot.objects.select_for_update().get(pk=alloc.stock_lot_id)
        lot.quantity_remaining += alloc.quantity
        lot.save(update_fields=["quantity_remaining", "updated_at"])
    StockAllocation.objects.filter(sales_order_item=sales_order_item).delete()
