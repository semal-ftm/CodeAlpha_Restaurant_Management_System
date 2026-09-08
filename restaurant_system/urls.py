from django.contrib import admin
from django.urls import include, path
from restaurant.dashboard_views import dashboard_page

urlpatterns = [
    path("", dashboard_page, name="dashboard"),
    path("dashboard/", dashboard_page, name="dashboard-alt"),
    path("admin/", admin.site.urls),
    path("api/", include("restaurant.urls")),
]
