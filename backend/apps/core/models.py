from django.conf import settings
from django.db import models


class TimeStampedModel(models.Model):
    """Adds self-managing created/updated timestamps."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class BaseOwnedModel(TimeStampedModel):
    """Base for every user-owned record.

    The ``owner`` FK is the backbone of data isolation: viewsets filter every
    queryset by ``owner=request.user`` so users only ever see their own data.
    """

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="%(class)ss",
    )

    class Meta:
        abstract = True
