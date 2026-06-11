from django.db import transaction
from rest_framework import serializers

from apps.inventory.services import create_lot_from_purchase_item
from apps.products.models import Product
from apps.products.validators import check_whole_units

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

    def validate(self, attrs):
        check_whole_units(attrs.get("product"), attrs.get("quantity"))
        return attrs


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

    def _receive_items(self, order, items_data):
        for item_data in items_data:
            item = PurchaseOrderItem.objects.create(purchase_order=order, **item_data)
            create_lot_from_purchase_item(item)

    @staticmethod
    def _items_changed(instance, items_data):
        existing = [
            (i.product_id, i.quantity, i.unit_cost) for i in instance.items.all()
        ]
        incoming = [
            (d["product"].id, d["quantity"], d["unit_cost"]) for d in items_data
        ]
        return existing != incoming

    @staticmethod
    def _stock_consumed(instance):
        return any(
            lot.quantity_remaining != lot.quantity_received
            for item in instance.items.all()
            for lot in item.lots.all()
        )

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("items")
        order = PurchaseOrder.objects.create(**validated_data)
        self._receive_items(order, items_data)
        return order

    @transaction.atomic
    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None and self._items_changed(instance, items_data):
            if self._stock_consumed(instance):
                raise serializers.ValidationError(
                    {"items": "Stock from this order has already been sold, so its "
                              "lines can't be changed. Edit the header only."}
                )
            for item in instance.items.all():
                item.lots.all().delete()
            instance.items.all().delete()
            self._receive_items(instance, items_data)

        return PurchaseOrder.objects.get(pk=instance.pk)
