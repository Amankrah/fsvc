#!/usr/bin/env python
"""
Check respondent counts for a specific project across different endpoints/queries
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_core.settings')
django.setup()

from responses.models import Respondent
from forms.models import Project

PROJECT_ID = 'f7672c4b-db61-421a-8c41-15aa5909e760'

print("=" * 80)
print("RESPONDENT COUNT ANALYSIS")
print("=" * 80)
print()

try:
    project = Project.objects.get(id=PROJECT_ID)
    print(f"Project: {project.name}")
    print(f"Project ID: {PROJECT_ID}")
    print()

    # Count ALL respondents (what Responses screen shows)
    all_respondents = Respondent.objects.filter(project_id=PROJECT_ID)
    total_all = all_respondents.count()
    print(f"1. ALL Respondents (Responses Screen): {total_all}")
    print()

    # Count by completion status
    completed = all_respondents.filter(completion_status='completed').count()
    draft = all_respondents.filter(completion_status='draft').count()
    abandoned = all_respondents.filter(completion_status='abandoned').count()

    print(f"2. Breakdown by Status:")
    print(f"   - Completed: {completed}")
    print(f"   - Draft: {draft}")
    print(f"   - Abandoned: {abandoned}")
    print(f"   - Total: {completed + draft + abandoned}")
    print()

    # Count respondents with complete filter metadata
    complete_filters = all_respondents.exclude(
        respondent_type__isnull=True
    ).exclude(
        respondent_type=''
    ).exclude(
        commodity__isnull=True
    ).exclude(
        commodity=''
    ).exclude(
        country__isnull=True
    ).exclude(
        country=''
    ).count()

    print(f"3. Respondents with Complete Filters: {complete_filters}")
    print()

    # Count by bundle (unique combinations)
    from django.db.models import Count
    bundles = all_respondents.values(
        'respondent_type', 'commodity', 'country'
    ).annotate(
        count=Count('id')
    ).order_by('-count')

    print(f"4. Bundle Statistics (Total Bundles: {len(bundles)}):")
    total_in_bundles = 0
    for bundle in bundles:
        if bundle['respondent_type'] and bundle['commodity'] and bundle['country']:
            total_in_bundles += bundle['count']
            print(f"   - {bundle['respondent_type']}, {bundle['commodity']}, {bundle['country']}: {bundle['count']}")

    print(f"\n   Total respondents in complete bundles: {total_in_bundles}")
    print()

    # Summary
    print("=" * 80)
    print("SUMMARY:")
    print("=" * 80)
    print(f"Responses Screen shows: {total_all} (ALL respondents)")
    print(f"Project Details should show: {total_all} (ALL respondents)")
    print(f"Bundle Stats shows: {total_in_bundles} (only respondents with complete filters)")
    print(f"Missing: {total_all - total_in_bundles} respondents don't have complete filter metadata")
    print()

except Project.DoesNotExist:
    print(f"ERROR: Project {PROJECT_ID} not found!")
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
