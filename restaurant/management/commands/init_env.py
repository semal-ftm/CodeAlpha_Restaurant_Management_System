from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.core.management.utils import get_random_secret_key


class Command(BaseCommand):
    help = "Write a production .env file with a freshly generated secret key (the key is never printed)."

    def add_arguments(self, parser):
        parser.add_argument("--domain", required=True, help="Public host name, e.g. tablemint.example.com")
        parser.add_argument("--behind-proxy", action="store_true", help="Set when Caddy/nginx/your host terminates HTTPS")
        parser.add_argument("--force", action="store_true", help="Overwrite an existing .env")

    def handle(self, *args, domain, behind_proxy, force, **options):
        path = settings.BASE_DIR / ".env"
        if path.exists() and not force:
            raise CommandError(f"{path} already exists. Use --force to replace it (this rotates the secret key and signs everyone out).")

        domain = domain.strip().removeprefix("https://").removeprefix("http://").strip("/")
        lines = [
            "# Production settings for TableMint. Keep this file private; it is git-ignored.",
            "DJANGO_DEBUG=0",
            f"DJANGO_SECRET_KEY={get_random_secret_key()}",
            f"DJANGO_ALLOWED_HOSTS={domain},127.0.0.1,localhost",
            f"DJANGO_CSRF_TRUSTED_ORIGINS=https://{domain}",
            f"DJANGO_BEHIND_PROXY={'1' if behind_proxy else '0'}",
            "# Raise to 31536000 once HTTPS has worked for a while.",
            "DJANGO_HSTS_SECONDS=3600",
        ]
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        self.stdout.write(self.style.SUCCESS(f"Wrote {path} (DEBUG off, new secret key, host {domain})."))
        self.stdout.write("Next: python manage.py collectstatic --noinput && python manage.py check --deploy")
