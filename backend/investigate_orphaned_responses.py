#!/usr/bin/env python
"""
Investigate orphaned responses (responses with deleted questions)
Compare responses from the valid respondent vs orphaned respondents
"""

import os
import django
import sys

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_core.settings.production')
django.setup()

from responses.models import Response, Respondent
from forms.models import Question
from django.db.models import Count, Q

# Target bundle: chief | cocoa | Ghana
PROJECT_ID = "f7672c4b-db61-421a-8c41-15aa5909e760"
RESPONDENT_TYPE = "chief"
COMMODITY = "cocoa"
COUNTRY = "Ghana"

print("=" * 120)
print("INVESTIGATING ORPHANED RESPONSES: chief | cocoa | Ghana")
print("=" * 120)

# Get all respondents in this bundle
respondents = Respondent.objects.filter(
    project_id=PROJECT_ID,
    respondent_type__iexact=RESPONDENT_TYPE,
    commodity__iexact=COMMODITY,
    country__iexact=COUNTRY
).annotate(
    total_responses=Count('responses'),
    valid_responses=Count('responses', filter=Q(responses__question__isnull=False)),
    orphaned_responses=Count('responses', filter=Q(responses__question__isnull=True))
).order_by('created_at')

print(f"\nFound {respondents.count()} respondents in bundle:")
print(f"{'Respondent ID':<40} {'Created':<25} {'Total':<8} {'Valid':<8} {'Orphaned':<10}")
print("-" * 120)

valid_respondent = None
orphaned_respondent = None

for resp in respondents:
    print(f"{resp.respondent_id:<40} {str(resp.created_at):<25} {resp.total_responses:<8} {resp.valid_responses:<8} {resp.orphaned_responses:<10}")

    if resp.valid_responses > 0 and valid_respondent is None:
        valid_respondent = resp
    if resp.orphaned_responses > 0 and orphaned_respondent is None:
        orphaned_respondent = resp

print("\n" + "=" * 120)
print("COMPARING VALID vs ORPHANED RESPONSES")
print("=" * 120)

if not valid_respondent or not orphaned_respondent:
    print("ERROR: Could not find both valid and orphaned respondents for comparison")
    sys.exit(1)

print(f"\nValid Respondent: {valid_respondent.respondent_id}")
print(f"Orphaned Respondent: {orphaned_respondent.respondent_id}")

# Get valid responses (with questions)
valid_responses = Response.objects.filter(
    respondent=valid_respondent,
    project_id=PROJECT_ID,
    question__isnull=False
).select_related('question').order_by('collected_at')[:5]

print(f"\n--- VALID RESPONSES (first 5) ---")
print(f"{'Question Text':<60} {'Response':<30} {'Question ID':<40}")
print("-" * 120)
for resp in valid_responses:
    question_text = resp.question.question_text[:55] if resp.question else "N/A"
    response_value = str(resp.response_value)[:25] if resp.response_value else ""
    question_id = str(resp.question_id) if resp.question_id else "N/A"
    print(f"{question_text:<60} {response_value:<30} {question_id:<40}")

# Get orphaned responses (with NULL questions)
orphaned_responses = Response.objects.filter(
    respondent=orphaned_respondent,
    project_id=PROJECT_ID,
    question__isnull=True
).order_by('collected_at')[:5]

print(f"\n--- ORPHANED RESPONSES (first 5) from {orphaned_respondent.respondent_id} ---")
print(f"{'Question ID (deleted)':<40} {'Response':<30} {'Collected At':<25}")
print("-" * 120)
for resp in orphaned_responses:
    question_id = str(resp.question_id) if resp.question_id else "NULL"
    response_value = str(resp.response_value)[:25] if resp.response_value else ""
    collected_at = str(resp.collected_at) if resp.collected_at else ""
    print(f"{question_id:<40} {response_value:<30} {collected_at:<25}")

# Check if the orphaned question IDs exist in the Question table
print("\n" + "=" * 120)
print("CHECKING IF DELETED QUESTIONS EXIST IN QUESTION TABLE")
print("=" * 120)

orphaned_question_ids = set(
    Response.objects.filter(
        respondent=orphaned_respondent,
        project_id=PROJECT_ID,
        question__isnull=True
    ).values_list('question_id', flat=True)
)

print(f"\nFound {len(orphaned_question_ids)} unique orphaned question IDs")
print(f"Sample orphaned question IDs: {list(orphaned_question_ids)[:5]}")

# Check if these questions exist in the Question table
existing_questions = Question.objects.filter(id__in=orphaned_question_ids)
print(f"\nQuestions that STILL EXIST in Question table: {existing_questions.count()}")

if existing_questions.exists():
    print("\n⚠️ WARNING: These questions still exist in the database!")
    print("This means the relationship is broken, not that the questions were deleted.")
    print("\nExisting questions:")
    for q in existing_questions[:5]:
        print(f"  - ID: {q.id}")
        print(f"    Text: {q.question_text[:80]}")
        print(f"    Category: {q.question_category}")
        print(f"    Assignment: {q.assigned_respondent_type} | {q.assigned_commodity} | {q.assigned_country}")
        print()

# Check for questions with DIFFERENT bundle assignments
print("\n" + "=" * 120)
print("HYPOTHESIS: Questions were RE-ASSIGNED to different bundles")
print("=" * 120)

all_orphaned_question_ids = list(orphaned_question_ids)[:10]  # Check first 10
for q_id in all_orphaned_question_ids:
    try:
        question = Question.objects.get(id=q_id)
        print(f"\nQuestion ID: {q_id}")
        print(f"  Text: {question.question_text[:60]}")
        print(f"  Current Assignment: {question.assigned_respondent_type} | {question.assigned_commodity} | {question.assigned_country}")
        print(f"  Expected Assignment: {RESPONDENT_TYPE} | {COMMODITY} | {COUNTRY}")

        if (question.assigned_respondent_type != RESPONDENT_TYPE or
            question.assigned_commodity != COMMODITY or
            question.assigned_country != COUNTRY):
            print(f"  ⚠️ MISMATCH! Question was reassigned to a different bundle!")
    except Question.DoesNotExist:
        print(f"\nQuestion ID: {q_id} - TRULY DELETED (not in Question table)")

print("\n" + "=" * 120)
print("SUMMARY")
print("=" * 120)
print("""
The orphaned responses are responses where:
1. The question_id points to a question that was deleted, OR
2. The question still exists but was reassigned to a different bundle

To fix this issue, you would need to:
- Either restore the deleted questions
- Or remove the orphaned responses from the database
- Or update the question assignments to match the original bundle
""")
