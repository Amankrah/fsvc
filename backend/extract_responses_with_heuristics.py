"""
Script to extract responses using heuristic matching for Sociodemographics.

Since the collection order doesn't match QB order, we use response patterns
to identify which QB item each response belongs to:
- Age patterns: "18-29", "30-39", "40-49", etc.
- Gender patterns: "Male", "Female"
- Education patterns: "Primary", "Secondary", "Higher education", etc.
- Income patterns: "GHC", "cedis", numbers > 100
- Country: "Ghana"
- etc.
"""

import os
import django
import pandas as pd
import re
from collections import defaultdict

# Setup Django
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_core.settings.production')
django.setup()

from forms.models import QuestionBank
from responses.models import Response, Respondent
from projects.models import Project
from django.db.models import Prefetch

# Project ID
PROJECT_ID = "f7672c4b-db61-421a-8c41-15aa5909e760"


def identify_sociodem_question(response_value, question_text):
    """
    Identify which Sociodemographic QB item a response belongs to based on patterns.
    """
    value = str(response_value).strip()
    text_lower = question_text.lower()

    # Age patterns
    if re.match(r'^\d+\s*[–-]\s*\d+$', value) or value in ['18 – 29', '30 – 39', '40 – 49', '50 – 59', '60 and above']:
        if 'age' in text_lower or 'old' in text_lower:
            return 'age'

    # Gender patterns
    if value.lower() in ['male', 'female']:
        if 'gender' in text_lower:
            return 'gender'

    # Education patterns
    education_keywords = ['primary', 'secondary', 'education', 'university', 'tertiary', 'post-secondary', 'formal']
    if any(keyword in value.lower() for keyword in education_keywords):
        if 'education' in text_lower:
            return 'education'

    # Income patterns - contains currency or large numbers
    if re.search(r'ghc|cedi|₵', value.lower()) or (value.replace(',', '').replace('.', '').isdigit() and int(value.replace(',', '').replace('.', '')) > 100):
        if 'income' in text_lower or 'revenue' in text_lower or 'earning' in text_lower:
            return 'income'

    # Household size - small single digit number
    if value.isdigit() and 1 <= int(value) <= 30:
        if 'household' in text_lower and 'people' in text_lower:
            return 'household_size'
        if 'children' in text_lower:
            return 'children'

    # Country
    if value.lower() in ['ghana', 'nigeria', 'ivory coast', 'cameroon']:
        if 'country' in text_lower:
            return 'country'

    # Region/District
    if '/' in value or any(region in value.lower() for region in ['northern', 'ashanti', 'greater', 'volta', 'eastern', 'western', 'central']):
        if 'region' in text_lower or 'district' in text_lower:
            return 'region'

    # Rural/Urban
    if value.lower() in ['rural', 'urban']:
        if 'rural' in text_lower or 'urban' in text_lower:
            return 'rural_urban'

    # Language - often single word or with "Other"
    if not re.search(r'\d', value) and len(value.split()) <= 3:
        if 'language' in text_lower and 'speak' in text_lower:
            return 'language_speak'

    # Languages (multiple) - JSON array format
    if value.startswith('[') and value.endswith(']'):
        if 'language' in text_lower and ('writing' in text_lower or 'reading' in text_lower or 'comfortable' in text_lower):
            return 'languages_comfortable'

    return None


