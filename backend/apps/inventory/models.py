import uuid
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from apps.core.models import BaseOwnedModel, TimeStampedModel


def generate_lot_code() -> str:
    return f"LOT-{uuid.uuid4().hex[:12].upper()}"


class StockLot(BaseOwnedModel):
    """A batch of stock for a product with its own cost basis.

    This is the "stock with a unique identifier". Lots come from purchase-order
    items or are added manually. Sales draw down ``quantity_remaining`` FIFO
    (oldest ``received_date`` first), so cost is attributed per batch.
    """

    product = models.ForeignKey(
        "products.Product", on_delete=models.PROTECT, related_name="lots"
    )
    lot_code = models.CharField(
        max_length=32, unique=True, default=generate_lot_code, editable=False
    )
    source_item = models.ForeignKey(
        "purchasing.PurchaseOrderItem",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lots",
    )
    unit_cost = models.DecimalField(
        max_digits=14, decimal_places=4, validators=[MinValueValidator(Decimal("0"))]
    )
    quantity_received = models.DecimalField(
        max_digits=14, decimal_places=4, validators=[MinValueValidator(Decimal("0.0001"))]
    )
    quantity_remaining = models.DecimalField(
        max_digits=14, decimal_places=4, validators=[MinValueValidator(Decimal("0"))]
    )
    received_date = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["received_date", "id"]  # FIFO order

    def __str__(self):
        return f"{self.lot_code} ({self.quantity_remaining} left)"

    @property
    def quantity_consumed(self) -> Decimal:
        return self.quantity_received - self.quantity_remaining

    @property
    def remaining_value(self) -> Decimal:
        return self.quantity_remaining * self.unit_cost


class StockAllocation(TimeStampedModel):
    """Records how much of a StockLot a sales-order item consumed.

    The FIFO ledger and COGS audit trail: ``cost`` per allocation is the lot's
    unit cost snapshotted at sale time; a sale item's COGS is the sum of these.
    """

    sales_order_item = models.ForeignKey(
        "sales.SalesOrderItem", on_delete=models.CASCADE, related_name="allocations"
    )
    stock_lot = models.ForeignKey(
        StockLot, on_delete=models.PROTECT, related_name="allocations"
    )
    quantity = models.DecimalField(
        max_digits=14, decimal_places=4, validators=[MinValueValidator(Decimal("0.0001"))]
    )
    unit_cost = models.DecimalField(max_digits=14, decimal_places=4)

    def __str__(self):
        return f"{self.quantity} from {self.stock_lot.lot_code}"

    @property
    def cost(self) -> Decimal:
        return self.quantity * self.unit_cost
