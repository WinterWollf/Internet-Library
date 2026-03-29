from datetime import timedelta

from django.core.cache import cache
from django.db.models import Count, Min, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from apps.catalog.models import Book, BookCopy
from apps.loans.models import Loan, Penalty, Reservation
from apps.notifications.models import Notification
from apps.users.models import User

DASHBOARD_CACHE_KEY = "stats_dashboard"
LOANS_PER_MONTH_CACHE_KEY_TPL = "stats_loans_per_month_{months}"
GENRES_CACHE_KEY_TPL = "stats_most_borrowed_genres_{limit}"


def get_dashboard_stats() -> dict:
    """Overall library statistics. Cached for 5 minutes."""
    cached = cache.get(DASHBOARD_CACHE_KEY)
    if cached is not None:
        return cached

    unpaid = (
        Penalty.objects.filter(paid_at=None, waived_by=None).aggregate(total=Sum("amount"))["total"] or 0
    )
    collected = (
        Penalty.objects.filter(paid_at__isnull=False).aggregate(total=Sum("amount"))["total"] or 0
    )

    result = {
        "total_users": User.objects.count(),
        "total_readers": User.objects.filter(role="reader").count(),
        "blocked_users": User.objects.filter(is_blocked=True).count(),
        "total_books": Book.objects.count(),
        "total_copies": BookCopy.objects.count(),
        "available_copies": BookCopy.objects.filter(is_available=True).count(),
        "active_loans": Loan.objects.filter(status="active").count(),
        "overdue_loans": Loan.objects.filter(status="overdue").count(),
        "pending_reservations": Reservation.objects.filter(status="pending").count(),
        "total_penalties_unpaid": unpaid,
        "total_penalties_collected": collected,
    }

    cache.set(DASHBOARD_CACHE_KEY, result, 60 * 5)
    return result


def get_loans_per_month(months: int = 6) -> list:
    """Loan counts grouped by month for the last N months. Cached for 1 hour."""
    cache_key = LOANS_PER_MONTH_CACHE_KEY_TPL.format(months=months)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    since = timezone.now() - timedelta(days=months * 31)
    qs = (
        Loan.objects.filter(borrowed_at__gte=since)
        .annotate(month=TruncMonth("borrowed_at"))
        .values("month")
        .annotate(count=Count("id"))
        .order_by("month")
    )

    data = [
        {"month": entry["month"].month, "year": entry["month"].year, "count": entry["count"]}
        for entry in qs
    ]

    cache.set(cache_key, data, 60 * 60)
    return data


def get_most_borrowed_books(limit: int = 10):
    """Top N books by total loan count, annotated with loan_count."""
    return (
        Book.objects.annotate(loan_count=Count("copies__loans", distinct=True))
        .order_by("-loan_count")[:limit]
    )


def get_most_borrowed_genres(limit: int = 5) -> list:
    """Top N genres by loan count with percentage share. Cached for 1 hour."""
    cache_key = GENRES_CACHE_KEY_TPL.format(limit=limit)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    # Fetch per-book loan counts along with the genres array, then aggregate in Python
    # to avoid raw SQL dependency on table naming conventions.
    books_data = list(
        Book.objects.annotate(loan_count=Count("copies__loans", distinct=True))
        .filter(loan_count__gt=0)
        .values_list("genres", "loan_count")
    )

    genre_counts: dict[str, int] = {}
    for genres, count in books_data:
        for genre in genres or []:
            genre_counts[genre] = genre_counts.get(genre, 0) + count

    top_genres = sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)[:limit]
    total = sum(count for _, count in top_genres) if top_genres else 0

    data = [
        {
            "genre": genre,
            "loan_count": count,
            "percentage": round(count / total * 100, 1) if total > 0 else 0,
        }
        for genre, count in top_genres
    ]

    cache.set(cache_key, data, 60 * 60)
    return data


def get_reader_stats(reader) -> dict:
    """Statistics for a single reader."""
    unpaid = (
        Penalty.objects.filter(loan__reader=reader, paid_at=None, waived_by=None).aggregate(
            total=Sum("amount")
        )["total"]
        or 0
    )

    return {
        "active_loans_count": Loan.objects.filter(reader=reader, status="active").count(),
        "total_books_read": Loan.objects.filter(reader=reader, status="returned").count(),
        "pending_reservations_count": Reservation.objects.filter(
            reader=reader, status="pending"
        ).count(),
        "unpaid_penalties_total": unpaid,
        "overdue_loans_count": Loan.objects.filter(reader=reader, status="overdue").count(),
    }


def get_overdue_report() -> list:
    """
    Readers with overdue loans: id, email, full name, overdue_loans_count,
    total_penalty (unpaid), oldest_overdue_date (earliest due_date of overdue loans).
    Ordered by oldest_overdue_date descending.
    """
    overdue_users = list(
        User.objects.filter(loans__status="overdue")
        .annotate(
            overdue_loans_count=Count("loans", filter=Q(loans__status="overdue"), distinct=True),
            oldest_overdue_date=Min("loans__due_date", filter=Q(loans__status="overdue")),
        )
        .values("id", "email", "first_name", "last_name", "overdue_loans_count", "oldest_overdue_date")
        .distinct()
        .order_by("-oldest_overdue_date")
    )

    # Compute unpaid penalty totals in a separate query to avoid join multiplication
    penalty_totals = {
        row["loan__reader_id"]: row["total"]
        for row in Penalty.objects.filter(
            loan__status="overdue", paid_at=None, waived_by=None
        )
        .values("loan__reader_id")
        .annotate(total=Sum("amount"))
    }

    return [
        {**user, "total_penalty": penalty_totals.get(user["id"])}
        for user in overdue_users
    ]


def get_popular_books_report(days: int = 30):
    """Books borrowed most in the last N days, annotated with loan_count."""
    since = timezone.now() - timedelta(days=days)
    return (
        Book.objects.annotate(
            loan_count=Count(
                "copies__loans",
                filter=Q(copies__loans__borrowed_at__gte=since),
                distinct=True,
            )
        )
        .filter(loan_count__gt=0)
        .order_by("-loan_count")
    )


def get_notification_stats() -> list:
    """Counts of notifications sent by type in the last 30 days."""
    since = timezone.now() - timedelta(days=30)
    return list(
        Notification.objects.filter(sent_at__gte=since)
        .values("type")
        .annotate(count=Count("id"))
        .order_by("type")
    )
