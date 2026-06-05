from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from apps.core.models import BaseOwnedModel, TimeStampedModel


class SalesOrder(BaseOwnedModel):
    """A sale to a customer. Its items consume StockLots (FIFO)."""

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        CONFIRMED = "CONFIRMED", "Confirmed"

    reference = models.CharField(max_length=64, blank=True)
    customer = models.CharField(max_length=255, blank=True)
    order_date = models.DateField()
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.CONFIRMED
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-order_date", "-id"]

    def __str__(self):
        return self.reference or f"SO #{self.pk}"

    @property
    def total_revenue(self) -> Decimal:
        return sum((item.revenue for item in self.items.all()), Decimal("0"))

    @property
    def total_cogs(self) -> Decimal:
        return sum((item.cogs for item in self.items.all()), Decimal("0"))

    @property
    def total_profit(self) -> Decimal:
        return self.total_revenue - self.total_cogs


class SalesOrderItem(TimeStampedModel):
    """A single product line on a sales order.

    On creation the inventory service allocates StockLots FIFO and records the
    cost via StockAllocation rows, so COGS is the exact cost of the lots drawn.
    """

    sales_order = models.ForeignKey(
        SalesOrder, on_delete=models.CASCADE, related_name="items"
    )
    product = models.ForeignKey(
        "products.Product", on_delete=models.PROTECT, related_name="sales_items"
    )
    quantity = models.DecimalField(
        max_digits=14, decimal_places=4, validators=[MinValueValidator(Decimal("0.0001"))]
    )
    unit_price = models.DecimalField(
        max_digits=14, decimal_places=4, validators=[MinValueValidator(Decimal("0"))]
    )

    def __str__(self):
        return f"{self.quantity} x {self.product} @ {self.unit_price}"

    @property
    def revenue(self) -> Decimal:
        return self.quantity * self.unit_price

    @property
    def cogs(self) -> Decimal:
        """Cost of goods sold = sum of the cost of every lot allocation."""
        return sum((a.cost for a in self.allocations.all()), Decimal("0"))

    @property
    def profit(self) -> Decimal:
        return self.revenue - self.cogs
