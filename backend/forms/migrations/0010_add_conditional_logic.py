# Generated migration for conditional/follow-up question logic

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('forms', '0009_add_general_category'),
    ]

    operations = [
        migrations.AddField(
            model_name='question',
            name='conditional_logic',
            field=models.JSONField(
                null=True,
                blank=True,
                help_text='Conditional logic for follow-up questions. Format: {"enabled": bool, "parent_question_id": str, "show_if": {...}}'
            ),
        ),
        migrations.AddField(
            model_name='question',
            name='is_follow_up',
            field=models.BooleanField(
                default=False,
                help_text='True if this question is a follow-up/conditional question'
            ),
        ),
        migrations.AddField(
            model_name='questionbank',
            name='conditional_logic',
            field=models.JSONField(
                null=True,
                blank=True,
                help_text='Conditional logic template for questions generated from this QuestionBank'
            ),
        ),
        migrations.AddField(
            model_name='questionbank',
            name='is_follow_up',
            field=models.BooleanField(
                default=False,
                help_text='True if this is a follow-up question template'
            ),
        ),
    ]
