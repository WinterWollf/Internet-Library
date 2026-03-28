from config.celery import app


@app.task(bind=True, name="loans.check_overdue_loans")
def check_overdue_loans(self):
    """Mark active loans past due as overdue and create penalties. Daily 08:00."""
    from apps.loans.services import mark_overdue_loans
    return mark_overdue_loans()


@app.task(bind=True, name="loans.send_return_reminders")
def send_return_reminders(self):
    """Send reminders for loans due within 3 days. Daily 09:00."""
    from apps.loans.services import get_loans_due_soon
    from apps.notifications.tasks import send_notification_email

    for loan in get_loans_due_soon(days=3):
        days_remaining = max((loan.due_date.date() - __import__("datetime").date.today()).days, 0)
        send_notification_email.delay(
            loan.reader_id,
            "reminder",
            {
                "book_title": loan.copy.book.title,
                "book_author": loan.copy.book.author,
                "days": days_remaining,
                "due_date": loan.due_date.strftime("%Y-%m-%d"),
            },
            loan_id=loan.pk,
        )


@app.task(bind=True, name="loans.send_overdue_notices")
def send_overdue_notices(self):
    """Send overdue notices to readers. Daily 10:00."""
    from decimal import Decimal

    from apps.loans.models import Loan, Penalty
    from apps.notifications.tasks import send_notification_email

    overdue = Loan.objects.select_related("reader", "copy__book").filter(
        status=Loan.Status.OVERDUE
    )
    for loan in overdue:
        days_overdue = (
            __import__("django.utils.timezone", fromlist=["timezone"]).timezone.now() - loan.due_date
        ).days
        penalty = loan.penalties.filter(reason=Penalty.Reason.OVERDUE).first()
        penalty_amount = str(penalty.amount) if penalty else "0.50 per day"

        send_notification_email.delay(
            loan.reader_id,
            "overdue",
            {
                "book_title": loan.copy.book.title,
                "due_date": loan.due_date.strftime("%Y-%m-%d"),
                "days_overdue": days_overdue,
                "penalty_amount": penalty_amount,
            },
            loan_id=loan.pk,
        )


@app.task(bind=True, name="loans.cleanup_expired_reservations")
def cleanup_expired_reservations(self):
    """Cancel expired pending reservations. Every hour."""
    from apps.loans.services import cancel_expired_reservations
    return cancel_expired_reservations()


@app.task(bind=True, name="loans.block_accounts_overdue")
def block_accounts_overdue(self):
    """Block readers with loans overdue by more than 60 days. Weekly."""
    from apps.loans.services import get_overdue_loans_older_than
    from apps.notifications.tasks import send_notification_email
    from apps.users.services import block_user

    for loan in get_overdue_loans_older_than(days=60).distinct():
        if not loan.reader.is_blocked:
            block_user(
                loan.reader_id,
                reason="Account automatically blocked: loan overdue by more than 60 days.",
                admin=None,
            )
            send_notification_email.delay(
                loan.reader_id,
                "account_blocked",
                {
                    "reason": "Account automatically blocked: loan overdue by more than 60 days.",
                    "overdue_books": [loan.copy.book.title],
                },
            )
