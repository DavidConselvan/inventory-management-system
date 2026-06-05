from rest_framework import serializers

from .models import Product


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "description",
            "sku",
            "unit",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate_sku(self, value):
        """Enforce per-owner SKU uniqueness with a friendly error (the DB
        constraint is the real guard; this gives a clean 400 instead of 500)."""
        request = self.context.get("request")
        if request is None:
            return value
        qs = Product.objects.filter(owner=request.user, sku=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("You already have a product with this SKU.")
        return value


class ProductFinancialsSerializer(serializers.Serializer):
    """Read-only shape of a product's financial summary (for schema/docs)."""

    purchased_quantity = serializers.DecimalField(max_digits=18, decimal_places=4)
    purchased_cost = serializers.DecimalField(max_digits=18, decimal_places=4)
    sold_quantity = serializers.DecimalField(max_digits=18, decimal_places=4)
    revenue = serializers.DecimalField(max_digits=18, decimal_places=4)
    cogs = serializers.DecimalField(max_digits=18, decimal_places=4)
    profit = serializers.DecimalField(max_digits=18, decimal_places=4)
    margin_percent = serializers.DecimalField(
        max_digits=18, decimal_places=2, allow_null=True
    )
    quantity_on_hand = serializers.DecimalField(max_digits=18, decimal_places=4)
    inventory_value = serializers.DecimalField(max_digits=18, decimal_places=4)
