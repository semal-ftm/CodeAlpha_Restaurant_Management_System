from django.db import transaction
from rest_framework import serializers
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


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = "__all__"


class InventoryItemSerializer(serializers.ModelSerializer):
    is_low_stock = serializers.ReadOnlyField()

    class Meta:
        model = InventoryItem
        fields = ["id", "name", "quantity", "unit", "low_stock_threshold", "is_low_stock"]


class RecipeItemSerializer(serializers.ModelSerializer):
    inventory_item_name = serializers.CharField(source="inventory_item.name", read_only=True)

    class Meta:
        model = RecipeItem
        fields = ["id", "inventory_item", "inventory_item_name", "quantity_required"]


class MenuItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    recipe_items = RecipeItemSerializer(many=True, read_only=True)

    class Meta:
        model = MenuItem
        fields = [
            "id",
            "category",
            "category_name",
            "name",
            "description",
            "price",
            "is_available",
            "recipe_items",
        ]


class RestaurantTableSerializer(serializers.ModelSerializer):
    class Meta:
        model = RestaurantTable
        fields = "__all__"


class ReservationSerializer(serializers.ModelSerializer):
    table_number = serializers.IntegerField(source="table.table_number", read_only=True)

    class Meta:
        model = Reservation
        fields = [
            "id",
            "customer_name",
            "customer_email",
            "table",
            "table_number",
            "reservation_date",
            "reservation_time",
            "number_of_guests",
            "status",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def validate(self, attrs):
        table = attrs.get("table") or getattr(self.instance, "table", None)
        reservation_date = attrs.get("reservation_date") or getattr(self.instance, "reservation_date", None)
        reservation_time = attrs.get("reservation_time") or getattr(self.instance, "reservation_time", None)
        guests = attrs.get("number_of_guests") or getattr(self.instance, "number_of_guests", None)
        status = attrs.get("status") or getattr(self.instance, "status", "confirmed")

        if table and guests and guests > table.capacity:
            raise serializers.ValidationError(
                {"number_of_guests": f"Table {table.table_number} only seats {table.capacity} guests."}
            )

        if status != "cancelled" and table and reservation_date and reservation_time:
            conflicts = Reservation.objects.filter(
                table=table,
                reservation_date=reservation_date,
                reservation_time=reservation_time,
            ).exclude(status="cancelled")

            if self.instance:
                conflicts = conflicts.exclude(pk=self.instance.pk)

            if conflicts.exists():
                raise serializers.ValidationError(
                    {"table": "This table already has a reservation at that date and time."}
                )
        return attrs


class OrderItemReadSerializer(serializers.ModelSerializer):
    menu_item_name = serializers.CharField(source="menu_item.name", read_only=True)
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ["id", "menu_item", "menu_item_name", "quantity", "unit_price", "line_total"]

    def get_line_total(self, obj):
        return obj.unit_price * obj.quantity


class OrderItemWriteSerializer(serializers.Serializer):
    menu_item = serializers.PrimaryKeyRelatedField(queryset=MenuItem.objects.all())
    quantity = serializers.IntegerField(min_value=1)


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemWriteSerializer(many=True, write_only=True, required=False)
    order_items = OrderItemReadSerializer(source="items", many=True, read_only=True)
    table_number = serializers.IntegerField(source="table.table_number", read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "table",
            "table_number",
            "status",
            "total_price",
            "created_at",
            "items",
            "order_items",
        ]
        read_only_fields = ["total_price", "created_at"]

    def validate_items(self, items):
        for item in items:
            if not item["menu_item"].is_available:
                raise serializers.ValidationError(
                    f"{item['menu_item'].name} is currently unavailable."
                )
        return items

    def _check_and_reduce_inventory(self, items):
        required_by_inventory = {}

        for order_item in items:
            menu_item = order_item["menu_item"]
            quantity = order_item["quantity"]

            for recipe in menu_item.recipe_items.select_related("inventory_item"):
                needed = recipe.quantity_required * quantity
                required_by_inventory.setdefault(recipe.inventory_item_id, 0)
                required_by_inventory[recipe.inventory_item_id] += needed

        locked_items = {}
        for inventory_id, needed in required_by_inventory.items():
            inv = InventoryItem.objects.select_for_update().get(pk=inventory_id)
            if inv.quantity < needed:
                raise serializers.ValidationError(
                    {
                        "inventory": (
                            f"Not enough {inv.name}. Required {needed} {inv.unit}, "
                            f"available {inv.quantity} {inv.unit}."
                        )
                    }
                )
            locked_items[inventory_id] = (inv, needed)

        for inv, needed in locked_items.values():
            inv.quantity -= needed
            inv.save(update_fields=["quantity"])

    @transaction.atomic
    def create(self, validated_data):
        items = validated_data.pop("items", [])
        if not items:
            raise serializers.ValidationError({"items": "At least one order item is required."})

        self._check_and_reduce_inventory(items)

        order = Order.objects.create(**validated_data)

        for item in items:
            menu_item = item["menu_item"]
            OrderItem.objects.create(
                order=order,
                menu_item=menu_item,
                quantity=item["quantity"],
                unit_price=menu_item.price,
            )

        order.recalculate_total()
        return order

    def update(self, instance, validated_data):
        validated_data.pop("items", None)
        return super().update(instance, validated_data)
