from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from apps.core.models import BaseOwnedModel, TimeStampedModel


class PurchaseOrder(BaseOwnedModel):
    """A purchase from a supplier. Receiving its items creates StockLots."""

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        RECEIVED = "RECEIVED", "Received"

    reference = models.CharField(max_length=64, blank=True)
    supplier = models.CharField(max_length=255, blank=True)
    order_date = models.DateField()
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.RECEIVED
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-order_date", "-id"]

    def __str__(self):
        return self.reference or f"PO #{self.pk}"

    @property
    def total_cost(self) -> Decimal:
        return sum((item.line_total for item in self.items.all()), Decimal("0"))


class PurchaseOrderItem(TimeStampedModel):
    """A single product line on a purchase order."""

    purchase_order = models.ForeignKey(
        PurchaseOrder, on_delete=models.CASCADE, related_name="items"
    )
    product = models.ForeignKey(
        "products.Product", on_delete=models.PROTECT, related_name="purchase_items"
    )
    quantity = models.DecimalField(
        max_digits=14, decimal_places=4, validators=[MinValueValidator(Decimal("0.0001"))]
    )
    unit_cost = models.DecimalField(
        max_digits=14, decimal_places=4, validators=[MinValueValidator(Decimal("0"))]
    )

    def __str__(self):
        return f"{self.quantity} x {self.product} @ {self.unit_cost}"

    @property
    def line_total(self) -> Decimal:
        return self.quantity * self.unit_cost