def extract_with_heuristics():
    """
    Extract responses using heuristic matching for Sociodemographics.
    """
    try:
        project = Project.objects.get(id=PROJECT_ID)
        print(f"\n{'='*80}")
        print(f"Response Extraction with Heuristic Matching")
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

        # Create mappings
        qb_id_to_number = {str(item.id): idx for idx, item in enumerate(question_bank_items, 1)}
        qb_number_to_item = {idx: item for idx, item in enumerate(question_bank_items, 1)}

        # Create mapping of question type to QB number for Sociodemographics
        sociodem_type_to_qb = {}
        for idx, item in enumerate(question_bank_items, 1):
            if item.question_category == 'Sociodemographics':
                text_lower = item.question_text.lower()
                if 'age' in text_lower or 'old' in text_lower:
                    sociodem_type_to_qb['age'] = idx
                elif 'gender' in text_lower:
                    sociodem_type_to_qb['gender'] = idx
                elif 'education' in text_lower:
                    sociodem_type_to_qb['education'] = idx
                elif 'income' in text_lower:
                    sociodem_type_to_qb['income'] = idx
                elif 'household' in text_lower and 'people' in text_lower:
                    sociodem_type_to_qb['household_size'] = idx
                elif 'children' in text_lower:
                    sociodem_type_to_qb['children'] = idx
                elif 'country' in text_lower:
                    sociodem_type_to_qb['country'] = idx
                elif 'region' in text_lower or 'district' in text_lower:
                    sociodem_type_to_qb['region'] = idx
                elif 'rural' in text_lower or 'urban' in text_lower:
                    sociodem_type_to_qb['rural_urban'] = idx
                elif 'language' in text_lower and 'speak' in text_lower:
                    sociodem_type_to_qb['language_speak'] = idx
                elif 'language' in text_lower and ('comfortable' in text_lower or 'writing' in text_lower):
                    sociodem_type_to_qb['languages_comfortable'] = idx

        print("Sociodemographic QB Mappings:")
        for qtype, qb_num in sorted(sociodem_type_to_qb.items(), key=lambda x: x[1]):
            print(f"  {qtype}: QB{qb_num}")
        print()

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
            'sociodem_matched_by_heuristics': 0,
            'sociodem_matched_by_position': 0,
            'other_matched_by_position': 0,
            'unmatched': 0,
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

            # Get all responses
            responses = list(respondent.responses.all())
            stats['total_responses'] += len(responses)

            # Group QB items by category for this respondent
            qb_by_category = defaultdict(list)
            for idx, bank_item in enumerate(question_bank_items, 1):
                # Check targeting
                is_targeted = True
                if bank_item.targeted_respondents and respondent.respondent_type not in bank_item.targeted_respondents:
                    is_targeted = False
                if bank_item.targeted_commodities and respondent.commodity not in bank_item.targeted_commodities:
                    is_targeted = False
                if bank_item.targeted_countries and respondent.country not in bank_item.targeted_countries:
                    is_targeted = False

                if is_targeted:
                    category = bank_item.question_category or 'general'
                    qb_by_category[category].append(idx)

            # Track position within each category
            category_positions = defaultdict(int)

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

                # Strategy 2: Orphaned responses
                elif response.question_bank_context:
                    stats['responses_orphaned'] += 1
                    category = response.question_bank_context.get('question_category', '')

                    # Strategy 2a: Heuristic matching for Sociodemographics
                    if category == 'Sociodemographics':
                        # Find the QB item for this category
                        applicable_qbs = qb_by_category.get(category, [])
                        if applicable_qbs:
                            # Get the QB item's question text
                            first_qb = qb_number_to_item.get(applicable_qbs[0])
                            if first_qb:
                                question_type = identify_sociodem_question(response.response_value, first_qb.question_text)

                                # Try all applicable QBs to find the right match
                                for qb_num in applicable_qbs:
                                    qb_item = qb_number_to_item.get(qb_num)
                                    if qb_item:
                                        qtype = identify_sociodem_question(response.response_value, qb_item.question_text)
                                        if qtype and qtype in sociodem_type_to_qb:
                                            target_qb = sociodem_type_to_qb[qtype]
                                            if not row[f"QB{target_qb}"]:
                                                row[f"QB{target_qb}"] = response.response_value or ''
                                                matched = True
                                                stats['sociodem_matched_by_heuristics'] += 1
                                                break

                    # Strategy 2b: Position-based for other categories
                    if not matched and category in qb_by_category:
                        applicable_qbs = qb_by_category[category]
                        position = category_positions[category]
                        category_positions[category] += 1

                        if position < len(applicable_qbs):
                            qb_num = applicable_qbs[position]
                            if not row[f"QB{qb_num}"]:
                                row[f"QB{qb_num}"] = response.response_value or ''
                                matched = True
                                if category == 'Sociodemographics':
                                    stats['sociodem_matched_by_position'] += 1
                                else:
                                    stats['other_matched_by_position'] += 1

                if not matched:
                    stats['unmatched'] += 1

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
        print(f"    - Sociodem matched by heuristics: {stats['sociodem_matched_by_heuristics']}")
        print(f"    - Sociodem matched by position: {stats['sociodem_matched_by_position']}")
        print(f"    - Other categories matched by position: {stats['other_matched_by_position']}")
        print(f"  - Unmatched: {stats['unmatched']}")
        print()

        # Create DataFrame
        df = pd.DataFrame(data_rows)

        # Export
        output_file = f"questionbank_responses_HEURISTIC_{PROJECT_ID}.csv"
        df.to_csv(output_file, index=False, encoding='utf-8-sig')
        print(f"✅ Exported to: {output_file}\n")

        return df

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    print("\n" + "="*80)
    print("HEURISTIC-BASED RESPONSE EXTRACTION")
    print("="*80)
    print()
    print("This script uses response patterns to identify Sociodemographic questions:")
    print("- Age patterns, gender patterns, education patterns, etc.")
    print("- Handles cases where collection order != QB order")
    print()
    print("="*80)
    print()

    df = extract_with_heuristics()

    if df is not None:
        print()
        print("="*80)
        print("EXTRACTION COMPLETE!")
        print("="*80)
        print()
