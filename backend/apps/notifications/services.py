from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db.models import Count, Q
from django.template.loader import render_to_string
from django.utils import timezone

from apps.notifications.models import Notification

DEDUP_WINDOW_HOURS = 24

TEMPLATE_MAP = {
    Notification.Type.REMINDER: "notifications/reminder.html",
    Notification.Type.OVERDUE: "notifications/overdue.html",
    Notification.Type.RESERVATION_READY: "notifications/reservation_ready.html",
    Notification.Type.ACCOUNT_BLOCKED: "notifications/account_blocked.html",
}

SUBJECT_MAP = {
    Notification.Type.REMINDER: "Reminder: Your loan is due in {days} day(s)",
    Notification.Type.OVERDUE: "Overdue loan: {book_title}",
    Notification.Type.RESERVATION_READY: "Your reserved book is available: {book_title}",
    Notification.Type.ACCOUNT_BLOCKED: "Your account has been blocked",
}


def send_notification_email(
    user_id: int,
    notification_type: str,
    context: dict,
    loan_id: int | None = None,
) -> Notification:
    """
    Create a Notification record, render the HTML template, send via Django mail backend.

    Duplicate prevention: if the same type+user+loan was sent within DEDUP_WINDOW_HOURS,
    skip silently and return the existing record.

    Never raises — stores error_message on failure so callers stay clean.
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()

    user = User.objects.get(pk=user_id)

    # Deduplication check
    window_start = timezone.now() - timedelta(hours=DEDUP_WINDOW_HOURS)
    dup_qs = Notification.objects.filter(
        user=user,
        type=notification_type,
        sent_at__gte=window_start,
        is_sent=True,
    )
    if loan_id:
        dup_qs = dup_qs.filter(loan_id=loan_id)
    if dup_qs.exists():
        return dup_qs.first()

    notification = Notification.objects.create(
        user=user,
        type=notification_type,
        loan_id=loan_id,
        channel=Notification.Channel.EMAIL,
    )

    try:
        template = TEMPLATE_MAP.get(notification_type)
        if not template:
            raise ValueError(f"No template registered for notification type: {notification_type}")

        # Enrich context with user info and app URLs
        render_context = {
            "user_name": user.get_full_name() or user.email,
            "dashboard_url": getattr(settings, "FRONTEND_URL", "http://localhost:3000") + "/loans",
            "extend_url": getattr(settings, "FRONTEND_URL", "http://localhost:3000") + "/loans",
            "borrow_url": getattr(settings, "FRONTEND_URL", "http://localhost:3000") + "/catalog",
            "book_url": getattr(settings, "FRONTEND_URL", "http://localhost:3000") + "/catalog",
            **context,
        }

        html_body = render_to_string(template, render_context)

        # Build subject from template
        raw_subject = SUBJECT_MAP.get(notification_type, "Notification from Internet Library")
        subject = raw_subject.format(**context)

        plain_text = _html_to_plain(render_context)

        send_mail(
            subject=subject,
            message=plain_text,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_body,
            fail_silently=False,
        )

        notification.is_sent = True
        notification.save(update_fields=["is_sent"])

    except Exception as exc:  # noqa: BLE001
        notification.error_message = str(exc)
        notification.save(update_fields=["error_message"])
        raise  # re-raise so Celery can retry

    return notification


def _html_to_plain(context: dict) -> str:
    """Generate a minimal plain-text fallback from context values."""
    lines = ["Internet Library — Notification\n"]
    for key, value in context.items():
        if isinstance(value, str) and key not in ("dashboard_url", "extend_url", "borrow_url", "book_url"):
            lines.append(f"{key.replace('_', ' ').title()}: {value}")
    lines.append(f"\nVisit: {context.get('dashboard_url', 'http://localhost:3000')}")
    return "\n".join(lines)


def get_user_notifications(user):
    """Return notification history for a reader."""
    return Notification.objects.filter(user=user).select_related("loan")


def get_notification_stats() -> dict:
    """Return counts by notification type and sent status (admin use)."""
    by_type = (
        Notification.objects.values("type")
        .annotate(total=Count("id"), sent=Count("id", filter=Q(is_sent=True)))
        .order_by("type")
    )
    return {
        "by_type": list(by_type),
        "total": Notification.objects.count(),
        "sent": Notification.objects.filter(is_sent=True).count(),
        "failed": Notification.objects.filter(is_sent=False, error_message__gt="").count(),
    }
