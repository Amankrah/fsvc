#!/usr/bin/env python
"""
Deep investigation of member data collection.
Checking all possible ways a member could be associated with respondents and responses.
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

# Target project and member
PROJECT_ID = "f7672c4b-db61-421a-8c41-15aa5909e760"
MEMBER_EMAIL = "a.abu@fsa.com"

print("=" * 140)
print(f"DEEP INVESTIGATION: DATA COLLECTION BY {MEMBER_EMAIL}")
print("=" * 140)

try:
    project = Project.objects.get(id=PROJECT_ID)
    member = User.objects.get(email=MEMBER_EMAIL)

    print(f"\nProject: {project.name}")
    print(f"Member: {member.email} ({member.first_name} {member.last_name})")

    # STEP 1: Check all responses collected by this member
    print("\n" + "=" * 140)
    print("STEP 1: ALL RESPONSES COLLECTED BY THIS MEMBER")
    print("=" * 140)

    responses_by_member = Response.objects.filter(
        project=project,
        collected_by=member
    )

    total_responses = responses_by_member.count()
    print(f"\nTotal responses collected by {MEMBER_EMAIL}: {total_responses}")

    # Get unique respondents from these responses
    unique_respondent_ids = responses_by_member.values_list('respondent_id', flat=True).distinct()
    print(f"Unique respondents in these responses: {len(unique_respondent_ids)}")

    # STEP 2: Check respondents created by this member
    print("\n" + "=" * 140)
    print("STEP 2: RESPONDENTS CREATED BY THIS MEMBER")
    print("=" * 140)

    respondents_created = Respondent.objects.filter(
        project=project,
        created_by=member
    )

    print(f"\nRespondents with created_by = {MEMBER_EMAIL}: {respondents_created.count()}")

    # STEP 3: Analyze respondents that have responses collected by this member
    print("\n" + "=" * 140)
    print("STEP 3: RESPONDENTS WITH RESPONSES COLLECTED BY THIS MEMBER")
    print("=" * 140)

    # Get all respondents that have at least one response collected by this member
    respondents_with_member_responses = Respondent.objects.filter(
        project=project,
        responses__collected_by=member
    ).distinct()

    print(f"\nRespondents with at least 1 response collected by {MEMBER_EMAIL}: {respondents_with_member_responses.count()}")

    # For each respondent, count how many responses were collected by this member
    print("\nDetailed breakdown:")
    print(f"{'Respondent ID':<40} {'Total Resp':<12} {'Member Resp':<12} {'% by Member':<12} {'Type':<25}")
    print(f"{'-'*40} {'-'*12} {'-'*12} {'-'*12} {'-'*25}")

    respondent_details = []

    for respondent in respondents_with_member_responses:
        total_resp_count = Response.objects.filter(respondent=respondent).count()
        member_resp_count = Response.objects.filter(respondent=respondent, collected_by=member).count()

        if total_resp_count > 0:
            pct = (member_resp_count / total_resp_count * 100)

            respondent_details.append({
                'respondent': respondent,
                'total_responses': total_resp_count,
                'member_responses': member_resp_count,
                'percentage': pct
            })

    # Sort by member responses descending
    respondent_details.sort(key=lambda x: x['member_responses'], reverse=True)

    for item in respondent_details[:50]:  # Show first 50
        resp = item['respondent']
        resp_type = resp.respondent_type or 'NULL'
        print(f"{resp.respondent_id:<40} {item['total_responses']:<12} {item['member_responses']:<12} {item['percentage']:<11.1f}% {resp_type:<25}")

    # STEP 4: Check collected_by field distribution
    print("\n" + "=" * 140)
    print("STEP 4: COLLECTED_BY FIELD ANALYSIS FOR ALL RESPONSES IN PROJECT")
    print("=" * 140)

    total_project_responses = Response.objects.filter(project=project).count()
    responses_with_collected_by = Response.objects.filter(project=project, collected_by__isnull=False).count()
    responses_without_collected_by = Response.objects.filter(project=project, collected_by__isnull=True).count()

    print(f"\nTotal responses in project: {total_project_responses}")
    print(f"Responses with collected_by set: {responses_with_collected_by} ({responses_with_collected_by/total_project_responses*100:.1f}%)")
    print(f"Responses without collected_by (NULL): {responses_without_collected_by} ({responses_without_collected_by/total_project_responses*100:.1f}%)")

    # Who collected responses?
    print("\nTop collectors in this project:")
    collectors = Response.objects.filter(
        project=project,
        collected_by__isnull=False
    ).values('collected_by__email').annotate(
        count=Count('response_id')
    ).order_by('-count')

    print(f"\n{'Collector Email':<50} {'Responses Collected':<20} {'% of Total':<15}")
    print(f"{'-'*50} {'-'*20} {'-'*15}")

    for collector in collectors:
        pct = (collector['count'] / total_project_responses * 100)
        print(f"{collector['collected_by__email']:<50} {collector['count']:<20} {pct:<14.1f}%")

    # STEP 5: Respondents with >36 responses - CHECK CREATED_BY
    print("\n" + "=" * 140)
    print("STEP 5: RESPONDENTS WITH >36 RESPONSES CREATED BY THIS MEMBER")
    print("=" * 140)

    # Get all qualified respondents CREATED BY this member
    qualified_by_created_by = Respondent.objects.filter(
        project=project,
        created_by=member
    ).annotate(
        response_count=Count('responses')
    ).filter(
        response_count__gt=36
    )

    print(f"\nQualified respondents (>36 responses) CREATED BY {MEMBER_EMAIL}: {qualified_by_created_by.count()}")

    # Show breakdown
    if qualified_by_created_by.exists():
        print(f"\n{'Respondent ID':<40} {'Type':<25} {'Commodity':<15} {'Responses':<12}")
        print(f"{'-'*40} {'-'*25} {'-'*15} {'-'*12}")

        for resp in qualified_by_created_by:
            resp_type = resp.respondent_type or 'NULL'
            commodity = resp.commodity or 'NULL'
            total = Response.objects.filter(respondent=resp).count()
            print(f"{resp.respondent_id:<40} {resp_type:<25} {commodity:<15} {total:<12}")

    # ALSO check via Response.collected_by for comparison
    print("\n" + "=" * 140)
    print("COMPARISON: VIA RESPONSE.COLLECTED_BY")
    print("=" * 140)

    qualified_via_responses = Respondent.objects.filter(
        project=project,
        responses__collected_by=member
    ).annotate(
        response_count=Count('responses')
    ).filter(
        response_count__gt=36
    ).distinct()

    print(f"Qualified respondents (>36) with at least 1 response by {MEMBER_EMAIL}: {qualified_via_responses.count()}")

    # STEP 6: Summary
    print("\n" + "=" * 140)
    print("SUMMARY")
    print("=" * 140)

    print(f"""
PROJECT: {project.name}
MEMBER: {MEMBER_EMAIL}

RESPONSES:
  - Total responses collected by member: {total_responses}
  - Unique respondents these responses belong to: {len(unique_respondent_ids)}

RESPONDENTS:
  - Created by member (Respondent.created_by): {respondents_created.count()}
  - With at least 1 response by member: {respondents_with_member_responses.count()}
  - Qualified (>36) with at least 1 response by member: {qualified_with_member.count()}
  - Qualified (>36) where member collected ALL responses: {member_all_count}
  - Qualified (>36) where member collected MAJORITY: {member_majority_count}

RECOMMENDATION:
  The most accurate count for government reporting would be:
  - Respondents where this member collected ALL responses: {member_all_count}
  OR
  - Respondents where this member collected MAJORITY of responses: {member_majority_count}

  TOTAL ATTRIBUTION: {member_all_count + member_majority_count} qualified respondents
""")

except User.DoesNotExist:
    print(f"\nERROR: User with email '{MEMBER_EMAIL}' not found in the database.")
except Project.DoesNotExist:
    print(f"\nERROR: Project with ID '{PROJECT_ID}' not found in the database.")
except Exception as e:
    print(f"\nERROR: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 140)
