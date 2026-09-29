from getpass import getpass

from django.contrib.auth import get_user_model, password_validation
from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

from restaurant.permissions import MANAGER, ROLE_GROUPS


class Command(BaseCommand):
    help = "Create (or update) a staff account with a role: manager, waiter or kitchen."

    def add_arguments(self, parser):
        parser.add_argument("username")
        parser.add_argument("--role", required=True, choices=sorted(ROLE_GROUPS))
        parser.add_argument("--name", default="", help='Display name, e.g. "Sam Rivera"')
        parser.add_argument(
            "--password",
            help="Password (omit to be prompted; avoid passing real passwords on the command line)",
        )

    def handle(self, *args, username, role, name, password, **options):
        User = get_user_model()
        user = User.objects.filter(username=username).first()
        created = user is None
        if created:
            user = User(username=username)  # not saved until the password passes validation

        if password is None:
            password = getpass("Password: ")
            if password != getpass("Password (again): "):
                raise CommandError("Passwords don't match.")
        try:
            password_validation.validate_password(password, user)
        except ValidationError as exc:
            raise CommandError(" ".join(exc.messages))

        first, _, last = name.partition(" ")
        if name:
            user.first_name, user.last_name = first, last
        user.set_password(password)
        user.is_active = True
        user.is_staff = role == MANAGER  # managers may use Django admin
        user.save()

        user.groups.remove(*Group.objects.filter(name__in=ROLE_GROUPS.values()))
        user.groups.add(Group.objects.get_or_create(name=ROLE_GROUPS[role])[0])

        verb = "Created" if created else "Updated"
        self.stdout.write(self.style.SUCCESS(f"{verb} {ROLE_GROUPS[role].lower()} account '{username}'."))
