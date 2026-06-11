from django.urls import path

from .views import AssistantView, DashboardView

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("assistant/", AssistantView.as_view(), name="assistant"),
]
