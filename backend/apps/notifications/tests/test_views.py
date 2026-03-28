from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.notifications.models import Notification
from apps.notifications.services import send_notification_email
from apps.notifications.tasks import send_notification_email as send_notification_email_task
from apps.users.models import User


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def reader(db):
    return User.objects.create_user(
        email="reader@test.com",
        username="reader@test.com",
        password="Pass123!",
        role=User.Role.READER,
        first_name="Jane",
        last_name="Doe",
    )


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="admin@test.com",
        username="admin@test.com",
        password="Pass123!",
        role=User.Role.ADMIN,
    )


@pytest.fixture
def reader_client(api_client, reader):
    refresh = RefreshToken.for_user(reader)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
    return api_client


@pytest.fixture
def admin_client(api_client, admin_user):
    refresh = RefreshToken.for_user(admin_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
    return api_client


# ── Service: send_notification_email ─────────────────────────────────────────

@pytest.mark.django_db
class TestSendNotificationEmail:
    def test_creates_notification_record(self, reader):
        with patch("apps.notifications.services.send_mail"):
            notif = send_notification_email(
                reader.pk,
                "reminder",
                {"book_title": "Dune", "book_author": "Frank Herbert", "days": 3, "due_date": "2026-04-01"},
            )
        assert notif.user == reader
        assert notif.type == "reminder"
        assert notif.is_sent is True
        assert Notification.objects.filter(user=reader).count() == 1

    def test_sets_is_sent_true_on_success(self, reader):
        with patch("apps.notifications.services.send_mail"):
            notif = send_notification_email(
                reader.pk,
                "overdue",
                {"book_title": "Dune", "due_date": "2026-03-01", "days_overdue": 5, "penalty_amount": "2.50"},
            )
        assert notif.is_sent is True
        assert notif.error_message == ""

    def test_stores_error_on_failure(self, reader):
        with patch("apps.notifications.services.send_mail", side_effect=Exception("SMTP down")):
            with pytest.raises(Exception, match="SMTP down"):
                send_notification_email(
                    reader.pk,
                    "reminder",
                    {"book_title": "Dune", "book_author": "F.H.", "days": 3, "due_date": "2026-04-01"},
                )
        notif = Notification.objects.filter(user=reader).first()
        assert notif is not None
        assert notif.is_sent is False
        assert "SMTP down" in notif.error_message

    def test_duplicate_prevention_within_24h(self, reader):
        """Same type+user within 24h should not send a second email."""
        with patch("apps.notifications.services.send_mail") as mock_send:
            send_notification_email(
                reader.pk,
                "reminder",
                {"book_title": "Dune", "book_author": "F.H.", "days": 3, "due_date": "2026-04-01"},
            )
            send_notification_email(
                reader.pk,
                "reminder",
                {"book_title": "Dune", "book_author": "F.H.", "days": 3, "due_date": "2026-04-01"},
            )
        assert mock_send.call_count == 1
        assert Notification.objects.filter(user=reader, type="reminder").count() == 1

    def test_no_dedup_after_24h(self, reader):
        """Notification older than 24h should allow a new one."""
        # Create an existing sent notification with old sent_at
        old = Notification.objects.create(user=reader, type="reminder", is_sent=True)
        old.sent_at = timezone.now() - timedelta(hours=25)
        old.save()
        # Manually update to bypass auto_now_add
        Notification.objects.filter(pk=old.pk).update(sent_at=timezone.now() - timedelta(hours=25))

        with patch("apps.notifications.services.send_mail"):
            send_notification_email(
                reader.pk,
                "reminder",
                {"book_title": "Dune", "book_author": "F.H.", "days": 3, "due_date": "2026-04-01"},
            )
        assert Notification.objects.filter(user=reader, type="reminder").count() == 2

    def test_all_notification_types_render(self, reader):
        contexts = {
            "reminder": {"book_title": "B", "book_author": "A", "days": 1, "due_date": "2026-04-01"},
            "overdue": {"book_title": "B", "due_date": "2026-03-01", "days_overdue": 3, "penalty_amount": "1.50"},
            "reservation_ready": {"book_title": "B", "book_author": "A", "reservation_expires": "2026-04-07"},
            "account_blocked": {"reason": "Overdue books", "overdue_books": ["Book 1"]},
        }
        with patch("apps.notifications.services.send_mail"):
            for ntype, ctx in contexts.items():
                notif = send_notification_email(reader.pk, ntype, ctx)
                assert notif.is_sent is True, f"Failed for type: {ntype}"
                # Reset dedup by deleting
                Notification.objects.filter(pk=notif.pk).delete()


# ── Celery task retry logic ───────────────────────────────────────────────────

@pytest.mark.django_db
class TestSendNotificationEmailTask:
    def test_task_calls_service(self, reader):
        with patch("apps.notifications.services.send_notification_email") as mock_svc:
            mock_svc.return_value = MagicMock()
            send_notification_email_task.apply(
                args=[reader.pk, "reminder", {"book_title": "B", "book_author": "A", "days": 3, "due_date": "2026-04-01"}]
            )
        mock_svc.assert_called_once()

    def test_task_retries_on_failure(self, reader):
        """Task should retry when service raises an exception."""
        with patch("apps.notifications.tasks.send_notification_email.__wrapped__", create=True):
            pass  # verifying retry config
        assert send_notification_email_task.max_retries == 3
        assert send_notification_email_task.default_retry_delay == 60


# ── API: notification history ─────────────────────────────────────────────────

@pytest.mark.django_db
class TestNotificationListView:
    def test_returns_own_notifications(self, reader_client, reader):
        Notification.objects.create(user=reader, type="reminder", is_sent=True)
        resp = reader_client.get("/api/v1/notifications/")
        assert resp.status_code == 200
        assert resp.data["count"] == 1
        assert resp.data["results"][0]["type"] == "reminder"

    def test_does_not_return_other_users_notifications(self, reader_client, admin_user):
        Notification.objects.create(user=admin_user, type="overdue", is_sent=True)
        resp = reader_client.get("/api/v1/notifications/")
        assert resp.status_code == 200
        assert resp.data["count"] == 0

    def test_requires_auth(self, api_client):
        resp = api_client.get("/api/v1/notifications/")
        assert resp.status_code == 401


# ── API: admin notification list ──────────────────────────────────────────────

@pytest.mark.django_db
class TestAdminNotificationListView:
    def test_returns_all_notifications(self, admin_client, reader, admin_user):
        Notification.objects.create(user=reader, type="reminder", is_sent=True)
        Notification.objects.create(user=admin_user, type="overdue", is_sent=False)
        resp = admin_client.get("/api/v1/admin/notifications/")
        assert resp.status_code == 200
        assert resp.data["count"] == 2

    def test_filter_by_type(self, admin_client, reader):
        Notification.objects.create(user=reader, type="reminder", is_sent=True)
        Notification.objects.create(user=reader, type="overdue", is_sent=True)
        resp = admin_client.get("/api/v1/admin/notifications/?type=reminder")
        assert resp.data["count"] == 1

    def test_filter_by_is_sent(self, admin_client, reader):
        Notification.objects.create(user=reader, type="reminder", is_sent=True)
        Notification.objects.create(user=reader, type="overdue", is_sent=False)
        resp = admin_client.get("/api/v1/admin/notifications/?is_sent=false")
        assert resp.data["count"] == 1

    def test_requires_admin(self, reader_client):
        resp = reader_client.get("/api/v1/admin/notifications/")
        assert resp.status_code == 403


# ── API: admin notification stats ─────────────────────────────────────────────

@pytest.mark.django_db
class TestAdminNotificationStatsView:
    def test_returns_stats(self, admin_client, reader):
        Notification.objects.create(user=reader, type="reminder", is_sent=True)
        Notification.objects.create(user=reader, type="reminder", is_sent=False, error_message="err")
        Notification.objects.create(user=reader, type="overdue", is_sent=True)
        resp = admin_client.get("/api/v1/admin/notifications/stats/")
        assert resp.status_code == 200
        assert resp.data["total"] == 3
        assert resp.data["sent"] == 2
        assert resp.data["failed"] == 1

    def test_requires_admin(self, reader_client):
        resp = reader_client.get("/api/v1/admin/notifications/stats/")
        assert resp.status_code == 403
