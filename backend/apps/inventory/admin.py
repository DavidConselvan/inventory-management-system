from django.contrib import admin

from .models import StockAllocation, StockLot


@admin.register(StockLot)
class StockLotAdmin(admin.ModelAdmin):
    list_display = [
        "lot_code",
        "product",
        "unit_cost",
        "quantity_received",
        "quantity_remaining",
        "received_date",
        "owner",
    ]
    search_fields = ["lot_code", "product__name"]


@admin.register(StockAllocation)
class StockAllocationAdmin(admin.ModelAdmin):
    list_display = ["stock_lot", "sales_order_item", "quantity", "unit_cost"]
