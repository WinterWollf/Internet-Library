from datetime import timedelta
from decimal import Decimal

from django.db.models import Q, Sum
from django.utils import timezone

from apps.catalog.models import BookCopy
from apps.loans.models import Loan, Penalty, Reservation

LOAN_DURATION_DAYS = 30
RESERVATION_DURATION_DAYS = 7
MAX_PROLONGATIONS = 2
OVERDUE_PENALTY_RATE = Decimal("0.50")  # € per day
UNPAID_PENALTY_THRESHOLD = Decimal("10.00")
BLOCK_OVERDUE_DAYS = 60  # days overdue before auto-block


# ── Borrowing ─────────────────────────────────────────────────────────────────

def borrow_book(reader, copy_id: int) -> Loan:
    """
    Create a loan for reader+copy. Raises ValueError on any pre-condition failure.
    Sets copy.is_available=False atomically.
    """
    if reader.is_blocked:
        raise ValueError("Your account is blocked. You cannot borrow books.")

    copy = BookCopy.objects.select_related("book").get(pk=copy_id)
    if not copy.is_available:
        raise ValueError("This copy is not available for borrowing.")

    unpaid_total = (
        Penalty.objects.filter(loan__reader=reader, paid_at__isnull=True)
        .aggregate(total=Sum("amount"))["total"]
        or Decimal("0")
    )
    if unpaid_total > UNPAID_PENALTY_THRESHOLD:
        raise ValueError(
            f"You have unpaid penalties of €{unpaid_total:.2f}. "
            f"Please settle penalties over €{UNPAID_PENALTY_THRESHOLD:.2f} before borrowing."
        )

    due_date = timezone.now() + timedelta(days=LOAN_DURATION_DAYS)
    loan = Loan.objects.create(copy=copy, reader=reader, due_date=due_date)

    copy.is_available = False
    copy.save(update_fields=["is_available"])

    return loan


def return_book(loan_id: int, reader) -> Loan:
    """Mark a loan as returned and make the copy available again."""
    loan = Loan.objects.select_related("copy__book").get(pk=loan_id)

    if loan.reader_id != reader.pk:
        raise ValueError("This loan does not belong to you.")
    if loan.status == Loan.Status.RETURNED:
        raise ValueError("This loan has already been returned.")

    loan.returned_at = timezone.now()
    loan.status = Loan.Status.RETURNED
    loan.save(update_fields=["returned_at", "status"])

    loan.copy.is_available = True
    loan.copy.save(update_fields=["is_available"])

    # Notify readers with pending reservations for this book
    _notify_reservation_ready(loan.copy.book)

    return loan


def _notify_reservation_ready(book) -> None:
    """Trigger reservation_ready notifications for readers with pending reservations."""
    from apps.notifications.tasks import send_notification_email

    pending = Reservation.objects.filter(
        book=book, status=Reservation.Status.PENDING
    ).select_related("reader").order_by("reserved_at")

    for reservation in pending:
        send_notification_email.delay(
            reservation.reader_id,
            "reservation_ready",
            {
                "book_title": book.title,
                "book_author": book.author,
                "reservation_expires": reservation.expires_at.strftime("%Y-%m-%d"),
            },
        )


def extend_loan(loan_id: int, reader) -> Loan:
    """Extend a loan's due date by LOAN_DURATION_DAYS if conditions are met."""
    loan = Loan.objects.get(pk=loan_id)

    if loan.reader_id != reader.pk:
        raise ValueError("This loan does not belong to you.")
    if loan.status == Loan.Status.OVERDUE:
        raise ValueError("Overdue loans cannot be extended.")
    if loan.status == Loan.Status.RETURNED:
        raise ValueError("Returned loans cannot be extended.")
    if loan.prolongation_count >= MAX_PROLONGATIONS:
        raise ValueError(f"This loan has already been extended {MAX_PROLONGATIONS} time(s).")

    loan.due_date += timedelta(days=LOAN_DURATION_DAYS)
    loan.prolongation_count += 1
    loan.save(update_fields=["due_date", "prolongation_count"])

    return loan


# ── Penalties ─────────────────────────────────────────────────────────────────

def calculate_overdue_penalty(loan: Loan) -> Penalty:
    """
    Calculate €0.50/day overdue penalty. Idempotent — skips if overdue penalty exists.
    """
    existing = loan.penalties.filter(reason=Penalty.Reason.OVERDUE).first()
    if existing:
        return existing

    days_overdue = max((timezone.now() - loan.due_date).days, 1)
    amount = OVERDUE_PENALTY_RATE * days_overdue

    return Penalty.objects.create(loan=loan, amount=amount, reason=Penalty.Reason.OVERDUE)


