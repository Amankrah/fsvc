#!/usr/bin/env python
"""
Deep investigation to find ANY possible attribution clues for historical respondents.

We'll check:
1. Device info (if members used consistent devices)
2. Location data patterns (GPS coordinates clustering)
3. Temporal patterns (time of day, date patterns)
4. Response patterns (similar question answering sequences)
5. Any metadata in responses
6. Sync operations logs
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
from django.db.models import Count, Q, Min, Max
from collections import Counter, defaultdict
from datetime import datetime
import json

# Target project
PROJECT_ID = "f7672c4b-db61-421a-8c41-15aa5909e760"

print("=" * 100)
print("DEEP INVESTIGATION: Finding Attribution Clues for Historical Respondents")
print("=" * 100)

project = Project.objects.get(id=PROJECT_ID)

# Get historical respondents (those with responses but no collected_by)
historical_respondents = []
tracked_respondents = []

for respondent in Respondent.objects.filter(project=project):
    has_collector_data = Response.objects.filter(
        respondent=respondent,
        collected_by__isnull=False
    ).exists()

    has_responses = Response.objects.filter(respondent=respondent).exists()

    if has_responses and not has_collector_data:
        historical_respondents.append(respondent)
    elif has_collector_data:
        tracked_respondents.append(respondent)

print(f"\nHistorical respondents to investigate: {len(historical_respondents)}")
print(f"Tracked respondents (for pattern comparison): {len(tracked_respondents)}")

# ============================================================================
# CLUE 1: Device Information Patterns
# ============================================================================
print("\n" + "=" * 100)
print("CLUE 1: DEVICE INFORMATION ANALYSIS")
print("=" * 100)

print("\n--- Tracked Respondents Device Info (Known Attribution) ---")
tracked_device_patterns = defaultdict(list)

for respondent in tracked_respondents[:20]:  # Sample first 20
    responses = Response.objects.filter(
        respondent=respondent,
        collected_by__isnull=False
    ).select_related('collected_by')

    for response in responses:
        if response.device_info:
            member = response.collected_by.email if response.collected_by else "Unknown"
            device_id = response.device_info.get('device_id') or response.device_info.get('deviceId')
            platform = response.device_info.get('platform')
            model = response.device_info.get('device_model') or response.device_info.get('model')

            if device_id or platform or model:
                tracked_device_patterns[member].append({
                    'device_id': device_id,
                    'platform': platform,
                    'model': model
                })

for member, devices in tracked_device_patterns.items():
    if devices:
        unique_device_ids = set(d['device_id'] for d in devices if d['device_id'])
        print(f"\n{member}:")
        print(f"  Unique device IDs: {len(unique_device_ids)}")
        if unique_device_ids:
            for did in list(unique_device_ids)[:3]:
                print(f"    - {did}")

print("\n--- Historical Respondents Device Info ---")
historical_device_info = []

for respondent in historical_respondents[:10]:  # Sample first 10
    responses = Response.objects.filter(respondent=respondent)
    for response in responses[:1]:  # Just check first response
        if response.device_info:
            historical_device_info.append({
                'respondent_id': respondent.respondent_id,
                'device_info': response.device_info
            })
            print(f"\n{respondent.respondent_id}:")
            print(f"  Device: {json.dumps(response.device_info, indent=2)[:200]}")

# ============================================================================
# CLUE 2: Location Data Patterns (GPS Clustering)
# ============================================================================
print("\n" + "=" * 100)
print("CLUE 2: LOCATION DATA ANALYSIS (GPS Clustering)")
print("=" * 100)

print("\n--- Tracked Respondents Location Patterns ---")
tracked_location_patterns = defaultdict(list)

for respondent in tracked_respondents[:20]:
    responses = Response.objects.filter(
        respondent=respondent,
        collected_by__isnull=False,
        location_data__isnull=False
    ).select_related('collected_by')

    for response in responses[:1]:  # First response with location
        if response.location_data:
            member = response.collected_by.email
            lat = response.location_data.get('latitude')
            lon = response.location_data.get('longitude')
            if lat and lon:
                tracked_location_patterns[member].append((lat, lon))

for member, locations in tracked_location_patterns.items():
    if locations:
        print(f"\n{member}: {len(locations)} location points")
        print(f"  Sample: {locations[0]}")

print("\n--- Historical Respondents Location Data ---")
historical_locations = []

for respondent in historical_respondents[:10]:
    responses = Response.objects.filter(
        respondent=respondent,
        location_data__isnull=False
    )
    for response in responses[:1]:
        if response.location_data:
            lat = response.location_data.get('latitude')
            lon = response.location_data.get('longitude')
            if lat and lon:
                historical_locations.append({
                    'respondent_id': respondent.respondent_id,
                    'lat': lat,
                    'lon': lon
                })
                print(f"\n{respondent.respondent_id}: ({lat}, {lon})")

# ============================================================================
# CLUE 3: Temporal Patterns (Collection Time Analysis)
# ============================================================================
print("\n" + "=" * 100)
print("CLUE 3: TEMPORAL PATTERNS (When data was collected)")
print("=" * 100)

print("\n--- Tracked Respondents Collection Times ---")
tracked_time_patterns = defaultdict(list)

for respondent in tracked_respondents:
    responses = Response.objects.filter(
        respondent=respondent,
        collected_by__isnull=False
    ).select_related('collected_by')

    for response in responses[:1]:
        member = response.collected_by.email
        collected_time = response.collected_at
        tracked_time_patterns[member].append(collected_time)

for member, times in tracked_time_patterns.items():
    if times:
        min_time = min(times)
        max_time = max(times)
        print(f"\n{member}:")
        print(f"  First collection: {min_time}")
        print(f"  Last collection: {max_time}")
        print(f"  Total responses: {len(times)}")

print("\n--- Historical Respondents Collection Times ---")
historical_times = []

for respondent in historical_respondents[:10]:
    responses = Response.objects.filter(respondent=respondent)
    times = [r.collected_at for r in responses]
    if times:
        min_time = min(times)
        max_time = max(times)
        historical_times.append({
            'respondent_id': respondent.respondent_id,
            'first': min_time,
            'last': max_time,
            'count': len(times)
        })
        print(f"\n{respondent.respondent_id}:")
        print(f"  First: {min_time}")
        print(f"  Last: {max_time}")
        print(f"  Responses: {len(times)}")

# ============================================================================
# CLUE 4: Respondent Metadata Analysis
# ============================================================================
print("\n" + "=" * 100)
print("CLUE 4: RESPONDENT METADATA ANALYSIS")
print("=" * 100)

print("\n--- Checking Respondent.location_data field ---")
for respondent in historical_respondents[:10]:
    if respondent.location_data:
        print(f"\n{respondent.respondent_id}:")
        print(f"  Location data: {json.dumps(respondent.location_data, indent=2)[:200]}")

print("\n--- Checking Respondent.demographics field ---")
for respondent in historical_respondents[:10]:
    if respondent.demographics:
        print(f"\n{respondent.respondent_id}:")
        print(f"  Demographics: {json.dumps(respondent.demographics, indent=2)[:200]}")

# ============================================================================
# CLUE 5: Sync Status and Metadata
# ============================================================================
print("\n" + "=" * 100)
print("CLUE 5: SYNC STATUS AND METADATA")
print("=" * 100)

# Check sync operations table
try:
    from sync.models import SyncOperation

    print("\n--- Sync Operations ---")
    sync_ops = SyncOperation.objects.filter(
        project=project
    ).select_related('user').order_by('-created_at')[:20]

    for op in sync_ops:
        print(f"\nUser: {op.user.email if op.user else 'Unknown'}")
        print(f"  Created: {op.created_at}")
        print(f"  Status: {op.status}")
        if hasattr(op, 'metadata'):
            print(f"  Metadata: {json.dumps(op.metadata, indent=2)[:200]}")
except Exception as e:
    print(f"\nSync operations not available: {e}")

# ============================================================================
# CLUE 6: Response Metadata Field Analysis
# ============================================================================
print("\n" + "=" * 100)
print("CLUE 6: RESPONSE METADATA FIELD")
print("=" * 100)

print("\n--- Sample Response Metadata from Historical Respondents ---")
for respondent in historical_respondents[:5]:
    responses = Response.objects.filter(respondent=respondent)
    for response in responses[:1]:
        if response.response_metadata:
            print(f"\n{respondent.respondent_id}:")
            print(f"  Metadata: {json.dumps(response.response_metadata, indent=2)[:300]}")

# ============================================================================
# SUMMARY AND RECOMMENDATIONS
# ============================================================================
print("\n" + "=" * 100)
print("SUMMARY: ATTRIBUTION RECOVERY STRATEGY")
print("=" * 100)

print("""
Based on the investigation, here are the possible attribution methods:

1. DEVICE FINGERPRINTING
   - If device_info contains unique device IDs
   - Match historical device IDs to tracked member device IDs
   - Confidence: HIGH (if device IDs exist and are unique)

2. GPS CLUSTERING
   - If location_data exists in responses
   - Cluster historical GPS coordinates with tracked member locations
   - Members likely work in specific geographic areas
   - Confidence: MEDIUM-HIGH

3. TEMPORAL PATTERN MATCHING
   - Analyze collection time patterns (time of day, day of week)
   - Match historical patterns to member work patterns
   - Confidence: LOW-MEDIUM

4. RESPONDENT.CREATED_BY FIELD
   - Some historical respondents might have created_by set
   - Even if responses don't have collected_by
   - Confidence: HIGH (when available)

5. SYNC OPERATION LOGS
   - Check which user synced which data batches
   - Match sync timestamps to response timestamps
   - Confidence: MEDIUM-HIGH

RECOMMENDED NEXT STEPS:
1. Run device ID matching first (fastest and most reliable)
2. If insufficient, use GPS clustering for remaining
3. Use temporal patterns as final resort
4. Accept some respondents may remain unattributable
""")

print("=" * 100)
