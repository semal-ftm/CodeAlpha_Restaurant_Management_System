from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    api_root,
    dashboard,
    me,
    CategoryViewSet,
    InventoryItemViewSet,
    MenuItemViewSet,
    RecipeItemViewSet,
    RestaurantTableViewSet,
    ReservationViewSet,
    OrderViewSet,
)

router = DefaultRouter()
router.register("categories", CategoryViewSet)
router.register("menu", MenuItemViewSet)
router.register("recipe-items", RecipeItemViewSet)
router.register("tables", RestaurantTableViewSet)
router.register("reservations", ReservationViewSet)
router.register("orders", OrderViewSet)
router.register("inventory", InventoryItemViewSet)

urlpatterns = [
    path("", api_root),
    path("dashboard/", dashboard),
    path("me/", me),
    path("", include(router.urls)),
]
