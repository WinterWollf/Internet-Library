from unittest.mock import patch

import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.catalog.models import Book, BookCopy, Review
from apps.users.models import User


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def reader(db):
    return User.objects.create_user(
        email="reader@test.com",
        username="reader@test.com",
        password="Pass123!",
        role=User.Role.READER,
    )


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="admin@test.com",
        username="admin@test.com",
        password="Pass123!",
        role=User.Role.ADMIN,
    )


@pytest.fixture
def reader_client(api_client, reader):
    refresh = RefreshToken.for_user(reader)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
    return api_client


@pytest.fixture
def admin_client(api_client, admin_user):
    refresh = RefreshToken.for_user(admin_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
    return api_client


@pytest.fixture
def book(db):
    return Book.objects.create(
        isbn="9780261102217",
        title="The Lord of the Rings",
        author="J.R.R. Tolkien",
        language="en",
        year_published=1954,
        genres=["Fantasy", "Adventure"],
    )


@pytest.fixture
def book_copy(book):
    return BookCopy.objects.create(book=book, copy_number=1)


@pytest.fixture
def approved_review(book, reader):
    return Review.objects.create(
        book=book,
        reader=reader,
        rating=5,
        content="Excellent book!",
        is_approved=True,
    )


# ── Public book listing ───────────────────────────────────────────────────────

@pytest.mark.django_db
class TestBookListView:
    def test_returns_200_without_auth(self, api_client, book):
        resp = api_client.get("/api/v1/catalog/books/")
        assert resp.status_code == 200
        assert resp.data["count"] == 1
        assert resp.data["results"][0]["title"] == "The Lord of the Rings"

    def test_filter_by_language(self, api_client, book):
        Book.objects.create(title="French Book", author="Author", isbn="111", ol_id="OL_FR1", language="fr")
        resp = api_client.get("/api/v1/catalog/books/?language=en")
        assert resp.status_code == 200
        assert resp.data["count"] == 1
        assert resp.data["results"][0]["language"] == "en"

    def test_filter_by_genre(self, api_client, book):
        Book.objects.create(title="Other", author="Author", isbn="222", ol_id="OL_SCI1", genres=["Science"])
        resp = api_client.get("/api/v1/catalog/books/?genre=Fantasy")
        assert resp.status_code == 200
        assert resp.data["count"] == 1

    def test_filter_by_available(self, api_client, book, book_copy):
        resp = api_client.get("/api/v1/catalog/books/?available=true")
        assert resp.status_code == 200
        assert resp.data["count"] == 1

    def test_available_copies_count_annotated(self, api_client, book, book_copy):
        resp = api_client.get("/api/v1/catalog/books/")
        assert resp.data["results"][0]["available_copies_count"] == 1

    def test_empty_list_when_no_books(self, api_client, db):
        resp = api_client.get("/api/v1/catalog/books/")
        assert resp.status_code == 200
        assert resp.data["count"] == 0


# ── Book detail ───────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestBookDetailView:
    def test_returns_book(self, api_client, book):
        resp = api_client.get(f"/api/v1/catalog/books/{book.pk}/")
        assert resp.status_code == 200
        assert resp.data["title"] == "The Lord of the Rings"
        assert "copies" in resp.data
        assert "reviews" in resp.data

    def test_returns_404_for_missing_book(self, api_client, db):
        resp = api_client.get("/api/v1/catalog/books/99999/")
        assert resp.status_code == 404

    def test_only_approved_reviews_returned(self, api_client, book, reader, approved_review):
        Review.objects.create(
            book=book,
            reader=User.objects.create_user(
                email="other@test.com", username="other@test.com", password="Pass123!"
            ),
            rating=3,
            content="Pending review",
            is_approved=False,
        )
        resp = api_client.get(f"/api/v1/catalog/books/{book.pk}/")
        assert len(resp.data["reviews"]) == 1
        assert resp.data["reviews"][0]["rating"] == 5

    def test_copies_listed(self, api_client, book, book_copy):
        resp = api_client.get(f"/api/v1/catalog/books/{book.pk}/")
        assert len(resp.data["copies"]) == 1
        assert resp.data["copies"][0]["copy_number"] == 1


# ── Full-text search ──────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestBookSearchView:
    def test_requires_q_param(self, api_client):
        resp = api_client.get("/api/v1/catalog/search/")
        assert resp.status_code == 400

    def test_returns_200_with_q(self, api_client, book):
        # Search vector is not populated in test DB —
        # verify the endpoint accepts the param and returns 200.
        resp = api_client.get("/api/v1/catalog/search/?q=tolkien")
        assert resp.status_code == 200
        assert "results" in resp.data


# ── Open Library search ───────────────────────────────────────────────────────

@pytest.mark.django_db
class TestOpenLibrarySearchView:
    def test_requires_auth(self, api_client):
        resp = api_client.get("/api/v1/open-library/search/?q=tolkien")
        assert resp.status_code == 401

    def test_requires_admin(self, reader_client):
        resp = reader_client.get("/api/v1/open-library/search/?q=tolkien")
        assert resp.status_code == 403

    def test_requires_q_param(self, admin_client):
        resp = admin_client.get("/api/v1/open-library/search/")
        assert resp.status_code == 400

    def test_returns_results(self, admin_client):
        mock_results = [
            {
                "ol_id": "OL27448W",
                "title": "The Lord of the Rings",
                "author": "J.R.R. Tolkien",
                "isbn": "9780261102217",
                "year_published": 1954,
                "cover_url": "https://covers.openlibrary.org/b/id/8406786-L.jpg",
            }
        ]
        with patch("apps.catalog.views.search_open_library", return_value=mock_results):
            resp = admin_client.get("/api/v1/open-library/search/?q=tolkien")
        assert resp.status_code == 200
        assert len(resp.data) == 1
        assert resp.data[0]["ol_id"] == "OL27448W"


# ── Open Library import ───────────────────────────────────────────────────────

@pytest.mark.django_db
class TestOpenLibraryImportView:
    def test_requires_auth(self, api_client):
        resp = api_client.post("/api/v1/open-library/import/9780261102217/")
        assert resp.status_code == 401

    def test_requires_admin(self, reader_client):
        resp = reader_client.post("/api/v1/open-library/import/9780261102217/")
        assert resp.status_code == 403

    def test_queues_task(self, admin_client):
        with patch("apps.catalog.tasks.import_book_task") as mock_task:
            resp = admin_client.post("/api/v1/open-library/import/9780261102217/")
        assert resp.status_code == 202
        assert "queued" in resp.data["message"]
        mock_task.delay.assert_called_once_with("9780261102217")


# ── Admin book management ─────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAdminBookListView:
    def test_requires_admin(self, reader_client):
        resp = reader_client.get("/api/v1/admin/catalog/books/")
        assert resp.status_code == 403

    def test_lists_books(self, admin_client, book):
        resp = admin_client.get("/api/v1/admin/catalog/books/")
        assert resp.status_code == 200
        assert resp.data["count"] == 1

    def test_creates_book(self, admin_client, db):
        payload = {
            "title": "Dune",
            "author": "Frank Herbert",
            "isbn": "9780441013593",
            "language": "en",
        }
        resp = admin_client.post("/api/v1/admin/catalog/books/", payload)
        assert resp.status_code == 201
        assert Book.objects.filter(isbn="9780441013593").exists()


@pytest.mark.django_db
class TestAdminBookDetailView:
    def test_returns_book(self, admin_client, book):
        resp = admin_client.get(f"/api/v1/admin/catalog/books/{book.pk}/")
        assert resp.status_code == 200
        assert resp.data["title"] == "The Lord of the Rings"

    def test_patches_book(self, admin_client, book):
        resp = admin_client.patch(
            f"/api/v1/admin/catalog/books/{book.pk}/",
            {"year_published": 2000},
        )
        assert resp.status_code == 200
        book.refresh_from_db()
        assert book.year_published == 2000

    def test_deletes_book(self, admin_client, book):
        resp = admin_client.delete(f"/api/v1/admin/catalog/books/{book.pk}/")
        assert resp.status_code == 204
        assert not Book.objects.filter(pk=book.pk).exists()

    def test_returns_404_for_missing(self, admin_client, db):
        resp = admin_client.get("/api/v1/admin/catalog/books/99999/")
        assert resp.status_code == 404


# ── Admin copy management ─────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAdminCopyListView:
    def test_lists_copies(self, admin_client, book_copy):
        resp = admin_client.get("/api/v1/admin/catalog/copies/")
        assert resp.status_code == 200
        assert resp.data["count"] == 1

    def test_creates_copy(self, admin_client, book):
        with patch("apps.catalog.tasks.generate_qr_code_task") as mock_task:
            resp = admin_client.post(
                "/api/v1/admin/catalog/copies/",
                {"book": book.pk, "copy_number": 2},
            )
        assert resp.status_code == 201
        assert BookCopy.objects.filter(book=book, copy_number=2).exists()
        mock_task.delay.assert_called_once()


@pytest.mark.django_db
class TestAdminCopyDetailView:
    def test_patches_copy(self, admin_client, book_copy):
        resp = admin_client.patch(
            f"/api/v1/admin/catalog/copies/{book_copy.pk}/",
            {"condition": "worn"},
        )
        assert resp.status_code == 200
        book_copy.refresh_from_db()
        assert book_copy.condition == "worn"

    def test_deletes_copy(self, admin_client, book_copy):
        resp = admin_client.delete(f"/api/v1/admin/catalog/copies/{book_copy.pk}/")
        assert resp.status_code == 204
        assert not BookCopy.objects.filter(pk=book_copy.pk).exists()
