from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.products.models import Product
from apps.purchasing.models import PurchaseOrder
from apps.sales.models import SalesOrder

from .analytics import products_breakdown, user_financials
from .assistant import run_assistant
from .serializers import (
    AssistantReplySerializer,
    AssistantRequestSerializer,
    DashboardSerializer,
)


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


class AssistantView(APIView):
    """JP, the AI ops assistant: answers questions over the user's own data."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=AssistantRequestSerializer, responses=AssistantReplySerializer)
    def post(self, request):
        if not settings.ANTHROPIC_API_KEY:
            return Response(
                {"detail": "The assistant isn't configured (no ANTHROPIC_API_KEY)."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        serializer = AssistantRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = serializer.validated_data["message"].strip()
        if not message:
            return Response({"detail": "message is required"}, status=400)

        # Cap and normalize prior turns for context.
        history = [
            {"role": m["role"], "content": m["content"]}
            for m in serializer.validated_data.get("history", [])
        ][-10:]

        try:
            reply = run_assistant(request.user, message, history)
        except Exception as exc:
            return Response(
                {"detail": f"Assistant error: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"reply": reply})
