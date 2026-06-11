"""The demo seed must be re-runnable (a manual reset wipes and recreates)."""
import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command

pytestmark = pytest.mark.django_db


def test_seed_demo_is_rerunnable():
    call_command("seed_demo")
    # second run must reset cleanly despite PROTECT FKs on products/lots
    call_command("seed_demo")
    assert get_user_model().objects.filter(username="demo").count() == 1
