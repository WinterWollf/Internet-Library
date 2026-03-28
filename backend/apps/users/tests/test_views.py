from unittest.mock import patch

import pytest
from django.urls import reverse
from django_otp.plugins.otp_totp.models import TOTPDevice
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

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
        password="SecurePass123!",
        first_name="Jane",
        last_name="Doe",
        role=User.Role.READER,
        gender=User.Gender.FEMALE,
    )


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="admin@test.com",
        username="admin@test.com",
        password="AdminPass123!",
        first_name="Admin",
        last_name="User",
        role=User.Role.ADMIN,
    )


@pytest.fixture
def reader_client(api_client, reader):
    api_client.force_authenticate(user=reader)
    return api_client


@pytest.fixture
def admin_client(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    return api_client


# ── Registration ──────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestRegister:
    url = "/api/v1/auth/register/"

    def test_register_success(self, api_client):
        resp = api_client.post(self.url, {
            "first_name": "Alice",
            "last_name": "Smith",
            "email": "alice@example.com",
            "password": "StrongPass1!",
            "confirm_password": "StrongPass1!",
            "gender": "female",
        })
        assert resp.status_code == 201
        assert "access" in resp.data
        assert "refresh" in resp.data
        assert resp.data["user"]["email"] == "alice@example.com"
        assert resp.data["user"]["avatar_url"] == "/static/avatars/female.png"
        assert User.objects.filter(email="alice@example.com").exists()

    def test_register_duplicate_email(self, api_client, reader):
        resp = api_client.post(self.url, {
            "first_name": "Jane",
            "last_name": "Duplicate",
            "email": reader.email,
            "password": "StrongPass1!",
            "confirm_password": "StrongPass1!",
        })
        assert resp.status_code == 400

    def test_register_passwords_mismatch(self, api_client):
        resp = api_client.post(self.url, {
            "first_name": "Bob",
            "last_name": "Test",
            "email": "bob@example.com",
            "password": "StrongPass1!",
            "confirm_password": "DifferentPass1!",
        })
        assert resp.status_code == 400

    def test_register_weak_password(self, api_client):
        resp = api_client.post(self.url, {
            "first_name": "Bob",
            "last_name": "Test",
            "email": "bob@example.com",
            "password": "1234",
            "confirm_password": "1234",
        })
        assert resp.status_code == 400

    def test_register_male_avatar(self, api_client):
        resp = api_client.post(self.url, {
            "first_name": "Bob",
            "last_name": "Test",
            "email": "bob2@example.com",
            "password": "StrongPass1!",
            "confirm_password": "StrongPass1!",
            "gender": "male",
        })
        assert resp.status_code == 201
        assert resp.data["user"]["avatar_url"] == "/static/avatars/male.png"


# ── Login ─────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestLogin:
    url = "/api/v1/auth/login/"

    def test_login_success(self, api_client, reader):
        resp = api_client.post(self.url, {
            "email": reader.email,
            "password": "SecurePass123!",
        })
        assert resp.status_code == 200
        assert "access" in resp.data
        assert "refresh" in resp.data
        assert resp.data["mfa_required"] is False

    def test_login_invalid_password(self, api_client, reader):
        resp = api_client.post(self.url, {
            "email": reader.email,
            "password": "WrongPassword",
        })
        assert resp.status_code == 401
        assert resp.data["code"] == "INVALID_CREDENTIALS"

    def test_login_nonexistent_email(self, api_client):
        resp = api_client.post(self.url, {
            "email": "nobody@example.com",
            "password": "SomePass123!",
        })
        assert resp.status_code == 401

    def test_login_blocked_user_returns_403(self, api_client, reader):
        reader.is_blocked = True
        reader.save()
        resp = api_client.post(self.url, {
            "email": reader.email,
            "password": "SecurePass123!",
        })
        assert resp.status_code == 403
        assert resp.data["code"] == "ACCOUNT_BLOCKED"

    def test_login_mfa_required_flag(self, api_client, reader):
        reader.mfa_enabled = True
        reader.save()
        resp = api_client.post(self.url, {
            "email": reader.email,
            "password": "SecurePass123!",
        })
        assert resp.status_code == 200
        assert resp.data["mfa_required"] is True


# ── Token refresh ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTokenRefresh:
    url = "/api/v1/auth/token/refresh/"

    def test_refresh_success(self, api_client, reader):
        refresh = str(RefreshToken.for_user(reader))
        resp = api_client.post(self.url, {"refresh": refresh})
        assert resp.status_code == 200
        assert "access" in resp.data

    def test_refresh_invalid_token(self, api_client):
        resp = api_client.post(self.url, {"refresh": "not.a.token"})
        assert resp.status_code == 401


# ── Logout ────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestLogout:
    url = "/api/v1/auth/logout/"

    def test_logout_success(self, reader_client, reader):
        refresh = str(RefreshToken.for_user(reader))
        resp = reader_client.post(self.url, {"refresh": refresh})
        assert resp.status_code == 204

    def test_logout_missing_token(self, reader_client):
        resp = reader_client.post(self.url, {})
        assert resp.status_code == 400
        assert resp.data["code"] == "MISSING_TOKEN"

    def test_logout_requires_auth(self, api_client):
        resp = api_client.post(self.url, {"refresh": "sometoken"})
        assert resp.status_code == 401


# ── Profile ───────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestProfile:
    url = "/api/v1/auth/profile/"

    def test_get_profile(self, reader_client, reader):
        resp = reader_client.get(self.url)
        assert resp.status_code == 200
        assert resp.data["email"] == reader.email
        assert resp.data["first_name"] == reader.first_name
        assert resp.data["avatar_url"] == "/static/avatars/female.png"

    def test_update_profile(self, reader_client, reader):
        resp = reader_client.patch(self.url, {"first_name": "Updated", "phone": "+48 100 200 300"})
        assert resp.status_code == 200
        assert resp.data["first_name"] == "Updated"
        assert resp.data["phone"] == "+48 100 200 300"
        reader.refresh_from_db()
        assert reader.first_name == "Updated"

    def test_email_is_read_only(self, reader_client, reader):
        resp = reader_client.patch(self.url, {"email": "changed@example.com"})
        assert resp.status_code == 200
        reader.refresh_from_db()
        assert reader.email == "reader@test.com"  # unchanged

    def test_profile_requires_auth(self, api_client):
        resp = api_client.get(self.url)
        assert resp.status_code == 401

    def test_admin_avatar_url(self, admin_client):
        resp = admin_client.get(self.url)
        assert resp.status_code == 200
        assert resp.data["avatar_url"] == "/static/avatars/admin.png"


# ── Change password ───────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestChangePassword:
    url = "/api/v1/auth/change-password/"

    def test_change_password_success(self, reader_client, reader):
        resp = reader_client.post(self.url, {
            "current_password": "SecurePass123!",
            "new_password": "NewSecure456!",
            "confirm_new_password": "NewSecure456!",
        })
        assert resp.status_code == 200
        reader.refresh_from_db()
        assert reader.check_password("NewSecure456!")

    def test_wrong_current_password(self, reader_client):
        resp = reader_client.post(self.url, {
            "current_password": "WrongOldPass!",
            "new_password": "NewSecure456!",
            "confirm_new_password": "NewSecure456!",
        })
        assert resp.status_code == 400

    def test_new_passwords_mismatch(self, reader_client):
        resp = reader_client.post(self.url, {
            "current_password": "SecurePass123!",
            "new_password": "NewSecure456!",
            "confirm_new_password": "DifferentPass!",
        })
        assert resp.status_code == 400


# ── MFA ───────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestMfa:
    setup_url = "/api/v1/auth/mfa/setup/"
    verify_url = "/api/v1/auth/mfa/verify/"
    disable_url = "/api/v1/auth/mfa/disable/"

    def test_mfa_setup_returns_qr(self, reader_client, reader):
        resp = reader_client.post(self.setup_url)
        assert resp.status_code == 200
        assert "otpauth_uri" in resp.data
        assert "qr_png_base64" in resp.data
        assert TOTPDevice.objects.filter(user=reader, confirmed=False).exists()

    def test_mfa_setup_replaces_existing_unconfirmed(self, reader_client, reader):
        reader_client.post(self.setup_url)
        reader_client.post(self.setup_url)
        assert TOTPDevice.objects.filter(user=reader, confirmed=False).count() == 1

    def test_mfa_verify_success(self, reader_client, reader):
        reader_client.post(self.setup_url)
        device = TOTPDevice.objects.get(user=reader, confirmed=False)

        with patch.object(TOTPDevice, "verify_token", return_value=True):
            resp = reader_client.post(self.verify_url, {"code": "123456"})

        assert resp.status_code == 200
        reader.refresh_from_db()
        assert reader.mfa_enabled is True
        device.refresh_from_db()
        assert device.confirmed is True

    def test_mfa_verify_invalid_code(self, reader_client, reader):
        reader_client.post(self.setup_url)

        with patch.object(TOTPDevice, "verify_token", return_value=False):
            resp = reader_client.post(self.verify_url, {"code": "000000"})

        assert resp.status_code == 400
        assert resp.data["code"] == "INVALID_CODE"

    def test_mfa_verify_no_pending_setup(self, reader_client):
        resp = reader_client.post(self.verify_url, {"code": "123456"})
        assert resp.status_code == 400
        assert resp.data["code"] == "NO_MFA_SETUP"

    def test_mfa_disable(self, reader_client, reader):
        reader.mfa_enabled = True
        reader.save()
        TOTPDevice.objects.create(user=reader, name="default", confirmed=True)

        resp = reader_client.post(self.disable_url)
        assert resp.status_code == 200
        reader.refresh_from_db()
        assert reader.mfa_enabled is False
        assert not TOTPDevice.objects.filter(user=reader).exists()

    def test_mfa_requires_auth(self, api_client):
        resp = api_client.post(self.setup_url)
        assert resp.status_code == 401


# ── Admin user management ─────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAdminUserManagement:
    list_url = "/api/v1/admin/users/"

    def test_list_users_as_admin(self, admin_client, reader):
        resp = admin_client.get(self.list_url)
        assert resp.status_code == 200
        emails = [u["email"] for u in resp.data["results"]]
        assert reader.email in emails

    def test_list_users_forbidden_for_reader(self, reader_client):
        resp = reader_client.get(self.list_url)
        assert resp.status_code == 403

    def test_list_users_requires_auth(self, api_client):
        resp = api_client.get(self.list_url)
        assert resp.status_code == 401

    def test_get_user_detail(self, admin_client, reader):
        resp = admin_client.get(f"{self.list_url}{reader.pk}/")
        assert resp.status_code == 200
        assert resp.data["email"] == reader.email

    def test_block_user(self, admin_client, reader):
        resp = admin_client.post(
            f"{self.list_url}{reader.pk}/block/",
            {"reason": "Overdue penalties"},
        )
        assert resp.status_code == 200
        reader.refresh_from_db()
        assert reader.is_blocked is True
        assert reader.blocked_reason == "Overdue penalties"

    def test_block_user_requires_reason(self, admin_client, reader):
        resp = admin_client.post(f"{self.list_url}{reader.pk}/block/", {})
        assert resp.status_code == 400
        assert resp.data["code"] == "REASON_REQUIRED"

    def test_block_nonexistent_user(self, admin_client):
        resp = admin_client.post("/api/v1/admin/users/99999/block/", {"reason": "test"})
        assert resp.status_code == 404

    def test_unblock_user(self, admin_client, reader):
        reader.is_blocked = True
        reader.blocked_reason = "Some reason"
        reader.save()

        resp = admin_client.post(f"{self.list_url}{reader.pk}/unblock/")
        assert resp.status_code == 200
        reader.refresh_from_db()
        assert reader.is_blocked is False
        assert reader.blocked_reason == ""

    def test_filter_by_role(self, admin_client, reader, admin_user):
        resp = admin_client.get(f"{self.list_url}?role=reader")
        assert resp.status_code == 200
        roles = [u["role"] for u in resp.data["results"]]
        assert all(r == "reader" for r in roles)

    def test_filter_by_blocked(self, admin_client, reader):
        reader.is_blocked = True
        reader.save()
        resp = admin_client.get(f"{self.list_url}?is_blocked=true")
        assert resp.status_code == 200
        assert any(u["email"] == reader.email for u in resp.data["results"])


# ── Blocked user middleware ───────────────────────────────────────────────────

@pytest.mark.django_db
class TestBlockedUserMiddleware:
    def test_blocked_user_gets_403_on_authenticated_request(self, api_client, reader):
        reader.is_blocked = True
        reader.save()
        # Must use a real JWT token so the middleware can resolve the user
        # from the Authorization header (force_authenticate bypasses middleware)
        refresh = RefreshToken.for_user(reader)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
        resp = api_client.get("/api/v1/auth/profile/")
        assert resp.status_code == 403
        # Middleware returns Django JsonResponse (no .data); use .json() to parse
        assert resp.json()["code"] == "ACCOUNT_BLOCKED"

    def test_unblocked_user_can_access(self, reader_client, reader):
        resp = reader_client.get("/api/v1/auth/profile/")
        assert resp.status_code == 200

    def test_blocked_unauthenticated_request_passes_through(self, api_client, reader):
        # Unauthenticated requests are not subject to the blocked-user check
        reader.is_blocked = True
        reader.save()
        resp = api_client.post("/api/v1/auth/login/", {
            "email": reader.email,
            "password": "SecurePass123!",
        })
        # Login view itself handles blocked check; middleware doesn't fire for anon
        assert resp.status_code == 403
        assert resp.data["code"] == "ACCOUNT_BLOCKED"
