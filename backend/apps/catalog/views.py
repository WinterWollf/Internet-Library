from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema, extend_schema_view
from drf_spectacular.types import OpenApiTypes
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


@extend_schema(
    tags=["Catalog"],
    summary="List books",
    description=(
        "Returns a paginated list of books available in the library. "
        "Supports filtering by `genre`, `language`, `year_published`, and `available` (boolean). "
        "Use `search` for full-text search across title, author and description. "
        "No authentication required."
    ),
    auth=[],
    responses={200: BookListSerializer(many=True)},
)
class BookListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        qs = get_books(request.query_params)
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = BookListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


@extend_schema(
    tags=["Catalog"],
    summary="Get book details",
    description=(
        "Returns full details for a single book including all copies "
        "(with availability and condition) and approved reader reviews. "
        "No authentication required."
    ),
    auth=[],
    responses={
        200: BookDetailSerializer,
        404: OpenApiResponse(description="Book not found."),
    },
)
class BookDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            book = get_book_detail(pk)
        except Book.DoesNotExist:
            raise NotFound({"error": "Book not found.", "code": "BOOK_NOT_FOUND"})
        serializer = BookDetailSerializer(book)
        return Response(serializer.data)


@extend_schema(
    tags=["Catalog"],
    summary="Full-text search books",
    description=(
        "Searches the catalog using PostgreSQL full-text search (SearchVector) across "
        "title, author and description. Returns a paginated list. "
        "No authentication required."
    ),
    auth=[],
    parameters=[
        OpenApiParameter(
            name="q",
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            required=True,
            description="Search query string.",
        ),
    ],
    responses={
        200: BookListSerializer(many=True),
        400: OpenApiResponse(description="Query parameter `q` is required."),
    },
)
class BookSearchView(APIView):
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


@extend_schema(
    tags=["Open Library"],
    summary="Search Open Library (does not save to DB)",
    description=(
        "Queries the Open Library API and returns matching book metadata. "
        "Results are not saved to the local database — use the import endpoint to add a book. "
        "Admin only."
    ),
    parameters=[
        OpenApiParameter(
            name="q",
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            required=True,
            description="Search query forwarded to Open Library.",
        ),
    ],
    responses={
        200: OpenLibrarySearchResultSerializer(many=True),
        400: OpenApiResponse(description="Query parameter `q` is required."),
    },
)
class OpenLibrarySearchView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if not q:
            raise ValidationError({"error": "Query parameter 'q' is required.", "code": "MISSING_QUERY"})
        results = search_open_library(q)
        serializer = OpenLibrarySearchResultSerializer(results, many=True)
        return Response(serializer.data)


@extend_schema(
    tags=["Open Library"],
    summary="Import book from Open Library by ISBN",
    description=(
        "Enqueues a Celery task to fetch book metadata from Open Library for the given ISBN "
        "and save it to the local catalog. The task runs asynchronously — "
        "poll the catalog to confirm the book was imported. Admin only."
    ),
    responses={
        202: OpenApiResponse(description="Import task queued successfully."),
        400: OpenApiResponse(description="Invalid ISBN format."),
    },
)
class OpenLibraryImportView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, identifier):
        from apps.catalog.tasks import import_book_task
        import_book_task.delay(identifier)
        return Response(
            {"message": f"Import for '{identifier}' has been queued."},
            status=status.HTTP_202_ACCEPTED,
        )


# ── Admin catalog views ───────────────────────────────────────────────────────

@extend_schema_view(
    get=extend_schema(
        tags=["Catalog (Admin)"],
        summary="List all books",
        description="Returns a paginated list of all books with admin-level detail including copy counts.",
        responses={200: BookAdminSerializer(many=True)},
    ),
    post=extend_schema(
        tags=["Catalog (Admin)"],
        summary="Create a book",
        description="Creates a new book record in the catalog.",
        request=BookAdminSerializer,
        responses={
            201: BookAdminSerializer,
            400: OpenApiResponse(description="Validation error."),
        },
    ),
)
class AdminBookListView(APIView):
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


@extend_schema_view(
    get=extend_schema(
        tags=["Catalog (Admin)"],
        summary="Get book details",
        responses={
            200: BookAdminSerializer,
            404: OpenApiResponse(description="Book not found."),
        },
    ),
    patch=extend_schema(
        tags=["Catalog (Admin)"],
        summary="Update a book",
        description="Partially updates book metadata.",
        request=BookAdminSerializer,
        responses={
            200: BookAdminSerializer,
            400: OpenApiResponse(description="Validation error."),
            404: OpenApiResponse(description="Book not found."),
        },
    ),
    delete=extend_schema(
        tags=["Catalog (Admin)"],
        summary="Delete a book",
        description="Permanently deletes the book and all its copies.",
        responses={
            204: OpenApiResponse(description="Book deleted."),
            404: OpenApiResponse(description="Book not found."),
        },
    ),
)
class AdminBookDetailView(APIView):
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


@extend_schema_view(
    get=extend_schema(
        tags=["Catalog (Admin)"],
        summary="List all book copies",
        description="Returns a paginated list of all physical copies across the entire catalog.",
        responses={200: BookCopySerializer(many=True)},
    ),
    post=extend_schema(
        tags=["Catalog (Admin)"],
        summary="Create a book copy",
        description="Adds a new physical copy to an existing book. A QR code generation task is enqueued automatically.",
        request=BookCopySerializer,
        responses={
            201: BookCopySerializer,
            400: OpenApiResponse(description="Validation error."),
        },
    ),
)
class AdminCopyListView(APIView):
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


@extend_schema_view(
    get=extend_schema(
        tags=["Catalog (Admin)"],
        summary="Get copy details",
        responses={
            200: BookCopySerializer,
            404: OpenApiResponse(description="Copy not found."),
        },
    ),
    patch=extend_schema(
        tags=["Catalog (Admin)"],
        summary="Update a book copy",
        description="Partially updates a copy's condition or availability status.",
        request=BookCopySerializer,
        responses={
            200: BookCopySerializer,
            400: OpenApiResponse(description="Validation error."),
            404: OpenApiResponse(description="Copy not found."),
        },
    ),
    delete=extend_schema(
        tags=["Catalog (Admin)"],
        summary="Delete a book copy",
        responses={
            204: OpenApiResponse(description="Copy deleted."),
            404: OpenApiResponse(description="Copy not found."),
        },
    ),
)
class AdminCopyDetailView(APIView):
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
