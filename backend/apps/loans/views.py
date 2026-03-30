from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema, extend_schema_view
from drf_spectacular.types import OpenApiTypes
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.loans.models import Loan, Penalty, Reservation
from apps.loans.serializers import (
    AdminLoanSerializer,
    LoanActionSerializer,
    LoanCreateSerializer,
    LoanSerializer,
    PenaltySerializer,
    ReservationCreateSerializer,
    ReservationSerializer,
)
from apps.loans.services import (
    borrow_book,
    cancel_reservation,
    extend_loan,
    get_active_loans,
    get_loan_history,
    pay_penalty,
    reserve_book,
    return_book,
    waive_penalty,
)
from apps.users.permissions import IsAdmin


# ── Reader loan endpoints ─────────────────────────────────────────────────────

@extend_schema(
    tags=["Loans"],
    summary="List active loans",
    description="Returns all currently active and overdue loans for the authenticated reader.",
    responses={200: LoanSerializer(many=True)},
)
class ActiveLoansView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        loans = get_active_loans(request.user)
        return Response(LoanSerializer(loans, many=True).data)


@extend_schema(
    tags=["Loans"],
    summary="List loan history",
    description="Returns a paginated history of all returned loans for the authenticated reader.",
    responses={200: LoanSerializer(many=True)},
)
class LoanHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        loans = get_loan_history(request.user)
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(loans, request)
        return paginator.get_paginated_response(LoanSerializer(page, many=True).data)


@extend_schema(
    tags=["Loans"],
    summary="Borrow a book copy",
    description=(
        "Creates a new loan for the specified copy. "
        "The reader must not be blocked and the copy must be available. "
        "Due date is set automatically based on library policy."
    ),
    request=LoanCreateSerializer,
    responses={
        201: LoanSerializer,
        400: OpenApiResponse(description="Copy unavailable, reader already has an active loan for this book, or other business rule violation."),
        404: OpenApiResponse(description="Copy not found."),
    },
)
class BorrowBookView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = LoanCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            loan = borrow_book(request.user, serializer.validated_data["copy_id"])
        except ValueError as exc:
            raise ValidationError({"error": str(exc)})
        except Exception:
            raise NotFound({"error": "Copy not found.", "code": "COPY_NOT_FOUND"})
        return Response(LoanSerializer(loan).data, status=status.HTTP_201_CREATED)


@extend_schema(
    tags=["Loans"],
    summary="Return a borrowed book",
    description=(
        "Marks the specified loan as returned and sets the copy back to available. "
        "If the book is returned late, a penalty may be created automatically."
    ),
    request=LoanActionSerializer,
    responses={
        200: LoanSerializer,
        400: OpenApiResponse(description="Loan is already returned or does not belong to the reader."),
        404: OpenApiResponse(description="Loan not found."),
    },
)
class ReturnBookView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = LoanActionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            loan = return_book(serializer.validated_data["loan_id"], request.user)
        except Loan.DoesNotExist:
            raise NotFound({"error": "Loan not found.", "code": "LOAN_NOT_FOUND"})
        except ValueError as exc:
            raise ValidationError({"error": str(exc)})
        return Response(LoanSerializer(loan).data)


@extend_schema(
    tags=["Loans"],
    summary="Extend a loan due date",
    description=(
        "Extends the due date of an active loan by the standard prolongation period. "
        "A loan may be extended at most 2 times."
    ),
    request=LoanActionSerializer,
    responses={
        200: LoanSerializer,
        400: OpenApiResponse(description="Loan already extended the maximum number of times, or is overdue/returned."),
        404: OpenApiResponse(description="Loan not found."),
    },
)
class ExtendLoanView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = LoanActionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            loan = extend_loan(serializer.validated_data["loan_id"], request.user)
        except Loan.DoesNotExist:
            raise NotFound({"error": "Loan not found.", "code": "LOAN_NOT_FOUND"})
        except ValueError as exc:
            raise ValidationError({"error": str(exc)})
        return Response(LoanSerializer(loan).data)


# ── Penalty endpoints ─────────────────────────────────────────────────────────

@extend_schema(
    tags=["Penalties"],
    summary="List own penalties",
    description="Returns a paginated list of all penalties (paid, unpaid, and waived) for the authenticated reader.",
    responses={200: PenaltySerializer(many=True)},
)
class PenaltyListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        penalties = Penalty.objects.select_related("loan__copy__book").filter(loan__reader=request.user)
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(penalties, request)
        return paginator.get_paginated_response(PenaltySerializer(page, many=True).data)


@extend_schema(
    tags=["Penalties"],
    summary="Pay a penalty",
    description="Marks the specified penalty as paid. The penalty must belong to the authenticated reader and must not already be settled.",
    responses={
        200: PenaltySerializer,
        400: OpenApiResponse(description="Penalty is already paid or waived."),
        404: OpenApiResponse(description="Penalty not found."),
    },
)
class PayPenaltyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            penalty = pay_penalty(pk, request.user)
        except Penalty.DoesNotExist:
            raise NotFound({"error": "Penalty not found.", "code": "PENALTY_NOT_FOUND"})
        except ValueError as exc:
            raise ValidationError({"error": str(exc)})
        return Response(PenaltySerializer(penalty).data)


