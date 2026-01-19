"""
Script to investigate specific respondents who have mismatched responses.

This script checks:
1. What questions were generated for specific respondents
2. What responses they actually gave
3. Why there's a mismatch between QB columns and actual answers
"""

import os
import django

# Setup Django
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_core.settings.production')
django.setup()

from forms.models import QuestionBank, Question
from responses.models import Response, Respondent
from projects.models import Project

# Project ID to analyze
PROJECT_ID = "f7672c4b-db61-421a-8c41-15aa5909e760"

# Respondent IDs to investigate
RESPONDENT_IDS = [
    "PROJ_F7672C4B_1765804627174",
    "PROJ_F7672C4B_1766054565252"
]


def investigate_respondent(respondent_id):
    try:
        project = Project.objects.get(id=PROJECT_ID)

        # Define custom category order
        CATEGORY_ORDER = [
            'Sociodemographics',
            'Environmental LCA',
            'Social LCA',
            'Vulnerability',
            'Fairness',
            'Solutions',
            'Informations',
            'Proximity and Value',
        ]

        # Get all QuestionBank items
        all_bank_items = QuestionBank.objects.filter(project=project)
        category_order_map = {cat: idx for idx, cat in enumerate(CATEGORY_ORDER)}

        question_bank_items = sorted(
            all_bank_items,
            key=lambda item: (
                category_order_map.get(item.question_category, 999),
                -item.priority_score,
                item.created_at
            )
        )

        print(f"\n{'='*100}")
        print(f"INVESTIGATING RESPONDENT: {respondent_id}")
        print(f"{'='*100}\n")

        # Get respondent
        respondent = Respondent.objects.filter(
            project=project,
            respondent_id=respondent_id
        ).first()

        if not respondent:
            print(f"❌ Respondent not found: {respondent_id}")
            return

        print(f"Respondent Type: {respondent.respondent_type}")
        print(f"Commodity: {respondent.commodity}")
        print(f"Country: {respondent.country}")
        print(f"Total Responses: {respondent.responses.count()}")
        print()

        # Get generated questions for this respondent's bundle
        generated_questions = Question.objects.filter(
            project=project,
            assigned_respondent_type=respondent.respondent_type,
            assigned_commodity=respondent.commodity or '',
            assigned_country=respondent.country or ''
        ).select_related('question_bank_source').order_by('order_index')

        print(f"{'='*100}")
        print(f"GENERATED QUESTIONS FOR THIS BUNDLE")
        print(f"{'='*100}")
        print(f"Total: {generated_questions.count()} questions\n")

        # Show first 20 generated questions with their QB mapping
        print("First 20 Generated Questions:")
        print("-" * 100)
        for idx, q in enumerate(generated_questions[:20], 1):
            qb_source = q.question_bank_source
            if qb_source:
                qb_idx = next((i for i, qb in enumerate(question_bank_items, 1) if qb.id == qb_source.id), None)
                print(f"Position {idx:2d}: QB{qb_idx:3d} | {q.question_text[:70]}...")
                print(f"             Category: {qb_source.question_category}")
            else:
                print(f"Position {idx:2d}: NO QB | {q.question_text[:70]}...")
            print()

        # Get all responses for this respondent
        responses = respondent.responses.all().select_related(
            'question',
            'question__question_bank_source'
        ).order_by('collected_at')

        print(f"\n{'='*100}")
        print(f"ACTUAL RESPONSES FROM THIS RESPONDENT")
        print(f"{'='*100}")
        print(f"Total: {responses.count()} responses\n")

        # Show first 20 responses
        print("First 20 Responses:")
        print("-" * 100)

        for idx, resp in enumerate(responses[:20], 1):
            if resp.question and resp.question.question_bank_source:
                qb_source = resp.question.question_bank_source
                qb_idx = next((i for i, qb in enumerate(question_bank_items, 1) if qb.id == qb_source.id), None)

                print(f"Response {idx:2d}: QB{qb_idx:3d}")
                print(f"  Question: {resp.question.question_text[:70]}...")
                print(f"  Answer: {resp.response_value}")
                print(f"  Category: {qb_source.question_category}")
                print(f"  Collected: {resp.collected_at}")
            else:
                print(f"Response {idx:2d}: ORPHANED (no question_id)")
                print(f"  Answer: {resp.response_value}")
                print(f"  Collected: {resp.collected_at}")
            print()

        # CRITICAL CHECK: Compare generated questions vs actual responses
        print(f"\n{'='*100}")
        print(f"MAPPING ANALYSIS: Do responses match generated questions?")
        print(f"{'='*100}\n")

        generated_list = list(generated_questions[:20])
        responses_list = list(responses[:20])

        print(f"Comparing first 20 positions:")
        print("-" * 100)

        for idx in range(min(len(generated_list), len(responses_list))):
            gen_q = generated_list[idx]
            resp = responses_list[idx]

            # Get QB numbers
            gen_qb_idx = None
            resp_qb_idx = None

            if gen_q.question_bank_source:
                gen_qb_idx = next((i for i, qb in enumerate(question_bank_items, 1) if qb.id == gen_q.question_bank_source.id), None)

            if resp.question and resp.question.question_bank_source:
                resp_qb_idx = next((i for i, qb in enumerate(question_bank_items, 1) if qb.id == resp.question.question_bank_source.id), None)

            match_status = "✓ MATCH" if gen_qb_idx == resp_qb_idx else "✗ MISMATCH"

            print(f"Position {idx + 1}:")
            print(f"  Generated Question: QB{gen_qb_idx if gen_qb_idx else '???'} - {gen_q.question_text[:60]}...")

            if resp.question:
                print(f"  Actual Response:    QB{resp_qb_idx if resp_qb_idx else '???'} - {resp.question.question_text[:60]}...")
                print(f"  Answer: {resp.response_value}")
            else:
                print(f"  Actual Response:    ORPHANED - {resp.response_value}")

            print(f"  Status: {match_status}")
            print()

        print(f"{'='*100}")
        print(f"END OF INVESTIGATION FOR {respondent_id}")
        print(f"{'='*100}\n\n")

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    print(f"\n{'='*100}")
    print(f"INVESTIGATING SPECIFIC RESPONDENTS WITH MISMATCHED RESPONSES")
    print(f"{'='*100}\n")

    for respondent_id in RESPONDENT_IDS:
        investigate_respondent(respondent_id)

    print(f"\n{'='*100}")
    print(f"ALL INVESTIGATIONS COMPLETE")
    print(f"{'='*100}\n")
