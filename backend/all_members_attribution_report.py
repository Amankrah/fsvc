#!/usr/bin/env python
"""
Comprehensive attribution report for ALL members in the project.
Shows data collection by each member using both Respondent.created_by and Response.collected_by.
"""

import os
import django

# Setup Django
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_core.settings.production')
django.setup()

from responses.models import Response, Respondent
from projects.models import Project
from authentication.models import User
from django.db.models import Count, Q
from collections import defaultdict

# Target project
PROJECT_ID = "f7672c4b-db61-421a-8c41-15aa5909e760"
MIN_RESPONSES = 36

print("=" * 160)
print("COMPREHENSIVE MEMBER ATTRIBUTION REPORT")
print("=" * 160)

project = Project.objects.get(id=PROJECT_ID)

print(f"\nProject: {project.name}")
print(f"Project ID: {PROJECT_ID}")
print(f"Minimum responses threshold: >{MIN_RESPONSES}")

# Get all members of this project
members = project.members.all()

print(f"\nTotal project members: {members.count()}")

# Project-wide statistics
total_respondents = Respondent.objects.filter(project=project).count()
qualified_respondents = Respondent.objects.filter(
    project=project
).annotate(
    response_count=Count('responses')
).filter(
    response_count__gt=MIN_RESPONSES
).count()

total_responses = Response.objects.filter(project=project).count()
tracked_responses = Response.objects.filter(project=project, collected_by__isnull=False).count()
untracked_responses = Response.objects.filter(project=project, collected_by__isnull=True).count()

print(f"\nPROJECT STATISTICS:")
print(f"  Total Respondents: {total_respondents}")
print(f"  Qualified Respondents (>{MIN_RESPONSES} responses): {qualified_respondents}")
print(f"  Total Responses: {total_responses}")
print(f"  Tracked Responses (collected_by set): {tracked_responses} ({tracked_responses/total_responses*100:.1f}%)")
print(f"  Untracked Responses (collected_by NULL): {untracked_responses} ({untracked_responses/total_responses*100:.1f}%)")

print("\n" + "=" * 160)
print("MEMBER ATTRIBUTION ANALYSIS")
print("=" * 160)

# Header
print(f"\n{'Member Email':<40} {'Name':<25} {'Resp Via':<12} {'Qual Via':<12} {'Resp Via':<12} {'Qual Via':<12} {'Qual':<12}")
print(f"{'':40} {'':25} {'created_by':<12} {'created_by':<12} {'collected_by':<12} {'collected_by':<12} {'100% Match':<12}")
print(f"{'-'*40} {'-'*25} {'-'*12} {'-'*12} {'-'*12} {'-'*12} {'-'*12}")

member_data = []

for member in members:
    # Method 1: Via Respondent.created_by
    respondents_created = Respondent.objects.filter(
        project=project,
        created_by=member
    ).annotate(
        response_count=Count('responses')
    )

    total_created = respondents_created.count()
    qualified_created = respondents_created.filter(response_count__gt=MIN_RESPONSES).count()

    # Method 2: Via Response.collected_by
    respondents_via_responses = Respondent.objects.filter(
        project=project,
        responses__collected_by=member
    ).annotate(
        response_count=Count('responses')
    ).distinct()

    total_via_responses = respondents_via_responses.count()
    qualified_via_responses = respondents_via_responses.filter(response_count__gt=MIN_RESPONSES).distinct().count()

    # Method 3: Qualified respondents where member collected ALL responses
    qualified_all_match = 0
    for respondent in respondents_via_responses.filter(response_count__gt=MIN_RESPONSES).distinct():
        total_resp = Response.objects.filter(respondent=respondent).count()
        member_resp = Response.objects.filter(respondent=respondent, collected_by=member).count()
        if total_resp > 0 and member_resp == total_resp:
            qualified_all_match += 1

    member_data.append({
        'email': member.email,
        'name': f"{member.first_name} {member.last_name}",
        'total_created': total_created,
        'qualified_created': qualified_created,
        'total_via_responses': total_via_responses,
        'qualified_via_responses': qualified_via_responses,
        'qualified_all_match': qualified_all_match
    })

# Sort by qualified_all_match descending
member_data.sort(key=lambda x: x['qualified_all_match'], reverse=True)

