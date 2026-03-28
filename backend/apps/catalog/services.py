import os
import re

import requests
from django.conf import settings
from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector
from django.db.models import Avg, Count, Q

from apps.catalog.models import Book, BookCopy

OPEN_LIBRARY_BASE = "https://openlibrary.org"


# ── Book catalog queries ──────────────────────────────────────────────────────

def get_books(filters: dict):
    """
    Return a queryset of books filtered by genre, language, availability,
    and/or full-text search. Annotated with available_copies_count and
    average_rating.
    """
    qs = Book.objects.all()

    if search := filters.get("search") or filters.get("q"):
        query = SearchQuery(search, config="english")
        qs = qs.filter(search_vector=query).annotate(
            rank=SearchRank("search_vector", query)
        ).order_by("-rank")

    if genre := filters.get("genre"):
        qs = qs.filter(genres__contains=[genre])

    if language := filters.get("language"):
        qs = qs.filter(language=language)

    if filters.get("available") in ("true", "1", True):
        qs = qs.filter(copies__is_available=True).distinct()

    qs = qs.annotate(
        available_copies_count=Count(
            "copies", filter=Q(copies__is_available=True), distinct=True
        ),
        average_rating=Avg("reviews__rating"),
        reviews_count=Count(
            "reviews", filter=Q(reviews__is_approved=True), distinct=True
        ),
    )

    # Preserve stable ordering after annotation (annotation drops model Meta ordering)
    if not (filters.get("search") or filters.get("q")):
        qs = qs.order_by("-created_at")

    return qs


def get_book_detail(book_id: int) -> Book:
    """Return a single book with copies and annotation."""
    qs = (
        Book.objects.filter(pk=book_id)
        .prefetch_related("copies", "reviews")
        .annotate(
            available_copies_count=Count(
                "copies", filter=Q(copies__is_available=True), distinct=True
            ),
            average_rating=Avg("reviews__rating"),
            reviews_count=Count(
                "reviews", filter=Q(reviews__is_approved=True), distinct=True
            ),
        )
    )
    return qs.get()


# ── Open Library integration ──────────────────────────────────────────────────

def import_book_from_open_library(isbn: str) -> Book:
    """
    Fetch book metadata from Open Library by ISBN and create/update the local
    Book record. Never called on every request — only on explicit admin import.
    """
    url = f"{OPEN_LIBRARY_BASE}/api/books"
    params = {"bibkeys": f"ISBN:{isbn}", "format": "json", "jscmd": "data"}
    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()

    data = response.json()
    key = f"ISBN:{isbn}"
    if key not in data:
        raise ValueError(f"Book with ISBN {isbn} not found on Open Library.")

    book_data = data[key]

    title = book_data.get("title", "")

    authors = book_data.get("authors", [])
    author = ", ".join(a.get("name", "") for a in authors) if authors else ""

    # Derive OL work ID from the key field e.g. "/works/OL27448W"
    ol_id = ""
    if work_key := book_data.get("key", ""):
        ol_id = work_key.split("/")[-1]

    # Cover URL — prefer Open Library cover endpoint
    cover_url = f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg"
    if covers := book_data.get("cover"):
        cover_url = covers.get("large") or covers.get("medium") or cover_url

    # Description from excerpts or notes
    description = ""
    if excerpts := book_data.get("excerpts"):
        description = excerpts[0].get("text", "") if excerpts else ""

    # Genres from subjects
    subjects = book_data.get("subjects", [])
    genres = []
    for s in subjects[:10]:
        genres.append(s.get("name", s) if isinstance(s, dict) else s)

    # Year from publish_date e.g. "January 1, 1954"
    year_published = None
    if publish_date := book_data.get("publish_date", ""):
        m = re.search(r"\d{4}", publish_date)
        if m:
            year_published = int(m.group())

    # Determine ol_id for update_or_create — avoid empty-string uniqueness conflict
    defaults = {
        "title": title,
        "author": author,
        "cover_url": cover_url,
        "description": description,
        "genres": genres,
        "year_published": year_published,
    }
    if ol_id:
        defaults["ol_id"] = ol_id

    book, _ = Book.objects.update_or_create(isbn=isbn, defaults=defaults)

    # Rebuild full-text search vector
    Book.objects.filter(pk=book.pk).update(
        search_vector=SearchVector("title", "author", "description", config="english")
    )
    book.refresh_from_db()
    return book


def search_open_library(query: str) -> list:
    """
    Search Open Library API and return results without saving to the local DB.
    """
    url = f"{OPEN_LIBRARY_BASE}/search.json"
    response = requests.get(url, params={"q": query, "limit": 20}, timeout=10)
    response.raise_for_status()

    results = []
    for doc in response.json().get("docs", []):
        isbn_list = doc.get("isbn", [])
        results.append({
            "ol_id": doc.get("key", "").replace("/works/", ""),
            "title": doc.get("title", ""),
            "author": ", ".join(doc.get("author_name", [])),
            "isbn": isbn_list[0] if isbn_list else None,
            "year_published": doc.get("first_publish_year"),
            "cover_url": (
                f"https://covers.openlibrary.org/b/id/{doc['cover_i']}-L.jpg"
                if doc.get("cover_i")
                else ""
            ),
        })
    return results


# ── QR code generation ────────────────────────────────────────────────────────

def generate_qr_code(copy_id: int) -> None:
    """Generate a PNG QR code for a BookCopy and persist it to media storage."""
    import qrcode  # imported here to keep top-level imports light

    copy = BookCopy.objects.get(pk=copy_id)

    qr_content = f"book:{copy.book_id}:copy:{copy.pk}"
    img = qrcode.make(qr_content)

    qr_dir = os.path.join(settings.MEDIA_ROOT, "qr_codes")
    os.makedirs(qr_dir, exist_ok=True)

    filename = f"copy_{copy_id}.png"
    filepath = os.path.join(qr_dir, filename)
    img.save(filepath)

    copy.qr_code = f"qr_codes/{filename}"
    copy.save(update_fields=["qr_code"])
