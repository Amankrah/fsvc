"""
Script to count responses for each question in the QuestionBank for a specific project.

This script:
1. Retrieves all QuestionBank items for the specified project
2. For each QuestionBank item, counts how many Response records exist
3. Generates a detailed report showing question text and response counts
"""

import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from forms.models import QuestionBank, Question
from responses.models import Response
from projects.models import Project
from django.db.models import Count, Q

# Project ID to analyze
PROJECT_ID = "f7672c4b-db61-421a-8c41-15aa5909e760"


def count_responses_per_question_bank():
    """
    Count responses for each QuestionBank item in the specified project.
    """
    try:
        # Get the project
        project = Project.objects.get(id=PROJECT_ID)
        print(f"\n{'='*80}")
        print(f"Question Bank Response Count Analysis")
        print(f"{'='*80}")
        print(f"Project: {project.name}")
        print(f"Project ID: {PROJECT_ID}")
        print(f"{'='*80}\n")

        # Get all QuestionBank items for this project
        question_bank_items = QuestionBank.objects.filter(
            project=project
        ).order_by('question_category', '-priority_score')

        total_bank_items = question_bank_items.count()
        print(f"Total QuestionBank items: {total_bank_items}\n")

        if total_bank_items == 0:
            print("⚠️  No QuestionBank items found for this project.")
            return

        # Statistics tracking
        total_responses_all = 0
        items_with_responses = 0
        items_without_responses = 0

        # Category-wise breakdown
        category_stats = {}

        print(f"{'='*80}")
        print(f"Question Bank Items and Response Counts")
        print(f"{'='*80}\n")

        for idx, bank_item in enumerate(question_bank_items, 1):
            # Find all Question instances generated from this QuestionBank item
            generated_questions = Question.objects.filter(
                project=project,
                question_bank_source=bank_item
            )

            # Count responses for all generated questions
            response_count = Response.objects.filter(
                project=project,
                question__question_bank_source=bank_item
            ).count()

            # Track statistics
            total_responses_all += response_count
            if response_count > 0:
                items_with_responses += 1
            else:
                items_without_responses += 1

            # Track category statistics
            category = bank_item.question_category or 'uncategorized'
            if category not in category_stats:
                category_stats[category] = {
                    'total_items': 0,
                    'total_responses': 0,
                    'items_with_responses': 0
                }
            category_stats[category]['total_items'] += 1
            category_stats[category]['total_responses'] += response_count
            if response_count > 0:
                category_stats[category]['items_with_responses'] += 1

            # Display question info
            status_icon = "✅" if response_count > 0 else "⭕"
            print(f"{status_icon} Question {idx}/{total_bank_items}")
            print(f"   ID: {bank_item.id}")
            print(f"   Category: {bank_item.question_category or 'N/A'}")
            print(f"   Priority: {bank_item.priority_score}")
            print(f"   Question: {bank_item.question_text[:100]}{'...' if len(bank_item.question_text) > 100 else ''}")
            print(f"   Response Type: {bank_item.response_type}")
            print(f"   Targeted Respondents: {', '.join(bank_item.targeted_respondents) if bank_item.targeted_respondents else 'None'}")
            print(f"   Targeted Commodities: {', '.join(bank_item.targeted_commodities) if bank_item.targeted_commodities else 'All'}")
            print(f"   Targeted Countries: {', '.join(bank_item.targeted_countries) if bank_item.targeted_countries else 'All'}")
            print(f"   Generated Questions: {generated_questions.count()}")
            print(f"   📊 Response Count: {response_count}")
            print()

        # Summary statistics
        print(f"\n{'='*80}")
        print(f"Summary Statistics")
        print(f"{'='*80}")
        print(f"Total QuestionBank Items: {total_bank_items}")
        print(f"Items with Responses: {items_with_responses} ({items_with_responses/total_bank_items*100:.1f}%)")
        print(f"Items without Responses: {items_without_responses} ({items_without_responses/total_bank_items*100:.1f}%)")
        print(f"Total Responses (all questions): {total_responses_all}")
        print(f"Average Responses per Item: {total_responses_all/total_bank_items:.2f}")
        print()

        # Category breakdown
        print(f"{'='*80}")
        print(f"Category Breakdown")
        print(f"{'='*80}")
        for category, stats in sorted(category_stats.items()):
            print(f"\n📁 {category.upper()}")
            print(f"   Total Items: {stats['total_items']}")
            print(f"   Items with Responses: {stats['items_with_responses']} ({stats['items_with_responses']/stats['total_items']*100:.1f}%)")
            print(f"   Total Responses: {stats['total_responses']}")
            print(f"   Avg Responses per Item: {stats['total_responses']/stats['total_items']:.2f}")

        # Top 10 most responded questions
        print(f"\n{'='*80}")
        print(f"Top 10 Most Responded Questions")
        print(f"{'='*80}\n")

        # Get QuestionBank items with their response counts
        bank_items_with_counts = []
        for bank_item in question_bank_items:
            response_count = Response.objects.filter(
                project=project,
                question__question_bank_source=bank_item
            ).count()
            bank_items_with_counts.append((bank_item, response_count))

        # Sort by response count descending
        bank_items_with_counts.sort(key=lambda x: x[1], reverse=True)

        for idx, (bank_item, response_count) in enumerate(bank_items_with_counts[:10], 1):
            print(f"{idx}. [{response_count} responses] {bank_item.question_text[:80]}{'...' if len(bank_item.question_text) > 80 else ''}")
            print(f"   Category: {bank_item.question_category}")
            print()

        print(f"{'='*80}")
        print(f"Analysis Complete!")
        print(f"{'='*80}\n")

    except Project.DoesNotExist:
        print(f"❌ Error: Project with ID '{PROJECT_ID}' not found.")
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    count_responses_per_question_bank()
