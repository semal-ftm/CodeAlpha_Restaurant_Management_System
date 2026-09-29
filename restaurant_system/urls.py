from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.urls import include, path
from restaurant.dashboard_views import dashboard_page

urlpatterns = [
    path("", dashboard_page, name="dashboard"),
    path("dashboard/", dashboard_page, name="dashboard-alt"),
    path("login/", auth_views.LoginView.as_view(redirect_authenticated_user=True), name="login"),
    path("logout/", auth_views.LogoutView.as_view(), name="logout"),
    path("admin/", admin.site.urls),
    path("api/", include("restaurant.urls")),
]
