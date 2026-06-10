from apps.core.viewsets import OwnedModelViewSet

from .models import StockLot
from .serializers import StockLotSerializer


class StockLotViewSet(OwnedModelViewSet):
    """CRUD for stock lots. A lot sales have already drawn from can't be deleted
    (returns 409), so cost of goods sold stays consistent."""

    queryset = StockLot.objects.select_related("product").all()
    serializer_class = StockLotSerializer
    filterset_fields = ["product"]
    search_fields = ["lot_code", "product__name"]
    ordering_fields = ["received_date", "created_at", "quantity_remaining"]
