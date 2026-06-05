from django.contrib import admin

from .models import Product


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ["name", "sku", "unit", "owner"]
    list_filter = ["unit"]
    search_fields = ["name", "sku"]
