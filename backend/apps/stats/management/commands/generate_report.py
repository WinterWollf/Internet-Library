from django.core.management.base import BaseCommand

from apps.stats.services import (
    get_dashboard_stats,
    get_most_borrowed_books,
    get_notification_stats,
    get_overdue_report,
)


class Command(BaseCommand):
    help = "Print a full library statistics report to the console."

    def handle(self, *args, **options):
        sep = "=" * 60

        self.stdout.write(self.style.SUCCESS(sep))
        self.stdout.write(self.style.SUCCESS("  INTERNET LIBRARY — STATISTICS REPORT"))
        self.stdout.write(self.style.SUCCESS(sep))

        # Dashboard stats
        self.stdout.write(self.style.HTTP_INFO("\n--- DASHBOARD STATS ---"))
        for key, value in get_dashboard_stats().items():
            self.stdout.write(f"  {key:<35} {value}")

        # Top 5 borrowed books
        self.stdout.write(self.style.HTTP_INFO("\n--- TOP 5 BORROWED BOOKS ---"))
        books = get_most_borrowed_books(limit=5)
        if books:
            for i, book in enumerate(books, 1):
                self.stdout.write(f"  {i}. {book.title} — {book.author}  ({book.loan_count} loans)")
        else:
            self.stdout.write("  No loans recorded yet.")

        # Overdue report
        self.stdout.write(self.style.HTTP_INFO("\n--- OVERDUE REPORT ---"))
        overdue = get_overdue_report()
        if overdue:
            for entry in overdue:
                penalty = entry["total_penalty"] or 0
                self.stdout.write(
                    f"  {entry['email']:<35} overdue: {entry['overdue_loans_count']}  "
                    f"unpaid penalty: {penalty}"
                )
        else:
            self.stdout.write("  No overdue loans.")

        # Notification stats (last 30 days)
        self.stdout.write(self.style.HTTP_INFO("\n--- NOTIFICATION STATS (LAST 30 DAYS) ---"))
        notif_stats = get_notification_stats()
        if notif_stats:
            for entry in notif_stats:
                self.stdout.write(f"  {entry['type']:<30} {entry['count']}")
        else:
            self.stdout.write("  No notifications in the last 30 days.")

        self.stdout.write("\n" + self.style.SUCCESS(sep))
