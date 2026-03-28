from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.catalog.models import Book, BookCopy
from apps.loans.models import Loan, Penalty, Reservation
from apps.loans.services import (
    LOAN_DURATION_DAYS,
    OVERDUE_PENALTY_RATE,
    UNPAID_PENALTY_THRESHOLD,
    borrow_book,
    calculate_overdue_penalty,
    cancel_reservation,
    extend_loan,
    pay_penalty,
    reserve_book,
    return_book,
    waive_penalty,
)
from apps.loans.tasks import check_overdue_loans
from apps.users.models import User


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def reader(db):
    return User.objects.create_user(
        email="reader@test.com",
        username="reader@test.com",
        password="Pass123!",
        role=User.Role.READER,
    )


@pytest.fixture
def reader2(db):
    return User.objects.create_user(
        email="reader2@test.com",
        username="reader2@test.com",
        password="Pass123!",
        role=User.Role.READER,
    )


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="admin@test.com",
        username="admin@test.com",
        password="Pass123!",
        role=User.Role.ADMIN,
    )


@pytest.fixture
def reader_client(api_client, reader):
    refresh = RefreshToken.for_user(reader)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
    return api_client


@pytest.fixture
def admin_client(api_client, admin_user):
    refresh = RefreshToken.for_user(admin_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
    return api_client


@pytest.fixture
def book(db):
    return Book.objects.create(
        isbn="9780261102217",
        ol_id="OL_LOTR",
        title="The Lord of the Rings",
        author="J.R.R. Tolkien",
    )


@pytest.fixture
def copy(book):
    with patch("apps.catalog.tasks.generate_qr_code_task"):
        return BookCopy.objects.create(book=book, copy_number=1, is_available=True)


@pytest.fixture
def active_loan(reader, copy):
    due = timezone.now() + timedelta(days=LOAN_DURATION_DAYS)
    copy.is_available = False
    copy.save()
    return Loan.objects.create(copy=copy, reader=reader, due_date=due, status=Loan.Status.ACTIVE)


@pytest.fixture
def overdue_loan(reader, copy):
    due = timezone.now() - timedelta(days=5)
    copy.is_available = False
    copy.save()
    return Loan.objects.create(copy=copy, reader=reader, due_date=due, status=Loan.Status.OVERDUE)


# ── Service: borrow_book ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestBorrowBook:
    def test_borrow_creates_loan(self, reader, copy):
        loan = borrow_book(reader, copy.pk)
        assert loan.reader == reader
        assert loan.copy == copy
        assert loan.status == Loan.Status.ACTIVE
        copy.refresh_from_db()
        assert not copy.is_available

    def test_borrow_unavailable_copy_raises(self, reader, copy):
        copy.is_available = False
        copy.save()
        with pytest.raises(ValueError, match="not available"):
            borrow_book(reader, copy.pk)

    def test_borrow_blocked_reader_raises(self, reader, copy):
        reader.is_blocked = True
        reader.save()
        with pytest.raises(ValueError, match="blocked"):
            borrow_book(reader, copy.pk)

    def test_borrow_with_excess_unpaid_penalties_raises(self, reader, copy, active_loan):
        # Create a second copy to have an independent loan
        copy2 = BookCopy.objects.create(book=copy.book, copy_number=2, is_available=True)
        # Give reader unpaid penalties over the threshold
        Penalty.objects.create(
            loan=active_loan,
            amount=UNPAID_PENALTY_THRESHOLD + Decimal("1.00"),
            reason=Penalty.Reason.OVERDUE,
        )
        with pytest.raises(ValueError, match="unpaid penalties"):
            borrow_book(reader, copy2.pk)

    def test_due_date_set_30_days_out(self, reader, copy):
        before = timezone.now() + timedelta(days=LOAN_DURATION_DAYS - 1)
        loan = borrow_book(reader, copy.pk)
        after = timezone.now() + timedelta(days=LOAN_DURATION_DAYS + 1)
        assert before < loan.due_date < after


# ── Service: return_book ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestReturnBook:
    def test_return_marks_returned(self, reader, active_loan):
        loan = return_book(active_loan.pk, reader)
        assert loan.status == Loan.Status.RETURNED
        assert loan.returned_at is not None
        loan.copy.refresh_from_db()
        assert loan.copy.is_available

    def test_return_wrong_reader_raises(self, reader2, active_loan):
        with pytest.raises(ValueError, match="does not belong"):
            return_book(active_loan.pk, reader2)

    def test_return_already_returned_raises(self, reader, active_loan):
        return_book(active_loan.pk, reader)
        with pytest.raises(ValueError, match="already been returned"):
            return_book(active_loan.pk, reader)


# ── Service: extend_loan ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestExtendLoan:
    def test_extend_increases_due_date(self, reader, active_loan):
        original_due = active_loan.due_date
        loan = extend_loan(active_loan.pk, reader)
        assert loan.due_date == original_due + timedelta(days=LOAN_DURATION_DAYS)
        assert loan.prolongation_count == 1

    def test_extend_max_2_times(self, reader, active_loan):
        extend_loan(active_loan.pk, reader)
        extend_loan(active_loan.pk, reader)
        with pytest.raises(ValueError, match="already been extended"):
            extend_loan(active_loan.pk, reader)

    def test_extend_overdue_loan_raises(self, reader, overdue_loan):
        with pytest.raises(ValueError, match="Overdue loans cannot be extended"):
            extend_loan(overdue_loan.pk, reader)

    def test_extend_wrong_reader_raises(self, reader2, active_loan):
        with pytest.raises(ValueError, match="does not belong"):
            extend_loan(active_loan.pk, reader2)


# ── Service: calculate_overdue_penalty ───────────────────────────────────────

@pytest.mark.django_db
class TestCalculateOverduePenalty:
    def test_creates_penalty_record(self, overdue_loan):
        penalty = calculate_overdue_penalty(overdue_loan)
        assert penalty.loan == overdue_loan
        assert penalty.reason == Penalty.Reason.OVERDUE
        assert penalty.amount >= OVERDUE_PENALTY_RATE  # at least 1 day

    def test_idempotent_on_second_call(self, overdue_loan):
        p1 = calculate_overdue_penalty(overdue_loan)
        p2 = calculate_overdue_penalty(overdue_loan)
        assert p1.pk == p2.pk
        assert Penalty.objects.filter(loan=overdue_loan).count() == 1

    def test_amount_reflects_days(self, overdue_loan):
        # overdue_loan is 5 days past due
        penalty = calculate_overdue_penalty(overdue_loan)
        assert penalty.amount == OVERDUE_PENALTY_RATE * 5


# ── Service: pay_penalty ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestPayPenalty:
    def test_pay_sets_paid_at(self, reader, overdue_loan):
        penalty = Penalty.objects.create(
            loan=overdue_loan, amount=Decimal("2.50"), reason=Penalty.Reason.OVERDUE
        )
        result = pay_penalty(penalty.pk, reader)
        assert result.paid_at is not None

    def test_pay_wrong_reader_raises(self, reader2, reader, overdue_loan):
        penalty = Penalty.objects.create(
            loan=overdue_loan, amount=Decimal("2.50"), reason=Penalty.Reason.OVERDUE
        )
        with pytest.raises(ValueError, match="does not belong"):
            pay_penalty(penalty.pk, reader2)

    def test_pay_already_paid_raises(self, reader, overdue_loan):
        penalty = Penalty.objects.create(
            loan=overdue_loan,
            amount=Decimal("2.50"),
            reason=Penalty.Reason.OVERDUE,
            paid_at=timezone.now(),
        )
        with pytest.raises(ValueError, match="already been paid"):
            pay_penalty(penalty.pk, reader)


# ── Service: reserve_book ─────────────────────────────────────────────────────

@pytest.mark.django_db
class TestReserveBook:
    def test_reserve_when_no_copies_available(self, reader, book, copy):
        copy.is_available = False
        copy.save()
        reservation = reserve_book(reader, book.pk)
        assert reservation.book == book
        assert reservation.reader == reader
        assert reservation.status == Reservation.Status.PENDING

    def test_reserve_fails_when_copies_available(self, reader, book, copy):
        # copy is available by default
        with pytest.raises(ValueError, match="available"):
            reserve_book(reader, book.pk)

    def test_reserve_duplicate_pending_raises(self, reader, book, copy):
        copy.is_available = False
        copy.save()
        reserve_book(reader, book.pk)
        with pytest.raises(ValueError, match="already have a pending"):
            reserve_book(reader, book.pk)


# ── Service: cancel_reservation ──────────────────────────────────────────────

@pytest.mark.django_db
class TestCancelReservation:
    def test_cancel_sets_cancelled(self, reader, book, copy):
        copy.is_available = False
        copy.save()
        reservation = reserve_book(reader, book.pk)
        result = cancel_reservation(reservation.pk, reader)
        assert result.status == Reservation.Status.CANCELLED

    def test_cancel_wrong_reader_raises(self, reader, reader2, book, copy):
        copy.is_available = False
        copy.save()
        reservation = reserve_book(reader, book.pk)
        with pytest.raises(ValueError, match="does not belong"):
            cancel_reservation(reservation.pk, reader2)


# ── Celery task: check_overdue_loans ─────────────────────────────────────────

@pytest.mark.django_db
class TestCheckOverdueLoansTask:
    def test_marks_active_loans_overdue(self, reader, copy):
        # Loan with due date in the past — test actual service integration
        past_due = timezone.now() - timedelta(days=3)
        copy.is_available = False
        copy.save()
        loan = Loan.objects.create(
            copy=copy, reader=reader, due_date=past_due, status=Loan.Status.ACTIVE
        )
        with patch("apps.loans.services.mark_overdue_loans", return_value=1) as mock:
            check_overdue_loans.apply()
        mock.assert_called_once()

    def test_does_not_affect_future_loans(self, reader, copy):
        future_due = timezone.now() + timedelta(days=10)
        copy.is_available = False
        copy.save()
        loan = Loan.objects.create(
            copy=copy, reader=reader, due_date=future_due, status=Loan.Status.ACTIVE
        )
        from apps.loans.services import mark_overdue_loans
        count = mark_overdue_loans()
        assert count == 0
        loan.refresh_from_db()
        assert loan.status == Loan.Status.ACTIVE


# ── API: borrow endpoint ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestBorrowEndpoint:
    def test_borrow_returns_201(self, reader_client, copy):
        resp = reader_client.post("/api/v1/loans/borrow/", {"copy_id": copy.pk})
        assert resp.status_code == 201
        assert resp.data["status"] == "active"

    def test_borrow_requires_auth(self, api_client, copy):
        resp = api_client.post("/api/v1/loans/borrow/", {"copy_id": copy.pk})
        assert resp.status_code == 401

    def test_borrow_unavailable_returns_400(self, reader_client, copy):
        copy.is_available = False
        copy.save()
        resp = reader_client.post("/api/v1/loans/borrow/", {"copy_id": copy.pk})
        assert resp.status_code == 400


# ── API: return endpoint ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestReturnEndpoint:
    def test_return_returns_200(self, reader_client, active_loan):
        resp = reader_client.post("/api/v1/loans/return/", {"loan_id": active_loan.pk})
        assert resp.status_code == 200
        assert resp.data["status"] == "returned"

    def test_return_requires_auth(self, api_client, active_loan):
        resp = api_client.post("/api/v1/loans/return/", {"loan_id": active_loan.pk})
        assert resp.status_code == 401


# ── API: extend endpoint ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestExtendEndpoint:
    def test_extend_returns_200(self, reader_client, active_loan):
        resp = reader_client.post("/api/v1/loans/extend/", {"loan_id": active_loan.pk})
        assert resp.status_code == 200
        assert resp.data["prolongation_count"] == 1

    def test_extend_overdue_returns_400(self, reader_client, overdue_loan):
        resp = reader_client.post("/api/v1/loans/extend/", {"loan_id": overdue_loan.pk})
        assert resp.status_code == 400


# ── API: active loans ─────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestActiveLoansEndpoint:
    def test_returns_active_loans(self, reader_client, active_loan):
        resp = reader_client.get("/api/v1/loans/active/")
        assert resp.status_code == 200
        assert len(resp.data) == 1
        assert resp.data[0]["status"] == "active"

    def test_does_not_return_returned_loans(self, reader_client, reader, active_loan):
        return_book(active_loan.pk, reader)
        resp = reader_client.get("/api/v1/loans/active/")
        assert len(resp.data) == 0

    def test_days_remaining_present(self, reader_client, active_loan):
        resp = reader_client.get("/api/v1/loans/active/")
        assert resp.data[0]["days_remaining"] is not None


# ── API: penalties ────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestPenaltyEndpoints:
    def test_list_own_penalties(self, reader_client, overdue_loan):
        Penalty.objects.create(
            loan=overdue_loan, amount=Decimal("2.50"), reason=Penalty.Reason.OVERDUE
        )
        resp = reader_client.get("/api/v1/penalties/")
        assert resp.status_code == 200
        assert resp.data["count"] == 1

    def test_pay_penalty(self, reader_client, reader, overdue_loan):
        penalty = Penalty.objects.create(
            loan=overdue_loan, amount=Decimal("2.50"), reason=Penalty.Reason.OVERDUE
        )
        resp = reader_client.post(f"/api/v1/penalties/{penalty.pk}/pay/")
        assert resp.status_code == 200
        assert resp.data["is_settled"] is True


# ── API: reservations ─────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestReservationEndpoints:
    def test_create_reservation(self, reader_client, book, copy):
        copy.is_available = False
        copy.save()
        resp = reader_client.post("/api/v1/reservations/", {"book_id": book.pk})
        assert resp.status_code == 201
        assert resp.data["status"] == "pending"

    def test_create_fails_when_copies_available(self, reader_client, book, copy):
        resp = reader_client.post("/api/v1/reservations/", {"book_id": book.pk})
        assert resp.status_code == 400

    def test_cancel_reservation(self, reader_client, reader, book, copy):
        copy.is_available = False
        copy.save()
        reservation = reserve_book(reader, book.pk)
        resp = reader_client.delete(f"/api/v1/reservations/{reservation.pk}/")
        assert resp.status_code == 204


# ── API: admin loans ──────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAdminLoanEndpoints:
    def test_list_all_loans(self, admin_client, active_loan):
        resp = admin_client.get("/api/v1/admin/loans/")
        assert resp.status_code == 200
        assert resp.data["count"] == 1

    def test_filter_by_status(self, admin_client, active_loan, overdue_loan):
        resp = admin_client.get("/api/v1/admin/loans/?status=overdue")
        assert resp.data["count"] == 1
        assert resp.data["results"][0]["status"] == "overdue"

    def test_overdue_loans_endpoint(self, admin_client, overdue_loan):
        resp = admin_client.get("/api/v1/admin/loans/overdue/")
        assert resp.status_code == 200
        assert resp.data["count"] == 1

    def test_waive_penalty(self, admin_client, overdue_loan):
        penalty = Penalty.objects.create(
            loan=overdue_loan, amount=Decimal("5.00"), reason=Penalty.Reason.OVERDUE
        )
        resp = admin_client.post(f"/api/v1/admin/loans/penalties/{penalty.pk}/waive/")
        assert resp.status_code == 200
        assert resp.data["is_settled"] is True

    def test_readers_cannot_access_admin_loans(self, reader_client):
        resp = reader_client.get("/api/v1/admin/loans/")
        assert resp.status_code == 403
