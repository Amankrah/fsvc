#!/usr/bin/env python
"""
Backfill Respondent.created_by field from Response.collected_by data.

This script identifies respondents without a creator and infers the creator
from the member who collected most of their responses.
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
from django.db.models import Count
from collections import Counter

# Target project
PROJECT_ID = "f7672c4b-db61-421a-8c41-15aa5909e760"
PROJECT_NAME = "FCI4Africa Data Collection"

# Set to True to actually perform the backfill, False for dry run
DRY_RUN = True  # Change to False to actually update the database

print("=" * 80)
print(f"BACKFILL RESPONDENT CREATORS: {PROJECT_NAME}")
print(f"MODE: {'DRY RUN (no changes will be made)' if DRY_RUN else 'LIVE (database will be updated)'}")
print("=" * 80)

try:
    project = Project.objects.get(id=PROJECT_ID)
    print(f"\nProject: {project.name}")
    print(f"Owner: {project.created_by.email}")
except Project.DoesNotExist:
    print(f"\nERROR: Project with ID {PROJECT_ID} not found!")
    sys.exit(1)

# Get respondents without creator
respondents_without_creator = Respondent.objects.filter(
    project=project,
    created_by__isnull=True
)

total_without_creator = respondents_without_creator.count()
print(f"\nRespondents without created_by: {total_without_creator}")

if total_without_creator == 0:
    print("\nNo respondents need backfilling. Exiting.")
    sys.exit(0)

print(f"\n{'Respondent ID':<50} {'Inferred Creator':<35} {'Confidence':<15} {'Status'}")
print(f"{'-'*50} {'-'*35} {'-'*15} {'-'*20}")

backfill_count = 0
no_data_count = 0
low_confidence_count = 0
updates = []

for respondent in respondents_without_creator:
    # Get all responses for this respondent with collected_by data
    responses_with_collector = Response.objects.filter(
        respondent=respondent,
        collected_by__isnull=False
    ).values('collected_by', 'collected_by__email')

    if not responses_with_collector:
        # No response data to infer from - use project owner as fallback
        inferred_creator = project.created_by
        confidence = "Fallback (Owner)"
        status = "Using project owner"
        no_data_count += 1
    else:
        # Count responses by each collector
        collector_counts = Counter()
        collector_emails = {}

        for resp in responses_with_collector:
            collector_id = resp['collected_by']
            collector_email = resp['collected_by__email']
            collector_counts[collector_id] += 1
            collector_emails[collector_id] = collector_email

        # Get the collector with most responses
        most_common_collector_id, response_count = collector_counts.most_common(1)[0]
        total_responses = sum(collector_counts.values())
        confidence_pct = (response_count / total_responses * 100)

        inferred_creator = User.objects.get(id=most_common_collector_id)
        confidence = f"{confidence_pct:.1f}% ({response_count}/{total_responses})"

        if confidence_pct < 50:
            status = "Low confidence"
            low_confidence_count += 1
        else:
            status = "High confidence"

    # Print the inference
    print(f"{respondent.respondent_id:<50} {inferred_creator.email:<35} {confidence:<15} {status}")

    # Store update for later
    updates.append({
        'respondent': respondent,
        'creator': inferred_creator,
        'confidence': confidence
    })
    backfill_count += 1

# Summary before applying changes
print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)

print(f"""
Total respondents without creator: {total_without_creator}
Can backfill with high confidence: {backfill_count - low_confidence_count - no_data_count}
Can backfill with low confidence: {low_confidence_count}
Using project owner fallback: {no_data_count}

Breakdown by inferred creator:
""")

creator_counts = Counter()
for update in updates:
    creator_counts[update['creator'].email] += 1

for email, count in creator_counts.most_common():
    print(f"  {email}: {count} respondents")

# Apply changes if not dry run
if not DRY_RUN:
    print("\n" + "=" * 80)
    print("APPLYING CHANGES")
    print("=" * 80)

    updated_count = 0
    for update in updates:
        respondent = update['respondent']
        creator = update['creator']

        respondent.created_by = creator
        respondent.save(update_fields=['created_by'])
        updated_count += 1

        if updated_count % 50 == 0:
            print(f"Updated {updated_count}/{backfill_count} respondents...")

    print(f"\n✓ Successfully updated {updated_count} respondents!")

    # Verify the changes
    remaining = Respondent.objects.filter(
        project=project,
        created_by__isnull=True
    ).count()

    print(f"✓ Remaining respondents without creator: {remaining}")
else:
    print("\n" + "=" * 80)
    print("DRY RUN COMPLETE - NO CHANGES MADE")
    print("=" * 80)
    print(f"\nTo apply these changes, run:")
    print(f"  python backfill_respondent_creators.py --live")
    print(f"\nOr edit the script and set DRY_RUN = False")

print("\n" + "=" * 80)
