from django.contrib import admin
from django.db import models
from django.template.response import TemplateResponse


class LibraryStatsDashboard(models.Model):
    """Unmanaged proxy model used solely to attach a read-only admin page."""

    class Meta:
        app_label = "stats"
        managed = False
        verbose_name = "Statistics Dashboard"
        verbose_name_plural = "Statistics Dashboard"


@admin.register(LibraryStatsDashboard)
class LibraryStatsDashboardAdmin(admin.ModelAdmin):
    def changelist_view(self, request, extra_context=None):
        from apps.stats.services import get_dashboard_stats

        context = {
            **self.admin_site.each_context(request),
            "title": "Library Statistics Dashboard",
            "stats": get_dashboard_stats(),
            "opts": self.model._meta,
        }
        return TemplateResponse(request, "admin/stats/dashboard.html", context)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
