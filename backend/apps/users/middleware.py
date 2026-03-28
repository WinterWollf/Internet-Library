from django.http import JsonResponse
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken


class BlockedUserMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = self._resolve_user(request)
        if user is not None and getattr(user, "is_blocked", False):
            return JsonResponse(
                {"error": "Your account has been blocked.", "code": "ACCOUNT_BLOCKED"},
                status=403,
            )
        return self.get_response(request)

    @staticmethod
    def _resolve_user(request):
        # Session-based auth (Django admin / session views)
        if hasattr(request, "user") and request.user.is_authenticated:
            return request.user
        # JWT Bearer token — DRF authenticates after middleware, so we parse it here
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if auth_header.startswith("Bearer "):
            try:
                user, _ = JWTAuthentication().authenticate(request)
                return user
            except (AuthenticationFailed, InvalidToken, TypeError):
                pass
        return None
