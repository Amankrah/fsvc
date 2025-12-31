#!/usr/bin/env python
"""
Device-based attribution analysis.
Uses device_info fingerprints to identify which member collected which respondent.
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
from collections import defaultdict, Counter
import json

# Target project
PROJECT_ID = "f7672c4b-db61-421a-8c41-15aa5909e760"

print("=" * 120)
print("DEVICE-BASED ATTRIBUTION ANALYSIS")
print("=" * 120)

project = Project.objects.get(id=PROJECT_ID)

# Get all respondents
all_respondents = Respondent.objects.filter(project=project)

# Separate tracked vs untracked
tracked_respondents = []
untracked_respondents = []

for respondent in all_respondents:
    has_collector = Response.objects.filter(
        respondent=respondent,
        collected_by__isnull=False
    ).exists()

    if has_collector:
        tracked_respondents.append(respondent)
    else:
        untracked_respondents.append(respondent)

print(f"\nProject: {project.name}")
print(f"Total Respondents: {len(all_respondents)}")
print(f"Tracked (with collected_by): {len(tracked_respondents)}")
print(f"Untracked (no collected_by): {len(untracked_respondents)}")

# ============================================================================
# STEP 1: Build Device Fingerprint Database from Tracked Respondents
# ============================================================================
print("\n" + "=" * 120)
print("STEP 1: DEVICE FINGERPRINT DATABASE (From Tracked Respondents)")
print("=" * 120)

device_to_member = {}  # Maps device fingerprint -> member email
member_devices = defaultdict(set)  # Maps member -> set of device fingerprints

def extract_device_fingerprint(device_info):
    """Extract a unique device fingerprint from device_info"""
    if not device_info:
        return None

    # Try different fingerprint methods in order of reliability
    fingerprints = []

    # Method 1: deviceId (most reliable)
    device_id = device_info.get('deviceId') or device_info.get('device_id')
    if device_id:
        fingerprints.append(('device_id', device_id))

    # Method 2: UUID
    uuid = device_info.get('uuid') or device_info.get('device_uuid')
    if uuid:
        fingerprints.append(('uuid', uuid))

    # Method 3: Combination of platform + model + brand
    platform = device_info.get('platform')
    model = device_info.get('model') or device_info.get('device_model')
    brand = device_info.get('brand') or device_info.get('manufacturer')

    if platform and model:
        combo = f"{platform}_{model}_{brand or 'unknown'}"
        fingerprints.append(('combo', combo))

    return fingerprints if fingerprints else None

# Analyze tracked respondents to build device database
print("\nAnalyzing tracked respondents to build device fingerprint database...")

for respondent in tracked_respondents:
    responses = Response.objects.filter(
        respondent=respondent,
        collected_by__isnull=False
    ).select_related('collected_by')

    for response in responses:
        if response.device_info:
            member = response.collected_by.email
            fingerprints = extract_device_fingerprint(response.device_info)

            if fingerprints:
                for fp_type, fp_value in fingerprints:
                    key = f"{fp_type}:{fp_value}"
                    device_to_member[key] = member
                    member_devices[member].add(key)

# Display device database
print(f"\n{'Member Email':<40} {'Unique Devices':<15} {'Device Fingerprints'}")
print(f"{'-'*40} {'-'*15} {'-'*60}")

for member in sorted(member_devices.keys()):
    devices = member_devices[member]
    print(f"{member:<40} {len(devices):<15}")
    for device in sorted(devices):
        print(f"{'':40} {'':15} {device}")

# ============================================================================
# STEP 2: Attribute Untracked Respondents Using Device Fingerprints
# ============================================================================
print("\n" + "=" * 120)
print("STEP 2: ATTRIBUTING UNTRACKED RESPONDENTS USING DEVICE FINGERPRINTS")
print("=" * 120)

attribution_results = defaultdict(list)  # member -> list of respondents
attribution_confidence = {}  # respondent_id -> confidence info
no_device_data = []

for respondent in untracked_respondents:
    # Get responses for this respondent
    responses = Response.objects.filter(respondent=respondent).order_by('collected_at')

    if not responses.exists():
        no_device_data.append((respondent, "No responses"))
        continue

    # Collect device fingerprints from all responses
    device_votes = Counter()  # Count which member's device appears most
    total_responses_checked = 0

    for response in responses:
        if response.device_info:
            fingerprints = extract_device_fingerprint(response.device_info)

            if fingerprints:
                total_responses_checked += 1
                for fp_type, fp_value in fingerprints:
                    key = f"{fp_type}:{fp_value}"
                    if key in device_to_member:
                        device_votes[device_to_member[key]] += 1

    if not device_votes:
        no_device_data.append((respondent, "Device fingerprints not in database"))
        continue

    # Get most common member
    most_common_member, vote_count = device_votes.most_common(1)[0]
    confidence = (vote_count / total_responses_checked * 100) if total_responses_checked > 0 else 0

    attribution_results[most_common_member].append(respondent)
    attribution_confidence[respondent.id] = {
        'member': most_common_member,
        'confidence': confidence,
        'votes': vote_count,
        'total': total_responses_checked,
        'all_votes': dict(device_votes)
    }

# Display attribution results
print(f"\n{'Member Email':<40} {'Attributed Respondents':<25} {'% of Untracked':<20}")
print(f"{'-'*40} {'-'*25} {'-'*20}")

total_attributed = sum(len(resps) for resps in attribution_results.values())

for member in sorted(attribution_results.keys()):
    count = len(attribution_results[member])
    pct = (count / len(untracked_respondents) * 100) if len(untracked_respondents) > 0 else 0
    print(f"{member:<40} {count:<25} {pct:<20.1f}%")

print(f"\n{'-'*40} {'-'*25} {'-'*20}")
print(f"{'TOTAL ATTRIBUTED':<40} {total_attributed:<25} {(total_attributed/len(untracked_respondents)*100 if len(untracked_respondents) > 0 else 0):<20.1f}%")
print(f"{'COULD NOT ATTRIBUTE':<40} {len(no_device_data):<25} {(len(no_device_data)/len(untracked_respondents)*100 if len(untracked_respondents) > 0 else 0):<20.1f}%")

# ============================================================================
# STEP 3: CONFIDENCE BREAKDOWN
# ============================================================================
print("\n" + "=" * 120)
print("STEP 3: CONFIDENCE ANALYSIS")
print("=" * 120)

high_conf = sum(1 for c in attribution_confidence.values() if c['confidence'] >= 90)
medium_conf = sum(1 for c in attribution_confidence.values() if 70 <= c['confidence'] < 90)
low_conf = sum(1 for c in attribution_confidence.values() if c['confidence'] < 70)

print(f"\nHigh Confidence (≥90%):     {high_conf:>5} respondents ({high_conf/total_attributed*100 if total_attributed > 0 else 0:>5.1f}% of attributed)")
print(f"Medium Confidence (70-89%): {medium_conf:>5} respondents ({medium_conf/total_attributed*100 if total_attributed > 0 else 0:>5.1f}% of attributed)")
print(f"Low Confidence (<70%):      {low_conf:>5} respondents ({low_conf/total_attributed*100 if total_attributed > 0 else 0:>5.1f}% of attributed)")

# ============================================================================
# STEP 4: SAMPLE ATTRIBUTION DETAILS
# ============================================================================
print("\n" + "=" * 120)
print("STEP 4: SAMPLE ATTRIBUTION DETAILS (First 15)")
print("=" * 120)

print(f"\n{'Respondent ID':<35} {'Attributed To':<35} {'Confidence':<15} {'Votes'}")
print(f"{'-'*35} {'-'*35} {'-'*15} {'-'*30}")

sample_count = 0
for member, respondents in sorted(attribution_results.items(), key=lambda x: len(x[1]), reverse=True):
    for respondent in respondents[:5]:  # First 5 from each member
        if sample_count >= 15:
            break
        conf_info = attribution_confidence[respondent.id]
        votes_str = f"{conf_info['votes']}/{conf_info['total']}"
        print(f"{respondent.respondent_id:<35} {member:<35} {conf_info['confidence']:<15.1f}% {votes_str}")
        sample_count += 1
    if sample_count >= 15:
        break

# ============================================================================
# STEP 5: FINAL SUMMARY - COMPLETE ATTRIBUTION
# ============================================================================
print("\n" + "=" * 120)
print("STEP 5: FINAL MEMBER PERFORMANCE WITH DEVICE ATTRIBUTION")
print("=" * 120)

# Combine tracked + attributed
final_counts = Counter()

# Add tracked respondents
for respondent in tracked_respondents:
    response = Response.objects.filter(
        respondent=respondent,
        collected_by__isnull=False
    ).select_related('collected_by').first()

    if response and response.collected_by:
        final_counts[response.collected_by.email] += 1

# Add attributed respondents
for member, respondents in attribution_results.items():
    final_counts[member] += len(respondents)

print(f"\n{'Rank':<6} {'Member Email':<40} {'Total Respondents':<20} {'Tracked':<12} {'Attributed':<12}")
print(f"{'-'*6} {'-'*40} {'-'*20} {'-'*12} {'-'*12}")

rank = 1
total_respondents_counted = 0

for member, total_count in final_counts.most_common():
    tracked_count = sum(1 for r in tracked_respondents if Response.objects.filter(
        respondent=r, collected_by__email=member
    ).exists())
    attributed_count = len(attribution_results.get(member, []))

    print(f"{rank:<6} {member:<40} {total_count:<20} {tracked_count:<12} {attributed_count:<12}")
    total_respondents_counted += total_count
    rank += 1

print(f"\n{'':<6} {'-'*40} {'-'*20} {'-'*12} {'-'*12}")
print(f"{'':<6} {'TOTAL COUNTED':<40} {total_respondents_counted:<20} {len(tracked_respondents):<12} {total_attributed:<12}")
print(f"{'':<6} {'COULD NOT ATTRIBUTE':<40} {len(no_device_data):<20}")
print(f"{'':<6} {'GRAND TOTAL':<40} {len(all_respondents):<20}")

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "=" * 120)
print("SUMMARY & NEXT STEPS")
print("=" * 120)

coverage = (total_attributed / len(untracked_respondents) * 100) if len(untracked_respondents) > 0 else 0

print(f"""
DEVICE ATTRIBUTION RESULTS:
- Successfully attributed: {total_attributed} out of {len(untracked_respondents)} untracked respondents ({coverage:.1f}%)
- Could not attribute: {len(no_device_data)} respondents ({(len(no_device_data)/len(untracked_respondents)*100 if len(untracked_respondents) > 0 else 0):.1f}%)
- High confidence attributions: {high_conf} ({(high_conf/total_attributed*100 if total_attributed > 0 else 0):.1f}% of attributed)

NEXT STEP:
If these attributions look correct, you can run a backfill script to update
the Respondent.created_by field with these attributions in the database.

This will make the member performance metrics accurate and permanent.
""")

print("=" * 120)
