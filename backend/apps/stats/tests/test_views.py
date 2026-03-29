from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalog.models import Book, BookCopy
from apps.loans.models import Loan, Penalty, Reservation
from apps.notifications.models import Notification
from apps.stats.services import DASHBOARD_CACHE_KEY
from apps.users.models import User


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="admin@test.com",
        password="testpass",
        username="admin_test",
        role="admin",
    )


@pytest.fixture
def reader_user(db):
    return User.objects.create_user(
        email="reader@test.com",
        password="testpass",
        username="reader_test",
        role="reader",
    )


@pytest.fixture
def book(db):
    return Book.objects.create(
        ol_id="OL1",
        isbn="1234567890",
        title="Test Book",
        author="Test Author",
        genres=["Fiction", "Drama"],
    )


@pytest.fixture
def book_copy(book):
    return BookCopy.objects.create(book=book, copy_number=1)


@pytest.fixture
def active_loan(db, book_copy, reader_user):
    return Loan.objects.create(
        copy=book_copy,
        reader=reader_user,
        due_date=timezone.now() + timedelta(days=7),
        status="active",
    )


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


# ---------------------------------------------------------------------------
# Dashboard stats
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestDashboardStats:
    def test_returns_correct_counts(self, client, admin_user, reader_user, active_loan):
        client.force_authenticate(user=admin_user)
        resp = client.get("/api/v1/admin/stats/dashboard/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_users"] >= 2
        assert data["total_readers"] >= 1
        assert data["active_loans"] >= 1
        assert "total_books" in data
        assert "available_copies" in data
        assert "total_penalties_unpaid" in data
        assert "total_penalties_collected" in data

    def test_requires_admin_role(self, client, reader_user):
        client.force_authenticate(user=reader_user)
        resp = client.get("/api/v1/admin/stats/dashboard/")
        assert resp.status_code == 403

    def test_requires_authentication(self, client):
        resp = client.get("/api/v1/admin/stats/dashboard/")
        assert resp.status_code == 401

    def test_penalty_sums_are_correct(self, client, admin_user, active_loan):
        Penalty.objects.create(loan=active_loan, amount=Decimal("5.00"), reason="overdue")
        Penalty.objects.create(
            loan=active_loan,
            amount=Decimal("3.00"),
            reason="damage",
            paid_at=timezone.now(),
        )
        client.force_authenticate(user=admin_user)
        resp = client.get("/api/v1/admin/stats/dashboard/")
        data = resp.json()
        assert Decimal(data["total_penalties_unpaid"]) >= Decimal("5.00")
        assert Decimal(data["total_penalties_collected"]) >= Decimal("3.00")


# ---------------------------------------------------------------------------
# Loans per month
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestLoansPerMonth:
    def test_returns_list_with_correct_structure(self, client, admin_user, active_loan):
        client.force_authenticate(user=admin_user)
        resp = client.get("/api/v1/admin/stats/loans-per-month/")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        if data:
            entry = data[0]
            assert "month" in entry
            assert "year" in entry
            assert "count" in entry

    def test_respects_months_param(self, client, admin_user):
        client.force_authenticate(user=admin_user)
        resp = client.get("/api/v1/admin/stats/loans-per-month/?months=1")
        assert resp.status_code == 200

    def test_counts_loans_in_range(self, client, admin_user, active_loan):
        client.force_authenticate(user=admin_user)
        resp = client.get("/api/v1/admin/stats/loans-per-month/?months=12")
        data = resp.json()
        total = sum(e["count"] for e in data)
        assert total >= 1


# ---------------------------------------------------------------------------
# Most borrowed books
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestMostBorrowedBooks:
    def test_returns_required_fields(self, client, admin_user, active_loan):
        client.force_authenticate(user=admin_user)
        resp = client.get("/api/v1/admin/stats/most-borrowed-books/")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        if data:
            assert {"id", "title", "author", "cover_url", "loan_count"} <= data[0].keys()

    def test_ordering_descending(self, client, admin_user, book, reader_user):
        book2 = Book.objects.create(
            ol_id="OL2", isbn="9876543210", title="Book 2", author="Author 2"
        )
        copy2 = BookCopy.objects.create(book=book2, copy_number=1)
        copy1 = BookCopy.objects.create(book=book, copy_number=2)
        # book2 gets 2 loans, book gets 1
        for _ in range(2):
            Loan.objects.create(
                copy=copy2,
                reader=reader_user,
                due_date=timezone.now() + timedelta(days=7),
                status="returned",
                returned_at=timezone.now(),
            )
        Loan.objects.create(
            copy=copy1,
            reader=reader_user,
            due_date=timezone.now() + timedelta(days=7),
            status="returned",
            returned_at=timezone.now(),
        )
        client.force_authenticate(user=admin_user)
        resp = client.get("/api/v1/admin/stats/most-borrowed-books/")
        data = resp.json()
        assert len(data) >= 2
        assert data[0]["loan_count"] >= data[1]["loan_count"]


