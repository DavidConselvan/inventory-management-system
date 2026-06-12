from rest_framework import serializers

from apps.products.serializers import ProductFinancialsSerializer


class ProductFinancialRowSerializer(ProductFinancialsSerializer):
    """A product's identity plus its financial summary, for the dashboard table."""

    id = serializers.IntegerField()
    name = serializers.CharField()
    sku = serializers.CharField()
    unit = serializers.CharField()


class AssistantMessageSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=["user", "assistant"])
    content = serializers.CharField()


class AssistantRequestSerializer(serializers.Serializer):
    message = serializers.CharField()
    history = AssistantMessageSerializer(many=True, required=False)


class AssistantReplySerializer(serializers.Serializer):
    reply = serializers.CharField()


class TrendPointSerializer(serializers.Serializer):
    """One month of the revenue / COGS / profit / margin time series."""

    period = serializers.CharField()
    label = serializers.CharField()
    revenue = serializers.DecimalField(max_digits=18, decimal_places=4)
    cogs = serializers.DecimalField(max_digits=18, decimal_places=4)
    profit = serializers.DecimalField(max_digits=18, decimal_places=4)
    margin_percent = serializers.DecimalField(
        max_digits=18, decimal_places=2, allow_null=True
    )


class DashboardSerializer(serializers.Serializer):
    totals = ProductFinancialsSerializer()
    products = ProductFinancialRowSerializer(many=True)
    trend = TrendPointSerializer(many=True)
    product_count = serializers.IntegerField()
    purchase_order_count = serializers.IntegerField()
    sales_order_count = serializers.IntegerField()
