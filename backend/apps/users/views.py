import base64
import io
import urllib.parse

import qrcode
from django.core import signing
from django_otp.plugins.otp_totp.models import TOTPDevice
from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.users import services
from apps.users.models import User
from apps.users.permissions import IsAdmin
from apps.users.serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    RegisterSerializer,
    UserAdminSerializer,
    UserProfileSerializer,
)


def _build_totp_uri(device: TOTPDevice) -> str:
    """Build a standard otpauth:// URI for authenticator apps."""
    issuer = "Internet Library"
    label = urllib.parse.quote(f"{issuer}:{device.user.email}", safe="")
    secret = base64.b32encode(device.bin_key).decode("utf-8")
    params = urllib.parse.urlencode({
        "secret": secret,
        "issuer": issuer,
        "digits": device.digits,
        "period": device.step,
    })
    return f"otpauth://totp/{label}?{params}"


def _make_qr_png_b64(uri: str) -> str:
    """Return a base64-encoded PNG of the QR code for the given URI."""
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


# ── Auth endpoints ────────────────────────────────────────────────────────────

@extend_schema(
    tags=["Auth"],
    summary="Register a new reader account",
    description=(
        "Creates a new reader account and immediately returns JWT access and refresh tokens "
        "alongside the user profile. No authentication required."
    ),
    auth=[],
    request=RegisterSerializer,
    responses={
        201: OpenApiResponse(description="Registration successful — returns `access`, `refresh` and `user` profile."),
        400: OpenApiResponse(description="Validation error (e.g. email already taken, passwords don't match)."),
    },
)
def _token_pair(user):
    """Return a RefreshToken with email and role claims embedded."""
    refresh = RefreshToken.for_user(user)
    refresh["email"] = user.email
    refresh["role"] = user.role
    refresh.access_token["email"] = user.email
    refresh.access_token["role"] = user.role
    return refresh


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.register_user(serializer.validated_data)
        refresh = _token_pair(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserProfileSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


@extend_schema(
    tags=["Auth"],
    summary="Login with email and password",
    description=(
        "Authenticates the user and returns JWT tokens. "
        "If the account has MFA enabled, `mfa_required` will be `true` — "
        "the client should then verify the TOTP code via `POST /api/v1/auth/mfa/verify/` "
        "before granting access."
    ),
    auth=[],
    request=LoginSerializer,
    responses={
        200: OpenApiResponse(description="Login successful — returns `access`, `refresh`, `mfa_required` and `user` profile."),
        401: OpenApiResponse(description="Invalid email or password."),
        403: OpenApiResponse(description="Account is blocked."),
    },
)
class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = services.authenticate_user(
                email=serializer.validated_data["email"],
                password=serializer.validated_data["password"],
            )
        except ValueError as exc:
            return Response(
                {"error": str(exc), "code": "INVALID_CREDENTIALS"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if user.is_blocked:
            return Response(
                {"error": "Your account has been blocked.", "code": "ACCOUNT_BLOCKED"},
                status=status.HTTP_403_FORBIDDEN,
            )

        if user.mfa_enabled:
            mfa_token = signing.dumps(
                {"user_id": user.id}, salt="mfa-login"
            )
            return Response({"mfa_required": True, "mfa_token": mfa_token})

        refresh = _token_pair(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "mfa_required": False,
            "user": UserProfileSerializer(user).data,
        })


@extend_schema(
    tags=["Auth"],
    summary="Logout — blacklist refresh token",
    description=(
        "Blacklists the provided refresh token so it can no longer be used to obtain new access tokens. "
        "The current access token remains valid until its natural expiry."
    ),
    responses={
        204: OpenApiResponse(description="Logged out successfully."),
        400: OpenApiResponse(description="Refresh token missing or invalid."),
    },
)
class LogoutView(APIView):
    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"error": "Refresh token required.", "code": "MISSING_TOKEN"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            return Response(
                {"error": "Invalid or expired token.", "code": "INVALID_TOKEN"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema_view(
    get=extend_schema(
        tags=["Auth"],
        summary="Get own profile",
        responses={200: UserProfileSerializer},
    ),
    patch=extend_schema(
        tags=["Auth"],
        summary="Update own profile",
        description="Partially updates the authenticated user's profile. Editable fields: `first_name`, `last_name`, `phone`, `gender`.",
        responses={200: UserProfileSerializer},
    ),
)
class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    http_method_names = ["get", "patch"]

    def get_object(self):
        return self.request.user


@extend_schema(
    tags=["Auth"],
    summary="Change password",
    description="Changes the authenticated user's password. Requires the current password for verification.",
    request=ChangePasswordSerializer,
    responses={
        200: OpenApiResponse(description="Password updated successfully."),
        400: OpenApiResponse(description="Current password incorrect, or new passwords don't match."),
    },
)
class ChangePasswordView(APIView):
    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response({"detail": "Password updated successfully."})


# ── MFA endpoints ─────────────────────────────────────────────────────────────

@extend_schema(
    tags=["Auth"],
    summary="Start MFA setup — get TOTP QR code",
    description=(
        "Generates a new TOTP device for the authenticated user and returns an `otpauth://` URI "
        "together with a base64-encoded QR code PNG. Scan the QR code in an authenticator app "
        "(Google Authenticator, Authy, etc.), then confirm setup with `POST /api/v1/auth/mfa/verify/`."
    ),
    responses={
        200: OpenApiResponse(description="Returns `otpauth_uri` string and `qr_png_base64` encoded PNG."),
    },
)
class MfaSetupView(APIView):
    def post(self, request):
        user = request.user
        # Remove any stale unconfirmed devices before starting fresh
        TOTPDevice.objects.filter(user=user, confirmed=False).delete()

        device = TOTPDevice.objects.create(user=user, name="default", confirmed=False)
        uri = _build_totp_uri(device)
        qr_b64 = _make_qr_png_b64(uri)

        return Response({"otpauth_uri": uri, "qr_png_base64": qr_b64})


@extend_schema(
    tags=["Auth"],
    summary="Verify TOTP code and activate MFA",
    description=(
        "Confirms the pending TOTP device by submitting the 6-digit code from the authenticator app. "
        "On success the device is marked confirmed and `mfa_enabled` is set to `true` on the user account."
    ),
    responses={
        200: OpenApiResponse(description="MFA activated successfully."),
        400: OpenApiResponse(description="Invalid TOTP code, or no pending MFA setup found for this user."),
    },
)
class MfaVerifyView(APIView):
    def post(self, request):
        code = request.data.get("code", "")
        user = request.user

        device = TOTPDevice.objects.filter(user=user, confirmed=False).first()
        if device is None:
            return Response(
                {"error": "No pending MFA setup found.", "code": "NO_MFA_SETUP"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not device.verify_token(code):
            return Response(
                {"error": "Invalid code.", "code": "INVALID_CODE"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        device.confirmed = True
        device.save(update_fields=["confirmed"])
        services.enable_mfa(user)
        return Response({"detail": "MFA enabled successfully."})


@extend_schema(
    tags=["Auth"],
    summary="Disable MFA",
    description="Removes all TOTP devices for the user and sets `mfa_enabled` to `false`.",
    responses={
        200: OpenApiResponse(description="MFA disabled successfully."),
    },
)
class MfaDisableView(APIView):
    def post(self, request):
        TOTPDevice.objects.filter(user=request.user).delete()
        services.disable_mfa(request.user)
        return Response({"detail": "MFA disabled."})


@extend_schema(
    tags=["Auth"],
    summary="Complete login with MFA code",
    description=(
        "Second step of the MFA login flow. "
        "Accepts the short-lived `mfa_token` returned by `POST /api/v1/auth/login/` "
        "and a 6-digit TOTP `code`. "
        "On success issues full JWT access and refresh tokens. "
        "The token is valid for 5 minutes."
    ),
    auth=[],
    responses={
        200: OpenApiResponse(description="MFA verified — returns `access`, `refresh` and `user` profile."),
        400: OpenApiResponse(description="Invalid or expired MFA token, or wrong TOTP code."),
    },
)
class MfaLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        mfa_token = request.data.get("mfa_token", "")
        code = request.data.get("code", "")

        try:
            payload = signing.loads(mfa_token, salt="mfa-login", max_age=300)
        except signing.SignatureExpired:
            return Response(
                {"error": "MFA session expired. Please log in again.", "code": "MFA_EXPIRED"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except signing.BadSignature:
            return Response(
                {"error": "Invalid MFA token.", "code": "MFA_INVALID_TOKEN"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(pk=payload["user_id"])
        except User.DoesNotExist:
            return Response(
                {"error": "Invalid MFA token.", "code": "MFA_INVALID_TOKEN"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        device = TOTPDevice.objects.filter(user=user, confirmed=True).first()
        if device is None or not device.verify_token(code):
            return Response(
                {"error": "Invalid code.", "code": "MFA_INVALID"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        refresh = _token_pair(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserProfileSerializer(user).data,
        })


# ── Self-service account actions ──────────────────────────────────────────────

@extend_schema(
    tags=["Auth"],
    summary="Block own account",
    description="Reader can request their own account to be blocked. Requires re-activation by an admin.",
    responses={200: OpenApiResponse(description="Account blocked.")},
)
class BlockSelfView(APIView):
    def post(self, request):
        user = request.user
        user.is_blocked = True
        user.blocked_reason = "Self-blocked by user"
        user.save(update_fields=["is_blocked", "blocked_reason"])
        return Response({"detail": "Your account has been blocked."})


@extend_schema(
    tags=["Auth"],
    summary="Delete own account",
    description="Permanently deletes the authenticated user's account and all associated data.",
    responses={
        204: OpenApiResponse(description="Account deleted."),
    },
)
class DeleteAccountView(APIView):
    def delete(self, request):
        request.user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Admin user management ─────────────────────────────────────────────────────

@extend_schema(
    tags=["Users (Admin)"],
    summary="List all users",
    description=(
        "Returns a paginated list of all registered users. "
        "Filter by `role` (`reader` | `admin`) or `is_blocked`. "
        "Search by `email`, `first_name`, or `last_name`."
    ),
    responses={200: UserAdminSerializer(many=True)},
)
class AdminUserListView(generics.ListAPIView):
    serializer_class = UserAdminSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    filterset_fields = ["role", "is_blocked"]
    search_fields = ["email", "first_name", "last_name"]

    def get_queryset(self):
        return User.objects.all()


@extend_schema(
    tags=["Users (Admin)"],
    summary="Get user details",
    responses={
        200: UserAdminSerializer,
        404: OpenApiResponse(description="User not found."),
    },
)
class AdminUserDetailView(generics.RetrieveAPIView):
    serializer_class = UserAdminSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    queryset = User.objects.all()


@extend_schema(
    tags=["Users (Admin)"],
    summary="Block a user",
    description=(
        "Blocks the specified user account. A non-empty `reason` is required. "
        "Blocked users receive a 403 Forbidden on every authenticated request."
    ),
    responses={
        200: UserAdminSerializer,
        400: OpenApiResponse(description="Block reason is required."),
        404: OpenApiResponse(description="User not found."),
    },
)
class AdminBlockUserView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        reason = request.data.get("reason", "").strip()
        if not reason:
            return Response(
                {"error": "Block reason is required.", "code": "REASON_REQUIRED"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            user = services.block_user(pk, reason, request.user)
        except User.DoesNotExist:
            return Response(
                {"error": "User not found.", "code": "NOT_FOUND"},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(UserAdminSerializer(user).data)


@extend_schema(
    tags=["Users (Admin)"],
    summary="Unblock a user",
    description="Removes the block from the specified user account, restoring normal access.",
    responses={
        200: UserAdminSerializer,
        404: OpenApiResponse(description="User not found."),
    },
)
class AdminUnblockUserView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        try:
            user = services.unblock_user(pk, request.user)
        except User.DoesNotExist:
            return Response(
                {"error": "User not found.", "code": "NOT_FOUND"},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(UserAdminSerializer(user).data)
