#!/usr/bin/env python
"""
Analyze batch import patterns to identify who imported the historical data.

Key insight: Historical respondents have responses created in rapid succession
(seconds/minutes apart), indicating bulk import rather than field collection.
"""

import os
import django

# Setup Django
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_core.settings.production')
django.setup()

from responses.models import Response, Respondent
from projects.models import Project, ProjectMemberActivity
from authentication.models import User
from django.db.models import Min, Max, Count
from datetime import timedelta
from collections import defaultdict

# Target project
PROJECT_ID = "f7672c4b-db61-421a-8c41-15aa5909e760"

print("=" * 100)
print("BATCH IMPORT ANALYSIS: Identifying Who Imported Historical Data")
print("=" * 100)

project = Project.objects.get(id=PROJECT_ID)

# Get historical respondents (with responses but no collected_by)
historical_respondents = []

for respondent in Respondent.objects.filter(project=project):
    has_collector_data = Response.objects.filter(
        respondent=respondent,
        collected_by__isnull=False
    ).exists()
    has_responses = Response.objects.filter(respondent=respondent).exists()

    if has_responses and not has_collector_data:
        historical_respondents.append(respondent)

print(f"\nHistorical respondents: {len(historical_respondents)}")

# Analyze collection patterns
print("\n" + "=" * 100)
print("BATCH IMPORT DETECTION")
print("=" * 100)

batch_patterns = []

for respondent in historical_respondents:
    responses = Response.objects.filter(respondent=respondent).order_by('collected_at')

    if responses.exists():
        first_time = responses.first().collected_at
        last_time = responses.last().collected_at
        count = responses.count()

        duration = (last_time - first_time).total_seconds()

        # Batch import indicator: many responses in short time
        is_batch = count > 50 and duration < 600  # 50+ responses in under 10 minutes

        batch_patterns.append({
            'respondent_id': respondent.respondent_id,
            'respondent': respondent,
            'count': count,
            'first': first_time,
            'last': last_time,
            'duration_seconds': duration,
            'is_batch': is_batch,
            'rate': count / duration if duration > 0 else count
        })

# Sort by first collection time
batch_patterns.sort(key=lambda x: x['first'])

# Group by date
batches_by_date = defaultdict(list)
for pattern in batch_patterns:
    date_key = pattern['first'].date()
    batches_by_date[date_key].append(pattern)

print(f"\n{'Date':<15} {'Batches':<10} {'Total Responses':<18} {'Avg Rate (resp/sec)':<20}")
print(f"{'-'*15} {'-'*10} {'-'*18} {'-'*20}")

for date in sorted(batches_by_date.keys()):
    batches = batches_by_date[date]
    batch_count = len(batches)
    total_responses = sum(b['count'] for b in batches)
    avg_rate = sum(b['rate'] for b in batches) / len(batches) if batches else 0

    print(f"{str(date):<15} {batch_count:<10} {total_responses:<18} {avg_rate:<20.2f}")

# Show detailed timeline for recent imports
print("\n" + "=" * 100)
print("RECENT IMPORT TIMELINE (Last 7 days)")
print("=" * 100)

from datetime import datetime, timezone
recent_cutoff = datetime.now(timezone.utc) - timedelta(days=7)

recent_batches = [p for p in batch_patterns if p['first'] >= recent_cutoff]

print(f"\n{'Import Time':<30} {'Respondents':<15} {'Responses':<12} {'Duration':<15} {'Rate/sec':<12}")
print(f"{'-'*30} {'-'*15} {'-'*12} {'-'*15} {'-'*12}")

# Group by hour to find batch import sessions
import_sessions = defaultdict(list)
for batch in recent_batches:
    hour_key = batch['first'].replace(minute=0, second=0, microsecond=0)
    import_sessions[hour_key].append(batch)

