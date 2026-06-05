from django.contrib import admin

from .models import SalesOrder, SalesOrderItem


class SalesOrderItemInline(admin.TabularInline):
    model = SalesOrderItem
    extra = 0


@admin.register(SalesOrder)
class SalesOrderAdmin(admin.ModelAdmin):
    list_display = ["__str__", "customer", "order_date", "status", "owner"]
    list_filter = ["status"]
    inlines = [SalesOrderItemInline]
