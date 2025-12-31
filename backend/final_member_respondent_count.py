#!/usr/bin/env python
"""
Final count of respondents collected by each member.
This counts unique respondents based on who collected their responses.
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
from django.db.models import Count, Q
from collections import Counter

# Target project
PROJECT_ID = "f7672c4b-db61-421a-8c41-15aa5909e760"
PROJECT_NAME = "FCI4Africa Data Collection"

print("=" * 100)
print(f"FINAL RESPONDENT COUNT BY MEMBER: {PROJECT_NAME}")
print("=" * 100)

try:
    project = Project.objects.get(id=PROJECT_ID)
except Project.DoesNotExist:
    print(f"\nERROR: Project not found!")
    sys.exit(1)

# Get all respondents for this project
all_respondents = Respondent.objects.filter(project=project)
total_respondents = all_respondents.count()

print(f"\nProject: {project.name}")
print(f"Owner: {project.created_by.email}")
print(f"Total Respondents: {total_respondents}")

# Method 1: Count based on Respondent.created_by (most accurate when available)
print("\n" + "="*100)
print("METHOD 1: Based on Respondent.created_by (Direct Attribution)")
print("="*100)
print("This shows respondents where the member is directly recorded as the creator")
print()

respondents_with_creator = all_respondents.filter(created_by__isnull=False)
tracked_count = respondents_with_creator.count()
untracked_count = all_respondents.filter(created_by__isnull=True).count()

creator_stats = respondents_with_creator.values(
    'created_by__email'
).annotate(
    count=Count('id')
).order_by('-count')

print(f"{'Member Email':<40} {'Respondents':<15} {'% of Tracked':<15} {'% of Total':<15}")
print(f"{'-'*40} {'-'*15} {'-'*15} {'-'*15}")

for stat in creator_stats:
    email = stat['created_by__email']
    count = stat['count']
    pct_tracked = (count / tracked_count * 100) if tracked_count > 0 else 0
    pct_total = (count / total_respondents * 100) if total_respondents > 0 else 0
    print(f"{email:<40} {count:<15} {pct_tracked:<15.1f} {pct_total:<15.1f}")

print(f"\n{'TOTAL TRACKED':<40} {tracked_count:<15} {'100.0':<15} {(tracked_count/total_respondents*100):<15.1f}")
print(f"{'UNTRACKED (no creator)':<40} {untracked_count:<15} {'-':<15} {(untracked_count/total_respondents*100):<15.1f}")

# Method 2: Infer from Response.collected_by (for ALL respondents)
print("\n" + "="*100)
print("METHOD 2: Inferred from Response.collected_by (Comprehensive - Includes Untracked)")
print("="*100)
print("For each respondent, we identify which member collected most of their responses")
print()

# For each respondent, find who collected most of their responses
member_respondent_mapping = {}  # member_email -> set of respondent IDs
respondent_primary_collector = {}  # respondent_id -> (collector_email, confidence)

for respondent in all_respondents:
    # Get all responses for this respondent with collector info
    responses_with_collector = Response.objects.filter(
        respondent=respondent,
        collected_by__isnull=False
    ).values('collected_by__email')

    if responses_with_collector:
        # Count by collector
        collector_counts = Counter()
        for r in responses_with_collector:
            collector_counts[r['collected_by__email']] += 1

        # Get primary collector (most responses)
        if collector_counts:
            primary_collector, response_count = collector_counts.most_common(1)[0]
            total_responses = sum(collector_counts.values())
            confidence = (response_count / total_responses * 100)

            respondent_primary_collector[respondent.id] = (primary_collector, confidence, response_count, total_responses)

            # Add to member's respondent set
            if primary_collector not in member_respondent_mapping:
                member_respondent_mapping[primary_collector] = set()
            member_respondent_mapping[primary_collector].add(respondent.id)
    else:
        # No response data - use Respondent.created_by if available, else project owner
        if respondent.created_by:
            creator_email = respondent.created_by.email
        else:
            creator_email = project.created_by.email

        respondent_primary_collector[respondent.id] = (creator_email, 0, 0, 0)  # 0% confidence = fallback

        if creator_email not in member_respondent_mapping:
            member_respondent_mapping[creator_email] = set()
        member_respondent_mapping[creator_email].add(respondent.id)

# Sort by count
sorted_members = sorted(member_respondent_mapping.items(), key=lambda x: len(x[1]), reverse=True)

print(f"{'Member Email':<40} {'Respondents':<15} {'% of Total':<15}")
print(f"{'-'*40} {'-'*15} {'-'*15}")

for email, respondent_set in sorted_members:
    count = len(respondent_set)
    pct = (count / total_respondents * 100) if total_respondents > 0 else 0
    print(f"{email:<40} {count:<15} {pct:<15.1f}")

total_mapped = sum(len(resp_set) for resp_set in member_respondent_mapping.values())
print(f"\n{'TOTAL':<40} {total_mapped:<15} {(total_mapped/total_respondents*100):<15.1f}")

# Confidence breakdown
print("\n" + "="*100)
print("CONFIDENCE ANALYSIS")
print("="*100)

high_confidence = sum(1 for (_, conf, _, _) in respondent_primary_collector.values() if conf >= 75)
medium_confidence = sum(1 for (_, conf, _, _) in respondent_primary_collector.values() if 50 <= conf < 75)
low_confidence = sum(1 for (_, conf, _, _) in respondent_primary_collector.values() if 25 <= conf < 50)
very_low_confidence = sum(1 for (_, conf, _, _) in respondent_primary_collector.values() if 0 < conf < 25)
fallback = sum(1 for (_, conf, _, _) in respondent_primary_collector.values() if conf == 0)

print(f"\nHigh Confidence (≥75%):     {high_confidence:>5} respondents ({high_confidence/total_respondents*100:>5.1f}%)")
print(f"Medium Confidence (50-74%): {medium_confidence:>5} respondents ({medium_confidence/total_respondents*100:>5.1f}%)")
print(f"Low Confidence (25-49%):    {low_confidence:>5} respondents ({low_confidence/total_respondents*100:>5.1f}%)")
print(f"Very Low (<25%):            {very_low_confidence:>5} respondents ({very_low_confidence/total_respondents*100:>5.1f}%)")
print(f"Fallback (no data):         {fallback:>5} respondents ({fallback/total_respondents*100:>5.1f}%)")

# Final summary
print("\n" + "="*100)
print("FINAL SUMMARY - RECOMMENDED COUNT")
print("="*100)
print("\nBased on comprehensive analysis (Method 2), here's the respondent count per member:\n")

print(f"{'Rank':<6} {'Member Email':<40} {'Respondents Collected':<25}")
print(f"{'-'*6} {'-'*40} {'-'*25}")

for rank, (email, respondent_set) in enumerate(sorted_members, 1):
    count = len(respondent_set)
    print(f"{rank:<6} {email:<40} {count:<25}")

print(f"\n{'':6} {'TOTAL':<40} {total_respondents:<25}")

print("\n" + "="*100)
print("NOTES:")
print("- Method 2 provides 100% coverage by inferring from response collection patterns")
print("- For respondents with multiple collectors, primary collector = member who collected most responses")
print("- Fallback to Respondent.created_by or project owner when no response data exists")
print("- This is the most accurate count possible given the available data")
print("="*100)
