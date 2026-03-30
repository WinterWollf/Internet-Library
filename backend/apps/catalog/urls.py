from django.urls import path

from apps.catalog.views import BookDetailView, BookListView, BookSearchView, ReviewListCreateView

urlpatterns = [
    path("books/", BookListView.as_view(), name="book_list"),
    path("books/<int:pk>/", BookDetailView.as_view(), name="book_detail"),
    path("search/", BookSearchView.as_view(), name="book_search"),
    path("reviews/", ReviewListCreateView.as_view(), name="review_list_create"),
]
