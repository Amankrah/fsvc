#!/usr/bin/env python
"""
Find respondents collected by a specific member with collection dates.
Shows detailed information about when respondents were created and their response collection dates.
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
from django.db.models import Count, Min, Max
from collections import defaultdict

# Target project and member
PROJECT_ID = "f7672c4b-db61-421a-8c41-15aa5909e760"
MEMBER_EMAIL = "a.ziz@fsa.com"
MIN_RESPONSES = 36

print("=" * 140)
print("ALL USERS IN DATABASE")
print("=" * 140)

# List all users
all_users = User.objects.all().order_by('email')
print(f"\nTotal users in database: {all_users.count()}\n")
print(f"{'Email':<50} {'First Name':<20} {'Last Name':<20} {'Active':<10} {'Staff':<10}")
print(f"{'-'*50} {'-'*20} {'-'*20} {'-'*10} {'-'*10}")

for user in all_users:
    print(f"{user.email:<50} {user.first_name:<20} {user.last_name:<20} {str(user.is_active):<10} {str(user.is_staff):<10}")

print("\n" + "=" * 140)
print(f"RESPONDENT COLLECTION ANALYSIS FOR MEMBER: {MEMBER_EMAIL}")
print("=" * 140)

try:
    project = Project.objects.get(id=PROJECT_ID)
    member = User.objects.get(email=MEMBER_EMAIL)

    print(f"\nProject: {project.name}")
    print(f"Project ID: {PROJECT_ID}")
    print(f"Member: {member.email}")
    print(f"Minimum responses threshold: >{MIN_RESPONSES}")

    # Method 1: Via Respondent.created_by
    print("\n" + "=" * 140)
    print("METHOD 1: VIA RESPONDENT.CREATED_BY")
    print("=" * 140)

    respondents_created = Respondent.objects.filter(
        project=project,
        created_by=member
    ).annotate(
        response_count=Count('responses'),
        first_response_date=Min('responses__created_at'),
        last_response_date=Max('responses__created_at')
    ).order_by('-created_at')

    total_created = respondents_created.count()
    qualified_created = respondents_created.filter(response_count__gt=MIN_RESPONSES).count()

    print(f"\nTotal respondents created by {MEMBER_EMAIL}: {total_created}")
    print(f"Qualified respondents (>{MIN_RESPONSES} responses): {qualified_created}")

    if respondents_created.exists():
        print(f"\n{'Respondent ID':<40} {'Created':<20} {'Responses':<12} {'First Response':<20} {'Last Response':<20} {'Type':<25}")
        print(f"{'-'*40} {'-'*20} {'-'*12} {'-'*20} {'-'*20} {'-'*25}")

        for resp in respondents_created:
            created_date = resp.created_at.strftime('%Y-%m-%d %H:%M:%S') if resp.created_at else 'N/A'
            first_resp = resp.first_response_date.strftime('%Y-%m-%d %H:%M:%S') if resp.first_response_date else 'N/A'
            last_resp = resp.last_response_date.strftime('%Y-%m-%d %H:%M:%S') if resp.last_response_date else 'N/A'
            resp_type = resp.respondent_type or 'NULL'

            print(f"{resp.respondent_id:<40} {created_date:<20} {resp.response_count:<12} {first_resp:<20} {last_resp:<20} {resp_type:<25}")

    # Method 2: Via Response.collected_by (primary collector)
    print("\n" + "=" * 140)
    print("METHOD 2: VIA RESPONSE.COLLECTED_BY (PRIMARY COLLECTOR)")
    print("=" * 140)

    # Get all respondents in the project
    all_respondents = Respondent.objects.filter(
        project=project
    ).annotate(
        response_count=Count('responses')
    )

    # Find respondents where this member collected most responses
    member_respondents = []

    for respondent in all_respondents:
        # Get collector stats for this respondent
        collector_stats = Response.objects.filter(
            respondent=respondent,
            collected_by__isnull=False
        ).values('collected_by__email').annotate(
            count=Count('response_id')
        ).order_by('-count')

        if collector_stats.exists():
            primary_collector = collector_stats.first()
            if primary_collector['collected_by__email'] == MEMBER_EMAIL:
                # Get date info
                responses = Response.objects.filter(
                    respondent=respondent,
                    collected_by=member
                ).aggregate(
                    first_response=Min('created_at'),
                    last_response=Max('created_at'),
                    total_responses=Count('response_id')
                )

                member_respondents.append({
                    'respondent': respondent,
                    'total_responses': respondent.response_count,
                    'member_responses': responses['total_responses'],
                    'first_response': responses['first_response'],
                    'last_response': responses['last_response']
                })

    total_via_collected_by = len(member_respondents)
    qualified_via_collected_by = sum(1 for r in member_respondents if r['total_responses'] > MIN_RESPONSES)

    print(f"\nTotal respondents where {MEMBER_EMAIL} is primary collector: {total_via_collected_by}")
    print(f"Qualified respondents (>{MIN_RESPONSES} responses): {qualified_via_collected_by}")

    if member_respondents:
        print(f"\n{'Respondent ID':<40} {'Total Resp':<12} {'Member Resp':<12} {'First Response':<20} {'Last Response':<20} {'Type':<25}")
        print(f"{'-'*40} {'-'*12} {'-'*12} {'-'*20} {'-'*20} {'-'*25}")

        for item in sorted(member_respondents, key=lambda x: x['last_response'] if x['last_response'] else x['respondent'].created_at, reverse=True):
            resp = item['respondent']
            first_resp = item['first_response'].strftime('%Y-%m-%d %H:%M:%S') if item['first_response'] else 'N/A'
            last_resp = item['last_response'].strftime('%Y-%m-%d %H:%M:%S') if item['last_response'] else 'N/A'
            resp_type = resp.respondent_type or 'NULL'

            print(f"{resp.respondent_id:<40} {item['total_responses']:<12} {item['member_responses']:<12} {first_resp:<20} {last_resp:<20} {resp_type:<25}")

    # Summary by date ranges
    print("\n" + "=" * 140)
    print("COLLECTION TIMELINE (METHOD 1: created_by)")
    print("=" * 140)

    if respondents_created.exists():
        # Group by date
        by_date = defaultdict(lambda: {'count': 0, 'qualified': 0})

        for resp in respondents_created:
            if resp.created_at:
                date_key = resp.created_at.strftime('%Y-%m-%d')
                by_date[date_key]['count'] += 1
                if resp.response_count > MIN_RESPONSES:
                    by_date[date_key]['qualified'] += 1

        print(f"\n{'Date':<15} {'Total Created':<15} {'Qualified':<15}")
        print(f"{'-'*15} {'-'*15} {'-'*15}")

        for date in sorted(by_date.keys()):
            print(f"{date:<15} {by_date[date]['count']:<15} {by_date[date]['qualified']:<15}")

    # Summary statistics
    print("\n" + "=" * 140)
    print("SUMMARY STATISTICS")
    print("=" * 140)

    print(f"""
