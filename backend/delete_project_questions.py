#!/usr/bin/env python
"""Delete all generated questions for a specific project"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_core.settings')
django.setup()

from forms.models import Question
from projects.models import Project
from django.db.models import Count

def delete_project_questions(project_id):
    """Delete all questions for a project"""
    try:
        # Get project details
        project = Project.objects.get(id=project_id)
        print(f"\n{'='*60}")
        print(f"PROJECT DETAILS")
        print(f"{'='*60}")
        print(f"Project Name: {project.name}")
        print(f"Project ID: {project.id}")
        print(f"Created By: {project.created_by}")
        print(f"Created At: {project.created_at}")

        # Get all questions for this project
        questions = Question.objects.filter(project=project)
        count = questions.count()

        print(f"\n{'='*60}")
        print(f"QUESTIONS TO DELETE")
        print(f"{'='*60}")
        print(f"Total Questions: {count}")

        if count > 0:
            # Show breakdown by bundle
            bundles = questions.values(
                'assigned_respondent_type',
                'assigned_commodity',
                'assigned_country'
            ).annotate(count=Count('id'))

            print(f"\nBreakdown by Generation Bundle:")
            for bundle in bundles:
                resp = bundle['assigned_respondent_type']
                comm = bundle['assigned_commodity'] or 'All'
                ctry = bundle['assigned_country'] or 'All'
                cnt = bundle['count']
                print(f"  - {resp} / {comm} / {ctry}: {cnt} questions")

            print(f"\n{'='*60}")
            print(f"DELETING ALL {count} QUESTIONS...")
            print(f"{'='*60}")

            # Delete all questions
            deleted_count, deleted_details = questions.delete()

            print(f"\nSuccessfully deleted {deleted_count} objects")
            print(f"\nDeleted objects breakdown:")
            for model, cnt in deleted_details.items():
                if cnt > 0:
                    print(f"  - {model}: {cnt}")

            # Verify deletion
            remaining = Question.objects.filter(project=project).count()
            print(f"\nRemaining questions: {remaining}")
            print(f"{'='*60}\n")
        else:
            print("No questions found for this project.")
            print(f"{'='*60}\n")

    except Project.DoesNotExist:
        print(f"\nERROR: Project with ID '{project_id}' not found")
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    project_id = '230bfffa-52cf-46d4-8bf9-923c707bbf00'
    delete_project_questions(project_id)
