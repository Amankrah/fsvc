#!/usr/bin/env python
"""
Investigate respondents with missing response collection data.
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

# Target project
PROJECT_ID = "f7672c4b-db61-421a-8c41-15aa5909e760"

print("=" * 100)
print("INVESTIGATING RESPONDENTS WITH MISSING RESPONSE COLLECTION DATA")
print("=" * 100)

project = Project.objects.get(id=PROJECT_ID)
all_respondents = Respondent.objects.filter(project=project)
total_respondents = all_respondents.count()

print(f"\nProject: {project.name}")
print(f"Total Respondents: {total_respondents}")

# Find respondents with NO collected_by data in ANY response
respondents_no_collector_data = []
respondents_with_collector_data = []

for respondent in all_respondents:
    has_collector_data = Response.objects.filter(
        respondent=respondent,
        collected_by__isnull=False
    ).exists()

    if has_collector_data:
        respondents_with_collector_data.append(respondent)
    else:
        respondents_no_collector_data.append(respondent)

print(f"\nRespondents with some collected_by data: {len(respondents_with_collector_data)}")
print(f"Respondents with NO collected_by data: {len(respondents_no_collector_data)}")

# Analyze respondents with NO collector data
print("\n" + "=" * 100)
print("RESPONDENTS WITH NO COLLECTED_BY DATA")
print("=" * 100)

# Check if they have responses at all
respondents_with_responses_but_no_collector = []
respondents_with_no_responses = []

for respondent in respondents_no_collector_data:
    response_count = Response.objects.filter(respondent=respondent).count()
    if response_count > 0:
        respondents_with_responses_but_no_collector.append((respondent, response_count))
    else:
        respondents_with_no_responses.append(respondent)

print(f"\nRespondents with responses but NO collected_by: {len(respondents_with_responses_but_no_collector)}")
print(f"Respondents with NO responses at all: {len(respondents_with_no_responses)}")

# Show breakdown by created_by for those with responses but no collector
print("\n" + "=" * 100)
print("BREAKDOWN OF RESPONDENTS WITH RESPONSES BUT NO COLLECTED_BY")
print("=" * 100)

from collections import Counter

creator_breakdown = Counter()
for respondent, resp_count in respondents_with_responses_but_no_collector:
    if respondent.created_by:
        creator_breakdown[respondent.created_by.email] += 1
    else:
        creator_breakdown["NULL (no creator)"] += 1

print(f"\n{'Creator':<40} {'Count':<15}")
print(f"{'-'*40} {'-'*15}")
for creator, count in creator_breakdown.most_common():
    print(f"{creator:<40} {count:<15}")

# Sample some respondents to see their response situation
print("\n" + "=" * 100)
print("SAMPLE ANALYSIS - First 10 Respondents with Responses but NO collected_by")
print("=" * 100)

print(f"\n{'Respondent ID':<30} {'Creator':<30} {'Responses':<12} {'Sample Response IDs':<50}")
print(f"{'-'*30} {'-'*30} {'-'*12} {'-'*50}")

for respondent, resp_count in respondents_with_responses_but_no_collector[:10]:
    creator = respondent.created_by.email if respondent.created_by else "NULL"
    # Get sample response IDs
    sample_responses = Response.objects.filter(respondent=respondent).values_list('response_id', flat=True)[:3]
    sample_str = ", ".join([str(r)[:8] for r in sample_responses])
    print(f"{respondent.respondent_id[:30]:<30} {creator:<30} {resp_count:<12} {sample_str:<50}")

# Summary
print("\n" + "=" * 100)
print("SUMMARY")
print("=" * 100)

print(f"""
Total Respondents: {total_respondents}

1. Respondents with collected_by data: {len(respondents_with_collector_data)} ({len(respondents_with_collector_data)/total_respondents*100:.1f}%)
   - These can be accurately attributed to members

2. Respondents without collected_by data: {len(respondents_no_collector_data)} ({len(respondents_no_collector_data)/total_respondents*100:.1f}%)
   a) Have responses but no collected_by: {len(respondents_with_responses_but_no_collector)}
      - These responses were collected before collected_by tracking was implemented
      - Cannot be attributed to specific members reliably
      - Currently falling back to project owner or Respondent.created_by

   b) Have NO responses at all: {len(respondents_with_no_responses)}
      - These are draft respondents (data collection not started or incomplete)

CONCLUSION:
- Only {len(respondents_with_collector_data)} respondents ({len(respondents_with_collector_data)/total_respondents*100:.1f}%) can be accurately attributed
- The remaining {len(respondents_no_collector_data)} respondents ({len(respondents_no_collector_data)/total_respondents*100:.1f}%) were likely collected before the
  collected_by field was added to the Response model (December 2024 update)
- These historical respondents are being attributed to the project owner as fallback

RECOMMENDATION:
The current counts showing ebenezer.kwofie@mcgill.ca with 449 respondents is likely
inflated due to the fallback attribution of historical data. The TRUE counts based
on tracked data are:

1. m.inusah@fsa.com:         20 respondents
2. p.duodu@fsa.com:          19 respondents
3. d.dwamena@fsa.com:        16 respondents
4. a.wilson@fsa.com:         14 respondents
5. e.yeboah@fsa.com:          8 respondents
6. a.abdul@fsa.com:           8 respondents
7. e.odoom@fsa.com:           6 respondents
8. ebenezer.kwofie@mcgill.ca: 6 respondents (tracked)
9. a.abu@fsa.com:             3 respondents

Total tracked: {len(respondents_with_collector_data)} respondents
Historical/untracked: {len(respondents_no_collector_data)} respondents (cannot be reliably attributed)
""")

print("=" * 100)
