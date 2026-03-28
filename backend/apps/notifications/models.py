from django.conf import settings
from django.db import models


class Notification(models.Model):
    class Type(models.TextChoices):
        REMINDER = "reminder", "Reminder"
        OVERDUE = "overdue", "Overdue"
        RESERVATION_READY = "reservation_ready", "Reservation Ready"
        ACCOUNT_BLOCKED = "account_blocked", "Account Blocked"

    class Channel(models.TextChoices):
        EMAIL = "email", "Email"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    type = models.CharField(max_length=20, choices=Type.choices)
    loan = models.ForeignKey(
        "loans.Loan",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications",
    )
    sent_at = models.DateTimeField(auto_now_add=True)
    channel = models.CharField(max_length=10, choices=Channel.choices, default=Channel.EMAIL)

    class Meta:
        ordering = ["-sent_at"]

    def __str__(self):
        return f"{self.type} → {self.user} via {self.channel}"
