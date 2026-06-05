"""Shared pytest fixtures."""
from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.inventory.services import create_lot_from_purchase_item
from apps.products.models import Product
from apps.purchasing.models import PurchaseOrder, PurchaseOrderItem

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(username="alice", password="pw-strong-123")


@pytest.fixture
def other_user(db):
    return User.objects.create_user(username="bob", password="pw-strong-123")


@pytest.fixture
def auth(api, user):
    """An APIClient authenticated as ``user``."""
    api.force_authenticate(user=user)
    return api


@pytest.fixture
def product(user):
    return Product.objects.create(
        owner=user, name="Cold Brew Concentrate", sku="CB-001", unit=Product.Unit.UNIT
    )


def buy(product, quantity, unit_cost, order_date=None):
    """Helper: receive a purchase that creates one stock lot."""
    po = PurchaseOrder.objects.create(
        owner=product.owner, order_date=order_date or date(2024, 1, 1)
    )
    item = PurchaseOrderItem.objects.create(
        purchase_order=po,
        product=product,
        quantity=Decimal(quantity),
        unit_cost=Decimal(unit_cost),
    )
    return create_lot_from_purchase_item(item)


@pytest.fixture
def make_purchase():
    return buy
