from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.loans.models import Loan, Penalty, Reservation
from apps.loans.serializers import (
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

class ActiveLoansView(APIView):
    """GET /api/v1/loans/active/"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        loans = get_active_loans(request.user)
        return Response(LoanSerializer(loans, many=True).data)


class LoanHistoryView(APIView):
    """GET /api/v1/loans/history/"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        loans = get_loan_history(request.user)
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(loans, request)
        return paginator.get_paginated_response(LoanSerializer(page, many=True).data)


class BorrowBookView(APIView):
    """POST /api/v1/loans/borrow/ — body: {copy_id}"""

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


class ReturnBookView(APIView):
    """POST /api/v1/loans/return/ — body: {loan_id}"""

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


class ExtendLoanView(APIView):
    """POST /api/v1/loans/extend/ — body: {loan_id}"""

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

class PenaltyListView(APIView):
    """GET /api/v1/penalties/"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        penalties = Penalty.objects.select_related("loan").filter(loan__reader=request.user)
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(penalties, request)
        return paginator.get_paginated_response(PenaltySerializer(page, many=True).data)


class PayPenaltyView(APIView):
    """POST /api/v1/penalties/{id}/pay/"""

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

class ReservationListCreateView(APIView):
    """GET /api/v1/reservations/ — list own reservations.
       POST /api/v1/reservations/ — create reservation."""

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


class ReservationCancelView(APIView):
    """DELETE /api/v1/reservations/{id}/"""

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

class AdminLoanListView(APIView):
    """GET /api/v1/admin/loans/ — all loans with optional filtering."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        qs = Loan.objects.select_related("copy__book", "reader").all()

        if status_filter := request.query_params.get("status"):
            qs = qs.filter(status=status_filter)
        if reader_id := request.query_params.get("reader"):
            qs = qs.filter(reader_id=reader_id)
        if book_id := request.query_params.get("book"):
            qs = qs.filter(copy__book_id=book_id)

        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(LoanSerializer(page, many=True).data)


class AdminOverdueLoansView(APIView):
    """GET /api/v1/admin/loans/overdue/"""

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        qs = Loan.objects.select_related("copy__book", "reader").filter(
            status=Loan.Status.OVERDUE
        )
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(LoanSerializer(page, many=True).data)


class AdminWaivePenaltyView(APIView):
    """POST /api/v1/admin/loans/penalties/{id}/waive/"""

    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        try:
            penalty = waive_penalty(pk, request.user)
        except Penalty.DoesNotExist:
            raise NotFound({"error": "Penalty not found.", "code": "PENALTY_NOT_FOUND"})
        except ValueError as exc:
            raise ValidationError({"error": str(exc)})
        return Response(PenaltySerializer(penalty).data)
