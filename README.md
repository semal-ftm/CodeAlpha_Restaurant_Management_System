# Restaurant Management System

A Django REST Framework backend for managing restaurant menu items, tables, reservations, orders, and inventory.

## Features

- Menu/category management
- Restaurant table management
- Reservation conflict validation
- Table capacity validation
- Order creation with multiple items
- Automatic order total calculation
- Recipe-to-inventory mapping
- Automatic inventory reduction when orders are created
- Low-stock endpoint
- Order status workflow
- Reservation cancellation
- Django Admin
- Simple dashboard/report endpoint
- SQLite database
- Postman-ready REST API

## Setup

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py makemigrations
python manage.py migrate
python manage.py seed_data
python manage.py createsuperuser
python manage.py runserver
```

Open:

- API root: http://127.0.0.1:8000/api/
- Admin: http://127.0.0.1:8000/admin/
- Dashboard: http://127.0.0.1:8000/api/dashboard/

## Main API Endpoints

- `GET/POST /api/categories/`
- `GET/POST /api/menu/`
- `GET/POST /api/recipe-items/`
- `GET/POST /api/tables/`
- `GET /api/tables/available/`
- `GET/POST /api/reservations/`
- `POST /api/reservations/{id}/cancel/`
- `GET/POST /api/orders/`
- `POST /api/orders/{id}/set-status/`
- `GET/POST/PATCH /api/inventory/`
- `GET /api/inventory/low-stock/`
- `GET /api/dashboard/`

## Example Reservation Request

```json
{
  "customer_name": "Sarah Khan",
  "customer_email": "sarah@example.com",
  "table": 3,
  "reservation_date": "2026-09-09",
  "reservation_time": "19:00:00",
  "number_of_guests": 4,
  "status": "confirmed"
}
```

## Example Order Request

```json
{
  "table": 3,
  "status": "pending",
  "items": [
    {
      "menu_item": 1,
      "quantity": 2
    },
    {
      "menu_item": 2,
      "quantity": 2
    }
  ]
}
```

The server calculates the order total and decreases linked inventory automatically.
