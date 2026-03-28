import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("loans", "0002_initial"),
    ]

    operations = [
        # Add indexes to Loan
        migrations.AddIndex(
            model_name="loan",
            index=models.Index(fields=["reader", "status"], name="loans_loan_reader_status_idx"),
        ),
        migrations.AddIndex(
            model_name="loan",
            index=models.Index(fields=["copy", "status"], name="loans_loan_copy_status_idx"),
        ),
        # Add created_at to Penalty
        migrations.AddField(
            model_name="penalty",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        # Fix Penalty ordering
        migrations.AlterModelOptions(
            name="penalty",
            options={"ordering": ["-created_at"], "verbose_name_plural": "penalties"},
        ),
        # Add unique constraint to Reservation
        migrations.AddConstraint(
            model_name="reservation",
            constraint=models.UniqueConstraint(
                condition=models.Q(status="pending"),
                fields=["book", "reader"],
                name="unique_pending_reservation",
            ),
        ),
    ]
