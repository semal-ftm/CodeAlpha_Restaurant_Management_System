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

Then create accounts for your team (you'll be asked for each password):

```bash
python manage.py create_staff sam  --role manager --name "Sam Rivera"
python manage.py create_staff alex --role waiter  --name "Alex Chen"
python manage.py create_staff jo   --role kitchen --name "Jo Park"
```

## Staff accounts and roles

Everyone signs in at `/login/`. The API checks roles on every request, so the rules can't be bypassed by calling it directly.

| | Manager | Waiter | Kitchen |
|---|:-:|:-:|:-:|
| View dashboard and data | ✅ | ✅ | ✅ |
| Take orders, book/cancel/seat reservations, set table status | ✅ | ✅ | — |
| Move orders to Preparing / Ready | ✅ | — | ✅ |
| Serve / Complete orders | ✅ | ✅ | — |
| Cancel orders | ✅ | — | — |
| Mark dishes available / sold out | ✅ | — | ✅ |
| Change stock, menu, prices, tables, recipes; Django admin | ✅ | — | — |

- Roles are the Django groups **Manager**, **Waiter** and **Kitchen** (created automatically by `migrate`). Superusers count as managers.
- You can also create users and assign groups in Django admin → Users. Accounts without one of the three groups can't sign in to the dashboard.
- `create_staff` gives managers Django admin access; run it again for an existing user to change their role or reset their password.
- Passwords must be at least 8 characters and not common or all-numeric.
- **Postman:** set the collection variables `username` and `password` (Basic auth). Use HTTPS if the API is reachable beyond your own machine.

## Deploying (HTTPS)

Local development needs nothing extra: DEBUG is on and a throwaway key is used. For a real server:

```bash
pip install -r requirements.txt
python manage.py init_env --domain tablemint.example.com --behind-proxy   # writes .env: DEBUG off + new secret key
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py check --deploy
waitress-serve --listen=127.0.0.1:8000 --trusted-proxy=127.0.0.1 --trusted-proxy-headers=x-forwarded-proto restaurant_system.wsgi:application
```

Then put an HTTPS proxy in front. `deploy/Caddyfile.example` is a two-line Caddy config that gets and renews a free certificate automatically.

With `DJANGO_DEBUG=0` the app:
- refuses to start without `DJANGO_SECRET_KEY`
- redirects HTTP to HTTPS and sends HSTS, `nosniff`, `X-Frame-Options: DENY` and a strict referrer policy
- marks session and CSRF cookies `Secure`
- serves static files itself (WhiteNoise)

`.env` is git-ignored; keep it private. `check --deploy` leaves two optional warnings (`SECURE_HSTS_INCLUDE_SUBDOMAINS`, `SECURE_HSTS_PRELOAD`) because they affect your whole domain. Enable them only if every subdomain is HTTPS. After HTTPS has worked for a while, raise `DJANGO_HSTS_SECONDS` in `.env` to `31536000`.

Open:

- API root: http://127.0.0.1:8000/api/
- Admin: http://127.0.0.1:8000/admin/
- Operations dashboard (web UI, sign-in required): http://127.0.0.1:8000/
- Dashboard summary (JSON): http://127.0.0.1:8000/api/dashboard/

## Web dashboard

The web UI at `/` is a single-page app with no build step (`restaurant/templates/restaurant/dashboard.html`,
`restaurant/static/restaurant/app.css`, `restaurant/static/restaurant/app.js`). It talks directly to the REST API.

- **Overview**: animated hero with live clock and next arrival, count-up KPIs, kitchen pipeline, floor donut, arrivals timeline, top sellers
- **Orders**: kanban board (Pending → Preparing → Ready → Served → Completed) with wait timers that turn amber/red, plus a filterable list
- **New order**: tap-to-add point-of-sale screen with table picker, category filters and a live cart
- **Floor plan**: drawn tables with chairs coloured by status; set status or start an order per table
- **Reservations**: chip-based booking (date, time slot, party size, table) that hides tables that are too small or already booked
- **Menu**: dish cards with ingredients, units sold and a sold-out toggle
- **Inventory**: health summary, stock bars, one-click restock presets
- Restaurant-themed motion: animated dining scene (swinging lamp, lifting cloche, candle, steam), top-down tables whose chairs slide in and show seated guests, animated kitchen stages (ticket printer, sizzling pan, ringing bell, cloche), steam and bubbles on dishes, fly-to-cart and food-emoji bursts
- Stock-aware ordering: dishes whose ingredients have run out are blocked in the order screen
- Light/dark theme, responsive layout, live search, auto-refresh every 30s, respects reduced-motion settings
- Interactive: drag tickets between board columns, a live activity ticker, alerts when another staff member places an order or marks one ready, a clickable dining scene (cloche, lamp, candle, glass) with pointer parallax, card tilt and press ripples
- The sign-in page and Overview fit on one screen on laptops and desktops (1280×720 and up)
- Keyboard shortcuts: `/` search · `N` new order · `B` book a table · `R` refresh · `1`–`6` switch pages · `Esc` close dialogs

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
- `GET /api/me/` (signed-in user, role and allowed actions)

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
