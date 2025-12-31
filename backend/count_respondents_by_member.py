#!/usr/bin/env python
"""
Script to count respondents collected by each team member.
Focus: FCI4Africa Data Collection project

This counts unique respondents (not total responses) collected by each member.
"""

import os
import django

# Setup Django
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_core.settings.production')
django.setup()

from responses.models import Response, Respondent
from projects.models import Project, ProjectMember
from authentication.models import User
from django.db.models import Count, Q

# Target project
PROJECT_ID = "f7672c4b-db61-421a-8c41-15aa5909e760"
PROJECT_NAME = "FCI4Africa Data Collection"

print("=" * 80)
print(f"RESPONDENT COLLECTION ANALYSIS: {PROJECT_NAME}")
print("=" * 80)

try:
    project = Project.objects.get(id=PROJECT_ID)
    print(f"\nProject: {project.name}")
    print(f"Owner: {project.created_by.email}")
    print(f"Created: {project.created_at.strftime('%Y-%m-%d')}")
except Project.DoesNotExist:
    print(f"\nERROR: Project with ID {PROJECT_ID} not found!")
    sys.exit(1)

# Get all respondents for this project
all_respondents = Respondent.objects.filter(project=project)
total_respondents = all_respondents.count()

print(f"\n1. OVERALL RESPONDENT STATISTICS")
print(f"   Total Respondents: {total_respondents}")

# Count respondents by created_by field
respondents_with_creator = all_respondents.filter(created_by__isnull=False)
respondents_without_creator = all_respondents.filter(created_by__isnull=True)

print(f"   Respondents with creator tracked: {respondents_with_creator.count()} ({respondents_with_creator.count()/total_respondents*100:.1f}%)")
print(f"   Respondents without creator: {respondents_without_creator.count()} ({respondents_without_creator.count()/total_respondents*100:.1f}%)")

# Get project members
members = project.members.all()
owner = project.created_by

print(f"\n2. TEAM COMPOSITION")
print(f"   Project Owner: {owner.email}")
print(f"   Team Members: {members.count()}")
for member in members:
    print(f"     - {member.user.email} (role: {member.role})")

# Count respondents collected by each team member (based on Respondent.created_by)
print(f"\n3. RESPONDENTS COLLECTED BY EACH MEMBER")
print(f"   (Based on Respondent.created_by field)")
print(f"   {'Member Email':<35} {'Respondents Collected':<25} {'% of Total':<12}")
print(f"   {'-'*35} {'-'*25} {'-'*12}")

# Get all users who created respondents (owner + members)
creator_stats = respondents_with_creator.values(
    'created_by__email', 'created_by__username'
).annotate(
    respondent_count=Count('id')
).order_by('-respondent_count')

total_tracked = respondents_with_creator.count()

for stat in creator_stats:
    email = stat['created_by__email'] or stat['created_by__username']
    count = stat['respondent_count']
    percentage = (count / total_tracked * 100) if total_tracked > 0 else 0
    print(f"   {email:<35} {count:<25} {percentage:<12.1f}%")

# Alternative count: Based on responses (Response.collected_by)
print(f"\n4. ALTERNATIVE VIEW: BASED ON RESPONSE.COLLECTED_BY")
print(f"   (This counts which member collected the responses, not who created the respondent)")
print(f"   {'Member Email':<35} {'Unique Respondents':<25} {'Total Responses':<20}")
print(f"   {'-'*35} {'-'*25} {'-'*20}")

# Get responses for this project with collected_by
responses_with_collector = Response.objects.filter(
    project=project,
    collected_by__isnull=False
)

# Count unique respondents per collector
collector_stats = responses_with_collector.values(
    'collected_by__email'
).annotate(
    unique_respondents=Count('respondent', distinct=True),
    total_responses=Count('response_id')
).order_by('-unique_respondents')

for stat in collector_stats:
    email = stat['collected_by__email']
    unique = stat['unique_respondents']
    total = stat['total_responses']
    print(f"   {email:<35} {unique:<25} {total:<20}")

# Detailed breakdown by member
print(f"\n5. DETAILED MEMBER BREAKDOWN")
print("=" * 80)

all_team_users = [owner] + [m.user for m in members]

for user in sorted(all_team_users, key=lambda u: u.email):
    print(f"\n   Member: {user.email}")

    # Count respondents created by this user
    respondents_created = all_respondents.filter(created_by=user).count()
    print(f"   Respondents Created: {respondents_created}")

    # Count responses collected by this user
    responses_collected = Response.objects.filter(
        project=project,
        collected_by=user
    ).count()

    # Count unique respondents from responses
    unique_respondents_from_responses = Response.objects.filter(
        project=project,
        collected_by=user
    ).values('respondent').distinct().count()

    print(f"   Responses Collected: {responses_collected}")
    print(f"   Unique Respondents (from responses): {unique_respondents_from_responses}")

# Summary
print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)

print(f"""
Key Findings for {PROJECT_NAME}:

1. Total Respondents: {total_respondents}

2. Data Quality:
   - Respondents with creator tracked: {respondents_with_creator.count()} ({respondents_with_creator.count()/total_respondents*100:.1f}%)
   - Respondents without creator: {respondents_without_creator.count()} ({respondents_without_creator.count()/total_respondents*100:.1f}%)

3. Top Collectors (by Respondent.created_by):
""")

for i, stat in enumerate(creator_stats[:5], 1):
    email = stat['created_by__email'] or stat['created_by__username']
    count = stat['respondent_count']
    percentage = (count / total_tracked * 100) if total_tracked > 0 else 0
    print(f"   {i}. {email}: {count} respondents ({percentage:.1f}%)")

print(f"""
NOTE: The 'Respondent.created_by' field is the most accurate indicator of who
collected each respondent, as it's set when the respondent is first created
during data collection. The 'Response.collected_by' field is set per response
and may be less reliable for older data.

RECOMMENDATION:
- Use Respondent.created_by as the primary metric for counting data collection
- Consider backfilling missing Respondent.created_by from Response.collected_by
  for respondents where created_by is NULL
""")

print("=" * 80)
