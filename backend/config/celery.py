import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

app = Celery("library")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

app.conf.beat_schedule = {
    "check-overdue-loans-daily": {
        "task": "loans.check_overdue_loans",
        "schedule": crontab(hour=8, minute=0),
    },
    "send-return-reminders-daily": {
        "task": "loans.send_return_reminders",
        "schedule": crontab(hour=9, minute=0),
    },
    "send-overdue-notices-daily": {
        "task": "loans.send_overdue_notices",
        "schedule": crontab(hour=10, minute=0),
    },
    "cleanup-expired-reservations-hourly": {
        "task": "loans.cleanup_expired_reservations",
        "schedule": crontab(minute=0),
    },
    "block-accounts-overdue-weekly": {
        "task": "loans.block_accounts_overdue",
        "schedule": crontab(hour=7, minute=0, day_of_week=1),  # Monday 07:00
    },
}
