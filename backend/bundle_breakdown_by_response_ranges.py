#!/usr/bin/env python
"""
Breakdown of respondent bundles by specific response count ranges.
Groups by (Respondent Type × Commodity × Country) and shows distribution
across response count ranges: 37, 191, 195, 197, 198+
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

# Define response count ranges
RESPONSE_RANGES = [
    (37, 37, "37"),
    (190, 190, "190"),
    (191, 191, "191"),
    (195, 195, "195"),
    (197, 197, "197"),
    (198, 999, "198+"),
]

print("=" * 140)
print("RESPONDENT BUNDLES BY RESPONSE COUNT RANGES")
print("=" * 140)

project = Project.objects.get(id=PROJECT_ID)

print(f"\nProject: {project.name}")
print(f"Response Ranges: 37, 191, 195, 197, 198+")

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
    'total_responses': 0
})

for respondent in respondents_with_counts:
    # Create bundle key
    respondent_type = respondent.respondent_type or "NULL"
    commodity = respondent.commodity or "NULL"
    country = respondent.country or "NULL"

    bundle_key = (respondent_type, commodity, country)

    bundles[bundle_key]['total'] += 1
    bundles[bundle_key]['total_responses'] += respondent.response_count

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
print("\n" + "=" * 140)
print("BUNDLE BREAKDOWN BY RESPONSE COUNT RANGES (Sorted by Respondent Type)")
print("=" * 140)

# Header
print(f"\n{'Respondent Type':<25} {'Commodity':<25} {'Country':<12} {'Total':<8} {'37':<8} {'191':<8} {'195':<8} {'197':<8} {'198+':<8} {'Avg':<8}")
print(f"{'-'*25} {'-'*25} {'-'*12} {'-'*8} {'-'*8} {'-'*8} {'-'*8} {'-'*8} {'-'*8} {'-'*8}")

# Data rows
for (resp_type, commodity, country), data in sorted_bundles:
    print(f"{resp_type:<25} {commodity:<25} {country:<12} {data['total']:<8} "
          f"{data['ranges'].get('37', 0):<8} "
          f"{data['ranges'].get('191', 0):<8} "
          f"{data['ranges'].get('195', 0):<8} "
          f"{data['ranges'].get('197', 0):<8} "
          f"{data['ranges'].get('198+', 0):<8} "
          f"{data['avg_responses']:<8.1f}")

# Summary totals
print(f"\n{'-'*25} {'-'*25} {'-'*12} {'-'*8} {'-'*8} {'-'*8} {'-'*8} {'-'*8} {'-'*8} {'-'*8}")

total_37 = sum(d['ranges'].get('37', 0) for d in bundles.values())
total_191 = sum(d['ranges'].get('191', 0) for d in bundles.values())
total_195 = sum(d['ranges'].get('195', 0) for d in bundles.values())
total_197 = sum(d['ranges'].get('197', 0) for d in bundles.values())
total_198_plus = sum(d['ranges'].get('198+', 0) for d in bundles.values())
overall_avg = sum(d['total_responses'] for d in bundles.values()) / total_qualified if total_qualified > 0 else 0

print(f"{'TOTAL':<25} {'':<25} {'':<12} {total_qualified:<8} "
      f"{total_37:<8} {total_191:<8} {total_195:<8} {total_197:<8} {total_198_plus:<8} {overall_avg:<8.1f}")

# Percentage row
print(f"{'PERCENTAGE':<25} {'':<25} {'':<12} {'100%':<8} "
      f"{total_37/total_qualified*100 if total_qualified>0 else 0:<7.1f}% "
      f"{total_191/total_qualified*100 if total_qualified>0 else 0:<7.1f}% "
      f"{total_195/total_qualified*100 if total_qualified>0 else 0:<7.1f}% "
      f"{total_197/total_qualified*100 if total_qualified>0 else 0:<7.1f}% "
      f"{total_198_plus/total_qualified*100 if total_qualified>0 else 0:<7.1f}% {'':<8}")

# Summary by Respondent Type
print("\n" + "=" * 140)
print("SUMMARY BY RESPONDENT TYPE")
print("=" * 140)

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

print(f"\n{'Respondent Type':<30} {'Total':<10} {'37':<10} {'191':<10} {'195':<10} {'197':<10} {'198+':<10} {'Avg Resp':<10}")
print(f"{'-'*30} {'-'*10} {'-'*10} {'-'*10} {'-'*10} {'-'*10} {'-'*10} {'-'*10}")

for resp_type, data in sorted_types:
    avg = data['total_responses'] / data['total'] if data['total'] > 0 else 0
    print(f"{resp_type:<30} {data['total']:<10} "
          f"{data['ranges'].get('37', 0):<10} "
          f"{data['ranges'].get('191', 0):<10} "
          f"{data['ranges'].get('195', 0):<10} "
          f"{data['ranges'].get('197', 0):<10} "
          f"{data['ranges'].get('198+', 0):<10} "
          f"{avg:<10.1f}")

# Summary by Commodity
print("\n" + "=" * 140)
print("SUMMARY BY COMMODITY")
print("=" * 140)

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

print(f"\n{'Commodity':<30} {'Total':<10} {'37':<10} {'191':<10} {'195':<10} {'197':<10} {'198+':<10} {'Avg Resp':<10}")
print(f"{'-'*30} {'-'*10} {'-'*10} {'-'*10} {'-'*10} {'-'*10} {'-'*10} {'-'*10}")

for commodity, data in sorted_commodities:
    avg = data['total_responses'] / data['total'] if data['total'] > 0 else 0
    print(f"{commodity:<30} {data['total']:<10} "
          f"{data['ranges'].get('37', 0):<10} "
          f"{data['ranges'].get('191', 0):<10} "
          f"{data['ranges'].get('195', 0):<10} "
          f"{data['ranges'].get('197', 0):<10} "
          f"{data['ranges'].get('198+', 0):<10} "
          f"{avg:<10.1f}")

# Overall statistics
print("\n" + "=" * 140)
print("OVERALL STATISTICS")
print("=" * 140)

print(f"""
TOTAL RESPONDENTS (>{MIN_RESPONSES} responses): {total_qualified}

RESPONSE COUNT DISTRIBUTION:
  - 37 responses:    {total_37:<6} ({total_37/total_qualified*100 if total_qualified>0 else 0:.1f}%)
  - 191 responses:   {total_191:<6} ({total_191/total_qualified*100 if total_qualified>0 else 0:.1f}%)
  - 195 responses:   {total_195:<6} ({total_195/total_qualified*100 if total_qualified>0 else 0:.1f}%)
  - 197 responses:   {total_197:<6} ({total_197/total_qualified*100 if total_qualified>0 else 0:.1f}%)
  - 198+ responses:  {total_198_plus:<6} ({total_198_plus/total_qualified*100 if total_qualified>0 else 0:.1f}%)

UNIQUE BUNDLES: {len(bundles)}
  - Unique Respondent Types: {len(type_summary)}
  - Unique Commodities: {len(commodity_summary)}

AVERAGE RESPONSES PER RESPONDENT: {overall_avg:.1f}
""")

print("=" * 140)
