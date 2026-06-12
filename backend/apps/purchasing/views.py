from django.db.models import DecimalField, F, Sum
from django.db.models.functions import Coalesce

from apps.core.viewsets import OwnedModelViewSet

from .models import PurchaseOrder
from .serializers import PurchaseOrderSerializer

_money = DecimalField(max_digits=18, decimal_places=4)


class PurchaseOrderViewSet(OwnedModelViewSet):
    queryset = PurchaseOrder.objects.prefetch_related("items__product").all()
    serializer_class = PurchaseOrderSerializer
    filterset_fields = ["status", "supplier"]
    search_fields = ["reference", "supplier", "notes"]
    ordering_fields = ["order_date", "reference", "supplier", "status", "cost_total"]

    def get_queryset(self):
        # One aggregated relation (items), so a plain annotate is safe here.
        return super().get_queryset().annotate(
            cost_total=Coalesce(
                Sum(F("items__quantity") * F("items__unit_cost"), output_field=_money),
                0,
                output_field=_money,
            )
        )
