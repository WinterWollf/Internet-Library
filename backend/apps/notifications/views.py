from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications.serializers import NotificationSerializer
from apps.notifications.services import get_notification_stats, get_user_notifications
from apps.users.permissions import IsAdmin


class NotificationListView(APIView):
    """GET /api/v1/notifications/ — reader's own notification history."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = get_user_notifications(request.user)
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(notifications, request)
        return paginator.get_paginated_response(NotificationSerializer(page, many=True).data)


class AdminNotificationListView(APIView):
    """GET /api/v1/admin/notifications/ — all notifications with filtering."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        from apps.notifications.models import Notification

        qs = Notification.objects.select_related("user").all()

        if ntype := request.query_params.get("type"):
            qs = qs.filter(type=ntype)
        if is_sent := request.query_params.get("is_sent"):
            qs = qs.filter(is_sent=is_sent.lower() == "true")
        if user_id := request.query_params.get("user"):
            qs = qs.filter(user_id=user_id)

        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(NotificationSerializer(page, many=True).data)


class AdminNotificationStatsView(APIView):
    """GET /api/v1/admin/notifications/stats/ — counts by type and status."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        return Response(get_notification_stats())
