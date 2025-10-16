# Generated migration to add unique constraint for questions

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('forms', '0005_questionbank_is_owner_question_and_more'),
    ]

    operations = [
        # Add unique constraint to prevent duplicate questions in same project
        migrations.AddConstraint(
            model_name='question',
            constraint=models.UniqueConstraint(
                fields=['project', 'question_text'],
                name='unique_question_per_project'
            ),
        ),
    ]

