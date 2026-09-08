from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie


@ensure_csrf_cookie
def dashboard_page(request):
    return render(request, "restaurant/dashboard.html")