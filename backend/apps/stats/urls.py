from django.urls import path

from apps.catalog.views import (
    AdminBookDetailView,
    AdminBookListView,
    AdminCopyDetailView,
    AdminCopyListView,
)
from apps.loans.views import (
    AdminLoanListView,
    AdminOverdueLoansView,
    AdminWaivePenaltyView,
)
from apps.notifications.views import (
    AdminNotificationListView,
    AdminNotificationStatsView,
)
from apps.users.views import (
    AdminBlockUserView,
    AdminUnblockUserView,
    AdminUserDetailView,
    AdminUserListView,
)

urlpatterns = [
    # User management
    path("users/", AdminUserListView.as_view(), name="admin_user_list"),
    path("users/<int:pk>/", AdminUserDetailView.as_view(), name="admin_user_detail"),
    path("users/<int:pk>/block/", AdminBlockUserView.as_view(), name="admin_block_user"),
    path("users/<int:pk>/unblock/", AdminUnblockUserView.as_view(), name="admin_unblock_user"),
    # Catalog management
    path("catalog/books/", AdminBookListView.as_view(), name="admin_book_list"),
    path("catalog/books/<int:pk>/", AdminBookDetailView.as_view(), name="admin_book_detail"),
    path("catalog/copies/", AdminCopyListView.as_view(), name="admin_copy_list"),
    path("catalog/copies/<int:pk>/", AdminCopyDetailView.as_view(), name="admin_copy_detail"),
    # Loan management
    path("loans/", AdminLoanListView.as_view(), name="admin_loan_list"),
    path("loans/overdue/", AdminOverdueLoansView.as_view(), name="admin_overdue_loans"),
    path("loans/penalties/<int:pk>/waive/", AdminWaivePenaltyView.as_view(), name="admin_waive_penalty"),
    # Notification management
    path("notifications/", AdminNotificationListView.as_view(), name="admin_notification_list"),
    path("notifications/stats/", AdminNotificationStatsView.as_view(), name="admin_notification_stats"),
    # TODO: stats/ — GET /api/v1/admin/stats/
]
