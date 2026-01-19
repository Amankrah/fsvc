"""
Script to check what information is available in orphaned responses.

This will help us understand:
1. What's stored in question_bank_context
2. Whether we can use it to map responses
3. What fallback strategies we need
"""

import os
import django
import json

# Setup Django
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_core.settings.production')
django.setup()

from responses.models import Response, Respondent
from projects.models import Project

# Project ID to analyze
PROJECT_ID = "f7672c4b-db61-421a-8c41-15aa5909e760"

# Sample respondent with orphaned responses
RESPONDENT_ID = "PROJ_F7672C4B_1765804627174"


def check_orphaned_responses():
    try:
        project = Project.objects.get(id=PROJECT_ID)
        respondent = Respondent.objects.get(project=project, respondent_id=RESPONDENT_ID)

        print(f"\n{'='*80}")
        print(f"Checking Orphaned Response Context")
        print(f"{'='*80}")
        print(f"Respondent: {respondent.respondent_id}")
        print(f"Type: {respondent.respondent_type}")
        print(f"Commodity: {respondent.commodity}")
        print(f"Country: {respondent.country}")
        print(f"{'='*80}\n")

        # Get first 10 orphaned responses
        orphaned_responses = Response.objects.filter(
            respondent=respondent,
            question__isnull=True
        ).order_by('collected_at')[:10]

        print(f"First 10 Orphaned Responses:\n")
        print("-" * 80)

        for idx, resp in enumerate(orphaned_responses, 1):
            print(f"\nResponse {idx}:")
            print(f"  Answer: {resp.response_value}")
            print(f"  Collected At: {resp.collected_at}")
            print(f"  Question Category: {resp.question_category}")
            print(f"  Question Data Source: {resp.question_data_source}")
            print(f"  Research Partner: {resp.research_partner_name}")
            print(f"  Work Package: {resp.work_package}")

            print(f"\n  Question Bank Context:")
            if resp.question_bank_context:
                print(f"    {json.dumps(resp.question_bank_context, indent=4)}")
            else:
                print(f"    (empty)")

            print("\n" + "-" * 80)

        # Check if any have valid responses too
        print(f"\n{'='*80}")
        print(f"Checking Valid Responses (with question link)")
        print(f"{'='*80}\n")

        valid_responses = Response.objects.filter(
            respondent=respondent,
            question__isnull=False
        ).select_related('question', 'question__question_bank_source').order_by('collected_at')[:5]

        if valid_responses.exists():
            print("First 5 Valid Responses:\n")
            for idx, resp in enumerate(valid_responses, 1):
                print(f"\nResponse {idx}:")
                print(f"  Answer: {resp.response_value}")
                print(f"  Question Text: {resp.question.question_text[:60]}...")
                if resp.question.question_bank_source:
                    print(f"  QuestionBank ID: {resp.question.question_bank_source.id}")
                    print(f"  QuestionBank Category: {resp.question.question_bank_source.question_category}")
                print(f"  Collected At: {resp.collected_at}")
        else:
            print("No valid responses found (all are orphaned)")

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    check_orphaned_responses()
