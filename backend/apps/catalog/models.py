from django.contrib.postgres.fields import ArrayField
from django.contrib.postgres.search import SearchVectorField
from django.db import models


class Book(models.Model):
    ol_id = models.CharField(max_length=50, unique=True, blank=True)
    isbn = models.CharField(max_length=20, unique=True, blank=True)
    title = models.CharField(max_length=500)
    author = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    cover_url = models.URLField(blank=True)
    genres = ArrayField(models.CharField(max_length=100), default=list, blank=True)
    language = models.CharField(max_length=10, default="en")
    search_vector = SearchVectorField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["title"]

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

    class Meta:
        ordering = ["book", "copy_number"]
        unique_together = ["book", "copy_number"]

    def __str__(self):
        return f"{self.book.title} — copy #{self.copy_number}"
