#!/usr/bin/env python
"""
Analyze request logs, Django middleware logs, or any server logs that might
contain information about which user submitted which responses.

When a member clicks "submit" on the mobile app, it makes an HTTP request to
the save_draft or similar endpoint. If those requests were logged, we might
be able to recover the attribution.
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
from django.db.models import Count, Min, Max
from datetime import datetime, timedelta

# Target project
PROJECT_ID = "f7672c4b-db61-421a-8c41-15aa5909e760"

print("=" * 160)
print("REQUEST LOG ANALYSIS FOR DATA ATTRIBUTION")
print("=" * 160)

project = Project.objects.get(id=PROJECT_ID)

print(f"\nProject: {project.name}")

# CRITICAL: Check if responses have timestamps that could help
print("\n" + "=" * 160)
print("RESPONSE TIMESTAMP ANALYSIS")
print("=" * 160)

# Get unattributed responses
unattributed_responses = Response.objects.filter(
    project=project,
    collected_by__isnull=True
)

total_unattributed = unattributed_responses.count()
print(f"\nTotal unattributed responses: {total_unattributed}")

# Check what timestamp fields exist
sample_response = unattributed_responses.first()
if sample_response:
    print(f"\nTimestamp fields available:")
    if hasattr(sample_response, 'collected_at'):
        print(f"  - collected_at: {sample_response.collected_at}")
    if hasattr(sample_response, 'created_at'):
        print(f"  - created_at: {sample_response.created_at}")
    if hasattr(sample_response, 'updated_at'):
        print(f"  - updated_at: {sample_response.updated_at}")

# Analyze response submission patterns
print("\n" + "=" * 160)
print("RESPONSE SUBMISSION PATTERNS")
print("=" * 160)

# Group unattributed responses by respondent and check submission times
print("\nAnalyzing submission timing patterns...")

# Get qualified unattributed respondents
unattributed_respondents = Respondent.objects.filter(
    project=project,
    created_by__isnull=True
).annotate(
    response_count=Count('responses')
).filter(
    response_count__gt=36
)

print(f"Qualified unattributed respondents: {unattributed_respondents.count()}")

# For each respondent, check if responses were submitted in batches
# (which might correlate with known member working hours)
print("\nChecking if responses were submitted in time-clustered batches...")

batch_submissions = []

for respondent in unattributed_respondents[:10]:  # Sample first 10
    responses = Response.objects.filter(
        respondent=respondent
    ).order_by('collected_at')

    if responses.exists() and responses.first().collected_at:
        # Get time range
        first_time = responses.first().collected_at
        last_time = responses.last().collected_at
        duration = last_time - first_time if last_time and first_time else None

        # Check if all responses were submitted within a short time window
        # (typical for mobile app batch submission)
        if duration and duration < timedelta(hours=2):
            batch_submissions.append({
                'respondent_id': respondent.respondent_id,
                'response_count': responses.count(),
                'first_time': first_time,
                'last_time': last_time,
                'duration': duration
            })

print(f"\nRespondents with batch submissions (within 2 hours): {len(batch_submissions)}")

if batch_submissions:
    print(f"\n{'Respondent ID':<40} {'Responses':<12} {'First Submission':<25} {'Last Submission':<25} {'Duration':<15}")
    print(f"{'-'*40} {'-'*12} {'-'*25} {'-'*25} {'-'*15}")

    for batch in batch_submissions[:20]:
        print(f"{batch['respondent_id']:<40} {batch['response_count']:<12} "
              f"{batch['first_time'].strftime('%Y-%m-%d %H:%M:%S'):<25} "
              f"{batch['last_time'].strftime('%Y-%m-%d %H:%M:%S'):<25} "
              f"{str(batch['duration']):<15}")

# CRITICAL: Check for Django logging
print("\n" + "=" * 160)
print("DJANGO LOGGING CONFIGURATION")
print("=" * 160)

from django.conf import settings

if hasattr(settings, 'LOGGING'):
    print("\n✓ Django logging is configured!")
    print("\nLogging configuration:")

    import json
    print(json.dumps(settings.LOGGING, indent=2))

    # Check if there are log files
    if 'handlers' in settings.LOGGING:
        handlers = settings.LOGGING['handlers']
        log_files = []

        for handler_name, handler_config in handlers.items():
            if 'filename' in handler_config:
                log_files.append(handler_config['filename'])

        if log_files:
            print(f"\n✓ Log files found: {log_files}")
            print("\nYou should check these log files for request data!")
            print("Look for patterns like:")
            print("  - POST /api/responses/save-draft/")
            print("  - User: <email>")
            print("  - Respondent ID: <id>")
else:
    print("\n✗ No Django logging configuration found")

# Check for nginx/apache logs
print("\n" + "=" * 160)
print("WEB SERVER LOGS")
print("=" * 160)

import subprocess

# Common log locations
log_locations = [
    '/var/log/nginx/access.log',
    '/var/log/nginx/error.log',
    '/var/log/apache2/access.log',
    '/var/log/apache2/error.log',
    '/var/log/gunicorn/access.log',
    '/var/log/gunicorn/error.log',
]

print("\nChecking common log file locations...")
existing_logs = []

for log_path in log_locations:
    if os.path.exists(log_path):
        existing_logs.append(log_path)
        print(f"  ✓ Found: {log_path}")

if existing_logs:
    print(f"\n✓ Found {len(existing_logs)} web server log files!")
    print("\nThese logs might contain:")
    print("  - Request timestamps")
    print("  - User tokens (Authorization header)")
    print("  - IP addresses")
    print("  - Request payloads (if logging level is high enough)")

    print("\nTo analyze, you can use:")
    print(f"  grep -E 'save-draft|POST.*responses' {existing_logs[0]}")
else:
    print("\n✗ No standard web server log files found")

# Check for database query logs
print("\n" + "=" * 160)
print("DATABASE QUERY LOGS")
print("=" * 160)

# Check database settings
db_config = settings.DATABASES.get('default', {})
print(f"\nDatabase engine: {db_config.get('ENGINE', 'Unknown')}")

if 'postgresql' in db_config.get('ENGINE', '').lower():
    print("\n✓ PostgreSQL detected!")
    print("\nPostgreSQL query logs might be enabled. Check:")
    print("  - /var/log/postgresql/")
    print("  - PostgreSQL log_statement setting")
    print("  - Look for INSERT INTO responses_response queries with user context")

elif 'mysql' in db_config.get('ENGINE', '').lower():
    print("\n✓ MySQL detected!")
    print("\nMySQL query logs might be enabled. Check:")
    print("  - /var/log/mysql/")
    print("  - MySQL general_log or slow_query_log")

# SUMMARY AND RECOMMENDATIONS
print("\n" + "=" * 160)
print("ATTRIBUTION RECOVERY STRATEGY")
print("=" * 160)

print(f"""
ANALYSIS RESULTS:
  Unattributed Responses: {total_unattributed}
  Unattributed Qualified Respondents: {unattributed_respondents.count()}

