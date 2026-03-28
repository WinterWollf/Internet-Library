from django.contrib import admin

from apps.loans.models import Loan, Penalty, Reservation


@admin.register(Loan)
class LoanAdmin(admin.ModelAdmin):
    list_display = ["reader", "copy", "status", "borrowed_at", "due_date", "returned_at"]
    list_filter = ["status"]
    search_fields = ["reader__email", "copy__book__title", "copy__book__isbn"]
    readonly_fields = ["borrowed_at"]


@admin.register(Penalty)
class PenaltyAdmin(admin.ModelAdmin):
    list_display = ["loan", "reason", "amount", "paid_at", "waived_by", "created_at"]
    list_filter = ["reason"]
    search_fields = ["loan__reader__email", "loan__copy__book__title"]
    readonly_fields = ["created_at"]


@admin.register(Reservation)
class ReservationAdmin(admin.ModelAdmin):
    list_display = ["reader", "book", "status", "reserved_at", "expires_at"]
    list_filter = ["status"]
    search_fields = ["reader__email", "book__title", "book__isbn"]
    readonly_fields = ["reserved_at"]
