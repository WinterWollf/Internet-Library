from django.utils import timezone
from rest_framework import serializers

from apps.catalog.models import Book, BookCopy
from apps.loans.models import Loan, Penalty, Reservation


class _BookMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Book
        fields = ["id", "title", "author", "cover_url"]


class _BookCopyMiniSerializer(serializers.ModelSerializer):
    book = _BookMiniSerializer(read_only=True)

    class Meta:
        model = BookCopy
        fields = ["id", "copy_number", "condition", "book"]


class LoanSerializer(serializers.ModelSerializer):
    copy = _BookCopyMiniSerializer(read_only=True)
    days_remaining = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Loan
        fields = [
            "id", "copy", "borrowed_at", "due_date", "returned_at",
            "prolongation_count", "status", "days_remaining", "is_overdue",
        ]

    def get_days_remaining(self, obj):
        if obj.status == Loan.Status.RETURNED:
            return None
        delta = obj.due_date - timezone.now()
        return delta.days

    def get_is_overdue(self, obj):
        return obj.status == Loan.Status.OVERDUE


class LoanCreateSerializer(serializers.Serializer):
    copy_id = serializers.IntegerField()


class LoanActionSerializer(serializers.Serializer):
    loan_id = serializers.IntegerField()


class _LoanMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Loan
        fields = ["id", "borrowed_at", "due_date", "status"]


class PenaltySerializer(serializers.ModelSerializer):
    loan = _LoanMiniSerializer(read_only=True)
    is_settled = serializers.SerializerMethodField()

    class Meta:
        model = Penalty
        fields = [
            "id", "loan", "amount", "reason", "paid_at",
            "waived_by", "created_at", "is_settled",
        ]

    def get_is_settled(self, obj):
        return obj.paid_at is not None


class _BookReservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Book
        fields = ["id", "title", "author", "cover_url"]


class ReservationSerializer(serializers.ModelSerializer):
    book = _BookReservationSerializer(read_only=True)

    class Meta:
        model = Reservation
        fields = ["id", "book", "reserved_at", "expires_at", "status"]


class ReservationCreateSerializer(serializers.Serializer):
    book_id = serializers.IntegerField()
