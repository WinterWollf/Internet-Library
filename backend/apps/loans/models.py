from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.catalog.models import Book, BookCopy


class Loan(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        RETURNED = "returned", "Returned"
        OVERDUE = "overdue", "Overdue"

    copy = models.ForeignKey(BookCopy, on_delete=models.PROTECT, related_name="loans")
    reader = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="loans")
    borrowed_at = models.DateTimeField(auto_now_add=True)
    due_date = models.DateTimeField()
    returned_at = models.DateTimeField(null=True, blank=True)
    prolongation_count = models.PositiveSmallIntegerField(default=0)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)

    class Meta:
        ordering = ["-borrowed_at"]
        indexes = [
            models.Index(fields=["reader", "status"]),
            models.Index(fields=["copy", "status"]),
        ]

    def __str__(self):
        return f"{self.reader} — {self.copy} ({self.status})"


class Penalty(models.Model):
    class Reason(models.TextChoices):
        OVERDUE = "overdue", "Overdue"
        DAMAGE = "damage", "Damage"
        LOSS = "loss", "Loss"

    loan = models.ForeignKey(Loan, on_delete=models.PROTECT, related_name="penalties")
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    reason = models.CharField(max_length=10, choices=Reason.choices)
    paid_at = models.DateTimeField(null=True, blank=True)
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
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        FULFILLED = "fulfilled", "Fulfilled"
        CANCELLED = "cancelled", "Cancelled"

    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="reservations")
    reader = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reservations")
    reserved_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)

    class Meta:
        ordering = ["-reserved_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["book", "reader"],
                condition=Q(status="pending"),
                name="unique_pending_reservation",
            )
        ]

    def __str__(self):
        return f"{self.reader} reserved {self.book} ({self.status})"
