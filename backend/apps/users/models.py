from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        READER = "reader", "Reader"
        ADMIN = "admin", "Admin"

    role = models.CharField(max_length=10, choices=Role.choices, default=Role.READER)
    is_blocked = models.BooleanField(default=False)
    blocked_reason = models.TextField(blank=True)
    mfa_enabled = models.BooleanField(default=False)

    class Meta:
        ordering = ["username"]

    def __str__(self):
        return self.username
