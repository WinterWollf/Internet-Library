from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Custom user model that uses email as the login identifier instead of username."""

    # Two application roles: readers borrow books, admins manage the entire system.
    class Role(models.TextChoices):
        READER = "reader", "Reader"
        ADMIN = "admin", "Admin"

    # Optional gender field used only to select a profile avatar.
    class Gender(models.TextChoices):
        FEMALE = "female", "Female"
        MALE = "male", "Male"

    # Make email the primary login identifier
    email = models.EmailField(unique=True)
    # username is kept for Django admin compatibility; not used for authentication.
    username = models.CharField(max_length=150, unique=True, blank=True)

    # Library-specific fields
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.READER)
    # Checked by BlockedUserMiddleware — blocked users receive 403 on every request.
    is_blocked = models.BooleanField(default=False)
    blocked_reason = models.TextField(blank=True)
    # True once the user has confirmed a TOTP device via MfaVerifyView.
    mfa_enabled = models.BooleanField(default=False)
    gender = models.CharField(
        max_length=10, choices=Gender.choices, blank=True, default=""
    )
    phone = models.CharField(max_length=20, blank=True, default="")

    # Per-user email notification opt-outs, checked by notification tasks before sending.
    email_reminders = models.BooleanField(default=True)
    email_overdue = models.BooleanField(default=True)
    email_reservation = models.BooleanField(default=True)
    email_account_alerts = models.BooleanField(default=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        ordering = ["email"]

    def __str__(self):
        # Used in Django admin, log output, and FK display.
        return self.email
