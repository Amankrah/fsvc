#!/usr/bin/env python
"""
Check total respondents with more than 36 responses in the FCI4Africa project.
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
from django.db.models import Count

# Target project
PROJECT_ID = "f7672c4b-db61-421a-8c41-15aa5909e760"
MIN_RESPONSES = 36

print("=" * 100)
print(f"RESPONDENTS WITH MORE THAN {MIN_RESPONSES} RESPONSES")
print("=" * 100)

project = Project.objects.get(id=PROJECT_ID)

print(f"\nProject: {project.name}")
print(f"Project ID: {PROJECT_ID}")
print(f"Minimum responses threshold: {MIN_RESPONSES}")

# Get all respondents with their response counts
respondents_with_counts = Respondent.objects.filter(
    project=project
).annotate(
    response_count=Count('responses')
).order_by('-response_count')

total_respondents = respondents_with_counts.count()
respondents_above_threshold = respondents_with_counts.filter(
    response_count__gt=MIN_RESPONSES
)

total_above_threshold = respondents_above_threshold.count()

print(f"\n" + "=" * 100)
print("SUMMARY")
print("=" * 100)

print(f"\nTotal respondents in project: {total_respondents}")
print(f"Respondents with > {MIN_RESPONSES} responses: {total_above_threshold}")
print(f"Percentage: {(total_above_threshold/total_respondents*100) if total_respondents > 0 else 0:.1f}%")

# Show breakdown by response count ranges
print(f"\n" + "=" * 100)
print("BREAKDOWN BY RESPONSE COUNT")
print("=" * 100)

ranges = [
    (0, 10, "0-10 responses"),
    (11, 36, "11-36 responses"),
    (37, 50, "37-50 responses"),
    (51, 100, "51-100 responses"),
    (101, 150, "101-150 responses"),
    (151, 200, "151-200 responses"),
    (201, 999999, "201+ responses"),
]

print(f"\n{'Range':<20} {'Count':<15} {'Percentage':<15}")
print(f"{'-'*20} {'-'*15} {'-'*15}")

for min_val, max_val, label in ranges:
    count = respondents_with_counts.filter(
        response_count__gte=min_val,
        response_count__lte=max_val
    ).count()
    pct = (count / total_respondents * 100) if total_respondents > 0 else 0
    print(f"{label:<20} {count:<15} {pct:<15.1f}%")

# Show sample of respondents above threshold
print(f"\n" + "=" * 100)
print(f"SAMPLE RESPONDENTS WITH > {MIN_RESPONSES} RESPONSES (First 20)")
print("=" * 100)

print(f"\n{'Respondent ID':<40} {'Responses':<12} {'Created By':<35} {'Status':<15}")
print(f"{'-'*40} {'-'*12} {'-'*35} {'-'*15}")

for respondent in respondents_above_threshold[:20]:
    created_by = respondent.created_by.email if respondent.created_by else "NULL"
    print(f"{respondent.respondent_id:<40} {respondent.response_count:<12} {created_by:<35} {respondent.completion_status:<15}")

# Check who collected these respondents
print(f"\n" + "=" * 100)
print(f"MEMBER ATTRIBUTION FOR RESPONDENTS WITH > {MIN_RESPONSES} RESPONSES")
print("=" * 100)

# Count by created_by
from collections import Counter
creator_counts = Counter()

for respondent in respondents_above_threshold:
    if respondent.created_by:
        creator_counts[respondent.created_by.email] += 1
    else:
        creator_counts["NULL (no creator tracked)"] += 1

print(f"\n{'Creator/Member':<40} {'Respondents':<15} {'% of Total':<15}")
print(f"{'-'*40} {'-'*15} {'-'*15}")

for creator, count in creator_counts.most_common():
    pct = (count / total_above_threshold * 100) if total_above_threshold > 0 else 0
    print(f"{creator:<40} {count:<15} {pct:<15.1f}%")

# Alternative: Check via Response.collected_by
print(f"\n" + "=" * 100)
print(f"ALTERNATIVE: CHECK VIA RESPONSE.COLLECTED_BY")
print("=" * 100)

member_attribution = Counter()

for respondent in respondents_above_threshold:
    # Get who collected most responses for this respondent
    responses = Response.objects.filter(
        respondent=respondent,
        collected_by__isnull=False
    ).values('collected_by__email').annotate(count=Count('response_id')).order_by('-count')

    if responses.exists():
        primary_collector = responses.first()
        member_attribution[primary_collector['collected_by__email']] += 1
    else:
        member_attribution["NULL (no collected_by data)"] += 1

print(f"\n{'Member (via Response.collected_by)':<40} {'Respondents':<15} {'% of Total':<15}")
print(f"{'-'*40} {'-'*15} {'-'*15}")

for member, count in member_attribution.most_common():
    pct = (count / total_above_threshold * 100) if total_above_threshold > 0 else 0
    print(f"{member:<40} {count:<15} {pct:<15.1f}%")

print(f"\n" + "=" * 100)
print("COMPLETE SUMMARY")
print("=" * 100)

print(f"""
PROJECT: {project.name}

TOTAL RESPONDENTS: {total_respondents}

RESPONDENTS WITH > {MIN_RESPONSES} RESPONSES: {total_above_threshold}
  - With creator tracked (Respondent.created_by): {sum(1 for r in respondents_above_threshold if r.created_by)}
  - Without creator tracked: {sum(1 for r in respondents_above_threshold if not r.created_by)}

  - With collected_by data (Response.collected_by): {sum(1 for c in member_attribution.values() if c != member_attribution.get("NULL (no collected_by data)", 0))}
  - Without collected_by data: {member_attribution.get("NULL (no collected_by data)", 0)}

This count represents respondents who completed substantial surveys (>{MIN_RESPONSES} questions).
""")

print("=" * 100)