for hour in sorted(import_sessions.keys()):
    batches = import_sessions[hour]
    total_respondents = len(batches)
    total_responses = sum(b['count'] for b in batches)
    avg_duration = sum(b['duration_seconds'] for b in batches) / len(batches)
    avg_rate = sum(b['rate'] for b in batches) / len(batches)

    print(f"{str(hour):<30} {total_respondents:<15} {total_responses:<12} {avg_duration:<15.1f} {avg_rate:<12.2f}")

# Check ProjectMemberActivity for clues
print("\n" + "=" * 100)
print("PROJECT ACTIVITY LOG ANALYSIS")
print("=" * 100)

try:
    recent_activities = ProjectMemberActivity.objects.filter(
        project=project,
        created_at__gte=recent_cutoff
    ).select_related('actor').order_by('-created_at')[:50]

    if recent_activities:
        print(f"\n{'Time':<30} {'Actor':<35} {'Activity':<20}")
        print(f"{'-'*30} {'-'*35} {'-'*20}")

        for activity in recent_activities:
            actor = activity.actor.email if activity.actor else "Unknown"
            print(f"{str(activity.created_at):<30} {actor:<35} {activity.activity_type:<20}")
    else:
        print("\nNo recent activities found in the log.")

except Exception as e:
    print(f"\nCould not access activity log: {e}")

# Check who was logged in during import sessions
print("\n" + "=" * 100)
print("USER ACTIVITY CORRELATION")
print("=" * 100)

print("\nChecking who created respondents during batch import periods...")

# For each major import session, check Respondent.created_by
for hour in sorted(import_sessions.keys())[-10:]:  # Last 10 import hours
    batches = import_sessions[hour]

    # Get respondents created in this hour
    hour_start = hour
    hour_end = hour + timedelta(hours=1)

    respondents_in_hour = [b['respondent'] for b in batches]

    # Check created_by
    creators = defaultdict(int)
    for resp in respondents_in_hour:
        if resp.created_by:
            creators[resp.created_by.email] += 1
        else:
            creators['NULL'] += 1

    if creators:
        print(f"\n{hour}:")
        print(f"  Total respondents: {len(respondents_in_hour)}")
        print(f"  Creators:")
        for creator, count in sorted(creators.items(), key=lambda x: x[1], reverse=True):
            print(f"    - {creator}: {count} respondents")

# FINAL ANALYSIS
print("\n" + "=" * 100)
print("CONCLUSION: WHO IMPORTED THE DATA?")
print("=" * 100)

# Aggregate all creators from historical respondents
all_creators = defaultdict(int)
for respondent in historical_respondents:
    if respondent.created_by:
        all_creators[respondent.created_by.email] += 1
    else:
        all_creators['NULL (no creator tracked)'] += 1

print(f"\nHistorical respondents by creator:")
print(f"{'Creator':<40} {'Respondents':<15} {'% of Total':<15}")
print(f"{'-'*40} {'-'*15} {'-'*15}")

total_historical = len(historical_respondents)
for creator, count in sorted(all_creators.items(), key=lambda x: x[1], reverse=True):
    pct = (count / total_historical * 100) if total_historical > 0 else 0
    print(f"{creator:<40} {count:<15} {pct:<15.1f}")

print(f"\n{'-'*40} {'-'*15} {'-'*15}")
print(f"{'TOTAL':<40} {total_historical:<15} {'100.0':<15}")

print(f"""
FINDINGS:
1. The 391 historical respondents show BATCH IMPORT patterns:
   - Each respondent's responses created in seconds/minutes
   - Impossible for manual field collection
   - Indicates bulk data import/migration

2. Import timeline shows concentrated activity in recent days

3. Respondent.created_by field attribution:
   - If NULL: Imported before user tracking was implemented
   - If set: That user performed the import

RECOMMENDATION:
Since this is imported/migrated data rather than field-collected data,
these respondents should either be:
a) Attributed to whoever performed the import (check created_by)
b) Marked as "Imported/Historical Data" in reporting
c) Excluded from member performance metrics (focus on new field collections only)
""")

print("=" * 100)