for data in member_data:
    print(f"{data['email']:<40} {data['name']:<25} "
          f"{data['total_created']:<12} {data['qualified_created']:<12} "
          f"{data['total_via_responses']:<12} {data['qualified_via_responses']:<12} "
          f"{data['qualified_all_match']:<12}")

# Summary totals
print(f"\n{'-'*40} {'-'*25} {'-'*12} {'-'*12} {'-'*12} {'-'*12} {'-'*12}")

total_row = {
    'total_created': sum(d['total_created'] for d in member_data),
    'qualified_created': sum(d['qualified_created'] for d in member_data),
    'total_via_responses': sum(d['total_via_responses'] for d in member_data),
    'qualified_via_responses': sum(d['qualified_via_responses'] for d in member_data),
    'qualified_all_match': sum(d['qualified_all_match'] for d in member_data)
}

print(f"{'TOTAL':<40} {'':25} "
      f"{total_row['total_created']:<12} {total_row['qualified_created']:<12} "
      f"{total_row['total_via_responses']:<12} {total_row['qualified_via_responses']:<12} "
      f"{total_row['qualified_all_match']:<12}")

# Unattributed respondents analysis
print("\n" + "=" * 160)
print("UNATTRIBUTED DATA ANALYSIS")
print("=" * 160)

# Respondents with NO created_by
respondents_no_creator = Respondent.objects.filter(
    project=project,
    created_by__isnull=True
).annotate(
    response_count=Count('responses')
)

total_no_creator = respondents_no_creator.count()
qualified_no_creator = respondents_no_creator.filter(response_count__gt=MIN_RESPONSES).count()

print(f"\nRespondents with NO created_by: {total_no_creator}")
print(f"Qualified respondents with NO created_by: {qualified_no_creator}")

# Check if these respondents have responses with collected_by set
respondents_no_creator_but_tracked = 0
for respondent in respondents_no_creator.filter(response_count__gt=MIN_RESPONSES):
    has_tracked_responses = Response.objects.filter(
        respondent=respondent,
        collected_by__isnull=False
    ).exists()
    if has_tracked_responses:
        respondents_no_creator_but_tracked += 1

print(f"Qualified respondents with NO created_by but HAVE collected_by in responses: {respondents_no_creator_but_tracked}")

# Truly unattributable respondents
truly_unattributable = Respondent.objects.filter(
    project=project,
    created_by__isnull=True
).annotate(
    response_count=Count('responses')
).filter(
    response_count__gt=MIN_RESPONSES
).exclude(
    responses__collected_by__isnull=False
).distinct()

print(f"Qualified respondents with NO attribution at all: {truly_unattributable.count()}")

print("\n" + "=" * 160)
print("SUMMARY")
print("=" * 160)

print(f"""
PROJECT: {project.name}

OVERALL STATISTICS:
  Total Respondents: {total_respondents}
  Qualified Respondents (>{MIN_RESPONSES} responses): {qualified_respondents}
  Total Responses: {total_responses}

TRACKING COVERAGE:
  Responses with collected_by: {tracked_responses} ({tracked_responses/total_responses*100:.1f}%)
  Responses without collected_by: {untracked_responses} ({untracked_responses/total_responses*100:.1f}%)

MEMBER ATTRIBUTION (Qualified Respondents):
  Via created_by: {total_row['qualified_created']}
  Via collected_by (at least 1 response): {total_row['qualified_via_responses']}
  Via collected_by (100% of responses): {total_row['qualified_all_match']}

UNATTRIBUTED DATA:
  Qualified respondents with NO created_by: {qualified_no_creator}
  Qualified respondents with NO attribution at all: {truly_unattributable.count()}

ATTRIBUTION GAP:
  Expected qualified respondents: {qualified_respondents}
  Attributed via 100% match: {total_row['qualified_all_match']}
  MISSING ATTRIBUTION: {qualified_respondents - total_row['qualified_all_match']} ({(qualified_respondents - total_row['qualified_all_match'])/qualified_respondents*100:.1f}%)

CRITICAL FINDING:
  {(qualified_respondents - total_row['qualified_all_match'])/qualified_respondents*100:.1f}% of qualified respondents cannot be definitively attributed to any member.
  This represents a significant data integrity issue for government reporting.
""")

print("=" * 160)
