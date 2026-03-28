from django.urls import path

from apps.catalog.views import OpenLibraryImportView, OpenLibrarySearchView

urlpatterns = [
    path("search/", OpenLibrarySearchView.as_view(), name="ol_search"),
    path("import/<str:isbn>/", OpenLibraryImportView.as_view(), name="ol_import"),
]
