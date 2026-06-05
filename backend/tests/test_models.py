"""Model-level validations and derived properties."""
from datetime import date
from decimal import Decimal

import pytest
from django.db import IntegrityError

from apps.products.models import Product
from apps.purchasing.models import PurchaseOrder, PurchaseOrderItem

pytestmark = pytest.mark.django_db


def test_sku_unique_per_owner(user):
    Product.objects.create(owner=user, name="A", sku="DUP", unit="UNIT")
    with pytest.raises(IntegrityError):
        Product.objects.create(owner=user, name="B", sku="DUP", unit="UNIT")


def test_same_sku_allowed_across_owners(user, other_user):
    Product.objects.create(owner=user, name="A", sku="SHARED", unit="UNIT")
    # No exception: SKU uniqueness is scoped per owner.
    Product.objects.create(owner=other_user, name="A", sku="SHARED", unit="UNIT")


def test_purchase_order_total_cost(product):
    po = PurchaseOrder.objects.create(owner=product.owner, order_date=date(2024, 1, 1))
    PurchaseOrderItem.objects.create(
        purchase_order=po, product=product, quantity=Decimal("10"), unit_cost=Decimal("2")
    )
    PurchaseOrderItem.objects.create(
        purchase_order=po, product=product, quantity=Decimal("5"), unit_cost=Decimal("3")
    )
    assert po.total_cost == Decimal("35")  # 10*2 + 5*3
