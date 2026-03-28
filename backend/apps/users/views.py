import base64
import io
import urllib.parse

import qrcode
from django_otp.plugins.otp_totp.models import TOTPDevice
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

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.register_user(serializer.validated_data)
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserProfileSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
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

        refresh = RefreshToken.for_user(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "mfa_required": user.mfa_enabled,
            "user": UserProfileSerializer(user).data,
        })


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


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    http_method_names = ["get", "patch"]

    def get_object(self):
        return self.request.user


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

class MfaSetupView(APIView):
    def post(self, request):
        user = request.user
        # Remove any stale unconfirmed devices before starting fresh
        TOTPDevice.objects.filter(user=user, confirmed=False).delete()

        device = TOTPDevice.objects.create(user=user, name="default", confirmed=False)
        uri = _build_totp_uri(device)
        qr_b64 = _make_qr_png_b64(uri)

        return Response({"otpauth_uri": uri, "qr_png_base64": qr_b64})


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


class MfaDisableView(APIView):
    def post(self, request):
        TOTPDevice.objects.filter(user=request.user).delete()
        services.disable_mfa(request.user)
        return Response({"detail": "MFA disabled."})


# ── Admin user management ─────────────────────────────────────────────────────

class AdminUserListView(generics.ListAPIView):
    serializer_class = UserAdminSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    filterset_fields = ["role", "is_blocked"]
    search_fields = ["email", "first_name", "last_name"]

    def get_queryset(self):
        return User.objects.all()


class AdminUserDetailView(generics.RetrieveAPIView):
    serializer_class = UserAdminSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    queryset = User.objects.all()


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
