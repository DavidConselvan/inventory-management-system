from rest_framework.routers import DefaultRouter

from .views import StockLotViewSet

router = DefaultRouter()
router.register("stock-lots", StockLotViewSet, basename="stocklot")

urlpatterns = router.urls
