"""
Django management command to find and delete responses that don't have associated questions.

This handles cases where questions were deleted but their responses remain in the database.
These orphaned responses cause export errors and should be cleaned up.

Usage:
    python manage.py cleanup_orphaned_responses --project-id=<uuid> --dry-run
    python manage.py cleanup_orphaned_responses --project-id=<uuid>
"""

from django.core.management.base import BaseCommand
from django.db.models import Q
from responses.models import Response
from projects.models import Project


class Command(BaseCommand):
    help = 'Find and delete responses that have no associated question (orphaned responses)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--project-id',
            type=str,
            required=True,
            help='Project ID to clean up responses for'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting'
        )

    def handle(self, *args, **options):
        project_id = options['project_id']
        dry_run = options['dry_run']

        self.stdout.write(self.style.WARNING('=' * 80))
        self.stdout.write(self.style.WARNING(f'CLEANUP ORPHANED RESPONSES FOR PROJECT: {project_id}'))
        self.stdout.write(self.style.WARNING('=' * 80))
        self.stdout.write('')

        if dry_run:
            self.stdout.write(self.style.NOTICE('🔍 DRY RUN MODE - No changes will be made'))
            self.stdout.write('')

        # Get project
        try:
            project = Project.objects.get(id=project_id)
            self.stdout.write(self.style.SUCCESS(f'✅ Found project: {project.name}'))
        except Project.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'❌ Project not found: {project_id}'))
            return

        self.stdout.write('')

        # Find all responses for this project
        total_responses = Response.objects.filter(project_id=project_id).count()
        self.stdout.write(f'📊 Total responses in project: {total_responses}')
        self.stdout.write('')

        # Find responses with null questions (orphaned responses)
        orphaned_responses = Response.objects.filter(
            project_id=project_id,
            question__isnull=True
        ).select_related('respondent')

        orphaned_count = orphaned_responses.count()

        if orphaned_count == 0:
            self.stdout.write(self.style.SUCCESS('✅ No orphaned responses found! Database is clean.'))
            return

        self.stdout.write(self.style.WARNING(f'⚠️  Found {orphaned_count} orphaned responses (no associated question)'))
        self.stdout.write('')

        # Show sample of orphaned responses
        self.stdout.write(self.style.NOTICE('Sample orphaned responses (first 10):'))
        sample_responses = orphaned_responses[:10]

        for response in sample_responses:
            respondent_id = response.respondent.respondent_id if response.respondent else 'UNKNOWN'
            response_preview = str(response.response_value)[:50] if response.response_value else 'NO VALUE'
            self.stdout.write(
                f'  - Response ID: {str(response.response_id)[:8]}... | '
                f'Respondent: {respondent_id} | '
                f'Value: "{response_preview}..." | '
                f'Collected: {response.collected_at.strftime("%Y-%m-%d %H:%M")}'
            )

        self.stdout.write('')

        # Group by respondent to understand impact
        respondent_impact = {}
        for response in orphaned_responses:
            if response.respondent:
                resp_id = response.respondent.respondent_id
                if resp_id not in respondent_impact:
                    respondent_impact[resp_id] = 0
                respondent_impact[resp_id] += 1

        if respondent_impact:
            self.stdout.write(self.style.NOTICE(f'📊 Impact across {len(respondent_impact)} respondents:'))
            # Show top 5 most affected
            sorted_impact = sorted(respondent_impact.items(), key=lambda x: x[1], reverse=True)[:5]
            for resp_id, count in sorted_impact:
                self.stdout.write(f'  - {resp_id}: {count} orphaned response(s)')
            self.stdout.write('')

        # Perform deletion
        if not dry_run:
            self.stdout.write(self.style.WARNING('⏳ Deleting orphaned responses...'))
            deleted_count, _ = orphaned_responses.delete()
            self.stdout.write(self.style.SUCCESS(f'✅ Successfully deleted {deleted_count} orphaned responses'))
        else:
            self.stdout.write(self.style.NOTICE('🔍 DRY RUN: Would delete these responses in real run'))

        # Summary
        self.stdout.write('')
        self.stdout.write(self.style.WARNING('=' * 80))
        self.stdout.write(self.style.WARNING('SUMMARY'))
        self.stdout.write(self.style.WARNING('=' * 80))
        self.stdout.write(f'Total responses in project: {total_responses}')
        self.stdout.write(f'Orphaned responses (no question): {orphaned_count}')

        if not dry_run:
            remaining = total_responses - orphaned_count
            self.stdout.write(self.style.SUCCESS(f'Responses remaining: {remaining}'))
            self.stdout.write('')
            self.stdout.write(self.style.SUCCESS('✅ CLEANUP COMPLETED!'))
        else:
            self.stdout.write(self.style.NOTICE(f'Would remain: {total_responses - orphaned_count}'))
            self.stdout.write('')
            self.stdout.write(self.style.NOTICE('🔍 This was a DRY RUN - no changes were made'))
            self.stdout.write(self.style.NOTICE('Run without --dry-run flag to perform actual deletion'))

        self.stdout.write('')
        self.stdout.write(self.style.NOTICE('Benefits of cleanup:'))
        self.stdout.write('  ✅ Fixes export errors (CSV and JSON)')
        self.stdout.write('  ✅ Reduces database size')
        self.stdout.write('  ✅ Improves query performance')
        self.stdout.write('  ✅ Maintains data integrity')
        self.stdout.write('')
