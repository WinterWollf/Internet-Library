from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVectorField
from django.db import models


class Book(models.Model):
    ol_id = models.CharField(max_length=50, unique=True, blank=True, null=True)
    isbn = models.CharField(max_length=20, unique=True, blank=True, null=True)
    title = models.CharField(max_length=500)
    author = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    cover_url = models.URLField(blank=True)
    genres = ArrayField(models.CharField(max_length=100), default=list, blank=True)
    language = models.CharField(max_length=50, blank=True)
    year_published = models.PositiveIntegerField(null=True, blank=True)
    search_vector = SearchVectorField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [GinIndex(fields=["search_vector"])]

    def __str__(self):
        return f"{self.title} — {self.author}"


class BookCopy(models.Model):
    class Condition(models.TextChoices):
        NEW = "new", "New"
        GOOD = "good", "Good"
        WORN = "worn", "Worn"

    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="copies")
    copy_number = models.PositiveIntegerField()
    condition = models.CharField(max_length=10, choices=Condition.choices, default=Condition.GOOD)
    is_available = models.BooleanField(default=True)
    qr_code = models.ImageField(upload_to="qr_codes/", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["book", "copy_number"]
        unique_together = [["book", "copy_number"]]

    def __str__(self):
        return f"{self.book.title} — copy #{self.copy_number}"


class Wishlist(models.Model):
    reader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="wishlist",
    )
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="wishlisted_by")
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-added_at"]
        unique_together = [["reader", "book"]]

    def __str__(self):
        return f"{self.reader} → {self.book}"


class Review(models.Model):
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="reviews")
    reader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    rating = models.PositiveSmallIntegerField()
    content = models.TextField()
    is_approved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [["book", "reader"]]

    def __str__(self):
        return f"{self.reader} — {self.book} ({self.rating}★)"
