from django.urls import path

from apps.loans.views import (
    ActiveLoansView,
    BorrowBookView,
    ExtendLoanView,
    LoanHistoryView,
    ReturnBookView,
)

urlpatterns = [
    path("active/", ActiveLoansView.as_view(), name="loan_active"),
    path("history/", LoanHistoryView.as_view(), name="loan_history"),
    path("borrow/", BorrowBookView.as_view(), name="loan_borrow"),
    path("return/", ReturnBookView.as_view(), name="loan_return"),
    path("extend/", ExtendLoanView.as_view(), name="loan_extend"),
]
