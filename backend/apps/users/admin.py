from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from apps.users.models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["email", "first_name", "last_name", "role", "is_blocked", "mfa_enabled", "is_active"]
    list_filter = ["role", "is_blocked", "mfa_enabled", "is_active"]
    search_fields = ["email", "first_name", "last_name"]
    ordering = ["email"]
    fieldsets = BaseUserAdmin.fieldsets + (
        (
            "Library",
            {"fields": ("role", "is_blocked", "blocked_reason", "mfa_enabled", "gender", "phone")},
        ),
    )