# ---------------------------------------------------------------------------
# Reader stats
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestReaderStats:
    def test_active_loans_counted(self, client, reader_user, active_loan):
        client.force_authenticate(user=reader_user)
        resp = client.get("/api/v1/stats/me/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["active_loans_count"] == 1
        assert data["overdue_loans_count"] == 0
        assert data["total_books_read"] == 0

    def test_returned_loans_counted(self, client, reader_user, book_copy):
        Loan.objects.create(
            copy=book_copy,
            reader=reader_user,
            due_date=timezone.now() - timedelta(days=1),
            status="returned",
            returned_at=timezone.now(),
        )
        client.force_authenticate(user=reader_user)
        resp = client.get("/api/v1/stats/me/")
        data = resp.json()
        assert data["total_books_read"] == 1

    def test_overdue_loans_counted(self, client, reader_user, book_copy):
        Loan.objects.create(
            copy=book_copy,
            reader=reader_user,
            due_date=timezone.now() - timedelta(days=5),
            status="overdue",
        )
        client.force_authenticate(user=reader_user)
        resp = client.get("/api/v1/stats/me/")
        data = resp.json()
        assert data["overdue_loans_count"] == 1

    def test_unpaid_penalty_total(self, client, reader_user, active_loan):
        Penalty.objects.create(loan=active_loan, amount=Decimal("12.50"), reason="overdue")
        client.force_authenticate(user=reader_user)
        resp = client.get("/api/v1/stats/me/")
        data = resp.json()
        assert Decimal(data["unpaid_penalties_total"]) == Decimal("12.50")

    def test_requires_authentication(self, client):
        resp = client.get("/api/v1/stats/me/")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Overdue report
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestOverdueReport:
    def test_lists_overdue_readers(self, client, admin_user, reader_user, book_copy):
        Loan.objects.create(
            copy=book_copy,
            reader=reader_user,
            due_date=timezone.now() - timedelta(days=3),
            status="overdue",
        )
        client.force_authenticate(user=admin_user)
        resp = client.get("/api/v1/admin/stats/overdue-report/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        entry = next((e for e in data if e["email"] == reader_user.email), None)
        assert entry is not None
        assert entry["overdue_loans_count"] >= 1

    def test_excludes_non_overdue_readers(self, client, admin_user, reader_user, active_loan):
        client.force_authenticate(user=admin_user)
        resp = client.get("/api/v1/admin/stats/overdue-report/")
        data = resp.json()
        emails = [e["email"] for e in data]
        assert reader_user.email not in emails

    def test_requires_admin(self, client, reader_user):
        client.force_authenticate(user=reader_user)
        resp = client.get("/api/v1/admin/stats/overdue-report/")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Redis cache set and invalidated on new loan
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestCacheBehaviour:
    def test_cache_populated_after_dashboard_request(self, client, admin_user):
        client.force_authenticate(user=admin_user)
        assert cache.get(DASHBOARD_CACHE_KEY) is None
        client.get("/api/v1/admin/stats/dashboard/")
        assert cache.get(DASHBOARD_CACHE_KEY) is not None

    def test_cache_invalidated_when_new_loan_created(self, client, admin_user, book_copy, reader_user):
        client.force_authenticate(user=admin_user)
        client.get("/api/v1/admin/stats/dashboard/")
        assert cache.get(DASHBOARD_CACHE_KEY) is not None

        Loan.objects.create(
            copy=book_copy,
            reader=reader_user,
            due_date=timezone.now() + timedelta(days=7),
            status="active",
        )
        assert cache.get(DASHBOARD_CACHE_KEY) is None

    def test_cache_invalidated_when_new_penalty_created(self, client, admin_user, active_loan):
        client.force_authenticate(user=admin_user)
        client.get("/api/v1/admin/stats/dashboard/")
        assert cache.get(DASHBOARD_CACHE_KEY) is not None

        Penalty.objects.create(loan=active_loan, amount=Decimal("5.00"), reason="overdue")
        assert cache.get(DASHBOARD_CACHE_KEY) is None

    def test_cache_invalidated_when_new_reservation_created(self, client, admin_user, book, reader_user):
        client.force_authenticate(user=admin_user)
        client.get("/api/v1/admin/stats/dashboard/")
        assert cache.get(DASHBOARD_CACHE_KEY) is not None

        Reservation.objects.create(
            book=book,
            reader=reader_user,
            expires_at=timezone.now() + timedelta(days=3),
            status="pending",
        )
        assert cache.get(DASHBOARD_CACHE_KEY) is None
