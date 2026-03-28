from django.contrib import admin

from apps.notifications.models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["user", "type", "channel", "is_sent", "sent_at"]
    list_filter = ["type", "is_sent", "channel"]
    search_fields = ["user__email"]
    readonly_fields = ["sent_at", "error_message"]
