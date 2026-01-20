"""
Script to investigate mismatches in the gender question (QB2).

This script:
1. Loads the extracted responses from category_matching
2. Finds QB2 responses that are not "Male" or "Female"
3. Shows what those responses are and which respondents have them
4. Helps identify if responses are misaligned
"""

import os
import django
import pandas as pd

# Setup Django
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_core.settings.production')
django.setup()

from forms.models import QuestionBank
from responses.models import Response, Respondent
from projects.models import Project

# Project ID to analyze
PROJECT_ID = "f7672c4b-db61-421a-8c41-15aa5909e760"

# Specific respondents mentioned
PROBLEM_RESPONDENTS = [
    "PROJ_F7672C4B_1765780004894",
    "PROJ_F7672C4B_1765805354969",
    "PROJ_F7672C4B_1765810448053",
    "PROJ_F7672C4B_1765806430331"
]


def investigate_gender_mismatches():
    """
    Check QB2 (gender question) for unexpected responses.
    """
    try:
        project = Project.objects.get(id=PROJECT_ID)
        print(f"\n{'='*80}")
        print(f"Investigating Gender Question (QB2) Mismatches")
        print(f"{'='*80}")
        print(f"Project: {project.name}")
        print(f"{'='*80}\n")

        # Load the CSV file
        csv_file = f"questionbank_responses_CATEGORY_MATCHED_{PROJECT_ID}.csv"

        if not os.path.exists(csv_file):
            print(f"❌ CSV file not found: {csv_file}")
            print("Please run extract_responses_by_category_matching.py first")
            return

        df = pd.read_csv(csv_file)
        print(f"Loaded {len(df)} respondents from CSV\n")

        # Check if QB2 column exists
        if 'QB2' not in df.columns:
            print("❌ QB2 column not found in CSV")
            return

        # Define expected gender responses
        expected_genders = ['Male', 'Female', 'male', 'female', '']

        # Find mismatches
        df['QB2_filled'] = df['QB2'].astype(str).str.strip()
        mismatches = df[~df['QB2_filled'].isin(expected_genders) & (df['QB2_filled'] != '')]

        print(f"{'='*80}")
        print(f"QB2 Gender Question Analysis")
        print(f"{'='*80}\n")

        print(f"Total respondents: {len(df)}")
        print(f"QB2 responses filled: {df['QB2_filled'].ne('').sum()}")
        print(f"QB2 mismatches found: {len(mismatches)}")
        print()

        if len(mismatches) > 0:
            print(f"{'='*80}")
            print(f"Mismatched QB2 Responses (Not Male/Female)")
            print(f"{'='*80}\n")

            print(f"Showing all {len(mismatches)} mismatches:\n")
            print("-" * 80)

            for idx, row in mismatches.iterrows():
                print(f"\nRespondent: {row['respondent_id']}")
                print(f"  Type: {row['respondent_type']}")
                print(f"  Commodity: {row['commodity']}")
                print(f"  Country: {row['country']}")
                print(f"  QB2 Response: '{row['QB2_filled']}'")

                # Show first few QB responses to understand the pattern
                qb_sample = []
                for i in range(1, 16):
                    col = f'QB{i}'
                    if col in row and pd.notna(row[col]) and str(row[col]).strip():
                        qb_sample.append(f"QB{i}: {str(row[col])[:40]}...")

                if qb_sample:
                    print(f"  First responses:")
                    for sample in qb_sample[:5]:
                        print(f"    {sample}")

            print()

        # Check the specific problem respondents
        print(f"\n{'='*80}")
        print(f"Checking Specific Problem Respondents")
        print(f"{'='*80}\n")

        for resp_id in PROBLEM_RESPONDENTS:
            if resp_id in df['respondent_id'].values:
                row = df[df['respondent_id'] == resp_id].iloc[0]

                print(f"\nRespondent: {resp_id}")
                print(f"  Type: {row['respondent_type']}")
                print(f"  Commodity: {row['commodity']}")
                print(f"  Country: {row['country']}")
                print(f"  QB2 (Gender): '{row['QB2_filled']}'")

                # Show first 15 QB responses
                print(f"  First 15 QB responses:")
                for i in range(1, 16):
                    col = f'QB{i}'
                    if col in row:
                        value = str(row[col]) if pd.notna(row[col]) else ''
                        if value and value != 'nan':
                            print(f"    QB{i}: {value[:60]}...")
                        else:
                            print(f"    QB{i}: (empty)")

                print("\n" + "-" * 80)
            else:
                print(f"\n❌ Respondent not found: {resp_id}")

        # Get the actual gender question from QuestionBank
        print(f"\n{'='*80}")
        print(f"QuestionBank QB2 Details")
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

        if len(question_bank_items) >= 2:
            qb2 = question_bank_items[1]  # QB2 is 2nd item (index 1)
            print(f"QB2 Question Text: {qb2.question_text}")
            print(f"QB2 Category: {qb2.question_category}")
            print(f"QB2 Response Type: {qb2.response_type}")
            print(f"QB2 Targeted Respondents: {qb2.targeted_respondents}")
            print(f"QB2 Targeted Commodities: {qb2.targeted_commodities}")

        print(f"\n{'='*80}")
        print(f"Investigation Complete")
        print(f"{'='*80}\n")

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    investigate_gender_mismatches()
