from django.db import transaction

from apps.core.viewsets import OwnedModelViewSet
from apps.inventory.services import release_allocations

from .models import SalesOrder
from .serializers import SalesOrderSerializer


class SalesOrderViewSet(OwnedModelViewSet):
    queryset = SalesOrder.objects.prefetch_related(
        "items__product", "items__allocations"
    ).all()
    serializer_class = SalesOrderSerializer
    filterset_fields = ["status", "customer"]
    search_fields = ["reference", "customer", "notes"]
    ordering_fields = ["order_date", "created_at"]

    @transaction.atomic
    def perform_destroy(self, instance):
        # Return consumed stock to its lots before deleting the order, so the
        # inventory ledger stays consistent.
        for item in instance.items.all():
            release_allocations(item)
        instance.delete()
