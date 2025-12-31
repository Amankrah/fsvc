#!/usr/bin/env python
"""
Breakdown of respondent bundles by response count RANGES.
Groups by (Respondent Type × Commodity × Country) and shows distribution
across proper response count ranges.
Sorted by Respondent Type.
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

# Define response count RANGES (more sensible groupings)
RESPONSE_RANGES = [
    (37, 50, "37-50"),
    (51, 100, "51-100"),
    (101, 150, "101-150"),
    (151, 190, "151-190"),
    (191, 194, "191-194"),
    (195, 196, "195-196"),
    (197, 197, "197"),
    (198, 999, "198+"),
]

print("=" * 150)
print("RESPONDENT BUNDLES BY RESPONSE COUNT RANGES")
print("=" * 150)

project = Project.objects.get(id=PROJECT_ID)

print(f"\nProject: {project.name}")
print(f"Response Ranges: 37-50, 51-100, 101-150, 151-190, 191-194, 195-196, 197, 198+")

# Get all respondents with response counts
respondents_with_counts = Respondent.objects.filter(
    project=project
).annotate(
    response_count=Count('responses')
).filter(
    response_count__gt=MIN_RESPONSES
)

total_qualified = respondents_with_counts.count()
print(f"Total qualified respondents (>{MIN_RESPONSES} responses): {total_qualified}")

# Group by targeting bundle and response range
bundles = defaultdict(lambda: {
    'total': 0,
    'ranges': defaultdict(int),
    'avg_responses': 0,
    'total_responses': 0,
    'min_responses': 999999,
    'max_responses': 0
})

for respondent in respondents_with_counts:
    # Create bundle key
    respondent_type = respondent.respondent_type or "NULL"
    commodity = respondent.commodity or "NULL"
    country = respondent.country or "NULL"

    bundle_key = (respondent_type, commodity, country)

    bundles[bundle_key]['total'] += 1
    bundles[bundle_key]['total_responses'] += respondent.response_count
    bundles[bundle_key]['min_responses'] = min(bundles[bundle_key]['min_responses'], respondent.response_count)
    bundles[bundle_key]['max_responses'] = max(bundles[bundle_key]['max_responses'], respondent.response_count)

    # Categorize by response range
    for min_val, max_val, range_label in RESPONSE_RANGES:
        if min_val <= respondent.response_count <= max_val:
            bundles[bundle_key]['ranges'][range_label] += 1
            break

# Calculate averages
for bundle_key, data in bundles.items():
    if data['total'] > 0:
        data['avg_responses'] = data['total_responses'] / data['total']

# Sort by Respondent Type, then Commodity, then Country
sorted_bundles = sorted(bundles.items(), key=lambda x: (x[0][0], x[0][1], x[0][2]))

# Display table
print("\n" + "=" * 150)
print("BUNDLE BREAKDOWN BY RESPONSE COUNT RANGES (Sorted by Respondent Type)")
print("=" * 150)

# Header
header = f"{'Respondent Type':<25} {'Commodity':<20} {'Ctry':<6} {'Total':<7} "
for _, _, label in RESPONSE_RANGES:
    header += f"{label:<10} "
header += f"{'Avg':<7} {'Min':<6} {'Max':<6}"
print(f"\n{header}")

separator = f"{'-'*25} {'-'*20} {'-'*6} {'-'*7} "
for _ in RESPONSE_RANGES:
    separator += f"{'-'*10} "
separator += f"{'-'*7} {'-'*6} {'-'*6}"
print(separator)

# Data rows
for (resp_type, commodity, country), data in sorted_bundles:
    row = f"{resp_type:<25} {commodity:<20} {country:<6} {data['total']:<7} "
    for _, _, range_label in RESPONSE_RANGES:
        row += f"{data['ranges'].get(range_label, 0):<10} "
    row += f"{data['avg_responses']:<7.1f} {data['min_responses']:<6} {data['max_responses']:<6}"
    print(row)

# Summary totals
print(f"\n{separator}")

total_row = f"{'TOTAL':<25} {'':<20} {'':<6} {total_qualified:<7} "
range_totals = {}
for _, _, range_label in RESPONSE_RANGES:
    total = sum(d['ranges'].get(range_label, 0) for d in bundles.values())
    range_totals[range_label] = total
    total_row += f"{total:<10} "

overall_avg = sum(d['total_responses'] for d in bundles.values()) / total_qualified if total_qualified > 0 else 0
overall_min = min(d['min_responses'] for d in bundles.values()) if bundles else 0
overall_max = max(d['max_responses'] for d in bundles.values()) if bundles else 0
total_row += f"{overall_avg:<7.1f} {overall_min:<6} {overall_max:<6}"
print(total_row)

# Percentage row
pct_row = f"{'PERCENTAGE':<25} {'':<20} {'':<6} {'100%':<7} "
for _, _, range_label in RESPONSE_RANGES:
    pct = (range_totals[range_label] / total_qualified * 100) if total_qualified > 0 else 0
    pct_row += f"{pct:<9.1f}% "
pct_row += f"{'':<7} {'':<6} {'':<6}"
print(pct_row)

# Summary by Respondent Type
print("\n" + "=" * 150)
print("SUMMARY BY RESPONDENT TYPE")
print("=" * 150)

type_summary = defaultdict(lambda: {
    'total': 0,
    'ranges': defaultdict(int),
    'total_responses': 0
})

for (resp_type, _, _), data in bundles.items():
    type_summary[resp_type]['total'] += data['total']
    type_summary[resp_type]['total_responses'] += data['total_responses']
    for range_label, count in data['ranges'].items():
        type_summary[resp_type]['ranges'][range_label] += count

# Sort by respondent type
sorted_types = sorted(type_summary.items())

header = f"{'Respondent Type':<30} {'Total':<10} "
for _, _, label in RESPONSE_RANGES:
    header += f"{label:<10} "
header += "Avg Resp"
print(f"\n{header}")

separator = f"{'-'*30} {'-'*10} "
for _ in RESPONSE_RANGES:
    separator += f"{'-'*10} "
separator += "-" * 10
print(separator)

for resp_type, data in sorted_types:
    avg = data['total_responses'] / data['total'] if data['total'] > 0 else 0
    row = f"{resp_type:<30} {data['total']:<10} "
    for _, _, range_label in RESPONSE_RANGES:
        row += f"{data['ranges'].get(range_label, 0):<10} "
    row += f"{avg:<10.1f}"
    print(row)

# Summary by Commodity
print("\n" + "=" * 150)
print("SUMMARY BY COMMODITY")
print("=" * 150)

commodity_summary = defaultdict(lambda: {
    'total': 0,
    'ranges': defaultdict(int),
    'total_responses': 0
})

for (_, commodity, _), data in bundles.items():
    commodity_summary[commodity]['total'] += data['total']
    commodity_summary[commodity]['total_responses'] += data['total_responses']
    for range_label, count in data['ranges'].items():
        commodity_summary[commodity]['ranges'][range_label] += count

# Sort by total count (descending)
sorted_commodities = sorted(commodity_summary.items(), key=lambda x: x[1]['total'], reverse=True)

header = f"{'Commodity':<30} {'Total':<10} "
for _, _, label in RESPONSE_RANGES:
    header += f"{label:<10} "
header += "Avg Resp"
print(f"\n{header}")

separator = f"{'-'*30} {'-'*10} "
for _ in RESPONSE_RANGES:
    separator += f"{'-'*10} "
separator += "-" * 10
print(separator)

for commodity, data in sorted_commodities:
    avg = data['total_responses'] / data['total'] if data['total'] > 0 else 0
    row = f"{commodity:<30} {data['total']:<10} "
    for _, _, range_label in RESPONSE_RANGES:
        row += f"{data['ranges'].get(range_label, 0):<10} "
    row += f"{avg:<10.1f}"
    print(row)

# Overall statistics
print("\n" + "=" * 150)
print("OVERALL STATISTICS")
print("=" * 150)

stats = f"""
TOTAL RESPONDENTS (>{MIN_RESPONSES} responses): {total_qualified}

RESPONSE COUNT DISTRIBUTION:
"""

for min_val, max_val, range_label in RESPONSE_RANGES:
    count = range_totals.get(range_label, 0)
    pct = (count / total_qualified * 100) if total_qualified > 0 else 0
    stats += f"  - {range_label:<12} {count:<6} ({pct:.1f}%)\n"

stats += f"""
UNIQUE BUNDLES: {len(bundles)}
  - Unique Respondent Types: {len(type_summary)}
  - Unique Commodities: {len(commodity_summary)}

RESPONSE COUNT STATISTICS:
  - Average: {overall_avg:.1f}
  - Minimum: {overall_min}
  - Maximum: {overall_max}
"""

print(stats)
print("=" * 150)
