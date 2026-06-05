from rest_framework.routers import DefaultRouter

from .views import SalesOrderViewSet

router = DefaultRouter()
router.register("sales-orders", SalesOrderViewSet, basename="salesorder")

urlpatterns = router.urls
