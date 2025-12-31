#!/usr/bin/env python
"""
Script to analyze collector information for responses.
This helps determine if we can backfill collected_by data.
"""

import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from responses.models import Response, Respondent
from projects.models import Project, ProjectMember
from authentication.models import User
from django.db.models import Count, Q
from collections import defaultdict

print("=" * 80)
print("RESPONSE COLLECTOR ANALYSIS")
print("=" * 80)

# Overall stats
total_responses = Response.objects.count()
with_collector = Response.objects.filter(collected_by__isnull=False).count()
without_collector = Response.objects.filter(collected_by__isnull=True).count()

print(f"\n1. OVERALL STATISTICS")
print(f"   Total Responses: {total_responses}")
print(f"   With collected_by: {with_collector} ({with_collector/total_responses*100:.2f}%)")
print(f"   Without collected_by: {without_collector} ({without_collector/total_responses*100:.2f}%)")

# Analyze respondent.created_by field
print(f"\n2. RESPONDENT CREATOR ANALYSIS")
respondents = Respondent.objects.all()
respondents_with_creator = respondents.filter(created_by__isnull=False).count()
respondents_without_creator = respondents.filter(created_by__isnull=True).count()
print(f"   Total Respondents: {respondents.count()}")
print(f"   With created_by: {respondents_with_creator} ({respondents_with_creator/respondents.count()*100:.2f}%)")
print(f"   Without created_by: {respondents_without_creator} ({respondents_without_creator/respondents.count()*100:.2f}%)")

# Check responses without collector - can we infer from respondent?
print(f"\n3. BACKFILL POTENTIAL - Respondent.created_by")
responses_without_collector = Response.objects.filter(collected_by__isnull=True).select_related('respondent')
can_backfill_from_respondent = 0
cannot_backfill_from_respondent = 0

for response in responses_without_collector:
    if response.respondent.created_by:
        can_backfill_from_respondent += 1
    else:
        cannot_backfill_from_respondent += 1

print(f"   Responses without collected_by: {without_collector}")
print(f"   Can backfill from Respondent.created_by: {can_backfill_from_respondent} ({can_backfill_from_respondent/without_collector*100:.2f}%)")
print(f"   Cannot backfill from Respondent: {cannot_backfill_from_respondent} ({cannot_backfill_from_respondent/without_collector*100:.2f}%)")

# Check project ownership for remaining
print(f"\n4. BACKFILL POTENTIAL - Project.created_by (fallback)")
cannot_backfill_count = 0
can_use_project_owner = 0

for response in responses_without_collector:
    if not response.respondent.created_by:
        # Could use project owner as fallback
        if response.project.created_by:
            can_use_project_owner += 1
        else:
            cannot_backfill_count += 1

print(f"   Can use Project.created_by as fallback: {can_use_project_owner}")
print(f"   Cannot backfill at all: {cannot_backfill_count}")

# Show sample data for verification
print(f"\n5. SAMPLE RESPONSES WITHOUT COLLECTOR")
print(f"   (First 10 responses)")
print(f"   {'Response ID':<40} {'Respondent Creator':<25} {'Project Owner':<25}")
print(f"   {'-'*40} {'-'*25} {'-'*25}")

for response in responses_without_collector[:10]:
    resp_creator = response.respondent.created_by.email if response.respondent.created_by else "NULL"
    proj_owner = response.project.created_by.email if response.project.created_by else "NULL"
    print(f"   {str(response.response_id):<40} {resp_creator:<25} {proj_owner:<25}")

# Breakdown by project
print(f"\n6. BREAKDOWN BY PROJECT")
projects_with_responses = Response.objects.values('project__name', 'project__created_by__email').annotate(
    total=Count('response_id'),
    with_collector=Count('response_id', filter=Q(collected_by__isnull=False)),
    without_collector=Count('response_id', filter=Q(collected_by__isnull=True))
).order_by('-total')

print(f"   {'Project Name':<30} {'Owner':<25} {'Total':<8} {'With':<8} {'Without':<8} {'%':<8}")
print(f"   {'-'*30} {'-'*25} {'-'*8} {'-'*8} {'-'*8} {'-'*8}")
for proj in projects_with_responses:
    pct = (proj['without_collector'] / proj['total'] * 100) if proj['total'] > 0 else 0
    print(f"   {proj['project__name'][:30]:<30} {proj['project__created_by__email'][:25]:<25} {proj['total']:<8} {proj['with_collector']:<8} {proj['without_collector']:<8} {pct:<8.1f}")

# Check project members
print(f"\n7. PROJECT MEMBER ANALYSIS")
projects = Project.objects.annotate(
    member_count=Count('members')
)

for project in projects:
    if project.member_count > 0:
        print(f"\n   Project: {project.name}")
        print(f"   Owner: {project.created_by.email}")
        print(f"   Members: {project.member_count}")
        for member in project.members.all():
            print(f"     - {member.user.email} (role: {member.role})")

        # Check if members collected any responses
        responses_by_members = Response.objects.filter(
            project=project,
            collected_by__isnull=False
        ).values('collected_by__email').annotate(count=Count('response_id'))

        if responses_by_members:
            print(f"   Responses collected by:")
            for resp in responses_by_members:
                print(f"     - {resp['collected_by__email']}: {resp['count']} responses")

print("\n" + "=" * 80)
print("SUMMARY & RECOMMENDATIONS")
print("=" * 80)

total_can_backfill = can_backfill_from_respondent + can_use_project_owner
backfill_percentage = (total_can_backfill / without_collector * 100) if without_collector > 0 else 0

print(f"""
The analysis shows:
- {without_collector} responses ({without_collector/total_responses*100:.1f}%) are missing collected_by information
- {can_backfill_from_respondent} ({can_backfill_from_respondent/without_collector*100:.1f}%) can be backfilled using Respondent.created_by
- {can_use_project_owner} ({can_use_project_owner/without_collector*100:.1f}%) can be backfilled using Project.created_by (fallback)
- {cannot_backfill_count} ({cannot_backfill_count/without_collector*100 if without_collector > 0 else 0:.1f}%) cannot be backfilled

BACKFILL STRATEGY:
1. Primary: Use Respondent.created_by (most accurate - member who initiated data collection)
2. Fallback: Use Project.created_by (project owner)
3. Total recoverable: {total_can_backfill} out of {without_collector} ({backfill_percentage:.1f}%)
""")

print("=" * 80)
