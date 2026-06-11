from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.products.models import Product
from apps.purchasing.models import PurchaseOrder
from apps.sales.models import SalesOrder

from .analytics import products_breakdown, user_financials
from .serializers import DashboardSerializer


class DashboardView(APIView):
    """Financial overview for the current user: headline totals plus a
    per-product profit breakdown."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses=DashboardSerializer)
    def get(self, request):
        user = request.user
        products = list(Product.objects.filter(owner=user))
        breakdown = products_breakdown(products)

        rows = [
            {
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "unit": p.unit,
                **breakdown[p.id],
            }
            for p in products
        ]

        data = {
            "totals": user_financials(user),
            "products": rows,
            "product_count": len(products),
            "purchase_order_count": PurchaseOrder.objects.filter(owner=user).count(),
            "sales_order_count": SalesOrder.objects.filter(owner=user).count(),
        }
        # Serialize so decimals are formatted consistently with the rest of the API.
        return Response(DashboardSerializer(data).data)
