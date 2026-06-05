from django.db import models

from apps.core.models import BaseOwnedModel


class Product(BaseOwnedModel):
    """A sellable item. Stock is held in StockLots; financials are derived."""

    class Unit(models.TextChoices):
        KG = "KG", "Kilogram"
        G = "G", "Gram"
        L = "L", "Liter"
        ML = "ML", "Milliliter"
        UNIT = "UNIT", "Unit"

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    sku = models.CharField(max_length=64)
    unit = models.CharField(max_length=8, choices=Unit.choices, default=Unit.UNIT)

    class Meta:
        ordering = ["name"]
        constraints = [
            # SKUs are unique per owner, not globally — two users may reuse codes.
            models.UniqueConstraint(
                fields=["owner", "sku"], name="unique_sku_per_owner"
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.sku})"
