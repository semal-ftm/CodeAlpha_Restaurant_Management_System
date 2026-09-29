from datetime import date
from django.db.models import Sum, Count
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from .models import (
    Category,
    InventoryItem,
    MenuItem,
    RecipeItem,
    RestaurantTable,
    Reservation,
    Order,
)
from .permissions import (
    ROLE_LABELS,
    RoleLimitedFieldsMixin,
    can_set_order_status,
    capabilities,
    get_role,
)
from .serializers import (
    CategorySerializer,
    InventoryItemSerializer,
    MenuItemSerializer,
    RecipeItemSerializer,
    RestaurantTableSerializer,
    ReservationSerializer,
    OrderSerializer,
)


@api_view(["GET"])
def api_root(request):
    return Response({
        "message": "Restaurant Management System API",
        "endpoints": {
            "categories": "/api/categories/",
            "menu": "/api/menu/",
            "recipe-items": "/api/recipe-items/",
            "tables": "/api/tables/",
            "reservations": "/api/reservations/",
            "orders": "/api/orders/",
            "inventory": "/api/inventory/",
            "dashboard": "/api/dashboard/",
            "me": "/api/me/",
        }
    })


@api_view(["GET"])
def me(request):
    """The signed-in staff member and what their role is allowed to do."""
    user = request.user
    role = get_role(user)
    return Response({
        "username": user.username,
        "name": user.get_full_name() or user.username,
        "role": role,
        "role_label": ROLE_LABELS[role],
        "can": capabilities(role),
    })


@api_view(["GET"])
def dashboard(request):
    today = date.today()
    today_orders = Order.objects.filter(created_at__date=today)
    today_reservations = Reservation.objects.filter(
        reservation_date=today
    ).exclude(status="cancelled")

    completed_sales = today_orders.filter(
        status__in=["served", "completed"]
    ).aggregate(total=Sum("total_price"))["total"] or 0

    return Response({
        "date": today,
        "today_orders": today_orders.count(),
        "today_sales": completed_sales,
        "today_reservations": today_reservations.count(),
        "available_tables": RestaurantTable.objects.filter(status="available").count(),
        "low_stock_items": sum(1 for item in InventoryItem.objects.all() if item.is_low_stock),
        "orders_by_status": list(
            today_orders.values("status").annotate(count=Count("id")).order_by("status")
        ),
    })


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


class InventoryItemViewSet(viewsets.ModelViewSet):
    queryset = InventoryItem.objects.all().order_by("name")
    serializer_class = InventoryItemSerializer

    @action(detail=False, methods=["get"], url_path="low-stock")
    def low_stock(self, request):
        items = [item for item in self.get_queryset() if item.is_low_stock]
        return Response(self.get_serializer(items, many=True).data)


class MenuItemViewSet(RoleLimitedFieldsMixin, viewsets.ModelViewSet):
    queryset = MenuItem.objects.select_related("category").prefetch_related("recipe_items__inventory_item")
    serializer_class = MenuItemSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        category = self.request.query_params.get("category")
        available = self.request.query_params.get("available")
        if category:
            qs = qs.filter(category_id=category)
        if available is not None:
            qs = qs.filter(is_available=available.lower() == "true")
        return qs


class RecipeItemViewSet(viewsets.ModelViewSet):
    queryset = RecipeItem.objects.select_related("menu_item", "inventory_item")
    serializer_class = RecipeItemSerializer


class RestaurantTableViewSet(RoleLimitedFieldsMixin, viewsets.ModelViewSet):
    queryset = RestaurantTable.objects.all()
    serializer_class = RestaurantTableSerializer

    @action(detail=False, methods=["get"], url_path="available")
    def available(self, request):
        tables = self.get_queryset().filter(status="available")
        return Response(self.get_serializer(tables, many=True).data)


class ReservationViewSet(RoleLimitedFieldsMixin, viewsets.ModelViewSet):
    queryset = Reservation.objects.select_related("table")
    serializer_class = ReservationSerializer

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        reservation = self.get_object()
        reservation.status = "cancelled"
        reservation.save(update_fields=["status"])
        return Response(self.get_serializer(reservation).data)


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.select_related("table").prefetch_related("items__menu_item")
    serializer_class = OrderSerializer

    @action(detail=True, methods=["post"], url_path="set-status")
    def set_status(self, request, pk=None):
        order = self.get_object()
        new_status = request.data.get("status")
        valid_statuses = dict(Order.STATUS_CHOICES)

        if new_status not in valid_statuses:
            return Response(
                {"error": f"Invalid status. Use one of: {', '.join(valid_statuses.keys())}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        role = get_role(request.user)
        if not can_set_order_status(role, new_status):
            return Response(
                {"detail": f"{ROLE_LABELS[role]} accounts can't mark orders as {new_status}."},
                status=status.HTTP_403_FORBIDDEN,
            )

        order.status = new_status
        order.save(update_fields=["status"])
        return Response(self.get_serializer(order).data)