# ── Reservation endpoints ─────────────────────────────────────────────────────

@extend_schema_view(
    get=extend_schema(
        tags=["Reservations"],
        summary="List own reservations",
        description="Returns a paginated list of all reservations (pending, fulfilled, cancelled) for the authenticated reader.",
        responses={200: ReservationSerializer(many=True)},
    ),
    post=extend_schema(
        tags=["Reservations"],
        summary="Reserve a book",
        description=(
            "Creates a pending reservation for the specified book. "
            "Only one active reservation per book per reader is allowed. "
            "The reservation expires automatically if not fulfilled within the configured window."
        ),
        request=ReservationCreateSerializer,
        responses={
            201: ReservationSerializer,
            400: OpenApiResponse(description="Reader already has a pending reservation for this book, or other business rule violation."),
            404: OpenApiResponse(description="Book not found."),
        },
    ),
)
class ReservationListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        reservations = Reservation.objects.select_related("book").filter(reader=request.user)
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(reservations, request)
        return paginator.get_paginated_response(ReservationSerializer(page, many=True).data)

    def post(self, request):
        serializer = ReservationCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            reservation = reserve_book(request.user, serializer.validated_data["book_id"])
        except ValueError as exc:
            raise ValidationError({"error": str(exc)})
        except Exception:
            raise NotFound({"error": "Book not found.", "code": "BOOK_NOT_FOUND"})
        return Response(ReservationSerializer(reservation).data, status=status.HTTP_201_CREATED)


@extend_schema(
    tags=["Reservations"],
    summary="Cancel a reservation",
    description="Cancels the specified pending reservation. The reservation must belong to the authenticated reader.",
    responses={
        204: OpenApiResponse(description="Reservation cancelled."),
        400: OpenApiResponse(description="Reservation is not in a cancellable state."),
        404: OpenApiResponse(description="Reservation not found."),
    },
)
class ReservationCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            cancel_reservation(pk, request.user)
        except Reservation.DoesNotExist:
            raise NotFound({"error": "Reservation not found.", "code": "RESERVATION_NOT_FOUND"})
        except ValueError as exc:
            raise ValidationError({"error": str(exc)})
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Admin loan views ──────────────────────────────────────────────────────────

@extend_schema(
    tags=["Loans (Admin)"],
    summary="List all loans",
    description=(
        "Returns a paginated list of all loans across all readers. "
        "Filter by `status` (`active` | `returned` | `overdue`), `reader` (user ID), or `book` (book ID)."
    ),
    parameters=[
        OpenApiParameter(
            name="status",
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            required=False,
            enum=["active", "returned", "overdue"],
            description="Filter by loan status.",
        ),
        OpenApiParameter(
            name="reader",
            type=OpenApiTypes.INT,
            location=OpenApiParameter.QUERY,
            required=False,
            description="Filter by reader user ID.",
        ),
        OpenApiParameter(
            name="book",
            type=OpenApiTypes.INT,
            location=OpenApiParameter.QUERY,
            required=False,
            description="Filter by book ID.",
        ),
    ],
    responses={200: LoanSerializer(many=True)},
)
class AdminLoanListView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        qs = Loan.objects.select_related("copy__book", "reader").all()

        if status_filter := request.query_params.get("status"):
            qs = qs.filter(status=status_filter)
        if reader_id := request.query_params.get("reader"):
            qs = qs.filter(reader_id=reader_id)
        if book_id := request.query_params.get("book"):
            qs = qs.filter(copy__book_id=book_id)

        ordering = request.query_params.get("ordering", "-borrowed_at")
        allowed_orderings = {"borrowed_at", "-borrowed_at", "due_date", "-due_date", "status", "-status"}
        if ordering not in allowed_orderings:
            ordering = "-borrowed_at"
        qs = qs.order_by(ordering)

        paginator = PageNumberPagination()
        try:
            paginator.page_size = min(int(request.query_params.get("page_size", 20)), 100)
        except (ValueError, TypeError):
            paginator.page_size = 20

        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(AdminLoanSerializer(page, many=True).data)


@extend_schema(
    tags=["Loans (Admin)"],
    summary="List overdue loans",
    description="Returns a paginated list of all loans currently in `overdue` status, across all readers.",
    responses={200: LoanSerializer(many=True)},
)
class AdminOverdueLoansView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        qs = Loan.objects.select_related("copy__book", "reader").filter(
            status=Loan.Status.OVERDUE
        )
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(LoanSerializer(page, many=True).data)


@extend_schema(
    tags=["Loans (Admin)"],
    summary="Waive a penalty",
    description=(
        "Marks the specified penalty as waived by the acting admin. "
        "A waived penalty is considered settled and will not appear in unpaid totals."
    ),
    responses={
        200: PenaltySerializer,
        400: OpenApiResponse(description="Penalty is already settled (paid or waived)."),
        404: OpenApiResponse(description="Penalty not found."),
    },
)
class AdminWaivePenaltyView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        try:
            penalty = waive_penalty(pk, request.user)
        except Penalty.DoesNotExist:
            raise NotFound({"error": "Penalty not found.", "code": "PENALTY_NOT_FOUND"})
        except ValueError as exc:
            raise ValidationError({"error": str(exc)})
        return Response(PenaltySerializer(penalty).data)
