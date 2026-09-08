from django.contrib import admin
from .models import (
    Category,
    InventoryItem,
    MenuItem,
    RecipeItem,
    RestaurantTable,
    Reservation,
    Order,
    OrderItem,
)


class RecipeItemInline(admin.TabularInline):
    model = RecipeItem
    extra = 1


@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "price", "is_available")
    list_filter = ("category", "is_available")
    search_fields = ("name",)
    inlines = [RecipeItemInline]


@admin.register(Reservation)
class ReservationAdmin(admin.ModelAdmin):
    list_display = (
        "customer_name",
        "table",
        "reservation_date",
        "reservation_time",
        "number_of_guests",
        "status",
    )
    list_filter = ("status", "reservation_date")
    search_fields = ("customer_name", "customer_email")


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("unit_price",)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "table", "status", "total_price", "created_at")
    list_filter = ("status", "created_at")
    inlines = [OrderItemInline]


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ("name", "quantity", "unit", "low_stock_threshold", "is_low_stock")
    search_fields = ("name",)


@admin.register(RestaurantTable)
class RestaurantTableAdmin(admin.ModelAdmin):
    list_display = ("table_number", "capacity", "status")
    list_filter = ("status",)


admin.site.register(Category)
admin.site.register(RecipeItem)
