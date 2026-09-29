"""Staff roles and the API permission rules built on them.

Roles are Django auth groups ("Manager", "Waiter", "Kitchen"). Superusers are
treated as managers. Accounts without one of these groups cannot use the
dashboard or the API.
"""
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import SAFE_METHODS, BasePermission

MANAGER = "manager"
WAITER = "waiter"
KITCHEN = "kitchen"

ROLE_GROUPS = {MANAGER: "Manager", WAITER: "Waiter", KITCHEN: "Kitchen"}
ROLE_LABELS = ROLE_GROUPS

# Which roles may perform each write action, keyed by viewset basename and action.
# Any write that is not listed here is manager-only.
WRITE_RULES = {
    "order": {
        "create": {MANAGER, WAITER},
        "set_status": {MANAGER, WAITER, KITCHEN},  # narrowed per status below
    },
    "reservation": {
        "create": {MANAGER, WAITER},
        "partial_update": {MANAGER, WAITER},
        "cancel": {MANAGER, WAITER},
    },
    "restauranttable": {"partial_update": {MANAGER, WAITER}},
    "menuitem": {"partial_update": {MANAGER, KITCHEN}},
}

# Who may move an order into each status.
ORDER_STATUS_ROLES = {
    "pending": {MANAGER},
    "preparing": {MANAGER, KITCHEN},
    "ready": {MANAGER, KITCHEN},
    "served": {MANAGER, WAITER},
    "completed": {MANAGER, WAITER},
    "cancelled": {MANAGER},  # voiding an order is a manager decision
}

# Non-manager roles may only PATCH these fields.
LIMITED_FIELDS = {
    "restauranttable": {WAITER: {"status"}},
    "menuitem": {KITCHEN: {"is_available"}},
    "reservation": {WAITER: {"status"}},
}


def get_role(user):
    """Return the user's staff role, or None if they are not staff."""
    if not user or not user.is_authenticated or not user.is_active:
        return None
    if user.is_superuser:
        return MANAGER
    names = set(user.groups.values_list("name", flat=True))
    for role in (MANAGER, KITCHEN, WAITER):
        if ROLE_GROUPS[role] in names:
            return role
    return None


def capabilities(role):
    """What the frontend should offer this role (the API enforces the same rules)."""
    return {
        "create_order": role in {MANAGER, WAITER},
        "order_statuses": sorted(s for s, roles in ORDER_STATUS_ROLES.items() if role in roles),
        "reserve": role in {MANAGER, WAITER},
        "table_status": role in {MANAGER, WAITER},
        "menu_toggle": role in {MANAGER, KITCHEN},
        "stock": role == MANAGER,
        "admin": role == MANAGER,
    }


def can_set_order_status(role, status):
    return role in ORDER_STATUS_ROLES.get(status, set())


class StaffRolePermission(BasePermission):
    """Reads need any staff role; writes follow WRITE_RULES."""

    message = "Your staff role does not allow this action."

    def has_permission(self, request, view):
        role = get_role(request.user)
        if role is None:
            self.message = "Sign in with a staff account to use the API."
            return False
        if request.method in SAFE_METHODS:
            return True
        allowed = WRITE_RULES.get(getattr(view, "basename", None), {}).get(getattr(view, "action", None), {MANAGER})
        if role not in allowed:
            self.message = f"{ROLE_LABELS[role]} accounts can't do this."
            return False
        return True


class RoleLimitedFieldsMixin:
    """Stops non-manager roles from PATCHing fields outside their allowance."""

    def partial_update(self, request, *args, **kwargs):
        role = get_role(request.user)
        allowed = LIMITED_FIELDS.get(self.basename, {}).get(role)
        if allowed is not None:
            extra = set(request.data.keys()) - allowed
            if extra:
                raise PermissionDenied(
                    f"{ROLE_LABELS[role]} accounts can only change: {', '.join(sorted(allowed))}."
                )
        return super().partial_update(request, *args, **kwargs)
