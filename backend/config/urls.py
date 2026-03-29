from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


def health_check(request):
    return JsonResponse({"status": "ok", "version": "1.0.0"})


urlpatterns = [
    path("api/v1/health/", health_check, name="health_check"),
    path("django-admin/", admin.site.urls),
    path("api/v1/auth/", include("apps.users.urls")),
    path("api/v1/catalog/", include("apps.catalog.urls")),
    path("api/v1/open-library/", include("apps.catalog.open_library_urls")),
    path("api/v1/loans/", include("apps.loans.urls")),
    path("api/v1/penalties/", include("apps.loans.penalties_urls")),
    path("api/v1/reservations/", include("apps.loans.reservations_urls")),
    path("api/v1/notifications/", include("apps.notifications.urls")),
    path("api/v1/stats/", include("apps.stats.reader_urls")),
    path("api/v1/admin/", include("apps.stats.urls")),
    # OpenAPI schema
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]
