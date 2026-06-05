from rest_framework import serializers

from apps.products.serializers import ProductFinancialsSerializer


class ProductFinancialRowSerializer(ProductFinancialsSerializer):
    """A product's identity plus its financial summary, for the dashboard table."""

    id = serializers.IntegerField()
    name = serializers.CharField()
    sku = serializers.CharField()
    unit = serializers.CharField()


class DashboardSerializer(serializers.Serializer):
    totals = ProductFinancialsSerializer()
    products = ProductFinancialRowSerializer(many=True)
    product_count = serializers.IntegerField()
    purchase_order_count = serializers.IntegerField()
    sales_order_count = serializers.IntegerField()
