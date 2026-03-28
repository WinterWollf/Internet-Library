from django.urls import path

from apps.loans.views import PayPenaltyView, PenaltyListView

urlpatterns = [
    path("", PenaltyListView.as_view(), name="penalty_list"),
    path("<int:pk>/pay/", PayPenaltyView.as_view(), name="penalty_pay"),
]
