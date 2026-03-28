from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from apps.users.views import (
    ChangePasswordView,
    LoginView,
    LogoutView,
    MfaDisableView,
    MfaSetupView,
    MfaVerifyView,
    ProfileView,
    RegisterView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth_register"),
    path("login/", LoginView.as_view(), name="auth_login"),
    path("logout/", LogoutView.as_view(), name="auth_logout"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("profile/", ProfileView.as_view(), name="auth_profile"),
    path("change-password/", ChangePasswordView.as_view(), name="auth_change_password"),
    path("mfa/setup/", MfaSetupView.as_view(), name="mfa_setup"),
    path("mfa/verify/", MfaVerifyView.as_view(), name="mfa_verify"),
    path("mfa/disable/", MfaDisableView.as_view(), name="mfa_disable"),
]
