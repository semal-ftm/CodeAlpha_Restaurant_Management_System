from datetime import date

from django.contrib.auth.models import Group, User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Category, InventoryItem, MenuItem, Order, OrderItem, RecipeItem, Reservation, RestaurantTable


class StaffRoleTests(TestCase):
    """The API enforces staff roles: Manager, Waiter and Kitchen."""

    @classmethod
    def setUpTestData(cls):
        cls.users = {}
        for role in ("Manager", "Waiter", "Kitchen"):
            user = User.objects.create_user(role.lower(), password="Str0ng-pass!")
            user.groups.add(Group.objects.get(name=role))
            cls.users[role.lower()] = user
        cls.no_role = User.objects.create_user("visitor", password="Str0ng-pass!")

        cat = Category.objects.create(name="Mains")
        cls.stock = InventoryItem.objects.create(name="Chicken", quantity=10, unit="kg", low_stock_threshold=2)
        cls.dish = MenuItem.objects.create(category=cat, name="Chicken Burger", price="8.99")
        RecipeItem.objects.create(menu_item=cls.dish, inventory_item=cls.stock, quantity_required="0.25")
        cls.table = RestaurantTable.objects.create(table_number=1, capacity=4)

    def client_for(self, who):
        client = APIClient()
        if who:
            client.force_authenticate(self.users.get(who) or self.no_role)
        return client

    def new_order(self, status="pending"):
        order = Order.objects.create(table=self.table, status=status)
        OrderItem.objects.create(order=order, menu_item=self.dish, quantity=1, unit_price=self.dish.price)
        return order

    # --- access ------------------------------------------------------
    def test_anonymous_and_roleless_users_are_refused(self):
        self.assertEqual(self.client_for(None).get("/api/orders/").status_code, 403)
        self.assertEqual(self.client_for("visitor").get("/api/orders/").status_code, 403)

    def test_every_role_can_read(self):
        for who in ("manager", "waiter", "kitchen"):
            with self.subTest(who=who):
                self.assertEqual(self.client_for(who).get("/api/orders/").status_code, 200)

    def test_me_reports_role_and_capabilities(self):
        data = self.client_for("kitchen").get("/api/me/").json()
        self.assertEqual(data["role"], "kitchen")
        self.assertEqual(data["can"]["order_statuses"], ["preparing", "ready"])
        self.assertFalse(data["can"]["create_order"])

    def test_dashboard_page_requires_login(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 302)
        self.assertIn("/login/", response["Location"])

    # --- orders ------------------------------------------------------
    def test_waiter_can_place_orders_but_kitchen_cannot(self):
        payload = {"table": self.table.id, "items": [{"menu_item": self.dish.id, "quantity": 1}]}
        self.assertEqual(self.client_for("waiter").post("/api/orders/", payload, format="json").status_code, 201)
        self.assertEqual(self.client_for("kitchen").post("/api/orders/", payload, format="json").status_code, 403)

    def test_order_status_changes_follow_the_role(self):
        cases = [
            ("kitchen", "preparing", 200), ("kitchen", "ready", 200), ("kitchen", "served", 403), ("kitchen", "cancelled", 403),
            ("waiter", "served", 200), ("waiter", "completed", 200), ("waiter", "cancelled", 403), ("waiter", "preparing", 403),
            ("manager", "preparing", 200), ("manager", "pending", 200), ("manager", "cancelled", 200),
        ]
        for who, status, expected in cases:
            with self.subTest(who=who, status=status):
                order = self.new_order()
                response = self.client_for(who).post(f"/api/orders/{order.id}/set-status/", {"status": status}, format="json")
                self.assertEqual(response.status_code, expected)

    def test_only_managers_can_edit_or_delete_orders_directly(self):
        order = self.new_order()
        self.assertEqual(self.client_for("waiter").delete(f"/api/orders/{order.id}/").status_code, 403)
        self.assertEqual(self.client_for("manager").delete(f"/api/orders/{order.id}/").status_code, 204)

    # --- tables, menu, stock -----------------------------------------
    def test_waiter_can_only_change_table_status(self):
        client = self.client_for("waiter")
        self.assertEqual(client.patch(f"/api/tables/{self.table.id}/", {"status": "occupied"}, format="json").status_code, 200)
        self.assertEqual(client.patch(f"/api/tables/{self.table.id}/", {"capacity": 12}, format="json").status_code, 403)
        self.assertEqual(self.client_for("kitchen").patch(f"/api/tables/{self.table.id}/", {"status": "available"}, format="json").status_code, 403)

    def test_kitchen_can_only_toggle_dish_availability(self):
        client = self.client_for("kitchen")
        self.assertEqual(client.patch(f"/api/menu/{self.dish.id}/", {"is_available": False}, format="json").status_code, 200)
        self.assertEqual(client.patch(f"/api/menu/{self.dish.id}/", {"price": "0.01"}, format="json").status_code, 403)
        self.assertEqual(self.client_for("waiter").patch(f"/api/menu/{self.dish.id}/", {"is_available": True}, format="json").status_code, 403)

    def test_only_managers_can_change_stock(self):
        url = f"/api/inventory/{self.stock.id}/"
        for who, expected in (("waiter", 403), ("kitchen", 403), ("manager", 200)):
            with self.subTest(who=who):
                self.assertEqual(self.client_for(who).patch(url, {"quantity": "50.00"}, format="json").status_code, expected)

    # --- reservations ------------------------------------------------
    def test_front_of_house_manages_reservations(self):
        payload = {
            "customer_name": "Test Guest", "customer_email": "guest@example.com", "table": self.table.id,
            "reservation_date": date.today().isoformat(), "reservation_time": "19:00:00", "number_of_guests": 2,
        }
        self.assertEqual(self.client_for("kitchen").post("/api/reservations/", payload, format="json").status_code, 403)
        response = self.client_for("waiter").post("/api/reservations/", payload, format="json")
        self.assertEqual(response.status_code, 201)
        rid = response.json()["id"]
        self.assertEqual(self.client_for("waiter").post(f"/api/reservations/{rid}/cancel/").status_code, 200)
        self.assertEqual(Reservation.objects.get(pk=rid).status, "cancelled")
