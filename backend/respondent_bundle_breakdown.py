#!/usr/bin/env python
"""
Breakdown of respondents by unique targeting bundles (respondent_type, commodity, country).
Shows counts for each unique combination with >36 responses.
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
from collections import defaultdict

# Target project
PROJECT_ID = "f7672c4b-db61-421a-8c41-15aa5909e760"
MIN_RESPONSES = 36

print("=" * 120)
print("RESPONDENT BREAKDOWN BY TARGETING BUNDLES")
print("=" * 120)

project = Project.objects.get(id=PROJECT_ID)

print(f"\nProject: {project.name}")
print(f"Project ID: {PROJECT_ID}")
print(f"Minimum responses: >{MIN_RESPONSES}")

# Get all respondents with response counts
respondents_with_counts = Respondent.objects.filter(
    project=project
).annotate(
    response_count=Count('responses')
)

# Filter those with >36 responses
qualified_respondents = respondents_with_counts.filter(
    response_count__gt=MIN_RESPONSES
)

total_qualified = qualified_respondents.count()

print(f"\nTotal qualified respondents (>{MIN_RESPONSES} responses): {total_qualified}")

# Group by targeting bundle
bundles = defaultdict(lambda: {
    'count': 0,
    'total_responses': 0,
    'respondents': [],
    'with_creator': 0,
    'with_collected_by': 0,
    'creators': defaultdict(int),
    'collectors': defaultdict(int)
})

for respondent in qualified_respondents:
    # Create bundle key
    respondent_type = respondent.respondent_type or "NULL"
    commodity = respondent.commodity or "NULL"
    country = respondent.country or "NULL"

    bundle_key = (respondent_type, commodity, country)

    bundles[bundle_key]['count'] += 1
    bundles[bundle_key]['total_responses'] += respondent.response_count
    bundles[bundle_key]['respondents'].append(respondent)

    # Track who created this respondent
    if respondent.created_by:
        bundles[bundle_key]['with_creator'] += 1
        bundles[bundle_key]['creators'][respondent.created_by.email] += 1

    # Check who collected responses for this respondent
    primary_collector = Response.objects.filter(
        respondent=respondent,
        collected_by__isnull=False
    ).values('collected_by__email').annotate(count=Count('response_id')).order_by('-count').first()

    if primary_collector:
        bundles[bundle_key]['with_collected_by'] += 1
        bundles[bundle_key]['collectors'][primary_collector['collected_by__email']] += 1

# Sort bundles by count (descending)
sorted_bundles = sorted(bundles.items(), key=lambda x: x[1]['count'], reverse=True)

# Display summary table
print("\n" + "=" * 120)
print("BUNDLE SUMMARY (Sorted by Count)")
print("=" * 120)

print(f"\n{'Respondent Type':<25} {'Commodity':<25} {'Country':<15} {'Count':<10} {'Avg Resp':<10} {'% Total':<10}")
print(f"{'-'*25} {'-'*25} {'-'*15} {'-'*10} {'-'*10} {'-'*10}")

for (resp_type, commodity, country), data in sorted_bundles:
    avg_responses = data['total_responses'] / data['count'] if data['count'] > 0 else 0
    pct = (data['count'] / total_qualified * 100) if total_qualified > 0 else 0

    print(f"{resp_type:<25} {commodity:<25} {country:<15} {data['count']:<10} {avg_responses:<10.1f} {pct:<10.1f}%")

# Detailed breakdown with member attribution
print("\n" + "=" * 120)
print("DETAILED BUNDLE BREAKDOWN WITH MEMBER ATTRIBUTION")
print("=" * 120)

for idx, ((resp_type, commodity, country), data) in enumerate(sorted_bundles, 1):
    avg_responses = data['total_responses'] / data['count'] if data['count'] > 0 else 0
    pct = (data['count'] / total_qualified * 100) if total_qualified > 0 else 0

    print(f"\n{'='*120}")
    print(f"BUNDLE #{idx}: {resp_type} | {commodity} | {country}")
    print(f"{'='*120}")
    print(f"Total Respondents: {data['count']} ({pct:.1f}% of all qualified)")
    print(f"Average Responses per Respondent: {avg_responses:.1f}")
    print(f"Total Responses: {data['total_responses']}")

    # Member attribution via Respondent.created_by
    print(f"\nMember Attribution (via Respondent.created_by):")
    print(f"  Tracked: {data['with_creator']} ({data['with_creator']/data['count']*100 if data['count'] > 0 else 0:.1f}%)")
    print(f"  Untracked: {data['count'] - data['with_creator']} ({(data['count'] - data['with_creator'])/data['count']*100 if data['count'] > 0 else 0:.1f}%)")

    if data['creators']:
        print(f"\n  Creators:")
        for creator, count in sorted(data['creators'].items(), key=lambda x: x[1], reverse=True):
            print(f"    - {creator}: {count} respondents ({count/data['count']*100:.1f}%)")

    # Member attribution via Response.collected_by
    print(f"\nAlternative Attribution (via Response.collected_by):")
    print(f"  Tracked: {data['with_collected_by']} ({data['with_collected_by']/data['count']*100 if data['count'] > 0 else 0:.1f}%)")
    print(f"  Untracked: {data['count'] - data['with_collected_by']} ({(data['count'] - data['with_collected_by'])/data['count']*100 if data['count'] > 0 else 0:.1f}%)")

    if data['collectors']:
        print(f"\n  Collectors:")
        for collector, count in sorted(data['collectors'].items(), key=lambda x: x[1], reverse=True):
            print(f"    - {collector}: {count} respondents ({count/data['count']*100:.1f}%)")

# Summary by dimension
print("\n" + "=" * 120)
print("BREAKDOWN BY INDIVIDUAL DIMENSIONS")
print("=" * 120)

# By Respondent Type
print("\nBY RESPONDENT TYPE:")
print(f"{'Respondent Type':<30} {'Count':<15} {'% of Total':<15}")
print(f"{'-'*30} {'-'*15} {'-'*15}")

type_counts = defaultdict(int)
for (resp_type, _, _), data in bundles.items():
    type_counts[resp_type] += data['count']

for resp_type in sorted(type_counts.keys(), key=lambda x: type_counts[x], reverse=True):
    count = type_counts[resp_type]
    pct = (count / total_qualified * 100) if total_qualified > 0 else 0
    print(f"{resp_type:<30} {count:<15} {pct:<15.1f}%")

# By Commodity
print("\nBY COMMODITY:")
print(f"{'Commodity':<30} {'Count':<15} {'% of Total':<15}")
print(f"{'-'*30} {'-'*15} {'-'*15}")

commodity_counts = defaultdict(int)
for (_, commodity, _), data in bundles.items():
    commodity_counts[commodity] += data['count']

for commodity in sorted(commodity_counts.keys(), key=lambda x: commodity_counts[x], reverse=True):
    count = commodity_counts[commodity]
    pct = (count / total_qualified * 100) if total_qualified > 0 else 0
    print(f"{commodity:<30} {count:<15} {pct:<15.1f}%")

# By Country
print("\nBY COUNTRY:")
print(f"{'Country':<30} {'Count':<15} {'% of Total':<15}")
print(f"{'-'*30} {'-'*15} {'-'*15}")

country_counts = defaultdict(int)
for (_, _, country), data in bundles.items():
    country_counts[country] += data['count']

for country in sorted(country_counts.keys(), key=lambda x: country_counts[x], reverse=True):
    count = country_counts[country]
    pct = (count / total_qualified * 100) if total_qualified > 0 else 0
    print(f"{country:<30} {count:<15} {pct:<15.1f}%")

# Final Summary
print("\n" + "=" * 120)
print("SUMMARY STATISTICS")
print("=" * 120)

print(f"""
TOTAL QUALIFIED RESPONDENTS (>{MIN_RESPONSES} responses): {total_qualified}

UNIQUE BUNDLES (Respondent Type × Commodity × Country): {len(bundles)}

BREAKDOWN:
- Unique Respondent Types: {len(type_counts)}
- Unique Commodities: {len(commodity_counts)}
- Unique Countries: {len(country_counts)}

MEMBER ATTRIBUTION COVERAGE:
- Via Respondent.created_by: {sum(d['with_creator'] for d in bundles.values())} / {total_qualified} ({sum(d['with_creator'] for d in bundles.values())/total_qualified*100 if total_qualified > 0 else 0:.1f}%)
- Via Response.collected_by: {sum(d['with_collected_by'] for d in bundles.values())} / {total_qualified} ({sum(d['with_collected_by'] for d in bundles.values())/total_qualified*100 if total_qualified > 0 else 0:.1f}%)
""")

print("=" * 120)