POTENTIAL RECOVERY METHODS:

1. WEB SERVER LOGS (nginx/apache/gunicorn):
   Status: {'✓ FOUND' if existing_logs else '✗ NOT FOUND'}
   {'Files: ' + ', '.join(existing_logs) if existing_logs else 'No log files detected'}

   Action: Search logs for POST requests to /api/responses/save-draft/
          Extract Authorization tokens or session IDs
          Match tokens to users via authtoken_token table

2. DJANGO APPLICATION LOGS:
   Status: {'✓ CONFIGURED' if hasattr(settings, 'LOGGING') else '✗ NOT CONFIGURED'}

   Action: Check configured log files for request/user data

3. DATABASE QUERY LOGS:
   Status: ⚠ DEPENDS ON DB CONFIGURATION

   Action: Check PostgreSQL/MySQL logs for INSERT queries with user context

4. TIMING CORRELATION:
   Status: {'✓ POSSIBLE' if batch_submissions else '✗ INSUFFICIENT DATA'}

   Action: If members worked on specific dates/times, correlate response
          timestamps with known member schedules

CRITICAL NEXT STEPS:
  1. Check web server logs: {existing_logs[0] if existing_logs else 'N/A'}
  2. Search for: Authorization: Token <token_value>
  3. Match tokens to users: SELECT user_id FROM authtoken_token WHERE key = '<token>'
  4. If found, can backfill collected_by field!

SUCCESS PROBABILITY:
  - If request logs exist with auth tokens: HIGH (80-90%)
  - If logs exist without auth data: MEDIUM (30-50%)
  - If no logs exist: ZERO (0%)
""")

print("=" * 160)
