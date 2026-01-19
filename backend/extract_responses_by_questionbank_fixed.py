"""
Script to extract responses mapped back to QuestionBank items with proper orphaned response handling.

This script fixes the mismatch issue by using question_bank_context stored in Response model
to map orphaned responses correctly, rather than relying on position-based matching with current questions.

Key improvements:
1. Uses response.question_bank_context to identify which QuestionBank item was answered
2. For truly orphaned responses without context, uses collected_at timestamp order
3. Only includes QB columns that are actually targeted to each respondent type

Output format:
- Row: One row per respondent
- Columns: respondent_id, respondent_type, commodity, country, QB1, QB2, QB3, ... (only applicable QB items)
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
from django.db.models import Count, Q, Prefetch

# Project ID to analyze
PROJECT_ID = "f7672c4b-db61-421a-8c41-15aa5909e760"


def is_qb_targeted_to_respondent(bank_item, respondent):
    """
    Check if a QuestionBank item is targeted to a specific respondent.
    Returns True if the QB item should be shown to this respondent.
    """
    # Check respondent type targeting
    if bank_item.targeted_respondents:
        if respondent.respondent_type not in bank_item.targeted_respondents:
            return False

    # Check commodity targeting
    if bank_item.targeted_commodities:
        if respondent.commodity not in bank_item.targeted_commodities:
            return False

    # Check country targeting
    if bank_item.targeted_countries:
        if respondent.country not in bank_item.targeted_countries:
            return False

    return True


def extract_responses_by_questionbank():
    """
    Extract all responses mapped back to QuestionBank items with proper handling.
    """
    try:
        # Get the project
        project = Project.objects.get(id=PROJECT_ID)
        print(f"\n{'='*80}")
        print(f"Response Data Extraction (Fixed - Mapped to QuestionBank)")
        print(f"{'='*80}")
        print(f"Project: {project.name}")
        print(f"Project ID: {PROJECT_ID}")
        print(f"{'='*80}\n")

        # Define custom category order (same as frontend)
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

        # Get all QuestionBank items for this project
        all_bank_items = QuestionBank.objects.filter(
            project=project
        ).select_related('project')

        # Sort by custom category order
        category_order_map = {cat: idx for idx, cat in enumerate(CATEGORY_ORDER)}

        question_bank_items = sorted(
            all_bank_items,
            key=lambda item: (
                category_order_map.get(item.question_category, 999),
                -item.priority_score,
                item.created_at
            )
        )

        total_bank_items = len(question_bank_items)
        print(f"Total QuestionBank Items: {total_bank_items}\n")
        print(f"Category Order: {' → '.join(CATEGORY_ORDER)}\n")

        # Create a mapping of QuestionBank ID to QB number and metadata
        qb_id_to_number = {}
        qb_metadata = {}

        for idx, bank_item in enumerate(question_bank_items, 1):
            qb_id_to_number[str(bank_item.id)] = idx
            qb_metadata[idx] = {
                'id': str(bank_item.id),
                'text': bank_item.question_text,
                'category': bank_item.question_category or 'general',
                'targeted_respondents': bank_item.targeted_respondents,
                'targeted_commodities': bank_item.targeted_commodities,
                'targeted_countries': bank_item.targeted_countries,
                'response_type': bank_item.response_type,
                'priority_score': bank_item.priority_score,
            }

        # Get all respondents
        respondents = Respondent.objects.filter(
            project=project
        ).prefetch_related(
            Prefetch('responses', queryset=Response.objects.order_by('collected_at'))
        ).order_by('respondent_id')

        total_respondents = respondents.count()
        print(f"Total Respondents: {total_respondents}\n")

        if total_respondents == 0:
            print("⚠️  No respondents found for this project.")
            return None

        # Initialize data structure
        data_rows = []

        # Track statistics
        total_valid_responses = 0
        total_orphaned_with_context = 0
        total_orphaned_without_context = 0
        total_orphaned_recovered = 0

        print("Processing respondents...\n")

        # Process each respondent
        for respondent_idx, respondent in enumerate(respondents, 1):
            # Determine which QB columns are applicable to this respondent
            applicable_qb_numbers = []
            for idx, bank_item in enumerate(question_bank_items, 1):
                if is_qb_targeted_to_respondent(bank_item, respondent):
                    applicable_qb_numbers.append(idx)

            row = {
                'respondent_id': respondent.respondent_id,
                'respondent_type': respondent.respondent_type or '',
                'commodity': respondent.commodity or '',
                'country': respondent.country or '',
                'completion_status': respondent.completion_status,
                'created_at': respondent.created_at.isoformat() if respondent.created_at else '',
                'last_response_at': respondent.last_response_at.isoformat() if respondent.last_response_at else '',
                'applicable_questions': len(applicable_qb_numbers),
            }

            # Initialize only applicable QuestionBank columns
            for qb_num in applicable_qb_numbers:
                row[f"QB{qb_num}"] = ''

            # Get all responses for this respondent
            responses = list(respondent.responses.all())

            # Separate responses by type
            valid_responses = []
            orphaned_with_context = []
            orphaned_without_context = []

            for response in responses:
                if response.question and response.question.question_bank_source:
                    # Valid response with question link
                    valid_responses.append(response)
                    total_valid_responses += 1
                elif response.question_bank_context and 'question_bank_id' in response.question_bank_context:
                    # Orphaned but has context
                    orphaned_with_context.append(response)
                    total_orphaned_with_context += 1
                else:
                    # Orphaned without context
                    orphaned_without_context.append(response)
                    total_orphaned_without_context += 1

            # Fill in valid responses
            for response in valid_responses:
                qb_id = str(response.question.question_bank_source.id)
                if qb_id in qb_id_to_number:
                    qb_num = qb_id_to_number[qb_id]
                    if f"QB{qb_num}" in row:  # Only if it's an applicable column
                        row[f"QB{qb_num}"] = response.response_value or ''

            # Fill in orphaned responses with context
            for response in orphaned_with_context:
                qb_id = response.question_bank_context.get('question_bank_id')
                if qb_id and str(qb_id) in qb_id_to_number:
                    qb_num = qb_id_to_number[str(qb_id)]
                    if f"QB{qb_num}" in row and not row[f"QB{qb_num}"]:
                        row[f"QB{qb_num}"] = response.response_value or ''
                        total_orphaned_recovered += 1

            # For orphaned responses without context, try position-based recovery
            if orphaned_without_context:
                # Get questions for this bundle in correct order
                bundle_questions = Question.objects.filter(
                    project=project,
                    assigned_respondent_type=respondent.respondent_type,
                    assigned_commodity=respondent.commodity or '',
                    assigned_country=respondent.country or ''
                ).select_related('question_bank_source').order_by('order_index')

                bundle_questions_list = list(bundle_questions)

                for idx, orphaned_response in enumerate(orphaned_without_context):
                    if idx < len(bundle_questions_list):
                        question = bundle_questions_list[idx]
                        if question.question_bank_source:
                            qb_id = str(question.question_bank_source.id)
                            if qb_id in qb_id_to_number:
                                qb_num = qb_id_to_number[qb_id]
                                if f"QB{qb_num}" in row and not row[f"QB{qb_num}"]:
                                    row[f"QB{qb_num}"] = orphaned_response.response_value or ''
                                    total_orphaned_recovered += 1

            data_rows.append(row)

            if respondent_idx % 50 == 0:
                print(f"Processed {respondent_idx}/{total_respondents} respondents...")

        print(f"Processed all {total_respondents} respondents\n")

        # Report statistics
        print(f"{'='*80}")
        print(f"Response Processing Statistics")
        print(f"{'='*80}")
        print(f"Valid responses (with question link): {total_valid_responses}")
        print(f"Orphaned responses with context: {total_orphaned_with_context}")
        print(f"Orphaned responses without context: {total_orphaned_without_context}")
        print(f"Total orphaned responses recovered: {total_orphaned_recovered}")
        print()

        # Create DataFrame
        df = pd.DataFrame(data_rows)

        # Get summary statistics
        print(f"{'='*80}")
        print(f"Data Summary")
        print(f"{'='*80}")
        print(f"Total Rows (Respondents): {len(df)}")
        print(f"Total Columns: {len(df.columns)}")
        print()

        # Export to CSV
        output_file = f"questionbank_responses_export_FIXED_{PROJECT_ID}.csv"
        df.to_csv(output_file, index=False, encoding='utf-8-sig')
        print(f"✅ Exported data to: {output_file}")
        print()

        # Create QB mapping file
        qb_mapping_file = f"questionbank_mapping_FIXED_{PROJECT_ID}.csv"
        qb_mapping_rows = []
        for qb_num in sorted(qb_metadata.keys()):
            meta = qb_metadata[qb_num]
            qb_mapping_rows.append({
                'column_name': f"QB{qb_num}",
                'question_text': meta['text'],
                'question_category': meta['category'],
                'targeted_respondents': ', '.join(meta['targeted_respondents']) if meta['targeted_respondents'] else '',
                'targeted_commodities': ', '.join(meta['targeted_commodities']) if meta['targeted_commodities'] else '',
                'targeted_countries': ', '.join(meta['targeted_countries']) if meta['targeted_countries'] else '',
                'response_type': meta['response_type'],
                'priority_score': meta['priority_score'],
            })

        qb_mapping_df = pd.DataFrame(qb_mapping_rows)
        qb_mapping_df.to_csv(qb_mapping_file, index=False, encoding='utf-8-sig')
        print(f"✅ Exported QuestionBank mapping to: {qb_mapping_file}")
        print()

        # Calculate response rates
        print(f"{'='*80}")
        print(f"Response Analysis")
        print(f"{'='*80}")

        # Count responses per QB column
        qb_columns = [col for col in df.columns if col.startswith('QB')]
        response_stats = []

        for col in qb_columns:
            qb_num = int(col[2:])
            non_empty = df[col].astype(str).str.strip().ne('').sum()

            # Count how many respondents this QB was applicable to
            applicable_count = df[col].notna().sum()

            completion_rate = (non_empty / applicable_count * 100) if applicable_count > 0 else 0

            response_stats.append({
                'column': col,
                'qb_number': qb_num,
                'responses': non_empty,
                'applicable_respondents': applicable_count,
                'completion_rate': completion_rate,
                'category': qb_metadata[qb_num]['category'],
                'question': qb_metadata[qb_num]['text'][:80] + ('...' if len(qb_metadata[qb_num]['text']) > 80 else '')
            })

        # Show top 20
        response_stats_sorted = sorted(response_stats, key=lambda x: x['responses'], reverse=True)

        print("\nTop 20 Most Responded QuestionBank Items:")
        print("-" * 80)
        for idx, stat in enumerate(response_stats_sorted[:20], 1):
            print(f"{idx}. {stat['column']}: {stat['responses']}/{stat['applicable_respondents']} ({stat['completion_rate']:.1f}%)")
            print(f"   Question: {stat['question']}")
            print(f"   Category: {stat['category']}")
            print()

        print(f"{'='*80}")
        print(f"Extraction Complete!")
        print(f"{'='*80}\n")

        return df

    except Project.DoesNotExist:
        print(f"❌ Error: Project with ID '{PROJECT_ID}' not found.")
        return None
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    print("\n" + "="*80)
    print("QUESTIONBANK RESPONSE EXTRACTION TOOL (FIXED VERSION)")
    print("="*80)
    print()
    print("This script properly handles orphaned responses by:")
    print("1. Using question_bank_context to map responses to QB items")
    print("2. Only including QB columns applicable to each respondent type")
    print("3. Maintaining proper category ordering")
    print()
    print("="*80)
    print()

    df = extract_responses_by_questionbank()

    print()
    print("="*80)
    print("EXTRACTION COMPLETE!")
    print("="*80)
    print()
    print("Generated files:")
    print(f"  1. questionbank_responses_export_FIXED_{PROJECT_ID}.csv")
    print(f"  2. questionbank_mapping_FIXED_{PROJECT_ID}.csv")
    print()
