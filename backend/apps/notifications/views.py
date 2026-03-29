from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from drf_spectacular.types import OpenApiTypes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications.serializers import NotificationSerializer
from apps.notifications.services import get_notification_stats, get_user_notifications
from apps.users.permissions import IsAdmin


@extend_schema(
    tags=["Notifications"],
    summary="List own notifications",
    description="Returns a paginated history of all notifications sent to the authenticated reader.",
    responses={200: NotificationSerializer(many=True)},
)
class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = get_user_notifications(request.user)
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(notifications, request)
        return paginator.get_paginated_response(NotificationSerializer(page, many=True).data)


@extend_schema(
    tags=["Notifications (Admin)"],
    summary="List all notifications",
    description=(
        "Returns a paginated list of all notifications sent to all users. "
        "Filter by `type` (`reminder` | `overdue` | `reservation_ready` | `account_blocked`), "
        "`is_sent` (`true` | `false`), or `user` (user ID)."
    ),
    parameters=[
        OpenApiParameter(
            name="type",
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            required=False,
            enum=["reminder", "overdue", "reservation_ready", "account_blocked"],
            description="Filter by notification type.",
        ),
        OpenApiParameter(
            name="is_sent",
            type=OpenApiTypes.BOOL,
            location=OpenApiParameter.QUERY,
            required=False,
            description="Filter by delivery status (`true` = sent successfully, `false` = failed).",
        ),
        OpenApiParameter(
            name="user",
            type=OpenApiTypes.INT,
            location=OpenApiParameter.QUERY,
            required=False,
            description="Filter by recipient user ID.",
        ),
    ],
    responses={200: NotificationSerializer(many=True)},
)
class AdminNotificationListView(APIView):
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


@extend_schema(
    tags=["Notifications (Admin)"],
    summary="Notification delivery statistics",
    description=(
        "Returns aggregate counts of notifications broken down by type and delivery status. "
        "Includes totals for all time."
    ),
    responses={
        200: OpenApiResponse(description="Returns `by_type` array with `type`, `total` and `sent` counts, plus overall `total`, `sent` and `failed` totals."),
    },
)
class AdminNotificationStatsView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        return Response(get_notification_stats())
