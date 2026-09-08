from django.core.management.base import BaseCommand
from restaurant.models import Category, MenuItem, InventoryItem, RecipeItem, RestaurantTable


class Command(BaseCommand):
    help = "Create demo restaurant data"

    def handle(self, *args, **options):
        burgers, _ = Category.objects.get_or_create(name="Burgers")
        drinks, _ = Category.objects.get_or_create(name="Drinks")
        sides, _ = Category.objects.get_or_create(name="Sides")

        chicken, _ = InventoryItem.objects.get_or_create(
            name="Chicken", defaults={"quantity": 20, "unit": "kg", "low_stock_threshold": 3}
        )
        buns, _ = InventoryItem.objects.get_or_create(
            name="Burger Buns", defaults={"quantity": 100, "unit": "pcs", "low_stock_threshold": 15}
        )
        cheese, _ = InventoryItem.objects.get_or_create(
            name="Cheese Slices", defaults={"quantity": 80, "unit": "pcs", "low_stock_threshold": 10}
        )
        cola_stock, _ = InventoryItem.objects.get_or_create(
            name="Cola Cans", defaults={"quantity": 60, "unit": "pcs", "low_stock_threshold": 10}
        )
        fries_stock, _ = InventoryItem.objects.get_or_create(
            name="Frozen Fries", defaults={"quantity": 25, "unit": "kg", "low_stock_threshold": 4}
        )

        burger, _ = MenuItem.objects.get_or_create(
            name="Chicken Burger",
            defaults={
                "category": burgers,
                "description": "Crispy chicken burger with cheese",
                "price": 8.99,
                "is_available": True,
            },
        )
        cola, _ = MenuItem.objects.get_or_create(
            name="Cola",
            defaults={
                "category": drinks,
                "description": "Chilled canned cola",
                "price": 2.50,
                "is_available": True,
            },
        )
        fries, _ = MenuItem.objects.get_or_create(
            name="French Fries",
            defaults={
                "category": sides,
                "description": "Crispy golden fries",
                "price": 3.99,
                "is_available": True,
            },
        )

        RecipeItem.objects.get_or_create(
            menu_item=burger, inventory_item=chicken, defaults={"quantity_required": 0.25}
        )
        RecipeItem.objects.get_or_create(
            menu_item=burger, inventory_item=buns, defaults={"quantity_required": 1}
        )
        RecipeItem.objects.get_or_create(
            menu_item=burger, inventory_item=cheese, defaults={"quantity_required": 1}
        )
        RecipeItem.objects.get_or_create(
            menu_item=cola, inventory_item=cola_stock, defaults={"quantity_required": 1}
        )
        RecipeItem.objects.get_or_create(
            menu_item=fries, inventory_item=fries_stock, defaults={"quantity_required": 0.20}
        )

        for table_number, capacity in [(1, 2), (2, 2), (3, 4), (4, 4), (5, 6), (6, 8)]:
            RestaurantTable.objects.get_or_create(
                table_number=table_number,
                defaults={"capacity": capacity, "status": "available"},
            )

        self.stdout.write(self.style.SUCCESS("Demo data created successfully."))
