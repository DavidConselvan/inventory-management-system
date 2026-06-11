from django.db import transaction
from rest_framework import serializers

from apps.inventory.services import (
    InsufficientStockError,
    allocate_stock_fifo,
    release_allocations,
)
from apps.products.validators import check_whole_units

from .models import SalesOrder, SalesOrderItem


class SalesOrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    revenue = serializers.DecimalField(max_digits=18, decimal_places=4, read_only=True)
    cogs = serializers.DecimalField(max_digits=18, decimal_places=4, read_only=True)
    profit = serializers.DecimalField(max_digits=18, decimal_places=4, read_only=True)

    class Meta:
        model = SalesOrderItem
        fields = [
            "id",
            "product",
            "product_name",
            "quantity",
            "unit_price",
            "revenue",
            "cogs",
            "profit",
        ]

    def validate_product(self, product):
        request = self.context.get("request")
        if request and product.owner_id != request.user.id:
            raise serializers.ValidationError("Product not found.")
        return product

    def validate(self, attrs):
        check_whole_units(attrs.get("product"), attrs.get("quantity"))
        return attrs


class SalesOrderSerializer(serializers.ModelSerializer):
    items = SalesOrderItemSerializer(many=True)
    total_revenue = serializers.DecimalField(
        max_digits=18, decimal_places=4, read_only=True
    )
    total_cogs = serializers.DecimalField(
        max_digits=18, decimal_places=4, read_only=True
    )
    total_profit = serializers.DecimalField(
        max_digits=18, decimal_places=4, read_only=True
    )

    class Meta:
        model = SalesOrder
        fields = [
            "id",
            "reference",
            "customer",
            "order_date",
            "status",
            "notes",
            "items",
            "total_revenue",
            "total_cogs",
            "total_profit",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("A sales order needs at least one item.")
        return items

    def _allocate_items(self, order, items_data):
        for item_data in items_data:
            item = SalesOrderItem.objects.create(sales_order=order, **item_data)
            try:
                allocate_stock_fifo(item)
            except InsufficientStockError as exc:
                raise serializers.ValidationError({"items": str(exc)})

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("items")
        order = SalesOrder.objects.create(**validated_data)
        self._allocate_items(order, items_data)
        return order

    @transaction.atomic
    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None:
            # Return the old lines' stock to its lots, then re-sell from scratch
            # against current stock. If it no longer fits, the atomic block rolls
            # the whole edit back to the original sale.
            for item in instance.items.all():
                release_allocations(item)
            instance.items.all().delete()
            self._allocate_items(instance, items_data)

        return SalesOrder.objects.get(pk=instance.pk)