PROJECT: {project.name}
MEMBER: {MEMBER_EMAIL}

METHOD 1 (via Respondent.created_by):
  - Total respondents: {total_created}
  - Qualified respondents (>{MIN_RESPONSES} responses): {qualified_created}

METHOD 2 (via Response.collected_by as primary collector):
  - Total respondents: {total_via_collected_by}
  - Qualified respondents (>{MIN_RESPONSES} responses): {qualified_via_collected_by}

RECOMMENDATION:
  - Use METHOD 1 if you want respondents officially created by this member
  - Use METHOD 2 if you want respondents where this member collected most responses
""")

    # Breakdown by respondent type
    print("\n" + "=" * 140)
    print("BREAKDOWN BY RESPONDENT TYPE (METHOD 1)")
    print("=" * 140)

    type_breakdown = defaultdict(lambda: {'total': 0, 'qualified': 0})

    for resp in respondents_created:
        resp_type = resp.respondent_type or 'NULL'
        type_breakdown[resp_type]['total'] += 1
        if resp.response_count > MIN_RESPONSES:
            type_breakdown[resp_type]['qualified'] += 1

    print(f"\n{'Respondent Type':<30} {'Total':<15} {'Qualified':<15}")
    print(f"{'-'*30} {'-'*15} {'-'*15}")

    for resp_type in sorted(type_breakdown.keys()):
        print(f"{resp_type:<30} {type_breakdown[resp_type]['total']:<15} {type_breakdown[resp_type]['qualified']:<15}")

except User.DoesNotExist:
    print(f"\nERROR: User with email '{MEMBER_EMAIL}' not found in the database.")
except Project.DoesNotExist:
    print(f"\nERROR: Project with ID '{PROJECT_ID}' not found in the database.")
except Exception as e:
    print(f"\nERROR: {str(e)}")

print("\n" + "=" * 140)
