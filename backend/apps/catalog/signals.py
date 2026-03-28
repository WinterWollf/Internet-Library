from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.catalog.models import BookCopy


@receiver(post_save, sender=BookCopy)
def on_book_copy_created(sender, instance, created, **kwargs):
    """Trigger async QR code generation when a new BookCopy is created."""
    if created:
        from apps.catalog.tasks import generate_qr_code_task
        generate_qr_code_task.delay(instance.pk)
