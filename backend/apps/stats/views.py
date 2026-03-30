from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from drf_spectacular.types import OpenApiTypes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsAdmin

from apps.stats.serializers import (
    DashboardStatsSerializer,
    LoansPerMonthSerializer,
    MostBorrowedBookSerializer,
    MostBorrowedGenreSerializer,
    OverdueReportSerializer,
    ReaderStatsSerializer,
)
from apps.stats.services import (
    get_dashboard_stats,
    get_loans_per_month,
    get_most_borrowed_books,
    get_most_borrowed_genres,
    get_notification_stats,
    get_overdue_report,
    get_popular_books_report,
    get_public_stats,
    get_reader_stats,
)


@extend_schema(
    tags=["Stats"],
    summary="Public library stats (homepage hero)",
    description="Returns total_books, total_users, and available_copies. No authentication required.",
    responses={200: {"type": "object", "properties": {
        "total_books": {"type": "integer"},
        "total_users": {"type": "integer"},
        "available_copies": {"type": "integer"},
    }}},
)
class PublicStatsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(get_public_stats())


@extend_schema(
    tags=["Stats"],
    summary="Get own reading statistics",
    description=(
        "Returns statistics for the authenticated reader: active and overdue loan counts, "
        "total books read (returned loans), pending reservations, and total unpaid penalties."
    ),
    responses={200: ReaderStatsSerializer},
)
class ReaderStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        stats = get_reader_stats(request.user)
        return Response(ReaderStatsSerializer(stats).data)


@extend_schema(
    tags=["Stats (Admin)"],
    summary="Library dashboard statistics",
    description=(
        "Returns a full snapshot of key library metrics: user counts, catalog size, "
        "copy availability, active/overdue loans, pending reservations, and penalty totals. "
        "Result is cached for 5 minutes."
    ),
    responses={200: DashboardStatsSerializer},
)
class AdminDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        return Response(DashboardStatsSerializer(get_dashboard_stats()).data)


@extend_schema(
    tags=["Stats (Admin)"],
    summary="Loans per month (chart data)",
    description=(
        "Returns monthly loan counts for the last N months, ordered chronologically. "
        "Suitable for rendering a time-series chart. Result is cached for 1 hour."
    ),
    parameters=[
        OpenApiParameter(
            name="months",
            type=OpenApiTypes.INT,
            location=OpenApiParameter.QUERY,
            required=False,
            default=6,
            description="Number of past months to include (default: 6).",
        ),
    ],
    responses={200: LoansPerMonthSerializer(many=True)},
)
class AdminLoansPerMonthView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        try:
            months = int(request.query_params.get("months", 6))
        except (ValueError, TypeError):
            months = 6
        data = get_loans_per_month(months)
        return Response(LoansPerMonthSerializer(data, many=True).data)


@extend_schema(
    tags=["Stats (Admin)"],
    summary="Most borrowed books",
    description="Returns the top N books ranked by total number of loans, highest first.",
    parameters=[
        OpenApiParameter(
            name="limit",
            type=OpenApiTypes.INT,
            location=OpenApiParameter.QUERY,
            required=False,
            default=10,
            description="Maximum number of books to return (default: 10).",
        ),
    ],
    responses={200: MostBorrowedBookSerializer(many=True)},
)
class AdminMostBorrowedBooksView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        try:
            limit = int(request.query_params.get("limit", 10))
        except (ValueError, TypeError):
            limit = 10
        books = get_most_borrowed_books(limit)
        return Response(MostBorrowedBookSerializer(books, many=True).data)


@extend_schema(
    tags=["Stats (Admin)"],
    summary="Most borrowed genres",
    description=(
        "Returns the top N genres by total loan count, including each genre's percentage share. "
        "Result is cached for 1 hour."
    ),
    parameters=[
        OpenApiParameter(
            name="limit",
            type=OpenApiTypes.INT,
            location=OpenApiParameter.QUERY,
            required=False,
            default=5,
            description="Maximum number of genres to return (default: 5).",
        ),
    ],
    responses={200: MostBorrowedGenreSerializer(many=True)},
)
class AdminMostBorrowedGenresView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        try:
            limit = int(request.query_params.get("limit", 5))
        except (ValueError, TypeError):
            limit = 5
        data = get_most_borrowed_genres(limit)
        return Response(MostBorrowedGenreSerializer(data, many=True).data)


@extend_schema(
    tags=["Stats (Admin)"],
    summary="Overdue report",
    description=(
        "Returns a list of all readers who currently have overdue loans, "
        "including each reader's overdue loan count, total unpaid penalty amount, "
        "and the due date of their oldest overdue loan."
    ),
    responses={200: OverdueReportSerializer(many=True)},
)
class AdminOverdueReportView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        report = get_overdue_report()
        return Response(OverdueReportSerializer(report, many=True).data)


@extend_schema(
    tags=["Stats (Admin)"],
    summary="Popular books (recent loans)",
    description="Returns books with the most loans in the last N days, ordered by loan count descending.",
    parameters=[
        OpenApiParameter(
            name="days",
            type=OpenApiTypes.INT,
            location=OpenApiParameter.QUERY,
            required=False,
            default=30,
            description="Look-back window in days (default: 30).",
        ),
    ],
    responses={200: MostBorrowedBookSerializer(many=True)},
)
class AdminPopularBooksView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        try:
            days = int(request.query_params.get("days", 30))
        except (ValueError, TypeError):
            days = 30
        books = get_popular_books_report(days)
        return Response(MostBorrowedBookSerializer(books, many=True).data)


@extend_schema(
    tags=["Stats (Admin)"],
    summary="Notification statistics (last 30 days)",
    description=(
        "Returns counts of notifications sent grouped by type over the last 30 days. "
        "Each entry contains `type` and `count`."
    ),
    responses={
        200: OpenApiResponse(description="Array of `{type, count}` objects for notifications in the last 30 days."),
    },
)
class AdminStatsNotificationsView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        return Response(get_notification_stats())
