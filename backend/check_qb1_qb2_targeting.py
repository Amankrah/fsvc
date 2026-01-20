"""
Script to check QB1 and QB2 targeting and understand the mismatch.

This will:
1. Show what QB1 and QB2 are
2. Check which QB items are targeted to problem respondents
3. Identify what QB item the "income" response should map to
"""

import os
import django

# Setup Django
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_core.settings.production')
django.setup()

from forms.models import QuestionBank
from projects.models import Project

# Project ID
PROJECT_ID = "f7672c4b-db61-421a-8c41-15aa5909e760"


def check_qb1_qb2_targeting():
    """
    Check QB1 and QB2 targeting.
    """
    try:
        project = Project.objects.get(id=PROJECT_ID)
        print(f"\n{'='*80}")
        print(f"QB1 and QB2 Targeting Analysis")
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

        # Show first 15 QB items
        print(f"First 15 QuestionBank Items (All):")
        print("-" * 80)
        for idx, qb in enumerate(question_bank_items[:15], 1):
            print(f"\nQB{idx}:")
            print(f"  Question: {qb.question_text[:80]}...")
            print(f"  Category: {qb.question_category}")
            print(f"  Response Type: {qb.response_type}")
            print(f"  Targeted Respondents: {qb.targeted_respondents if qb.targeted_respondents else 'ALL'}")
            print(f"  Targeted Commodities: {qb.targeted_commodities if qb.targeted_commodities else 'ALL'}")

        # Now check what QB items are targeted to farmers + groundnut
        print(f"\n{'='*80}")
        print(f"Sociodemographic QB Items for: farmers + groundnut")
        print(f"{'='*80}\n")

        applicable_sociodem = []
        for idx, qb in enumerate(question_bank_items, 1):
            if qb.question_category != 'Sociodemographics':
                continue

            # Check targeting
            is_targeted = True

            if qb.targeted_respondents and 'farmers' not in qb.targeted_respondents:
                is_targeted = False

            if qb.targeted_commodities and 'groundnut' not in qb.targeted_commodities:
                is_targeted = False

            if is_targeted:
                applicable_sociodem.append((idx, qb))

        print(f"Found {len(applicable_sociodem)} applicable Sociodemographic QB items:")
        print("-" * 80)

        for idx, (qb_num, qb) in enumerate(applicable_sociodem[:15], 1):
            print(f"\nPosition {idx} (QB{qb_num}):")
            print(f"  Question: {qb.question_text[:80]}...")
            print(f"  Response Type: {qb.response_type}")

        # Now check for processors + palm_oil
        print(f"\n{'='*80}")
        print(f"Sociodemographic QB Items for: processors + palm_oil")
        print(f"{'='*80}\n")

        applicable_sociodem_proc = []
        for idx, qb in enumerate(question_bank_items, 1):
            if qb.question_category != 'Sociodemographics':
                continue

            # Check targeting
            is_targeted = True

            if qb.targeted_respondents and 'processors' not in qb.targeted_respondents:
                is_targeted = False

            if qb.targeted_commodities and 'palm_oil' not in qb.targeted_commodities:
                is_targeted = False

            if is_targeted:
                applicable_sociodem_proc.append((idx, qb))

        print(f"Found {len(applicable_sociodem_proc)} applicable Sociodemographic QB items:")
        print("-" * 80)

        for idx, (qb_num, qb) in enumerate(applicable_sociodem_proc[:15], 1):
            print(f"\nPosition {idx} (QB{qb_num}):")
            print(f"  Question: {qb.question_text[:80]}...")
            print(f"  Response Type: {qb.response_type}")

        # Search for income-related questions
        print(f"\n{'='*80}")
        print(f"Searching for Income-Related Questions")
        print(f"{'='*80}\n")

        for idx, qb in enumerate(question_bank_items, 1):
            text_lower = qb.question_text.lower()
            if any(word in text_lower for word in ['income', 'revenue', 'salary', 'earning', 'ghc', 'cedi']):
                print(f"QB{idx} ({qb.question_category}):")
                print(f"  {qb.question_text[:100]}...")
                print(f"  Targeted Respondents: {qb.targeted_respondents if qb.targeted_respondents else 'ALL'}")
                print()

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    check_qb1_qb2_targeting()
