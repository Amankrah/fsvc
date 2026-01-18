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

        # Get all QuestionBank items for this project
        question_bank_items = QuestionBank.objects.filter(
            project=project
        ).order_by('question_category', '-priority_score')

        total_bank_items = question_bank_items.count()
        print(f"Total QuestionBank Items: {total_bank_items}\n")

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

            # Group responses by QuestionBank source
            # If a respondent has multiple responses to generated questions from same QuestionBank,
            # we'll consolidate them (for now, taking the first response)
            qb_responses = {}

            for response in respondent.responses.all():
                if response.question and response.question.question_bank_source:
                    qb_id = str(response.question.question_bank_source.id)

                    # If we don't have a response for this QuestionBank yet, store it
                    if qb_id not in qb_responses:
                        qb_responses[qb_id] = response.response_value or ''
                    # If response_type is choice_multiple, we might want to consolidate multiple responses
                    # For now, we just keep the first response
                    # TODO: In future, handle consolidation better (e.g., combine multiple choice responses)

            # Fill in the QuestionBank columns
            for qb_id, response_value in qb_responses.items():
                if qb_id in qb_columns:
                    col_name = qb_columns[qb_id]
                    row[col_name] = response_value

            data_rows.append(row)

            if respondent_idx % 50 == 0:
                print(f"Processed {respondent_idx}/{total_respondents} respondents...")

        print(f"Processed all {total_respondents} respondents")
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
