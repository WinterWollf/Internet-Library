import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

app = Celery("library")
# Load all CELERY_* keys from Django settings.
app.config_from_object("django.conf:settings", namespace="CELERY")
# Auto-discover tasks.py modules in every INSTALLED_APP.
app.autodiscover_tasks()

# Periodic tasks run by Celery Beat (requires django_celery_beat scheduler).
# All times are UTC.
app.conf.beat_schedule = {
    # Mark active loans past their due_date as overdue and create penalty records.
    "check-overdue-loans-daily": {
        "task": "loans.check_overdue_loans",
        "schedule": crontab(hour=8, minute=0),
    },
    # Email readers whose loan is due within the next 3 days.
    "send-return-reminders-daily": {
        "task": "loans.send_return_reminders",
        "schedule": crontab(hour=9, minute=0),
    },
    # Email all readers with currently overdue loans.
    "send-overdue-notices-daily": {
        "task": "loans.send_overdue_notices",
        "schedule": crontab(hour=10, minute=0),
    },
    # Cancel pending reservations whose expires_at has passed.
    "cleanup-expired-reservations-hourly": {
        "task": "loans.cleanup_expired_reservations",
        "schedule": crontab(minute=0),
    },
    # Block readers whose loan has been overdue for more than 60 days; notify them by email.
    "block-accounts-overdue-weekly": {
        "task": "loans.block_accounts_overdue",
        "schedule": crontab(hour=7, minute=0, day_of_week=1),  # Monday 07:00
    },
}
