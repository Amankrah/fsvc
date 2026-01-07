#!/usr/bin/env python
"""
Delete the erroneous response from PROJ_F7672C4B_1765982669516
Response #20 with value "Once every month" that has a 101-minute gap
"""

import os
import django
import sys

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_core.settings.production')
django.setup()

from responses.models import Response, Respondent
from django.db.models import Q

# Target respondent with the problematic response
RESPONDENT_ID = "PROJ_F7672C4B_1765982669516"
PROJECT_ID = "f7672c4b-db61-421a-8c41-15aa5909e760"

print("=" * 120)
print("DELETING ERRONEOUS RESPONSE")
print("=" * 120)

# Get the respondent
respondent = Respondent.objects.filter(
    respondent_id=RESPONDENT_ID,
    project_id=PROJECT_ID
).first()

if not respondent:
    print(f"ERROR: Respondent {RESPONDENT_ID} not found")
    sys.exit(1)

print(f"\nRespondent found: {respondent.respondent_id}")

# Get all orphaned responses for this respondent
orphaned_responses = Response.objects.filter(
    respondent=respondent,
    project_id=PROJECT_ID,
    question__isnull=True
).order_by('collected_at')

print(f"Total orphaned responses: {orphaned_responses.count()}")

# Find the response with the large timestamp gap
responses_list = list(orphaned_responses)
problematic_response = None

for i in range(1, len(responses_list)):
    prev_time = responses_list[i-1].collected_at
    curr_time = responses_list[i].collected_at
    time_diff = (curr_time - prev_time).total_seconds()

    if time_diff > 60:  # More than 1 minute gap
        print(f"\n⚠️ Found response with {int(time_diff/60)} minute gap:")
        print(f"  Position: {i+1}")
        print(f"  Response value: {responses_list[i].response_value}")
        print(f"  Collected at: {responses_list[i].collected_at}")
        print(f"  Previous response at: {prev_time}")

        if responses_list[i].response_value == "Once every month":
            problematic_response = responses_list[i]
            print(f"  ✓ This is the problematic response!")
            break

if not problematic_response:
    print("\nERROR: Could not find the problematic response with 'Once every month'")
    sys.exit(1)

print("\n" + "=" * 120)
print("CONFIRMATION")
print("=" * 120)
print(f"About to delete:")
print(f"  Response ID: {problematic_response.id}")
print(f"  Value: {problematic_response.response_value}")
print(f"  Collected at: {problematic_response.collected_at}")
print(f"  Respondent: {respondent.respondent_id}")

# Get user confirmation
response = input("\nAre you sure you want to delete this response? (yes/no): ")

if response.lower() == 'yes':
    problematic_response.delete()
    print("\n✓ Response deleted successfully!")

    # Verify the count
    remaining = Response.objects.filter(
        respondent=respondent,
        project_id=PROJECT_ID,
        question__isnull=True
    ).count()

    print(f"Remaining orphaned responses for this respondent: {remaining}")
    print(f"Expected: 37")

    if remaining == 37:
        print("\n✓✓✓ SUCCESS! Respondent now has 37 orphaned responses matching the question count!")
    else:
        print(f"\n⚠️ WARNING: Expected 37 responses but found {remaining}")
else:
    print("\nDeletion cancelled.")
