from rest_framework import serializers

from .models import StockAllocation, StockLot


class StockAllocationSerializer(serializers.ModelSerializer):
    lot_code = serializers.CharField(source="stock_lot.lot_code", read_only=True)
    cost = serializers.DecimalField(max_digits=18, decimal_places=4, read_only=True)

    class Meta:
        model = StockAllocation
        fields = ["id", "stock_lot", "lot_code", "quantity", "unit_cost", "cost"]


class StockLotSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    quantity_consumed = serializers.DecimalField(
        max_digits=18, decimal_places=4, read_only=True
    )
    remaining_value = serializers.DecimalField(
        max_digits=18, decimal_places=4, read_only=True
    )

    class Meta:
        model = StockLot
        fields = [
            "id",
            "product",
            "product_name",
            "lot_code",
            "source_item",
            "unit_cost",
            "quantity_received",
            "quantity_remaining",
            "quantity_consumed",
            "remaining_value",
            "received_date",
            "created_at",
        ]
        # quantity_remaining is server-managed; on manual add it mirrors received.
        read_only_fields = [
            "lot_code",
            "source_item",
            "quantity_remaining",
            "created_at",
        ]

    def validate_product(self, product):
        request = self.context.get("request")
        if request and product.owner_id != request.user.id:
            raise serializers.ValidationError("Product not found.")
        return product

    def create(self, validated_data):
        # Manually-added stock starts fully available.
        validated_data["quantity_remaining"] = validated_data["quantity_received"]
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("product", None)
        consumed = instance.quantity_received - instance.quantity_remaining
        new_received = validated_data.get("quantity_received", instance.quantity_received)
        if new_received < consumed:
            raise serializers.ValidationError(
                {
                    "quantity_received": (
                        f"Can't drop below {consumed}, the amount already sold "
                        "from this lot."
                    )
                }
            )

        instance = super().update(instance, validated_data)
        instance.quantity_remaining = new_received - consumed
        instance.save(update_fields=["quantity_remaining", "updated_at"])
        return instance
