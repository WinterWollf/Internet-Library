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

_OL_ID_RE = re.compile(r'^OL\d+[A-Z]$')


def _rebuild_search_vector(book: Book) -> None:
    Book.objects.filter(pk=book.pk).update(
        search_vector=SearchVector("title", "author", "description", config="english")
    )
    book.refresh_from_db()


def _import_by_isbn(isbn: str) -> Book:
    """Fetch book metadata from Open Library by ISBN."""
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

    ol_id = None
    if work_key := book_data.get("key", ""):
        raw = work_key.split("/")[-1]
        ol_id = raw if raw else None

    cover_url = f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg"
    if covers := book_data.get("cover"):
        cover_url = covers.get("large") or covers.get("medium") or cover_url

    description = ""
    if excerpts := book_data.get("excerpts"):
        description = excerpts[0].get("text", "") if excerpts else ""

    subjects = book_data.get("subjects", [])
    genres = [s.get("name", s) if isinstance(s, dict) else s for s in subjects[:10]]

    year_published = None
    if publish_date := book_data.get("publish_date", ""):
        m = re.search(r"\d{4}", publish_date)
        if m:
            year_published = int(m.group())

    defaults: dict = {
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
    _rebuild_search_vector(book)
    return book


def _import_by_ol_id(ol_id: str) -> Book:
    """
    Fetch book metadata from Open Library by Works ID (e.g. OL27448W).
    Tries to find an ISBN via the editions endpoint so the canonical
    _import_by_isbn path can be used. Falls back to a direct work import
    when no ISBN is available.
    """
    # First try to locate an ISBN via the work's editions
    editions_url = f"{OPEN_LIBRARY_BASE}/works/{ol_id}/editions.json"
    try:
        editions_resp = requests.get(editions_url, params={"limit": 5}, timeout=10)
        if editions_resp.ok:
            for edition in editions_resp.json().get("entries", []):
                isbns = edition.get("isbn_13", []) or edition.get("isbn_10", [])
                if isbns:
                    return _import_by_isbn(isbns[0])
    except requests.RequestException:
        pass

    # No ISBN found — import directly from the Works API
    work_url = f"{OPEN_LIBRARY_BASE}/works/{ol_id}.json"
    work_resp = requests.get(work_url, timeout=10)
    work_resp.raise_for_status()
    work_data = work_resp.json()

    title = work_data.get("title", "")

    # Resolve first author name via author key
    author = ""
    for author_entry in work_data.get("authors", [])[:1]:
        author_key = author_entry.get("author", {}).get("key", "")
        if author_key:
            try:
                a_resp = requests.get(f"{OPEN_LIBRARY_BASE}{author_key}.json", timeout=10)
                if a_resp.ok:
                    author = a_resp.json().get("name", "")
            except requests.RequestException:
                pass

    desc = work_data.get("description", "")
    if isinstance(desc, dict):
        desc = desc.get("value", "")

    subjects = work_data.get("subjects", [])[:10]
    genres = [s if isinstance(s, str) else "" for s in subjects]
    genres = [g for g in genres if g]

    covers = work_data.get("covers", [])
    cover_url = f"https://covers.openlibrary.org/b/olid/{ol_id}-L.jpg"
    if covers and covers[0] > 0:
        cover_url = f"https://covers.openlibrary.org/b/id/{covers[0]}-L.jpg"

    defaults: dict = {
        "title": title,
        "author": author,
        "cover_url": cover_url,
        "description": desc,
        "genres": genres,
    }

    book, _ = Book.objects.update_or_create(ol_id=ol_id, defaults=defaults)
    _rebuild_search_vector(book)
    return book


def import_book_from_open_library(identifier: str) -> Book:
    """
    Import a book by ISBN or OL Works ID (e.g. OL27448W).
    Dispatches to the appropriate import function based on identifier format.
    """
    if _OL_ID_RE.match(identifier):
        return _import_by_ol_id(identifier)
    return _import_by_isbn(identifier)


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
