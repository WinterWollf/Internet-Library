from config.celery import app


@app.task(
    bind=True,
    name="notifications.send_notification_email",
    max_retries=3,
    default_retry_delay=60,
)
def send_notification_email(
    self,
    user_id: int,
    notification_type: str,
    context: dict,
    loan_id: int | None = None,
):
    """
    Async wrapper for send_notification_email service.
    Retries up to 3 times with a 60-second delay on email send failure.
    """
    from apps.notifications.services import send_notification_email as _send

    try:
        _send(user_id, notification_type, context, loan_id=loan_id)
    except Exception as exc:
        raise self.retry(exc=exc)
