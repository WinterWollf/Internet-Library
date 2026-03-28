from config.celery import app


@app.task(bind=True)
def send_notification_email(self, user_id: int, template: str, context: dict):
    """Send a notification email to a user. Idempotent — safe to retry."""
    # TODO: implement email sending via Django email backend
    pass


@app.task(bind=True)
def check_overdue_loans(self):
    """Mark overdue loans and trigger overdue notices. Scheduled daily at 08:00."""
    from apps.loans.services import mark_overdue_loans
    mark_overdue_loans()


@app.task(bind=True)
def send_return_reminders(self):
    """Send reminders 3 days before due date. Scheduled daily at 09:00."""
    pass


@app.task(bind=True)
def send_overdue_notices(self):
    """Send overdue notices. Scheduled daily at 10:00."""
    pass


@app.task(bind=True)
def cleanup_expired_reservations(self):
    """Cancel expired reservations. Scheduled every hour."""
    from apps.loans.services import cancel_expired_reservations
    cancel_expired_reservations()


@app.task(bind=True)
def block_accounts_overdue(self):
    """Block accounts with persistent overdue loans. Scheduled weekly."""
    pass
