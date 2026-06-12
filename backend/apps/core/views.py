import json
import logging

from django.conf import settings
from django.http import StreamingHttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.products.models import Product
from apps.purchasing.models import PurchaseOrder
from apps.sales.models import SalesOrder

from .analytics import products_breakdown, revenue_timeseries, user_financials
from .assistant import assistant_error_message, run_assistant, stream_assistant
from .exports import EXPORTERS, csv_response
from .importing import ENTITY_SPECS, run_import, template_headers
from .serializers import (
    AssistantReplySerializer,
    AssistantRequestSerializer,
    DashboardSerializer,
)

logger = logging.getLogger(__name__)


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
            "trend": revenue_timeseries(user),
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
            logger.exception("Assistant request failed")
            return Response(
                {"detail": assistant_error_message(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"reply": reply})


class AssistantStreamView(APIView):
    """Streaming variant of JP: Server-Sent Events so the UI renders the reply
    token-by-token, followed by suggested follow-up questions."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=AssistantRequestSerializer, responses={200: OpenApiTypes.STR})
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

        history = [
            {"role": m["role"], "content": m["content"]}
            for m in serializer.validated_data.get("history", [])
        ][-10:]
        user = request.user

        def events():
            try:
                for event in stream_assistant(user, message, history):
                    yield f"data: {json.dumps(event)}\n\n"
            except Exception as exc:
                logger.exception("Assistant stream failed")
                detail = assistant_error_message(exc)
                yield f"data: {json.dumps({'type': 'error', 'detail': detail})}\n\n"
            yield 'data: {"type": "done"}\n\n'

        response = StreamingHttpResponse(events(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"  # don't let a proxy buffer the stream
        return response


class ExportView(APIView):
    """Download one of the user's entities as CSV."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: OpenApiTypes.STR})
    def get(self, request, entity):
        exporter = EXPORTERS.get(entity)
        if exporter is None:
            return Response({"detail": "Unknown entity."}, status=404)
        return exporter(request.user)


class ImportTemplateView(APIView):
    """Download a header-only CSV template for an entity."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: OpenApiTypes.STR})
    def get(self, request, entity):
        if entity not in ENTITY_SPECS:
            return Response({"detail": "Unknown entity."}, status=404)
        return csv_response(f"{entity}-template.csv", template_headers(entity), [])


class ImportView(APIView):
    """Import a CSV. ``dry_run`` (default true) previews without writing."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=OpenApiTypes.BINARY, responses={200: OpenApiTypes.OBJECT})
    def post(self, request, entity):
        if entity not in ENTITY_SPECS:
            return Response({"detail": "Unknown entity."}, status=404)
        upload = request.FILES.get("file")
        if upload is None:
            return Response({"detail": "A CSV file is required."}, status=400)
        dry_run = str(request.data.get("dry_run", "true")).lower() != "false"
        try:
            result = run_import(request.user, entity, upload, dry_run=dry_run)
        except Exception as exc:
            return Response({"detail": f"Could not read the file: {exc}"}, status=400)
        return Response(result)
