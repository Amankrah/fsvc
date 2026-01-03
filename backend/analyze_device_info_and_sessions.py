#!/usr/bin/env python
"""
Analyze device_info and any session/authentication data that might help attribute responses.
Looking for: session tokens, user IDs, device fingerprints, or any user-identifying data.
"""

import os
import django
import json

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

print("=" * 160)
print("DEVICE INFO AND SESSION DATA ANALYSIS")
print("=" * 160)

project = Project.objects.get(id=PROJECT_ID)

print(f"\nProject: {project.name}")

# Get all responses with device_info
responses_with_device_info = Response.objects.filter(
    project=project,
    device_info__isnull=False
).exclude(
    device_info={}
)

total_responses = Response.objects.filter(project=project).count()
responses_with_info = responses_with_device_info.count()

print(f"\nTotal Responses: {total_responses}")
print(f"Responses with device_info: {responses_with_info} ({responses_with_info/total_responses*100:.1f}%)")

# Sample some device_info to see what keys are available
print("\n" + "=" * 160)
print("SAMPLE DEVICE_INFO STRUCTURES")
print("=" * 160)

# Get unique device_info structures
device_info_samples = defaultdict(int)
all_keys_seen = set()

for response in responses_with_device_info[:1000]:  # Sample first 1000
    device_info = response.device_info
    if device_info:
        keys = tuple(sorted(device_info.keys()))
        device_info_samples[keys] += 1
        all_keys_seen.update(device_info.keys())

print(f"\nUnique device_info key structures found: {len(device_info_samples)}")
print(f"\nAll keys seen across device_info: {sorted(all_keys_seen)}")

print("\n" + "=" * 160)
print("DEVICE_INFO STRUCTURE BREAKDOWN")
print("=" * 160)

for keys, count in sorted(device_info_samples.items(), key=lambda x: x[1], reverse=True):
    print(f"\nKeys: {keys}")
    print(f"Count: {count}")

    # Show a sample of this structure
    sample = Response.objects.filter(
        project=project,
        device_info__isnull=False
    ).exclude(device_info={}).first()

    if sample and sample.device_info:
        matching_sample = None
        for resp in responses_with_device_info[:1000]:
            if tuple(sorted(resp.device_info.keys())) == keys:
                matching_sample = resp
                break

        if matching_sample:
            print(f"Sample data:")
            for key in keys:
                value = matching_sample.device_info.get(key)
                # Truncate long values
                if isinstance(value, str) and len(value) > 100:
                    value = value[:100] + "..."
                print(f"  {key}: {value}")

# Check for user-identifying fields
print("\n" + "=" * 160)
print("SEARCHING FOR USER-IDENTIFYING DATA")
print("=" * 160)

# Look for common session/auth fields
identifying_fields = [
    'user_id', 'userId', 'user', 'session', 'sessionId', 'session_id',
    'token', 'auth_token', 'access_token', 'refresh_token',
    'device_id', 'deviceId', 'device_uuid', 'installation_id',
    'user_email', 'email', 'username', 'collector', 'collected_by'
]

found_fields = {}
for field in identifying_fields:
    # Check if any device_info contains this field
    count = Response.objects.filter(
        project=project,
        device_info__has_key=field
    ).count()

    if count > 0:
        found_fields[field] = count

        # Get a sample value
        sample_response = Response.objects.filter(
            project=project,
            device_info__has_key=field
        ).first()

        if sample_response:
            sample_value = sample_response.device_info.get(field)
            print(f"\n✓ Found '{field}' in {count} responses")
            print(f"  Sample value: {sample_value}")

            # If this looks like a user identifier, analyze distribution
            if count > 10:
                unique_values = Response.objects.filter(
                    project=project,
                    device_info__has_key=field
                ).values_list(f'device_info__{field}', flat=True).distinct()

                print(f"  Unique values: {len(list(unique_values))}")

if not found_fields:
    print("\n✗ No user-identifying fields found in device_info")

# Check for unique device fingerprints
print("\n" + "=" * 160)
print("DEVICE FINGERPRINT ANALYSIS")
print("=" * 160)

# Try to create device fingerprints from available data
device_fingerprints = defaultdict(list)

for response in responses_with_device_info:
    device_info = response.device_info
    if device_info:
        # Create a fingerprint from available fields
        fingerprint_parts = []

        # Common identifying fields
        for field in ['platform', 'model', 'manufacturer', 'serial', 'uuid', 'device_id']:
            if field in device_info:
                fingerprint_parts.append(f"{field}:{device_info[field]}")

        if fingerprint_parts:
            fingerprint = "|".join(fingerprint_parts)
            device_fingerprints[fingerprint].append(response.response_id)

print(f"\nUnique device fingerprints found: {len(device_fingerprints)}")

if len(device_fingerprints) > 0:
    print(f"\nTop 10 devices by response count:")
    sorted_devices = sorted(device_fingerprints.items(), key=lambda x: len(x[1]), reverse=True)

    for i, (fingerprint, response_ids) in enumerate(sorted_devices[:10], 1):
        print(f"{i}. {fingerprint}: {len(response_ids)} responses")

        # Check if these responses have collected_by set
        responses_with_collector = Response.objects.filter(
            response_id__in=response_ids,
            collected_by__isnull=False
        )

        if responses_with_collector.exists():
            collectors = responses_with_collector.values_list('collected_by__email', flat=True).distinct()
            print(f"   Collectors found: {list(collectors)}")

# Check if respondent_id could help
print("\n" + "=" * 160)
print("RESPONDENT-BASED ATTRIBUTION")
print("=" * 160)

# For unattributed respondents, check if all their responses share device_info
unattributed_respondents = Respondent.objects.filter(
    project=project,
    created_by__isnull=True
).annotate(
    response_count=Count('responses')
).filter(
    response_count__gt=36
)

print(f"\nQualified unattributed respondents: {unattributed_respondents.count()}")

# Sample a few and check if their responses have consistent device_info
consistent_device_count = 0
for respondent in unattributed_respondents[:50]:
    responses = Response.objects.filter(respondent=respondent)

    device_infos = [r.device_info for r in responses if r.device_info]

    if device_infos:
        # Check if all device_infos are similar (same platform at least)
        platforms = set()
        for di in device_infos:
            if 'platform' in di:
                platforms.add(di['platform'])

        if len(platforms) == 1:
            consistent_device_count += 1

print(f"Respondents with consistent device platform: {consistent_device_count} out of 50 sampled")

# Summary
print("\n" + "=" * 160)
print("SUMMARY")
print("=" * 160)

print(f"""
DEVICE INFO COVERAGE:
  Total Responses: {total_responses}
  Responses with device_info: {responses_with_info} ({responses_with_info/total_responses*100:.1f}%)

USER-IDENTIFYING FIELDS FOUND:
  {len(found_fields)} fields found
  Fields: {list(found_fields.keys()) if found_fields else 'None'}

DEVICE FINGERPRINTS:
  Unique devices identified: {len(device_fingerprints)}

CONCLUSION:
  {'✓ Session/user data MAY be available for attribution' if found_fields else '✗ No session/user data available in device_info'}
  {'✓ Device fingerprints MAY help group responses by device' if len(device_fingerprints) > 0 else '✗ Cannot create meaningful device fingerprints'}
""")

print("=" * 160)
