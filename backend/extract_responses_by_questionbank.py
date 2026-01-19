"""
Script to extract responses mapped back to QuestionBank items (not generated questions).

This script:
1. Retrieves all QuestionBank items for the project (490 items)
2. For each respondent, consolidates all responses back to their QuestionBank source
3. Creates a tabular export where columns are QuestionBank items (not generated questions)
4. Exports to CSV for easy analysis

Output format:
- Row: One row per respondent
- Columns: respondent_id, respondent_type, commodity, country, QB1, QB2, QB3, ... (one column per QuestionBank item)

Key difference from extract_responses_tabular.py:
- That script used individual generated questions (6,602 questions) as columns
- This script uses QuestionBank items (490 items) as columns
- Multiple responses to generated questions from same QuestionBank are consolidated
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


def extract_responses_by_questionbank():
    """
    Extract all responses mapped back to QuestionBank items.
    Each row represents a respondent with responses mapped to QuestionBank sources.
    """
    try:
        # Get the project
        project = Project.objects.get(id=PROJECT_ID)
        print(f"\n{'='*80}")
        print(f"Response Data Extraction (Mapped to QuestionBank)")
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

        # Sort by custom category order, then by order within category
        # Create a mapping for category order
        category_order_map = {cat: idx for idx, cat in enumerate(CATEGORY_ORDER)}

        question_bank_items = sorted(
            all_bank_items,
            key=lambda item: (
                category_order_map.get(item.question_category, 999),  # Category order
                -item.priority_score,  # Then by priority (descending)
                item.created_at  # Then by creation time
            )
        )

        total_bank_items = len(question_bank_items)
        print(f"Total QuestionBank Items: {total_bank_items}\n")
        print(f"Category Order: {' → '.join(CATEGORY_ORDER)}\n")

        # Show QuestionBank breakdown by category (in correct order)
        print("QuestionBank Items by Category:")
        category_counts = {}
        for item in question_bank_items:
            cat = item.question_category or 'Uncategorized'
            category_counts[cat] = category_counts.get(cat, 0) + 1

        for category in CATEGORY_ORDER:
            count = category_counts.get(category, 0)
            if count > 0:
                print(f"  {category}: {count} items")

        # Show any uncategorized items
        if 'Uncategorized' in category_counts:
            print(f"  Uncategorized: {category_counts['Uncategorized']} items")
        print()

        if total_bank_items == 0:
            print("⚠️  No QuestionBank items found for this project.")
            return None

        # Get all respondents for this project with their responses
        respondents = Respondent.objects.filter(
            project=project
        ).prefetch_related(
            Prefetch('responses', queryset=Response.objects.select_related('question', 'question__question_bank_source'))
        ).order_by('respondent_id')

        total_respondents = respondents.count()
        print(f"Total Respondents: {total_respondents}\n")

        if total_respondents == 0:
            print("⚠️  No respondents found for this project.")
            return None

        # Create a mapping of QuestionBank ID to column name
        qb_columns = {}
        qb_text_map = {}
        qb_category_map = {}
        qb_metadata_map = {}

        for idx, bank_item in enumerate(question_bank_items, 1):
            col_name = f"QB{idx}"
            qb_columns[str(bank_item.id)] = col_name
            # Store full question text
            qb_text_map[col_name] = bank_item.question_text
            qb_category_map[col_name] = bank_item.question_category or 'general'
            qb_metadata_map[col_name] = {
                'targeted_respondents': bank_item.targeted_respondents,
                'targeted_commodities': bank_item.targeted_commodities,
                'targeted_countries': bank_item.targeted_countries,
                'response_type': bank_item.response_type,
                'priority_score': bank_item.priority_score,
            }

        print(f"Creating data structure with {total_bank_items} QuestionBank columns...")
        print()

        # Initialize data structure
        data_rows = []

        # Track orphaned response recovery
        total_orphaned_recovered = 0
        respondents_with_orphaned = 0

        # Process each respondent
        for respondent_idx, respondent in enumerate(respondents, 1):
            row = {
                'respondent_id': respondent.respondent_id,
                'respondent_type': respondent.respondent_type or '',
                'commodity': respondent.commodity or '',
                'country': respondent.country or '',
                'completion_status': respondent.completion_status,
                'created_at': respondent.created_at.isoformat() if respondent.created_at else '',
                'last_response_at': respondent.last_response_at.isoformat() if respondent.last_response_at else '',
            }

            # Initialize all QuestionBank columns with empty values
            for col_name in qb_columns.values():
                row[col_name] = ''

            # Separate valid and orphaned responses
            valid_responses = []
            orphaned_responses = []

            for response in respondent.responses.all().order_by('collected_at'):
                if response.question and response.question.question_bank_source:
                    valid_responses.append(response)
                else:
                    # Orphaned response (question_id is NULL)
                    orphaned_responses.append(response)

            # Group valid responses by QuestionBank source
            qb_responses = {}
            for response in valid_responses:
                qb_id = str(response.question.question_bank_source.id)
                if qb_id not in qb_responses:
                    qb_responses[qb_id] = response.response_value or ''

            # Fill in the QuestionBank columns from valid responses
            for qb_id, response_value in qb_responses.items():
                if qb_id in qb_columns:
                    col_name = qb_columns[qb_id]
                    row[col_name] = response_value

            # RECOVERY STRATEGY: Category-aware position-based matching for orphaned responses
            # Match responses using category from question_bank_context and position within category
            if orphaned_responses and len(orphaned_responses) > 0:
                respondents_with_orphaned += 1

                # Group QuestionBank items by category for this respondent
                qb_by_category = {}
                for cat in CATEGORY_ORDER:
                    qb_by_category[cat] = []

                # Populate with applicable QB items in order
                for idx, bank_item in enumerate(question_bank_items, 1):
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
                        category = bank_item.question_category or 'general'
                        if category in qb_by_category:
                            qb_by_category[category].append({
                                'qb_number': idx,
                                'qb_id': str(bank_item.id)
                            })

                # Track position within each category
                category_positions = {cat: 0 for cat in CATEGORY_ORDER}

                # Match orphaned responses by category and position
                recovered_count = 0
                for orphaned_response in orphaned_responses:
                    # Get category from question_bank_context
                    if orphaned_response.question_bank_context:
                        category = orphaned_response.question_bank_context.get('question_category', '')

                        if category in qb_by_category:
                            # Get the QB items in this category applicable to this respondent
                            applicable_qbs = qb_by_category[category]

                            # Get current position within this category
                            position = category_positions[category]
                            category_positions[category] += 1

                            # Match by position within category
                            if position < len(applicable_qbs):
                                qb_info = applicable_qbs[position]
                                qb_id = qb_info['qb_id']

                                if qb_id in qb_columns:
                                    col_name = qb_columns[qb_id]
                                    # Only fill if not already filled
                                    if not row[col_name]:
                                        row[col_name] = orphaned_response.response_value or ''
                                        recovered_count += 1

                total_orphaned_recovered += recovered_count

            data_rows.append(row)

            if respondent_idx % 50 == 0:
                print(f"Processed {respondent_idx}/{total_respondents} respondents...")

        print(f"Processed all {total_respondents} respondents")
        print()

        # Report orphaned response recovery
        if respondents_with_orphaned > 0:
            print(f"{'='*80}")
            print(f"Orphaned Response Recovery")
            print(f"{'='*80}")
            print(f"Respondents with orphaned responses: {respondents_with_orphaned}")
            print(f"Total orphaned responses recovered: {total_orphaned_recovered}")
            print(f"Recovery method: Category-aware position-based matching")
            print(f"Note: Orphaned responses matched using category from question_bank_context")
            print(f"      and position within that category, respecting custom category order")
            print()

        # Create DataFrame
        df = pd.DataFrame(data_rows)

        # Get summary statistics
        print(f"{'='*80}")
        print(f"Data Summary")
        print(f"{'='*80}")
        print(f"Total Rows (Respondents): {len(df)}")
        print(f"Total Columns: {len(df.columns)}")
        print(f"  - Metadata columns: 7 (respondent_id, respondent_type, commodity, country, completion_status, created_at, last_response_at)")
        print(f"  - QuestionBank columns: {total_bank_items}")
        print()

        # Respondent type breakdown
        print("Respondent Type Distribution:")
        print(df['respondent_type'].value_counts())
        print()

        # Commodity breakdown
        print("Commodity Distribution:")
        print(df['commodity'].value_counts())
        print()

        # Country breakdown
        print("Country Distribution:")
        print(df['country'].value_counts())
        print()

        # Completion status breakdown
        print("Completion Status Distribution:")
        print(df['completion_status'].value_counts())
        print()

        # Export to CSV
        output_file = f"questionbank_responses_export_{PROJECT_ID}.csv"
        df.to_csv(output_file, index=False, encoding='utf-8-sig')
        print(f"✅ Exported data to: {output_file}")
        print()

        # Create a separate file with QuestionBank mappings
        qb_mapping_file = f"questionbank_mapping_{PROJECT_ID}.csv"
        qb_mapping_df = pd.DataFrame([
            {
                'column_name': col_name,
                'question_text': qb_text_map[col_name],
                'question_category': qb_category_map[col_name],
                'targeted_respondents': ', '.join(qb_metadata_map[col_name]['targeted_respondents']) if qb_metadata_map[col_name]['targeted_respondents'] else '',
                'targeted_commodities': ', '.join(qb_metadata_map[col_name]['targeted_commodities']) if qb_metadata_map[col_name]['targeted_commodities'] else '',
                'targeted_countries': ', '.join(qb_metadata_map[col_name]['targeted_countries']) if qb_metadata_map[col_name]['targeted_countries'] else '',
                'response_type': qb_metadata_map[col_name]['response_type'],
                'priority_score': qb_metadata_map[col_name]['priority_score'],
            }
            for col_name in sorted(qb_columns.values(), key=lambda x: int(x[2:]))
        ])
        qb_mapping_df.to_csv(qb_mapping_file, index=False, encoding='utf-8-sig')
        print(f"✅ Exported QuestionBank mapping to: {qb_mapping_file}")
        print()

        # Calculate response rates per QuestionBank item
        print(f"{'='*80}")
        print(f"QuestionBank Response Analysis")
        print(f"{'='*80}")
        print()

        # Count non-empty responses per QuestionBank
        response_stats = []
        for col_name in sorted(qb_columns.values(), key=lambda x: int(x[2:])):
            non_empty = df[col_name].astype(str).str.strip().ne('').sum()
            completion_rate = (non_empty / len(df) * 100) if len(df) > 0 else 0

            response_stats.append({
                'column_name': col_name,
                'responses': non_empty,
                'total_respondents': len(df),
                'completion_rate': completion_rate,
                'question': qb_text_map[col_name][:100] + ('...' if len(qb_text_map[col_name]) > 100 else ''),
                'category': qb_category_map[col_name]
            })

        # Show top 20 most responded QuestionBank items
        response_stats_sorted = sorted(response_stats, key=lambda x: x['responses'], reverse=True)

        print("Top 20 Most Responded QuestionBank Items:")
        print("-" * 80)
        for idx, stat in enumerate(response_stats_sorted[:20], 1):
            print(f"{idx}. {stat['column_name']}: {stat['responses']}/{stat['total_respondents']} responses ({stat['completion_rate']:.1f}%)")
            print(f"   Question: {stat['question']}")
            print(f"   Category: {stat['category']}")
            print()

        # Category-wise summary
        print(f"{'='*80}")
        print(f"Category-wise Response Summary")
        print(f"{'='*80}")

        category_summary = defaultdict(lambda: {'total_qb_items': 0, 'total_responses': 0, 'avg_completion': []})

        for stat in response_stats:
            category = stat['category']
            category_summary[category]['total_qb_items'] += 1
            category_summary[category]['total_responses'] += stat['responses']
            category_summary[category]['avg_completion'].append(stat['completion_rate'])

        for category in sorted(category_summary.keys()):
            stats = category_summary[category]
            avg_completion = sum(stats['avg_completion']) / len(stats['avg_completion'])
            print(f"\n📁 {category.upper()}")
            print(f"   Total QuestionBank Items: {stats['total_qb_items']}")
            print(f"   Total Responses: {stats['total_responses']}")
            print(f"   Average Completion Rate: {avg_completion:.1f}%")

        print(f"\n{'='*80}")
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
    print("QUESTIONBANK RESPONSE EXTRACTION TOOL")
    print("="*80)
    print()
    print("This script extracts responses mapped back to QuestionBank items.")
    print("Each column represents a QuestionBank item (490 total),")
    print("not individual generated questions (6,602 total).")
    print()
    print("Key Features:")
    print("- Maps all responses back to their QuestionBank source")
    print("- Consolidates multiple generated question responses per QuestionBank")
    print("- Creates respondent × QuestionBank matrix for analysis")
    print()
    print("="*80)
    print()

    # Extract responses mapped to QuestionBank
    df = extract_responses_by_questionbank()

    print()
    print("="*80)
    print("EXTRACTION COMPLETE!")
    print("="*80)
    print()
    print("Generated files:")
    print(f"  1. questionbank_responses_export_{PROJECT_ID}.csv - All responses mapped to QuestionBank")
    print(f"  2. questionbank_mapping_{PROJECT_ID}.csv - QuestionBank column mappings with metadata")
    print()
    print("To download from server to your local machine:")
    print("Run this in Git Bash on your local Windows machine:")
    print()
    print(f"  scp -i /path/to/fsda_key.pem ubuntu@13.60.137.180:/var/www/fsvc/backend/questionbank_responses_export_{PROJECT_ID}.csv ~/Desktop/")
    print(f"  scp -i /path/to/fsda_key.pem ubuntu@13.60.137.180:/var/www/fsvc/backend/questionbank_mapping_{PROJECT_ID}.csv ~/Desktop/")
    print()
