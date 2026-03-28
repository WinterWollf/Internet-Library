from config.celery import app


@app.task(bind=True, name="catalog.generate_qr_code_task")
def generate_qr_code_task(self, copy_id: int):
    """Async wrapper: generate QR code for a BookCopy. Triggered on copy creation."""
    from apps.catalog.services import generate_qr_code
    generate_qr_code(copy_id)


@app.task(bind=True, name="catalog.import_book_task")
def import_book_task(self, isbn: str):
    """Async wrapper: import book metadata from Open Library API by ISBN."""
    from apps.catalog.services import import_book_from_open_library
    import_book_from_open_library(isbn)
