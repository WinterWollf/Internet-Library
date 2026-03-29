from django.core.cache import cache
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.loans.models import Loan, Penalty, Reservation
from apps.stats.services import DASHBOARD_CACHE_KEY


@receiver(post_save, sender=Loan)
def invalidate_dashboard_on_loan(sender, instance, created, **kwargs):
    if created:
        cache.delete(DASHBOARD_CACHE_KEY)


@receiver(post_save, sender=Penalty)
def invalidate_dashboard_on_penalty(sender, instance, created, **kwargs):
    if created:
        cache.delete(DASHBOARD_CACHE_KEY)


@receiver(post_save, sender=Reservation)
def invalidate_dashboard_on_reservation(sender, instance, created, **kwargs):
    if created:
        cache.delete(DASHBOARD_CACHE_KEY)
