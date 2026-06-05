from rest_framework.pagination import PageNumberPagination


class DefaultPagination(PageNumberPagination):
    """Page-number pagination that lets clients widen the page when they need
    to populate a full table (e.g. ``?page_size=200``)."""

    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 200
