from apps.core.viewsets import OwnedModelViewSet

from .models import PurchaseOrder
from .serializers import PurchaseOrderSerializer


class PurchaseOrderViewSet(OwnedModelViewSet):
    queryset = PurchaseOrder.objects.prefetch_related("items__product").all()
    serializer_class = PurchaseOrderSerializer
    filterset_fields = ["status", "supplier"]
    search_fields = ["reference", "supplier", "notes"]
    ordering_fields = ["order_date", "created_at"]
