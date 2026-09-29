from django.contrib import messages
from django.contrib.auth import logout
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render
from django.views.decorators.csrf import ensure_csrf_cookie

from .permissions import get_role


@login_required
@ensure_csrf_cookie
def dashboard_page(request):
    if get_role(request.user) is None:
        logout(request)
        messages.error(request, "This account has no staff role yet. Ask a manager to assign you Manager, Waiter or Kitchen.")
        return redirect("login")
    return render(request, "restaurant/dashboard.html")
