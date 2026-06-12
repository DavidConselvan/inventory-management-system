"""AI assistant: tool data-isolation and endpoint gating.

The Claude call itself needs a live API key, so these cover the parts that
don't: the read-only tools (scoped to the user) and the endpoint guards.
"""
import pytest
from rest_framework.test import APIClient

from apps.core.assistant import _tool_executors
from apps.products.models import Product

pytestmark = pytest.mark.django_db

ASSISTANT = "/api/assistant/"


def test_assistant_requires_auth(api):
    assert api.post(ASSISTANT, {"message": "hi"}, format="json").status_code == 401


def test_assistant_503_without_api_key(auth, settings):
    # With no key configured the endpoint degrades gracefully rather than 500.
    settings.ANTHROPIC_API_KEY = ""
    resp = auth.post(ASSISTANT, {"message": "what's my profit?"}, format="json")
    assert resp.status_code == 503


def test_tools_are_scoped_to_the_user(user, make_purchase):
    product = Product.objects.create(owner=user, name="Cold Brew", sku="CB-1", unit="UNIT")
    make_purchase(product, 100, 1)
    tools = _tool_executors(user)

    listed = tools["list_products"]({})
    assert [p["sku"] for p in listed] == ["CB-1"]
    assert listed[0]["quantity_on_hand"] == 100  # nothing sold yet

    dashboard = tools["get_dashboard"]({})
    assert dashboard["totals"]["purchased_cost"] == 100
    assert len(dashboard["products"]) == 1

    found = tools["find_product"]({"query": "CB-1"})
    assert found["found"] is True
    assert found["name"] == "Cold Brew"


def test_tools_cannot_see_another_users_product(user, other_user):
    Product.objects.create(owner=other_user, name="Secret Sauce", sku="SS-9", unit="UNIT")
    tools = _tool_executors(user)

    assert tools["list_products"]({}) == []
    assert tools["find_product"]({"query": "SS-9"})["found"] is False
