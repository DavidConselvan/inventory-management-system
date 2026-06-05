from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    # auth
    path("api/auth/", include("apps.accounts.urls")),
    # resources
    path("api/", include("apps.products.urls")),
    path("api/", include("apps.purchasing.urls")),
    path("api/", include("apps.inventory.urls")),
    path("api/", include("apps.sales.urls")),
    path("api/", include("apps.core.urls")),
    # API schema + docs
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
]
