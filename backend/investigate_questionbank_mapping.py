"""
Script to investigate why responses don't match QuestionBank questions.

This script checks:
1. Which QuestionBank items are targeted to which respondent types
2. What the first few QB items are for different respondent types
3. Why aggregators_lbcs might be getting wrong responses in QB1-QB11
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


def investigate_mapping():
    try:
        project = Project.objects.get(id=PROJECT_ID)
        print(f"\n{'='*80}")
        print(f"INVESTIGATING QUESTIONBANK MAPPING ISSUE")
        print(f"{'='*80}")
        print(f"Project: {project.name}")
        print(f"{'='*80}\n")

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

        print(f"Total QuestionBank Items: {len(question_bank_items)}\n")

        # Show first 15 QuestionBank items (QB1-QB15)
        print(f"{'='*80}")
        print(f"FIRST 15 QUESTIONBANK ITEMS (QB1-QB15)")
        print(f"{'='*80}\n")

        for idx, qb in enumerate(question_bank_items[:15], 1):
            print(f"QB{idx}: {qb.question_text[:80]}...")
            print(f"     Category: {qb.question_category}")
            print(f"     Targeted Respondents: {', '.join(qb.targeted_respondents) if qb.targeted_respondents else 'ALL'}")
            print(f"     Targeted Commodities: {', '.join(qb.targeted_commodities) if qb.targeted_commodities else 'ALL'}")
            print()

        # Check which respondent types exist
        print(f"\n{'='*80}")
        print(f"RESPONDENT TYPES IN PROJECT")
        print(f"{'='*80}\n")

        respondent_types = Respondent.objects.filter(project=project).values('respondent_type').distinct()
        for rt in respondent_types:
            count = Respondent.objects.filter(project=project, respondent_type=rt['respondent_type']).count()
            print(f"  {rt['respondent_type']}: {count} respondents")

        # Focus on aggregators_lbcs + cocoa + Ghana
        print(f"\n{'='*80}")
        print(f"INVESTIGATING: aggregators_lbcs | cocoa | Ghana")
        print(f"{'='*80}\n")

        # Get a sample respondent
        sample_respondent = Respondent.objects.filter(
            project=project,
            respondent_type='aggregators_lbcs',
            commodity='cocoa',
            country='Ghana'
        ).first()

        if sample_respondent:
            print(f"Sample Respondent: {sample_respondent.respondent_id}")
            print(f"Total Responses: {sample_respondent.responses.count()}")
            print()

            # Get their generated questions
            generated_questions = Question.objects.filter(
                project=project,
                assigned_respondent_type='aggregators_lbcs',
                assigned_commodity='cocoa',
                assigned_country='Ghana'
            ).select_related('question_bank_source').order_by('order_index')[:15]

            print(f"First 15 Generated Questions for this bundle:")
            print("-" * 80)

            for idx, q in enumerate(generated_questions, 1):
                qb_source = q.question_bank_source
                if qb_source:
                    # Find which QB number this is
                    qb_idx = next((i for i, qb in enumerate(question_bank_items, 1) if qb.id == qb_source.id), None)
                    print(f"Position {idx}: QB{qb_idx if qb_idx else '???'} - {q.question_text[:60]}...")
                    print(f"           Category: {qb_source.question_category}")
                else:
                    print(f"Position {idx}: NO QB SOURCE - {q.question_text[:60]}...")
                print()

            # Get sample responses
            print(f"\n{'='*80}")
            print(f"SAMPLE RESPONSES FROM THIS RESPONDENT")
            print(f"{'='*80}\n")

            responses = sample_respondent.responses.all().select_related('question', 'question__question_bank_source').order_by('collected_at')[:15]

            for idx, resp in enumerate(responses, 1):
                if resp.question and resp.question.question_bank_source:
                    qb_source = resp.question.question_bank_source
                    qb_idx = next((i for i, qb in enumerate(question_bank_items, 1) if qb.id == qb_source.id), None)
                    print(f"Response {idx}: QB{qb_idx if qb_idx else '???'}")
                    print(f"  Question: {resp.question.question_text[:60]}...")
                    print(f"  Answer: {resp.response_value}")
                    print(f"  Category: {qb_source.question_category}")
                else:
                    print(f"Response {idx}: ORPHANED (no question)")
                    print(f"  Answer: {resp.response_value}")
                print()

        # Check if QB1-QB11 are actually for aggregators_lbcs
        print(f"\n{'='*80}")
        print(f"CHECKING: Are QB1-QB11 targeted to aggregators_lbcs?")
        print(f"{'='*80}\n")

        for idx, qb in enumerate(question_bank_items[:11], 1):
            is_targeted = 'aggregators_lbcs' in qb.targeted_respondents if qb.targeted_respondents else True
            cocoa_targeted = 'cocoa' in qb.targeted_commodities if qb.targeted_commodities else True

            print(f"QB{idx}: {qb.question_text[:50]}...")
            print(f"  Targeted to aggregators_lbcs? {'✓ YES' if is_targeted else '✗ NO'}")
            print(f"  Targeted to cocoa? {'✓ YES' if cocoa_targeted else '✗ NO'}")
            print(f"  Targeted respondents: {qb.targeted_respondents}")
            print()

        print(f"{'='*80}")
        print(f"INVESTIGATION COMPLETE")
        print(f"{'='*80}\n")

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    investigate_mapping()
