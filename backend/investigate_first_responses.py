"""
Script to investigate the first responses of problem respondents.

This will show:
1. All Sociodemographic responses in order
2. What category each response has in question_bank_context
3. Whether there's a pattern to the off-by-one error
"""

import os
import django

# Setup Django
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_core.settings.production')
django.setup()

from responses.models import Response, Respondent
from projects.models import Project

# Project ID
PROJECT_ID = "f7672c4b-db61-421a-8c41-15aa5909e760"

# Problem respondents
PROBLEM_RESPONDENTS = [
    "PROJ_F7672C4B_1765780004894",
    "PROJ_F7672C4B_1765805354969",
    "PROJ_F7672C4B_1765810448053",
    "PROJ_F7672C4B_1765806430331"
]


def investigate_first_responses():
    """
    Check the first responses of problem respondents.
    """
    try:
        project = Project.objects.get(id=PROJECT_ID)
        print(f"\n{'='*80}")
        print(f"Investigating First Responses (Off-by-One Analysis)")
        print(f"{'='*80}\n")

        for resp_id in PROBLEM_RESPONDENTS:
            respondent = Respondent.objects.filter(
                project=project,
                respondent_id=resp_id
            ).first()

            if not respondent:
                print(f"❌ Respondent not found: {resp_id}\n")
                continue

            print(f"{'='*80}")
            print(f"Respondent: {resp_id}")
            print(f"{'='*80}")
            print(f"Type: {respondent.respondent_type}")
            print(f"Commodity: {respondent.commodity}")
            print(f"Country: {respondent.country}")
            print()

            # Get all responses
            all_responses = Response.objects.filter(
                respondent=respondent
            ).order_by('collected_at')

            # Get only Sociodemographic responses
            sociodem_responses = [
                r for r in all_responses
                if r.question_bank_context and
                r.question_bank_context.get('question_category') == 'Sociodemographics'
            ]

            print(f"Total responses: {all_responses.count()}")
            print(f"Sociodemographic responses: {len(sociodem_responses)}")
            print()

            print(f"First 15 Sociodemographic Responses:")
            print("-" * 80)

            for idx, resp in enumerate(sociodem_responses[:15], 1):
                print(f"\nPosition {idx}:")
                print(f"  Answer: {resp.response_value}")
                print(f"  Collected: {resp.collected_at}")
                print(f"  Category: {resp.question_bank_context.get('question_category')}")

                # Check if there's any other useful info in context
                context = resp.question_bank_context
                if 'question_text' in context:
                    print(f"  Question Text: {context['question_text'][:60]}...")

            print(f"\n{'='*80}\n")

        # Now check a GOOD respondent for comparison
        print(f"\n{'='*80}")
        print(f"Checking a GOOD respondent for comparison")
        print(f"{'='*80}\n")

        # Find a respondent with correct alignment (gender in QB2)
        good_respondent = Respondent.objects.filter(
            project=project,
            respondent_type='farmers',
            commodity='cocoa'
        ).first()

        if good_respondent:
            print(f"Good Respondent: {good_respondent.respondent_id}")
            print(f"Type: {good_respondent.respondent_type}")
            print(f"Commodity: {good_respondent.commodity}")
            print()

            all_responses = Response.objects.filter(
                respondent=good_respondent
            ).order_by('collected_at')

            sociodem_responses = [
                r for r in all_responses
                if r.question_bank_context and
                r.question_bank_context.get('question_category') == 'Sociodemographics'
            ]

            print(f"First 15 Sociodemographic Responses:")
            print("-" * 80)

            for idx, resp in enumerate(sociodem_responses[:15], 1):
                print(f"\nPosition {idx}:")
                print(f"  Answer: {resp.response_value}")
                print(f"  Category: {resp.question_bank_context.get('question_category')}")

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    investigate_first_responses()
