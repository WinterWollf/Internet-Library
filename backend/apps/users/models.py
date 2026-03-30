from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        READER = "reader", "Reader"
        ADMIN = "admin", "Admin"

    class Gender(models.TextChoices):
        FEMALE = "female", "Female"
        MALE = "male", "Male"

    # Make email the primary login identifier
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150, unique=True, blank=True)

    # Library-specific fields
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.READER)
    is_blocked = models.BooleanField(default=False)
    blocked_reason = models.TextField(blank=True)
    mfa_enabled = models.BooleanField(default=False)
    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True, default="")
    phone = models.CharField(max_length=20, blank=True, default="")

    # Notification preferences
    email_reminders = models.BooleanField(default=True)
    email_overdue = models.BooleanField(default=True)
    email_reservation = models.BooleanField(default=True)
    email_account_alerts = models.BooleanField(default=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        ordering = ["email"]

    def __str__(self):
        return self.email
