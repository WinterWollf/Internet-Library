from django.urls import path

from apps.stats.views import PublicStatsView, ReaderStatsView

urlpatterns = [
    path("public/", PublicStatsView.as_view(), name="stats_public"),
    path("me/", ReaderStatsView.as_view(), name="reader_stats"),
]
