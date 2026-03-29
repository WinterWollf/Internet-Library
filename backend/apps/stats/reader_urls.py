from django.urls import path

from apps.stats.views import ReaderStatsView

urlpatterns = [
    path("me/", ReaderStatsView.as_view(), name="reader_stats"),
]
