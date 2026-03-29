from rest_framework import serializers


class DashboardStatsSerializer(serializers.Serializer):
    total_users = serializers.IntegerField()
    total_readers = serializers.IntegerField()
    blocked_users = serializers.IntegerField()
    total_books = serializers.IntegerField()
    total_copies = serializers.IntegerField()
    available_copies = serializers.IntegerField()
    active_loans = serializers.IntegerField()
    overdue_loans = serializers.IntegerField()
    pending_reservations = serializers.IntegerField()
    total_penalties_unpaid = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_penalties_collected = serializers.DecimalField(max_digits=10, decimal_places=2)


class LoansPerMonthSerializer(serializers.Serializer):
    month = serializers.IntegerField()
    year = serializers.IntegerField()
    count = serializers.IntegerField()


class MostBorrowedBookSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    author = serializers.CharField()
    cover_url = serializers.URLField(allow_blank=True)
    loan_count = serializers.IntegerField()


class MostBorrowedGenreSerializer(serializers.Serializer):
    genre = serializers.CharField()
    loan_count = serializers.IntegerField()
    percentage = serializers.FloatField()


class ReaderStatsSerializer(serializers.Serializer):
    active_loans_count = serializers.IntegerField()
    total_books_read = serializers.IntegerField()
    pending_reservations_count = serializers.IntegerField()
    unpaid_penalties_total = serializers.DecimalField(max_digits=10, decimal_places=2)
    overdue_loans_count = serializers.IntegerField()


class OverdueReportSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    overdue_loans_count = serializers.IntegerField()
    total_penalty = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)
    oldest_overdue_date = serializers.DateTimeField(allow_null=True)
