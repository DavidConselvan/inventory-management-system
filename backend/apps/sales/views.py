from django.db import transaction
from django.db.models import DecimalField, F, OuterRef, Subquery, Sum
from django.db.models.functions import Coalesce

from apps.core.viewsets import OwnedModelViewSet
from apps.inventory.models import StockAllocation
from apps.inventory.services import release_allocations

from .models import SalesOrder, SalesOrderItem
from .serializers import SalesOrderSerializer

_money = DecimalField(max_digits=18, decimal_places=4)


class SalesOrderViewSet(OwnedModelViewSet):
    queryset = SalesOrder.objects.prefetch_related(
        "items__product", "items__allocations"
    ).all()
    serializer_class = SalesOrderSerializer
    filterset_fields = ["status", "customer"]
    search_fields = ["reference", "customer", "notes"]
    # revenue/profit are DB annotations (see get_queryset) so they're orderable.
    ordering_fields = ["order_date", "reference", "customer", "status", "revenue", "profit"]

    def get_queryset(self):
        # Aggregate revenue and COGS as correlated subqueries (not a multi-join
        # annotate) so the two sums don't fan out and double-count each other.
        revenue = (
            SalesOrderItem.objects.filter(sales_order=OuterRef("pk"))
            .values("sales_order")
            .annotate(t=Sum(F("quantity") * F("unit_price"), output_field=_money))
            .values("t")
        )
        cogs = (
            StockAllocation.objects.filter(sales_order_item__sales_order=OuterRef("pk"))
            .values("sales_order_item__sales_order")
            .annotate(t=Sum(F("quantity") * F("unit_cost"), output_field=_money))
            .values("t")
        )
        return (
            super()
            .get_queryset()
            .annotate(revenue=Coalesce(Subquery(revenue, output_field=_money), 0, output_field=_money))
            .annotate(cogs=Coalesce(Subquery(cogs, output_field=_money), 0, output_field=_money))
            .annotate(profit=F("revenue") - F("cogs"))
        )

    @transaction.atomic
    def perform_destroy(self, instance):
        # Return consumed stock to its lots before deleting the order, so the
        # inventory ledger stays consistent.
        for item in instance.items.all():
            release_allocations(item)
        instance.delete()
