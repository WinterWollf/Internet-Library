from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.catalog.models import Book, BookCopy


class Loan(models.Model):
    """Records a single borrow event: one reader borrowing one physical copy for a fixed period."""

    # State machine: ACTIVE → OVERDUE (by daily task) or ACTIVE → RETURNED (by return service).
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        RETURNED = "returned", "Returned"
        OVERDUE = "overdue", "Overdue"

    # PROTECT: prevent deleting a copy or user that still has loan history.
    copy = models.ForeignKey(BookCopy, on_delete=models.PROTECT, related_name="loans")
    reader = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="loans"
    )
    borrowed_at = models.DateTimeField(auto_now_add=True)
    due_date = models.DateTimeField()
    returned_at = models.DateTimeField(null=True, blank=True)
    # Tracks how many times this loan has been extended; the service layer enforces a max.
    prolongation_count = models.PositiveSmallIntegerField(default=0)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.ACTIVE
    )

    class Meta:
        ordering = ["-borrowed_at"]
        indexes = [
            models.Index(fields=["reader", "status"]),
            models.Index(fields=["copy", "status"]),
        ]

    def __str__(self):
        # Used in admin, notification emails, and penalty FK display.
        return f"{self.reader} — {self.copy} ({self.status})"


class Penalty(models.Model):
    """A financial charge linked to a Loan, created for late return, damage, or loss."""

    # Determines the penalty category and affects how it is displayed in notifications.
    class Reason(models.TextChoices):
        OVERDUE = "overdue", "Overdue"
        DAMAGE = "damage", "Damage"
        LOSS = "loss", "Loss"

    # PROTECT: audit trail — penalty records must outlive the loan they reference.
    loan = models.ForeignKey(Loan, on_delete=models.PROTECT, related_name="penalties")
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    reason = models.CharField(max_length=10, choices=Reason.choices)
    paid_at = models.DateTimeField(null=True, blank=True)
    # SET_NULL so the waiver record is preserved even if the admin account is deleted.
    waived_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="waived_penalties",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "penalties"

    def __str__(self):
        return f"Penalty for loan #{self.loan_id} — {self.reason}"


class Reservation(models.Model):
    """Holds a reader's place in the queue for a book that is currently fully on loan."""

    # Terminal states: FULFILLED when a copy becomes available and is assigned; CANCELLED on expiry.
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        FULFILLED = "fulfilled", "Fulfilled"
        CANCELLED = "cancelled", "Cancelled"

    book = models.ForeignKey(
        Book, on_delete=models.CASCADE, related_name="reservations"
    )
    reader = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reservations"
    )
    reserved_at = models.DateTimeField(auto_now_add=True)
    # Typically set 48 h after reservation; expired pending reservations are cancelled hourly.
    expires_at = models.DateTimeField()
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING
    )

    class Meta:
        ordering = ["-reserved_at"]
        constraints = [
            # A reader may have at most one pending reservation per book at a time.
            models.UniqueConstraint(
                fields=["book", "reader"],
                condition=Q(status="pending"),
                name="unique_pending_reservation",
            )
        ]

    def __str__(self):
        return f"{self.reader} reserved {self.book} ({self.status})"

