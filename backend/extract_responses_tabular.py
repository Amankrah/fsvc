"""
Script to extract responses in tabular format for analysis.

This script:
1. Retrieves all responses for a specific project
2. Extracts responses with respondent metadata (respondent_id, commodity, targeted_respondent, country, question_category)
3. Pivots responses so each question becomes a separate column
4. Exports to CSV for easy analysis

Output format:
- Row: One row per respondent
- Columns: respondent_id, respondent_type, commodity, country, question_category, Q1, Q2, Q3, ... (one column per question)
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


def extract_responses_to_dataframe():
    """
    Extract all responses for a project into a pandas DataFrame.
    Each row represents a respondent with all their responses as columns.
    """
    try:
        # Get the project
        project = Project.objects.get(id=PROJECT_ID)
        print(f"\n{'='*80}")
        print(f"Response Data Extraction")
        print(f"{'='*80}")
        print(f"Project: {project.name}")
        print(f"Project ID: {PROJECT_ID}")
        print(f"{'='*80}\n")

        # Get all respondents for this project with their responses
        respondents = Respondent.objects.filter(
            project=project
        ).prefetch_related(
            Prefetch('responses', queryset=Response.objects.select_related('question'))
        ).order_by('respondent_id')

        total_respondents = respondents.count()
        print(f"Total Respondents: {total_respondents}\n")

        if total_respondents == 0:
            print("⚠️  No respondents found for this project.")
            return None

        # Get all unique questions for this project to create columns
        all_questions = Question.objects.filter(
            project=project
        ).select_related('question_bank_source').order_by('order_index')

        total_questions = all_questions.count()
        print(f"Total Questions: {total_questions}\n")

        if total_questions == 0:
            print("⚠️  No questions found for this project.")
            return None

        # Create a mapping of question_id to column name
        question_columns = {}
        question_text_map = {}
        question_category_map = {}

        for idx, question in enumerate(all_questions, 1):
            col_name = f"Q{idx}"
            question_columns[str(question.id)] = col_name
            # Truncate question text for readability
            question_text_map[col_name] = question.question_text[:100] + ('...' if len(question.question_text) > 100 else '')
            question_category_map[col_name] = question.question_category or 'general'

        print(f"Creating data structure with {total_questions} question columns...")
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

            # Initialize all question columns with empty values
            for col_name in question_columns.values():
                row[col_name] = ''

            # Fill in responses for this respondent
            for response in respondent.responses.all():
                if response.question and str(response.question.id) in question_columns:
                    col_name = question_columns[str(response.question.id)]
                    row[col_name] = response.response_value or ''

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
        print(f"  - Question columns: {total_questions}")
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
        output_file = f"responses_export_{PROJECT_ID}.csv"
        df.to_csv(output_file, index=False, encoding='utf-8-sig')
        print(f"✅ Exported data to: {output_file}")
        print()

        # Create a separate file with question mappings
        question_mapping_file = f"question_mapping_{PROJECT_ID}.csv"
        question_mapping_df = pd.DataFrame([
            {
                'column_name': col_name,
                'question_text': question_text_map[col_name],
                'question_category': question_category_map[col_name]
            }
            for col_name in sorted(question_columns.values(), key=lambda x: int(x[1:]))
        ])
        question_mapping_df.to_csv(question_mapping_file, index=False, encoding='utf-8-sig')
        print(f"✅ Exported question mapping to: {question_mapping_file}")
        print()

        # Calculate completion rates
        print(f"{'='*80}")
        print(f"Response Completion Analysis")
        print(f"{'='*80}")

        # Count non-empty responses per question
        for col_name in sorted(question_columns.values(), key=lambda x: int(x[1:])):
            non_empty = df[col_name].astype(str).str.strip().ne('').sum()
            completion_rate = (non_empty / len(df) * 100) if len(df) > 0 else 0
            print(f"{col_name}: {non_empty}/{len(df)} responses ({completion_rate:.1f}%)")
            print(f"   Question: {question_text_map[col_name][:80]}...")
            print(f"   Category: {question_category_map[col_name]}")
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


def extract_responses_by_category():
    """
    Alternative extraction: Create separate sheets/files for each question category.
    This is useful for analyzing different aspects of the food system separately.
    """
    try:
        # Get the project
        project = Project.objects.get(id=PROJECT_ID)
        print(f"\n{'='*80}")
        print(f"Response Data Extraction by Category")
        print(f"{'='*80}")
        print(f"Project: {project.name}")
        print(f"Project ID: {PROJECT_ID}")
        print(f"{'='*80}\n")

        # Get all respondents
        respondents = Respondent.objects.filter(
            project=project
        ).prefetch_related(
            Prefetch('responses', queryset=Response.objects.select_related('question'))
        ).order_by('respondent_id')

        total_respondents = respondents.count()
        print(f"Total Respondents: {total_respondents}\n")

        if total_respondents == 0:
            print("⚠️  No respondents found for this project.")
            return None

        # Get all questions grouped by category
        all_questions = Question.objects.filter(
            project=project
        ).select_related('question_bank_source').order_by('question_category', 'order_index')

        # Group questions by category
        questions_by_category = defaultdict(list)
        for question in all_questions:
            category = question.question_category or 'general'
            questions_by_category[category].append(question)

        print(f"Found {len(questions_by_category)} categories:")
        for category, questions in questions_by_category.items():
            print(f"  - {category}: {len(questions)} questions")
        print()

        # Create Excel writer for multiple sheets
        excel_file = f"responses_by_category_{PROJECT_ID}.xlsx"
        with pd.ExcelWriter(excel_file, engine='openpyxl') as writer:

            for category, questions in questions_by_category.items():
                print(f"Processing category: {category} ({len(questions)} questions)...")

                # Create column mapping for this category
                question_columns = {}
                question_text_map = {}

                for idx, question in enumerate(questions, 1):
                    col_name = f"Q{idx}"
                    question_columns[str(question.id)] = col_name
                    question_text_map[col_name] = question.question_text[:100] + ('...' if len(question.question_text) > 100 else '')

                # Initialize data rows
                data_rows = []

                for respondent in respondents:
                    row = {
                        'respondent_id': respondent.respondent_id,
                        'respondent_type': respondent.respondent_type or '',
                        'commodity': respondent.commodity or '',
                        'country': respondent.country or '',
                    }

                    # Initialize question columns
                    for col_name in question_columns.values():
                        row[col_name] = ''

                    # Fill in responses
                    for response in respondent.responses.all():
                        if response.question and str(response.question.id) in question_columns:
                            col_name = question_columns[str(response.question.id)]
                            row[col_name] = response.response_value or ''

                    data_rows.append(row)

                # Create DataFrame for this category
                df = pd.DataFrame(data_rows)

                # Write to Excel sheet (truncate sheet name to 31 chars - Excel limit)
                sheet_name = category[:31]
                df.to_excel(writer, sheet_name=sheet_name, index=False)

                print(f"  ✅ Created sheet: {sheet_name} ({len(df)} rows, {len(df.columns)} columns)")

        print()
        print(f"✅ Exported category-based data to: {excel_file}")
        print()

        print(f"{'='*80}")
        print(f"Category Extraction Complete!")
        print(f"{'='*80}\n")

        return excel_file

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
    print("RESPONSE DATA EXTRACTION TOOL")
    print("="*80)
    print()
    print("This script will extract response data in two formats:")
    print("1. Single CSV file with all questions as columns")
    print("2. Excel file with separate sheets for each question category")
    print()
    print("="*80)
    print()

    # Extract to single DataFrame/CSV
    print("EXTRACTION 1: Single CSV File")
    print("-" * 80)
    df = extract_responses_to_dataframe()

    print()
    print("="*80)
    print()

    # Extract by category to Excel
    print("EXTRACTION 2: Excel File by Category")
    print("-" * 80)
    excel_file = extract_responses_by_category()

    print()
    print("="*80)
    print("ALL EXTRACTIONS COMPLETE!")
    print("="*80)
    print()
    print("Generated files:")
    print(f"  1. responses_export_{PROJECT_ID}.csv - All responses in single file")
    print(f"  2. question_mapping_{PROJECT_ID}.csv - Question column mappings")
    print(f"  3. responses_by_category_{PROJECT_ID}.xlsx - Responses grouped by category")
    print()