def pay_penalty(penalty_id: int, reader) -> Penalty:
    """Mark a penalty as paid. Validates the penalty belongs to the reader."""
    penalty = Penalty.objects.select_related("loan").get(pk=penalty_id)

    if penalty.loan.reader_id != reader.pk:
        raise ValueError("This penalty does not belong to you.")
    if penalty.paid_at is not None:
        raise ValueError("This penalty has already been paid.")

    penalty.paid_at = timezone.now()
    penalty.save(update_fields=["paid_at"])

    return penalty


def waive_penalty(penalty_id: int, admin) -> Penalty:
    """Admin: waive a penalty (mark paid, record who waived it)."""
    penalty = Penalty.objects.get(pk=penalty_id)

    if penalty.paid_at is not None:
        raise ValueError("This penalty has already been settled.")

    penalty.paid_at = timezone.now()
    penalty.waived_by = admin
    penalty.save(update_fields=["paid_at", "waived_by"])

    return penalty


# ── Reservations ──────────────────────────────────────────────────────────────

def reserve_book(reader, book_id: int) -> Reservation:
    """
    Reserve a book when no copies are available.
    Raises ValueError if copies are currently available or reader already has a pending reservation.
    """
    from apps.catalog.models import Book

    book = Book.objects.get(pk=book_id)

    if book.copies.filter(is_available=True).exists():
        raise ValueError("Copies of this book are currently available. Please borrow directly.")

    if Reservation.objects.filter(
        book=book, reader=reader, status=Reservation.Status.PENDING
    ).exists():
        raise ValueError("You already have a pending reservation for this book.")

    expires_at = timezone.now() + timedelta(days=RESERVATION_DURATION_DAYS)
    return Reservation.objects.create(book=book, reader=reader, expires_at=expires_at)


def cancel_reservation(reservation_id: int, reader) -> Reservation:
    """Cancel a pending reservation."""
    reservation = Reservation.objects.get(pk=reservation_id)

    if reservation.reader_id != reader.pk:
        raise ValueError("This reservation does not belong to you.")
    if reservation.status != Reservation.Status.PENDING:
        raise ValueError("Only pending reservations can be cancelled.")

    reservation.status = Reservation.Status.CANCELLED
    reservation.save(update_fields=["status"])

    return reservation


# ── Queries ───────────────────────────────────────────────────────────────────

def get_active_loans(reader):
    """Active and overdue loans for reader, ordered by due_date ascending."""
    return (
        Loan.objects.select_related("copy__book")
        .filter(reader=reader, status__in=[Loan.Status.ACTIVE, Loan.Status.OVERDUE])
        .order_by("due_date")
    )


def get_loan_history(reader):
    """Returned loans for reader."""
    return (
        Loan.objects.select_related("copy__book")
        .filter(reader=reader, status=Loan.Status.RETURNED)
        .order_by("-returned_at")
    )


# ── Scheduled task helpers ────────────────────────────────────────────────────

def mark_overdue_loans() -> int:
    """
    Find active loans past due date, mark as overdue, create penalties.
    Idempotent — safe to call multiple times. Returns count of newly overdue loans.
    """
    now = timezone.now()
    overdue_qs = Loan.objects.filter(status=Loan.Status.ACTIVE, due_date__lt=now)

    count = 0
    for loan in overdue_qs.select_related("copy"):
        loan.status = Loan.Status.OVERDUE
        loan.save(update_fields=["status"])
        calculate_overdue_penalty(loan)
        count += 1

    return count


def cancel_expired_reservations() -> int:
    """Cancel pending reservations that have passed their expiry. Returns count."""
    now = timezone.now()
    updated = Reservation.objects.filter(
        status=Reservation.Status.PENDING, expires_at__lt=now
    ).update(status=Reservation.Status.CANCELLED)
    return updated


def get_loans_due_soon(days: int = 3):
    """Return active loans due within `days` days."""
    now = timezone.now()
    deadline = now + timedelta(days=days)
    return Loan.objects.select_related("reader", "copy__book").filter(
        status=Loan.Status.ACTIVE,
        due_date__gte=now,
        due_date__lte=deadline,
    )


def get_overdue_loans_older_than(days: int):
    """Return overdue loans where due_date is more than `days` days ago."""
    cutoff = timezone.now() - timedelta(days=days)
    return Loan.objects.select_related("reader").filter(
        status=Loan.Status.OVERDUE,
        due_date__lt=cutoff,
    )
