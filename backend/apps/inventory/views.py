from rest_framework import mixins, viewsets

from apps.core.viewsets import OwnedQuerysetMixin

from .models import StockLot
from .serializers import StockLotSerializer


class StockLotViewSet(
    OwnedQuerysetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    """List/inspect stock lots and add stock manually.

    Lots are not editable or deletable through the API: their quantities are
    driven by purchases (which create them) and sales (which consume them via
    the FIFO ledger), so mutating them directly would corrupt COGS.
    """

    queryset = StockLot.objects.select_related("product").all()
    serializer_class = StockLotSerializer
    filterset_fields = ["product"]
    search_fields = ["lot_code", "product__name"]
    ordering_fields = ["received_date", "created_at", "quantity_remaining"]
