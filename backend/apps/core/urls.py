from django.urls import path

from .views import (
    AssistantStreamView,
    AssistantView,
    DashboardView,
    ExportView,
    ImportTemplateView,
    ImportView,
)

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("assistant/", AssistantView.as_view(), name="assistant"),
    path("assistant/stream/", AssistantStreamView.as_view(), name="assistant-stream"),
    path("export/<str:entity>/", ExportView.as_view(), name="export"),
    path("import/<str:entity>/template/", ImportTemplateView.as_view(), name="import-template"),
    path("import/<str:entity>/", ImportView.as_view(), name="import"),
]
