#!/usr/bin/env python
"""
Analyze orphaned response patterns to determine recovery strategy
Goal: Match orphaned responses to current questions based on patterns
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
print("ANALYZING ORPHANED RESPONSE PATTERNS FOR RECOVERY")
print("=" * 120)

# Get the valid respondent (the one with 37 valid responses)
valid_respondent = Respondent.objects.annotate(
    valid_count=Count('responses', filter=Q(responses__question__isnull=False))
).filter(
    project_id=PROJECT_ID,
    respondent_type__iexact=RESPONDENT_TYPE,
    commodity__iexact=COMMODITY,
    country__iexact=COUNTRY,
    valid_count__gt=0
).first()

if not valid_respondent:
    print("ERROR: No valid respondent found")
    sys.exit(1)

print(f"\nValid Respondent: {valid_respondent.respondent_id}")

# Get orphaned respondents
orphaned_respondents = Respondent.objects.annotate(
    orphaned_count=Count('responses', filter=Q(responses__question__isnull=True)),
    valid_count=Count('responses', filter=Q(responses__question__isnull=False))
).filter(
    project_id=PROJECT_ID,
    respondent_type__iexact=RESPONDENT_TYPE,
    commodity__iexact=COMMODITY,
    country__iexact=COUNTRY,
    orphaned_count__gt=0,
    valid_count=0
).order_by('created_at')

print(f"\nOrphaned Respondents: {orphaned_respondents.count()}")
for resp in orphaned_respondents:
    print(f"  - {resp.respondent_id}: {resp.orphaned_count} orphaned responses")

# Get valid responses with questions
valid_responses = Response.objects.filter(
    respondent=valid_respondent,
    project_id=PROJECT_ID,
    question__isnull=False
).select_related('question').order_by('collected_at')

print(f"\n{'=' * 120}")
print(f"VALID RESPONSES PATTERN (Respondent: {valid_respondent.respondent_id})")
print(f"{'=' * 120}")
print(f"{'#':<4} {'Collected At':<25} {'Question Text':<50} {'Response':<30}")
print("-" * 120)

valid_pattern = []
for idx, resp in enumerate(valid_responses, 1):
    question_text = resp.question.question_text[:47] if resp.question else "N/A"
    response_value = str(resp.response_value)[:27] if resp.response_value else ""
    collected_at = str(resp.collected_at)[:25] if resp.collected_at else ""
    print(f"{idx:<4} {collected_at:<25} {question_text:<50} {response_value:<30}")
    valid_pattern.append({
        'index': idx,
        'collected_at': resp.collected_at,
        'question_id': resp.question_id,
        'question_text': resp.question.question_text if resp.question else None,
        'response_value': resp.response_value
    })

# Analyze each orphaned respondent's pattern
for orphaned in orphaned_respondents:
    print(f"\n{'=' * 120}")
    print(f"ORPHANED RESPONSES PATTERN (Respondent: {orphaned.respondent_id})")
    print(f"{'=' * 120}")

    orphaned_responses = Response.objects.filter(
        respondent=orphaned,
        project_id=PROJECT_ID,
        question__isnull=True
    ).order_by('collected_at')

    print(f"{'#':<4} {'Collected At':<25} {'Question ID (NULL)':<40} {'Response':<30}")
    print("-" * 120)

    orphaned_pattern = []
    for idx, resp in enumerate(orphaned_responses, 1):
        collected_at = str(resp.collected_at)[:25] if resp.collected_at else ""
        response_value = str(resp.response_value)[:27] if resp.response_value else ""
        print(f"{idx:<4} {collected_at:<25} {'NULL':<40} {response_value:<30}")
        orphaned_pattern.append({
            'index': idx,
            'collected_at': resp.collected_at,
            'response_value': resp.response_value
        })

    # Compare patterns
    print(f"\n--- PATTERN COMPARISON ---")
    print(f"Valid responses: {len(valid_pattern)}")
    print(f"Orphaned responses: {len(orphaned_pattern)}")

    if len(orphaned_pattern) == len(valid_pattern):
        print("✓ Same count - likely collected from same question set")
        print("\nAttempting to match by position:")
        print(f"{'Pos':<5} {'FULL Question Text':<80} {'Orphaned Response':<40}")
        print("=" * 130)

        matches = 0
        for i in range(min(len(valid_pattern), len(orphaned_pattern))):
            v = valid_pattern[i]
            o = orphaned_pattern[i]
            question_text = v['question_text'] if v['question_text'] else "N/A"
            orphaned_value = str(o['response_value']) if o['response_value'] else ""
            print(f"{i+1:<5} {question_text:<80} {orphaned_value:<40}")
            matches += 1

        print(f"\n✓ Can potentially match {matches} orphaned responses to current questions by position")
    else:
        print("⚠ Different counts - orphaned responses may be from a different question set")
        print("\n⚠ DETAILED ANALYSIS - Checking which response is likely wrong:")
        print(f"{'Pos':<5} {'Valid Question':<80} {'Orphaned Response':<40} {'Match?':<10}")
        print("=" * 140)

        # Show all orphaned responses with question matches where available
        for i in range(len(orphaned_pattern)):
            o = orphaned_pattern[i]
            if i < len(valid_pattern):
                v = valid_pattern[i]
                question_text = v['question_text'] if v['question_text'] else "N/A"
                orphaned_value = str(o['response_value']) if o['response_value'] else ""

                # Check for timestamp gaps (more than 1 minute)
                if i > 0:
                    prev_time = orphaned_pattern[i-1]['collected_at']
                    curr_time = o['collected_at']
                    time_diff = (curr_time - prev_time).total_seconds()
                    if time_diff > 60:  # More than 1 minute gap
                        match_status = f"⚠️ GAP: {int(time_diff/60)}min"
                    else:
                        match_status = "✓"
                else:
                    match_status = "✓"

                print(f"{i+1:<5} {question_text:<80} {orphaned_value:<40} {match_status:<10}")
            else:
                # Extra orphaned response with no corresponding question
                orphaned_value = str(o['response_value']) if o['response_value'] else ""
                print(f"{i+1:<5} {'[NO MATCHING QUESTION - EXTRA RESPONSE]':<80} {orphaned_value:<40} {'❌ EXTRA':<10}")

# Get current questions for this bundle
print(f"\n{'=' * 120}")
print("CURRENT QUESTIONS FOR THIS BUNDLE")
print(f"{'=' * 120}")

current_questions = Question.objects.filter(
    project_id=PROJECT_ID,
    assigned_respondent_type__iexact=RESPONDENT_TYPE,
    assigned_commodity__iexact=COMMODITY,
    assigned_country__iexact=COUNTRY
).order_by('question_category', 'order_index', 'question_text')

print(f"\nTotal current questions: {current_questions.count()}")
print(f"Valid responses count: {len(valid_pattern)}")

if current_questions.count() == len(valid_pattern):
    print("✓ Current questions match valid response count")
else:
    print("⚠ Mismatch between current questions and valid response count")

print(f"\n{'=' * 120}")
print("RECOVERY STRATEGY RECOMMENDATION")
print(f"{'=' * 120}")
print("""
Based on the analysis:

1. If orphaned responses have the same count as valid responses:
   → Use POSITION-BASED MATCHING: Match orphaned responses to current questions by order
   → This assumes all respondents answered the same questions in the same order

2. If orphaned responses have different counts:
   → MANUAL REVIEW NEEDED: Cannot automatically match without additional metadata
   → May need to examine response_value patterns or timestamps

3. Implementation approach:
   → Create a recovery function that matches by position (index)
   → Add orphaned responses to the export using matched questions
   → Flag these as recovered/matched for transparency
""")
