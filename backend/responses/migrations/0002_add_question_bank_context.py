# Generated migration for question bank context

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('responses', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='respondent',
            name='respondent_type',
            field=models.CharField(blank=True, help_text="Type of respondent from project's targeted_respondents", max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='respondent',
            name='commodity',
            field=models.CharField(blank=True, help_text="Commodity from project's targeted_commodities", max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='respondent',
            name='country',
            field=models.CharField(blank=True, help_text="Country from project's targeted_countries", max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='response',
            name='question_bank_context',
            field=models.JSONField(blank=True, default=dict, help_text='Context from question bank: respondent_type, commodity, country'),
        ),
    ]
