from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.analytics import product_financials
from apps.core.viewsets import OwnedModelViewSet

from .models import Product
from .serializers import ProductFinancialsSerializer, ProductSerializer


class ProductViewSet(OwnedModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    filterset_fields = ["unit"]
    search_fields = ["name", "sku", "description"]
    ordering_fields = ["name", "sku", "created_at"]

    @extend_schema(responses=ProductFinancialsSerializer)
    @action(detail=True, methods=["get"])
    def financials(self, request, pk=None):
        """Revenue, COGS, profit, margin and stock-on-hand for one product."""
        product = self.get_object()
        return Response(product_financials(product))
