"""
Script to extract responses using category-based matching from question_bank_context.

Since orphaned responses have question_bank_context with category but not question_bank_id,
we match responses to QuestionBank items based on:
1. Category from question_bank_context
2. Position within that category
3. Respondent type, commodity, and country targeting

This approach handles the case where questions may have been re-targeted after data collection.
"""

import os
import django
import pandas as pd
from collections import defaultdict

# Setup Django
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_core.settings.production')
django.setup()

from forms.models import QuestionBank, Question
from responses.models import Response, Respondent
from projects.models import Project
from django.db.models import Prefetch

# Project ID to analyze
PROJECT_ID = "f7672c4b-db61-421a-8c41-15aa5909e760"


def extract_responses_by_category_matching():
    """
    Extract responses by matching categories from question_bank_context.
    """
    try:
        project = Project.objects.get(id=PROJECT_ID)
        print(f"\n{'='*80}")
        print(f"Response Extraction (Category-Based Matching)")
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
        all_bank_items = QuestionBank.objects.filter(project=project).select_related('project')

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

        # Create QB mappings
        qb_id_to_number = {}
        qb_number_to_item = {}

        for idx, bank_item in enumerate(question_bank_items, 1):
            qb_id_to_number[str(bank_item.id)] = idx
            qb_number_to_item[idx] = bank_item

        # Group QB items by category for position-based matching within category
        qb_by_category = defaultdict(list)
        for idx, bank_item in enumerate(question_bank_items, 1):
            category = bank_item.question_category or 'general'
            qb_by_category[category].append({
                'qb_number': idx,
                'item': bank_item
            })

        # Get all respondents
        respondents = Respondent.objects.filter(project=project).prefetch_related(
            Prefetch('responses', queryset=Response.objects.order_by('collected_at'))
        ).order_by('respondent_id')

        print(f"Total Respondents: {respondents.count()}\n")

        # Track statistics
        stats = {
            'total_responses': 0,
            'responses_with_valid_question': 0,
            'responses_orphaned': 0,
            'responses_with_category': 0,
            'responses_matched_by_category': 0,
            'responses_unmatched': 0,
        }

        data_rows = []

        print("Processing respondents...\n")

        for respondent_idx, respondent in enumerate(respondents, 1):
            row = {
                'respondent_id': respondent.respondent_id,
                'respondent_type': respondent.respondent_type or '',
                'commodity': respondent.commodity or '',
                'country': respondent.country or '',
                'completion_status': respondent.completion_status,
            }

            # Initialize all QB columns
            for qb_num in range(1, len(question_bank_items) + 1):
                row[f"QB{qb_num}"] = ''

            # Track position within each category for this respondent
            category_positions = defaultdict(int)

            # Get all responses
            responses = list(respondent.responses.all())
            stats['total_responses'] += len(responses)

            for response in responses:
                matched = False

                # Strategy 1: Direct question link
                if response.question and response.question.question_bank_source:
                    qb_id = str(response.question.question_bank_source.id)
                    if qb_id in qb_id_to_number:
                        qb_num = qb_id_to_number[qb_id]
                        row[f"QB{qb_num}"] = response.response_value or ''
                        matched = True
                        stats['responses_with_valid_question'] += 1

                # Strategy 2: Use question_bank_context for orphaned responses
                elif response.question_bank_context:
                    stats['responses_orphaned'] += 1

                    # Get category from context
                    category = response.question_bank_context.get('question_category', '')

                    if category:
                        stats['responses_with_category'] += 1

                        # Get the position within this category for this respondent
                        position_in_category = category_positions[category]
                        category_positions[category] += 1

                        # Find QB items in this category that match respondent targeting
                        category_qbs = qb_by_category.get(category, [])

                        # Filter by targeting
                        applicable_qbs = []
                        for qb_info in category_qbs:
                            bank_item = qb_info['item']

                            # Check if this QB is targeted to this respondent
                            is_targeted = True

                            if bank_item.targeted_respondents:
                                if respondent.respondent_type not in bank_item.targeted_respondents:
                                    is_targeted = False

                            if bank_item.targeted_commodities:
                                if respondent.commodity not in bank_item.targeted_commodities:
                                    is_targeted = False

                            if bank_item.targeted_countries:
                                if respondent.country not in bank_item.targeted_countries:
                                    is_targeted = False

                            if is_targeted:
                                applicable_qbs.append(qb_info)

                        # Match by position within applicable QBs
                        if position_in_category < len(applicable_qbs):
                            qb_num = applicable_qbs[position_in_category]['qb_number']
                            if not row[f"QB{qb_num}"]:  # Don't overwrite existing
                                row[f"QB{qb_num}"] = response.response_value or ''
                                matched = True
                                stats['responses_matched_by_category'] += 1

                if not matched:
                    stats['responses_unmatched'] += 1

            data_rows.append(row)

            if respondent_idx % 50 == 0:
                print(f"Processed {respondent_idx}/{respondents.count()} respondents...")

        print(f"\nProcessed all {respondents.count()} respondents\n")

        # Print statistics
        print(f"{'='*80}")
        print(f"Processing Statistics")
        print(f"{'='*80}")
        print(f"Total responses: {stats['total_responses']}")
        print(f"  - With valid question link: {stats['responses_with_valid_question']}")
        print(f"  - Orphaned: {stats['responses_orphaned']}")
        print(f"    - With category info: {stats['responses_with_category']}")
        print(f"    - Matched by category: {stats['responses_matched_by_category']}")
        print(f"  - Unmatched: {stats['responses_unmatched']}")
        print()

        # Create DataFrame
        df = pd.DataFrame(data_rows)

        # Export
        output_file = f"questionbank_responses_CATEGORY_MATCHED_{PROJECT_ID}.csv"
        df.to_csv(output_file, index=False, encoding='utf-8-sig')
        print(f"✅ Exported to: {output_file}\n")

        # Show sample of data
        print(f"{'='*80}")
        print(f"Sample Data (First 3 Respondents, First 15 QB Columns)")
        print(f"{'='*80}\n")

        sample_cols = ['respondent_id', 'respondent_type', 'commodity'] + [f'QB{i}' for i in range(1, 16)]
        available_cols = [col for col in sample_cols if col in df.columns]
        print(df[available_cols].head(3).to_string())
        print()

        return df

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    print("\n" + "="*80)
    print("CATEGORY-BASED RESPONSE EXTRACTION")
    print("="*80)
    print()
    print("This script matches orphaned responses using:")
    print("1. Category from question_bank_context")
    print("2. Position within that category")
    print("3. Respondent targeting rules")
    print()
    print("="*80)
    print()

    df = extract_responses_by_category_matching()

    if df is not None:
        print()
        print("="*80)
        print("EXTRACTION COMPLETE!")
        print("="*80)
        print()
