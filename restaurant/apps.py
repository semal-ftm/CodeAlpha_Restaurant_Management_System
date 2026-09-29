from django.apps import AppConfig
from django.db.models.signals import post_migrate


def ensure_staff_roles(sender, **kwargs):
    """Create the staff role groups; managers get full admin rights on restaurant data."""
    from django.contrib.auth.models import Group, Permission

    from .permissions import MANAGER, ROLE_GROUPS

    for role, name in ROLE_GROUPS.items():
        group, _ = Group.objects.get_or_create(name=name)
        if role == MANAGER:
            group.permissions.add(*Permission.objects.filter(content_type__app_label="restaurant"))


class RestaurantConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "restaurant"

    def ready(self):
        post_migrate.connect(ensure_staff_roles, sender=self)
