from django.urls import path

from apps.loans.views import ReservationCancelView, ReservationListCreateView

urlpatterns = [
    path("", ReservationListCreateView.as_view(), name="reservation_list_create"),
    path("<int:pk>/", ReservationCancelView.as_view(), name="reservation_cancel"),
]
