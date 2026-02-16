#!/usr/bin/env python
"""
Delete test projects from the database
This will cascade delete all related data (questions, responses, respondents, etc.)
"""

import os
import django
import sys

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_core.settings.production')
django.setup()

from projects.models import Project
from forms.models import Question
from responses.models import Response, Respondent

# List of test projects to delete
TEST_PROJECTS = [
    "Test Senegal",
    "Nigeria TEST",
    "Test Senegal 2",
    "Test Senegal 3",
    "Nigeria Test 2"
]

print("=" * 120)
print("DELETE TEST PROJECTS")
print("=" * 120)

# Find all matching projects
projects_to_delete = []
for project_name in TEST_PROJECTS:
    projects = Project.objects.filter(name__iexact=project_name)
    if projects.exists():
        for project in projects:
            projects_to_delete.append(project)
            print(f"\nFound: {project.name}")
            print(f"  ID: {project.id}")
            print(f"  Created by: {project.created_by.email if project.created_by else 'Unknown'}")
            print(f"  Created at: {project.created_at}")
    else:
        print(f"\n⚠️  Project not found: {project_name}")

if not projects_to_delete:
    print("\n❌ No test projects found to delete")
    sys.exit(0)

print("\n" + "=" * 120)
print("STATISTICS FOR PROJECTS TO BE DELETED")
print("=" * 120)

total_questions = 0
total_responses = 0
total_respondents = 0

for project in projects_to_delete:
    questions = Question.objects.filter(project=project).count()
    responses = Response.objects.filter(project=project).count()
    respondents = Respondent.objects.filter(project=project).count()

    total_questions += questions
    total_responses += responses
    total_respondents += respondents

    print(f"\n{project.name}:")
    print(f"  Questions: {questions}")
    print(f"  Responses: {responses}")
    print(f"  Respondents: {respondents}")

print("\n" + "-" * 120)
print(f"TOTAL across all {len(projects_to_delete)} projects:")
print(f"  Questions: {total_questions}")
print(f"  Responses: {total_responses}")
print(f"  Respondents: {total_respondents}")

print("\n" + "=" * 120)
print("CONFIRMATION")
print("=" * 120)
print(f"\nYou are about to DELETE {len(projects_to_delete)} projects:")
for project in projects_to_delete:
    print(f"  - {project.name} (ID: {project.id})")

print(f"\nThis will CASCADE DELETE:")
print(f"  - {total_questions} questions")
print(f"  - {total_responses} responses")
print(f"  - {total_respondents} respondents")
print(f"  - All related data (project members, etc.)")

print("\n⚠️  WARNING: This action CANNOT be undone!")

# Get user confirmation
response = input("\nType 'DELETE' to confirm deletion, or anything else to cancel: ")

if response == 'DELETE':
    print("\n" + "=" * 120)
    print("DELETING PROJECTS...")
    print("=" * 120)

    deleted_count = 0
    for project in projects_to_delete:
        try:
            project_name = project.name
            project_id = project.id
            project.delete()
            deleted_count += 1
            print(f"✓ Deleted: {project_name} (ID: {project_id})")
        except Exception as e:
            print(f"❌ Error deleting {project.name}: {str(e)}")

    print("\n" + "=" * 120)
    print("DELETION COMPLETE")
    print("=" * 120)
    print(f"Successfully deleted {deleted_count} out of {len(projects_to_delete)} projects")

    # Verify deletion
    remaining = Project.objects.filter(name__in=TEST_PROJECTS).count()
    if remaining == 0:
        print("\n✓✓✓ All test projects successfully removed from database!")
    else:
        print(f"\n⚠️  WARNING: {remaining} projects still remain in database")
else:
    print("\n❌ Deletion cancelled.")
    print("No projects were deleted.")
