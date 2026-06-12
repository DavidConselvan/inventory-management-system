from django.db.models import DecimalField, ExpressionWrapper, F

from apps.core.viewsets import OwnedModelViewSet

from .models import StockLot
from .serializers import StockLotSerializer

_money = DecimalField(max_digits=18, decimal_places=4)


class StockLotViewSet(OwnedModelViewSet):
    """CRUD for stock lots. A lot sales have already drawn from can't be deleted
    (returns 409), so cost of goods sold stays consistent."""

    queryset = StockLot.objects.select_related("product").all()
    serializer_class = StockLotSerializer
    filterset_fields = ["product"]
    search_fields = ["lot_code", "product__name"]
    ordering_fields = [
        "lot_code",
        "received_date",
        "unit_cost",
        "quantity_received",
        "quantity_remaining",
        "value",
    ]

    def get_queryset(self):
        return super().get_queryset().annotate(
            value=ExpressionWrapper(
                F("quantity_remaining") * F("unit_cost"), output_field=_money
            )
        )
