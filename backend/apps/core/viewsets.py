from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .permissions import IsOwner


class OwnedQuerysetMixin:
    """Scopes a viewset to the requesting user.

    Restricts every queryset to ``owner=request.user`` and stamps ``owner`` on
    create. With :class:`IsOwner` this guarantees users only ever read and
    mutate their own data.
    """

    permission_classes = [IsAuthenticated, IsOwner]

    def get_queryset(self):
        return super().get_queryset().filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class OwnedModelViewSet(OwnedQuerysetMixin, viewsets.ModelViewSet):
    """Full CRUD viewset scoped to the requesting user."""
