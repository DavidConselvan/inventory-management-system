from rest_framework.routers import DefaultRouter

from .views import PurchaseOrderViewSet

router = DefaultRouter()
router.register("purchase-orders", PurchaseOrderViewSet, basename="purchaseorder")

urlpatterns = router.urls
