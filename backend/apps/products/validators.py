from rest_framework import serializers

from .models import Product


def check_whole_units(product, quantity, field="quantity"):
    """Discrete-unit products (unit = UNIT) can only move in whole numbers;
    mass and volume products (kg/g, L/mL) may be fractional."""
    if (
        product is not None
        and quantity is not None
        and product.unit == Product.Unit.UNIT
        and quantity != quantity.to_integral_value()
    ):
        raise serializers.ValidationError(
            {field: "This product is measured in whole units."}
        )
