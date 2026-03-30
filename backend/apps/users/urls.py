from django.urls import path
from drf_spectacular.utils import extend_schema
from rest_framework_simplejwt.views import TokenRefreshView

from apps.users.views import (
    BlockSelfView,
    ChangePasswordView,
    DeleteAccountView,
    LoginView,
    LogoutView,
    MfaDisableView,
    MfaLoginView,
    MfaSetupView,
    MfaVerifyView,
    ProfileView,
    RegisterView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth_register"),
    path("login/", LoginView.as_view(), name="auth_login"),
    path("logout/", LogoutView.as_view(), name="auth_logout"),
    path(
        "token/refresh/",
        extend_schema(
            tags=["Auth"],
            summary="Refresh access token",
            description="Returns a new JWT access token (and optionally a rotated refresh token) in exchange for a valid refresh token.",
            auth=[],
        )(TokenRefreshView).as_view(),
        name="token_refresh",
    ),
    path("profile/", ProfileView.as_view(), name="auth_profile"),
    path("change-password/", ChangePasswordView.as_view(), name="auth_change_password"),
    path("mfa/setup/", MfaSetupView.as_view(), name="mfa_setup"),
    path("mfa/verify/", MfaVerifyView.as_view(), name="mfa_verify"),
    path("mfa/disable/", MfaDisableView.as_view(), name="mfa_disable"),
    path("mfa/login/", MfaLoginView.as_view(), name="mfa_login"),
    path("block-self/", BlockSelfView.as_view(), name="auth_block_self"),
    path("delete-account/", DeleteAccountView.as_view(), name="auth_delete_account"),
]
