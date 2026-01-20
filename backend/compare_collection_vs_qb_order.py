"""
Script to compare the order questions were collected vs QB order.

The issue: Questions were asked in one order during collection,
but QB items are ordered differently. We need to understand
what the actual collection order was.
"""

import os
import django

# Setup Django
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_core.settings.production')
django.setup()

from forms.models import QuestionBank
from responses.models import Response, Respondent
from projects.models import Project

# Project ID
PROJECT_ID = "f7672c4b-db61-421a-8c41-15aa5909e760"

# Problem respondent
RESPONDENT_ID = "PROJ_F7672C4B_1765780004894"


def compare_orders():
    """
    Compare collection order vs QB order.
    """
    try:
        project = Project.objects.get(id=PROJECT_ID)
        print(f"\n{'='*80}")
        print(f"Comparing Collection Order vs QuestionBank Order")
        print(f"{'='*80}\n")

        # Get QB items
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

        print("Expected QB Order (Sociodemographics):")
        print("-" * 80)
        for idx, qb in enumerate(question_bank_items[:11], 1):
            if qb.question_category == 'Sociodemographics':
                print(f"QB{idx}: {qb.question_text[:60]}...")
        print()

        # Get the problem respondent
        respondent = Respondent.objects.get(project=project, respondent_id=RESPONDENT_ID)

        print(f"Respondent: {respondent.respondent_id}")
        print(f"Type: {respondent.respondent_type}")
        print(f"Commodity: {respondent.commodity}")
        print()

        # Get all Sociodemographic responses
        all_responses = Response.objects.filter(
            respondent=respondent
        ).order_by('collected_at')

        sociodem_responses = [
            r for r in all_responses
            if r.question_bank_context and
            r.question_bank_context.get('question_category') == 'Sociodemographics'
        ]

        print("Actual Collection Order (Sociodemographics responses):")
        print("-" * 80)
        for idx, resp in enumerate(sociodem_responses, 1):
            print(f"Position {idx}: {resp.response_value}")
        print()

        # Try to infer which QB each response should map to
        print("Inferred Mapping:")
        print("-" * 80)

        # Based on the responses, let's try to guess:
        response_patterns = [
            ("40 – 49", "Age", "QB1"),
            ("GHC10,000", "Income", "QB6"),
            ("15", "Household size", "QB4"),
            ("7", "Children", "QB5"),
            ("Male", "Gender", "QB2"),
            ("No formal education", "Education", "QB3"),
            ("GHANA", "Country", "QB7"),
            ("NORTHERN/KUMBUNGU", "Region", "QB8"),
            ("DAGBANI", "Language", "QB10"),
            ("Rural", "Rural/Urban", "QB9"),
            ('["English"]', "Languages", "QB11"),
        ]

        for idx, (response_val, question_type, qb_num) in enumerate(response_patterns, 1):
            actual_response = sociodem_responses[idx-1].response_value if idx <= len(sociodem_responses) else "N/A"
            match = "✓" if response_val in actual_response else "✗"
            print(f"Position {idx}: {actual_response[:30]:30s} → {question_type:20s} → {qb_num} {match}")

        print()
        print("INSIGHT:")
        print("-" * 80)
        print("The questions were asked in this order during collection:")
        print("1. Age (QB1) ✓")
        print("2. Income (QB6) ← Should be position 6 in QB order!")
        print("3. Household size (QB4)")
        print("4. Children (QB5)")
        print("5. Gender (QB2) ← Should be position 2 in QB order!")
        print("6. Education (QB3)")
        print("7-11. Other demographics")
        print()
        print("The frontend asked questions in a DIFFERENT ORDER than the QB list!")
        print("Our position-based matching assumes QB order, but responses follow collection order.")

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    compare_orders()
