from rest_framework.permissions import BasePermission


class IsOwner(BasePermission):
    """Object-level guard: the record's owner must be the requesting user.

    Defense-in-depth alongside the owner-filtered queryset — even if an object
    leaks into a queryset, a non-owner can never act on it.
    """

    def has_object_permission(self, request, view, obj):
        return getattr(obj, "owner_id", None) == request.user.id
