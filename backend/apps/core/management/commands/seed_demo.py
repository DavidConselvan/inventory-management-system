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

from apps.inventory.models import StockLot
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

        # Wipe any previous demo data. Product and StockLot use PROTECT, so a
        # plain user cascade-delete raises; clear owned records in dependency
        # order first (sales free lot allocations, then purchases, lots, products).
        existing = User.objects.filter(username=DEMO_USERNAME).first()
        if existing:
            SalesOrder.objects.filter(owner=existing).delete()
            PurchaseOrder.objects.filter(owner=existing).delete()
            StockLot.objects.filter(owner=existing).delete()
            Product.objects.filter(owner=existing).delete()
            existing.delete()

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

        cold_brew = make_product(
            "Cold Brew Concentrate", "CB-001", Product.Unit.UNIT, "1L bottles"
        )
        beans = make_product(
            "Single-Origin Beans", "BN-100", Product.Unit.KG, "Ethiopian, washed"
        )
        matcha = make_product(
            "Matcha Powder", "MT-200", Product.Unit.G, "Ceremonial grade"
        )
        oat_milk = make_product(
            "Oat Milk", "OM-300", Product.Unit.L, "Barista edition"
        )

        # A year of trading so the dashboard's historical charts tell a story:
        # twelve months, gentle growth (the 0.06 ramp) with seasonal wobble, and
        # a unit cost that drifts up over time — so each month draws older,
        # cheaper FIFO lots and margins stay realistic. We buy ~30% more than we
        # sell each month, which keeps stock on hand and never oversells.
        months = [date(2025, m, 1) for m in range(7, 13)]
        months += [date(2026, m, 1) for m in range(1, 7)]
        wobble = [1.00, 0.90, 1.10, 1.05, 0.95, 1.20, 1.15, 1.00, 1.25, 1.10, 1.30, 1.22]

        # product, base monthly volume, sale price, starting cost, monthly cost drift
        plan = [
            (cold_brew, 80, 10, Decimal("1.00"), Decimal("0.04")),
            (beans, 35, 15, Decimal("8.00"), Decimal("0.15")),
            (matcha, 300, Decimal("0.80"), Decimal("0.20"), Decimal("0.01")),
            (oat_milk, 90, Decimal("3.50"), Decimal("1.50"), Decimal("0.05")),
        ]

        for product, base, price, cost0, drift in plan:
            for i, when in enumerate(months):
                sell_qty = round(base * (1 + 0.06 * i) * wobble[i])
                unit_cost = cost0 + drift * i
                purchase(product, round(sell_qty * 1.3) + 1, unit_cost, when)
                sell(product, sell_qty, price, when)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded demo data. Log in with {DEMO_USERNAME} / {DEMO_PASSWORD}"
            )
        )
