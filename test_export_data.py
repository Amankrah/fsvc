"""
Test script to check respondent and question data for export debugging.
Run with: python manage.py shell < test_export_data.py
"""

import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_core.settings')
django.setup()

from responses.models import Respondent
from forms.models import Question

print("\n=== TESTING EXPORT DATA ===\n")

# Get all unique bundle combinations
respondents = Respondent.objects.all()
print(f"Total respondents in database: {respondents.count()}")

# Get unique combinations
bundles = respondents.values('project_id', 'respondent_type', 'commodity', 'country').distinct()
print(f"\nUnique bundles: {bundles.count()}")

for bundle in bundles[:5]:  # Show first 5 bundles
    project_id = bundle['project_id']
    respondent_type = bundle['respondent_type']
    commodity = bundle['commodity']
    country = bundle['country']

    print(f"\n--- Bundle: {respondent_type} | {commodity} | {country} ---")

    # Count respondents in this bundle
    bundle_respondents = Respondent.objects.filter(
        project_id=project_id,
        respondent_type__iexact=respondent_type,
        commodity__iexact=commodity,
        country__iexact=country
    )
    print(f"Respondents: {bundle_respondents.count()}")

    # Show sample respondent IDs
    sample_ids = [r.respondent_id for r in bundle_respondents[:5]]
    print(f"Sample IDs: {sample_ids}")

    # Count questions for this bundle
    bundle_questions = Question.objects.filter(
        project_id=project_id,
        assigned_respondent_type__iexact=respondent_type,
        assigned_commodity__iexact=commodity,
        assigned_country__iexact=country
    )
    print(f"Questions: {bundle_questions.count()}")

    # Show sample question categories
    if bundle_questions.exists():
        categories = bundle_questions.values_list('question_category', flat=True).distinct()
        print(f"Categories: {list(categories)}")

print("\n=== TEST COMPLETE ===\n")
