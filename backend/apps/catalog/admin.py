from django.contrib import admin

from apps.catalog.models import Book, BookCopy, Review


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ["title", "author", "isbn", "language", "year_published", "created_at"]
    search_fields = ["title", "author", "isbn", "ol_id"]
    list_filter = ["language", "year_published"]
    readonly_fields = ["search_vector", "created_at", "updated_at"]


@admin.register(BookCopy)
class BookCopyAdmin(admin.ModelAdmin):
    list_display = ["book", "copy_number", "condition", "is_available", "created_at"]
    search_fields = ["book__title", "book__isbn"]
    list_filter = ["condition", "is_available"]
    readonly_fields = ["qr_code", "created_at"]


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ["book", "reader", "rating", "is_approved", "created_at"]
    search_fields = ["book__title", "reader__email"]
    list_filter = ["is_approved", "rating"]
    readonly_fields = ["created_at"]
