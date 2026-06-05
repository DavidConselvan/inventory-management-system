"""Seed a demo user with sample data.

Reproduces the spec's worked example (buy 100 @ $1, sell 100 @ $10 -> profit
900, margin 900%) plus a couple of extra products so the dashboard, charts and
FIFO behaviour are all visible on first run. Idempotent: re-running wipes and
recreates the demo user's data.
"""
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.inventory.services import allocate_stock_fifo, create_lot_from_purchase_item
from apps.products.models import Product
from apps.purchasing.models import PurchaseOrder, PurchaseOrderItem
from apps.sales.models import SalesOrder, SalesOrderItem

DEMO_USERNAME = "demo"
DEMO_PASSWORD = "demo12345"


class Command(BaseCommand):
    help = "Seed a demo user (demo / demo12345) with sample inventory data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--skip-if-exists",
            action="store_true",
            help="Do nothing if the demo user already exists (used on container "
            "startup so restarts don't wipe data).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()

        if options["skip_if_exists"] and User.objects.filter(
            username=DEMO_USERNAME
        ).exists():
            self.stdout.write("Demo user already exists — skipping seed.")
            return

        # Wipe any previous demo data (owner FKs cascade on user delete).
        User.objects.filter(username=DEMO_USERNAME).delete()
        user = User.objects.create_user(
            username=DEMO_USERNAME, email="demo@example.com", password=DEMO_PASSWORD
        )

        seq = {"po": 0, "so": 0}

        def make_product(name, sku, unit, desc=""):
            return Product.objects.create(
                owner=user, name=name, sku=sku, unit=unit, description=desc
            )

        def purchase(product, quantity, unit_cost, when, supplier="Acme Wholesale"):
            seq["po"] += 1
            po = PurchaseOrder.objects.create(
                owner=user,
                order_date=when,
                supplier=supplier,
                reference=f"PO-{seq['po']:04d}",
            )
            item = PurchaseOrderItem.objects.create(
                purchase_order=po,
                product=product,
                quantity=Decimal(str(quantity)),
                unit_cost=Decimal(str(unit_cost)),
            )
            create_lot_from_purchase_item(item)
            return po

        def sell(product, quantity, unit_price, when, customer="Café Bloom"):
            seq["so"] += 1
            so = SalesOrder.objects.create(
                owner=user,
                order_date=when,
                customer=customer,
                reference=f"SO-{seq['so']:04d}",
            )
            item = SalesOrderItem.objects.create(
                sales_order=so,
                product=product,
                quantity=Decimal(str(quantity)),
                unit_price=Decimal(str(unit_price)),
            )
            allocate_stock_fifo(item)
            return so

        # 1. The worked example: profit 900, margin 900%.
        cold_brew = make_product(
            "Cold Brew Concentrate", "CB-001", Product.Unit.UNIT, "1L bottles"
        )
        purchase(cold_brew, 100, 1, date(2024, 1, 5))
        sell(cold_brew, 100, 10, date(2024, 2, 1))

        # 2. Multiple lots at different costs, partial sale spanning both (FIFO).
        beans = make_product(
            "Single-Origin Beans", "BN-100", Product.Unit.KG, "Ethiopian, washed"
        )
        purchase(beans, 50, 8, date(2024, 1, 10))
        purchase(beans, 50, 9, date(2024, 1, 20))
        sell(beans, 60, 15, date(2024, 2, 5))  # 50 @ $8 + 10 @ $9

        # 3. Lots of stock still on hand (inventory value on the dashboard).
        matcha = make_product(
            "Matcha Powder", "MT-200", Product.Unit.G, "Ceremonial grade"
        )
        purchase(matcha, 1000, 0.2, date(2024, 1, 15))
        sell(matcha, 400, 0.8, date(2024, 2, 10))

        # 4. A product purchased but not yet sold.
        oat_milk = make_product(
            "Oat Milk", "OM-300", Product.Unit.L, "Barista edition"
        )
        purchase(oat_milk, 200, 1.5, date(2024, 1, 25))

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded demo data. Log in with {DEMO_USERNAME} / {DEMO_PASSWORD}"
            )
        )
