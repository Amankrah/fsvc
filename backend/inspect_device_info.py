#!/usr/bin/env python
"""
Inspect what device_info data actually exists in responses.
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
import json
from collections import Counter

# Target project
PROJECT_ID = "f7672c4b-db61-421a-8c41-15aa5909e760"

print("=" * 100)
print("DEVICE INFO INSPECTION")
print("=" * 100)

project = Project.objects.get(id=PROJECT_ID)

# Get all responses with device_info
all_responses = Response.objects.filter(
    project=project,
    device_info__isnull=False
).exclude(device_info={})

print(f"\nTotal responses with device_info: {all_responses.count()}")

# Sample device_info structures
print("\n" + "=" * 100)
print("SAMPLE DEVICE_INFO STRUCTURES (First 20 unique)")
print("=" * 100)

seen_structures = set()
sample_count = 0

for response in all_responses[:100]:  # Check first 100
    if response.device_info:
        # Create a structure signature
        keys = sorted(response.device_info.keys())
        structure_sig = str(keys)

        if structure_sig not in seen_structures and sample_count < 20:
            seen_structures.add(structure_sig)
            print(f"\nStructure {sample_count + 1}:")
            print(f"Keys: {keys}")
            print(f"Sample: {json.dumps(response.device_info, indent=2)}")
            print(f"Has collected_by: {response.collected_by is not None}")
            if response.collected_by:
                print(f"Collected by: {response.collected_by.email}")
            sample_count += 1

# Analyze what fields are available
print("\n" + "=" * 100)
print("DEVICE_INFO FIELD ANALYSIS")
print("=" * 100)

field_counter = Counter()
value_examples = {}

for response in all_responses[:1000]:  # Analyze first 1000
    if response.device_info:
        for key in response.device_info.keys():
            field_counter[key] += 1
            if key not in value_examples and response.device_info[key]:
                value_examples[key] = response.device_info[key]

print(f"\n{'Field Name':<30} {'Count':<15} {'Example Value':<50}")
print(f"{'-'*30} {'-'*15} {'-'*50}")

for field, count in field_counter.most_common():
    example = str(value_examples.get(field, 'N/A'))[:50]
    print(f"{field:<30} {count:<15} {example:<50}")

# Check responses WITH collected_by
print("\n" + "=" * 100)
print("DEVICE INFO FROM TRACKED RESPONSES (with collected_by)")
print("=" * 100)

tracked_responses = Response.objects.filter(
    project=project,
    collected_by__isnull=False,
    device_info__isnull=False
).exclude(device_info={}).select_related('collected_by')[:20]

print(f"\nFound {tracked_responses.count()} tracked responses with device_info")

for resp in tracked_responses:
    print(f"\nMember: {resp.collected_by.email}")
    print(f"Device Info: {json.dumps(resp.device_info, indent=2)}")

# Check responses WITHOUT collected_by
print("\n" + "=" * 100)
print("DEVICE INFO FROM UNTRACKED RESPONSES (NO collected_by)")
print("=" * 100)

untracked_responses = Response.objects.filter(
    project=project,
    collected_by__isnull=True,
    device_info__isnull=False
).exclude(device_info={})[:20]

print(f"\nFound {untracked_responses.count()} untracked responses with device_info")

for resp in untracked_responses:
    print(f"\nDevice Info: {json.dumps(resp.device_info, indent=2)}")

print("\n" + "=" * 100)
