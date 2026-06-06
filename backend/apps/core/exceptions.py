from django.db.models import ProtectedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    """Turn a database ProtectedError into a clean 409 instead of a 500.

    Products are PROTECT-referenced by purchase items, sales items and stock
    lots, so deleting one that has history should be a meaningful conflict, not
    a server error.
    """
    response = exception_handler(exc, context)
    if response is None and isinstance(exc, ProtectedError):
        return Response(
            {
                "detail": "This item can't be deleted because it's referenced by "
                "existing orders or stock."
            },
            status=status.HTTP_409_CONFLICT,
        )
    return response
