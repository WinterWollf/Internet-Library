from config.celery import app


@app.task(bind=True)
def generate_qr_code(self, copy_id: int):
    """Generate QR code for a BookCopy. Called on copy creation."""
    from apps.catalog.services import generate_qr_code_for_copy
    generate_qr_code_for_copy(copy_id)


@app.task(bind=True)
def import_book_from_open_library(self, isbn: str):
    """Import book metadata from Open Library API by ISBN."""
    from apps.catalog.services import import_book_by_isbn
    import_book_by_isbn(isbn)
