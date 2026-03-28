from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Book, BookCopy
from apps.catalog.serializers import (
    BookAdminSerializer,
    BookCopySerializer,
    BookDetailSerializer,
    BookListSerializer,
    OpenLibrarySearchResultSerializer,
)
from apps.catalog.services import (
    get_book_detail,
    get_books,
    search_open_library,
)
from apps.users.permissions import IsAdmin


class BookListView(APIView):
    """GET /api/v1/catalog/books/ — public book listing with filters and pagination."""

    permission_classes = [AllowAny]

    def get(self, request):
        qs = get_books(request.query_params)
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = BookListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class BookDetailView(APIView):
    """GET /api/v1/catalog/books/{id}/ — book detail with copies and reviews."""

    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            book = get_book_detail(pk)
        except Book.DoesNotExist:
            raise NotFound({"error": "Book not found.", "code": "BOOK_NOT_FOUND"})
        serializer = BookDetailSerializer(book)
        return Response(serializer.data)


class BookSearchView(APIView):
    """GET /api/v1/catalog/search/?q= — full-text search via PostgreSQL SearchVector."""

    permission_classes = [AllowAny]

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if not q:
            raise ValidationError({"error": "Query parameter 'q' is required.", "code": "MISSING_QUERY"})
        qs = get_books({"search": q})
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = BookListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class OpenLibrarySearchView(APIView):
    """GET /api/v1/open-library/search/?q= — search Open Library without saving to DB."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if not q:
            raise ValidationError({"error": "Query parameter 'q' is required.", "code": "MISSING_QUERY"})
        results = search_open_library(q)
        serializer = OpenLibrarySearchResultSerializer(results, many=True)
        return Response(serializer.data)


class OpenLibraryImportView(APIView):
    """POST /api/v1/open-library/import/{isbn}/ — admin-only: import book from Open Library."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, isbn):
        from apps.catalog.tasks import import_book_task
        import_book_task.delay(isbn)
        return Response(
            {"message": f"Import for ISBN {isbn} has been queued."},
            status=status.HTTP_202_ACCEPTED,
        )


# ── Admin catalog views ───────────────────────────────────────────────────────

class AdminBookListView(APIView):
    """GET /api/v1/admin/catalog/books/ — list all books (admin).
       POST /api/v1/admin/catalog/books/ — create a book (admin)."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        qs = Book.objects.all()
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = BookAdminSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        serializer = BookAdminSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AdminBookDetailView(APIView):
    """GET/PATCH/DELETE /api/v1/admin/catalog/books/{id}/ — manage a book (admin)."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def _get_book(self, pk):
        try:
            return Book.objects.get(pk=pk)
        except Book.DoesNotExist:
            raise NotFound({"error": "Book not found.", "code": "BOOK_NOT_FOUND"})

    def get(self, request, pk):
        book = self._get_book(pk)
        return Response(BookAdminSerializer(book).data)

    def patch(self, request, pk):
        book = self._get_book(pk)
        serializer = BookAdminSerializer(book, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        book = self._get_book(pk)
        book.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminCopyListView(APIView):
    """GET /api/v1/admin/catalog/copies/ — list all copies (admin).
       POST /api/v1/admin/catalog/copies/ — create a copy (admin)."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        qs = BookCopy.objects.select_related("book").all()
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = BookCopySerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        serializer = BookCopySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AdminCopyDetailView(APIView):
    """GET/PATCH/DELETE /api/v1/admin/catalog/copies/{id}/ — manage a copy (admin)."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def _get_copy(self, pk):
        try:
            return BookCopy.objects.select_related("book").get(pk=pk)
        except BookCopy.DoesNotExist:
            raise NotFound({"error": "Copy not found.", "code": "COPY_NOT_FOUND"})

    def get(self, request, pk):
        copy = self._get_copy(pk)
        return Response(BookCopySerializer(copy).data)

    def patch(self, request, pk):
        copy = self._get_copy(pk)
        serializer = BookCopySerializer(copy, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        copy = self._get_copy(pk)
        copy.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
