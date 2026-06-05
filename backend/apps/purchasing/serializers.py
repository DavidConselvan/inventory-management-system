from django.db import transaction
from rest_framework import serializers

from apps.inventory.services import create_lot_from_purchase_item
from apps.products.models import Product

from .models import PurchaseOrder, PurchaseOrderItem


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    line_total = serializers.DecimalField(
        max_digits=18, decimal_places=4, read_only=True
    )

    class Meta:
        model = PurchaseOrderItem
        fields = ["id", "product", "product_name", "quantity", "unit_cost", "line_total"]

    def validate_product(self, product):
        # Data isolation: you can only buy stock for your own products.
        request = self.context.get("request")
        if request and product.owner_id != request.user.id:
            raise serializers.ValidationError("Product not found.")
        return product


class PurchaseOrderSerializer(serializers.ModelSerializer):
    items = PurchaseOrderItemSerializer(many=True)
    total_cost = serializers.DecimalField(
        max_digits=18, decimal_places=4, read_only=True
    )

    class Meta:
        model = PurchaseOrder
        fields = [
            "id",
            "reference",
            "supplier",
            "order_date",
            "status",
            "notes",
            "items",
            "total_cost",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("A purchase order needs at least one item.")
        return items

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("items")
        order = PurchaseOrder.objects.create(**validated_data)
        for item_data in items_data:
            item = PurchaseOrderItem.objects.create(purchase_order=order, **item_data)
            # Receiving the item brings a costed batch into stock.
            create_lot_from_purchase_item(item)
        return order

    @transaction.atomic
    def update(self, instance, validated_data):
        # Line items are immutable once received (lots may already be sold);
        # only header fields can be edited. Add stock via a new purchase order.
        validated_data.pop("items", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance
