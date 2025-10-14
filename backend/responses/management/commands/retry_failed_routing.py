"""
Django management command to retry failed database routing for responses.

Usage:
    python manage.py retry_failed_routing
    python manage.py retry_failed_routing --max-attempts 5
    python manage.py retry_failed_routing --project-id <uuid>
    python manage.py retry_failed_routing --dry-run
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from responses.models import Response
from responses.database_router import get_database_router
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Retry failed database routing for responses that need to be sent to partner databases'

    def add_arguments(self, parser):
        parser.add_argument(
            '--max-attempts',
            type=int,
            default=3,
            help='Maximum number of retry attempts (default: 3)'
        )
        parser.add_argument(
            '--project-id',
            type=str,
            help='Only retry responses for a specific project'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be retried without actually retrying'
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=100,
            help='Maximum number of responses to retry in one run (default: 100)'
        )

    def handle(self, *args, **options):
        max_attempts = options['max_attempts']
        project_id = options.get('project_id')
        dry_run = options['dry_run']
        limit = options['limit']

        self.stdout.write(
            self.style.SUCCESS(
                f"Starting database routing retry process (max_attempts={max_attempts}, dry_run={dry_run})"
            )
        )

        # Find responses that need retry
        queryset = Response.objects.filter(
            routing_complete=False,
            routing_attempts__lt=max_attempts
        ).select_related('question', 'project', 'respondent')

        if project_id:
            queryset = queryset.filter(project_id=project_id)

        # Limit to prevent overwhelming the system
        responses_to_retry = list(queryset[:limit])

        if not responses_to_retry:
            self.stdout.write(
                self.style.WARNING("No responses found that need retry")
            )
            return

        self.stdout.write(
            self.style.WARNING(
                f"Found {len(responses_to_retry)} response(s) that need retry"
            )
        )

        if dry_run:
            self.stdout.write(self.style.NOTICE("\n=== DRY RUN MODE ==="))
            for response in responses_to_retry:
                self.stdout.write(
                    f"  - Response {response.response_id}:"
                )
                self.stdout.write(
                    f"    Project: {response.project.name}"
                )
                self.stdout.write(
                    f"    Question: {response.question.question_text[:50]}..."
                )
                self.stdout.write(
                    f"    Attempts: {response.routing_attempts}/{max_attempts}"
                )
                self.stdout.write(
                    f"    Failed endpoints: {', '.join(response.get_failed_endpoints())}"
                )
                self.stdout.write("")
            return

        # Retry routing
        router = get_database_router()
        success_count = 0
        partial_success_count = 0
        failed_count = 0

        for response in responses_to_retry:
            self.stdout.write(
                f"Retrying response {response.response_id} "
                f"(attempt {response.routing_attempts + 1}/{max_attempts})..."
            )

            try:
                # Get failed endpoints
                failed_endpoints = response.get_failed_endpoints()

                # Attempt routing again
                routing_results = router.route_response(response)

                # Update routing status
                response.update_routing_status(routing_results)

                if routing_results.get('success'):
                    if response.routing_complete:
                        success_count += 1
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"  ✓ Successfully routed to all endpoints"
                            )
                        )
                    else:
                        partial_success_count += 1
                        still_failed = response.get_failed_endpoints()
                        self.stdout.write(
                            self.style.WARNING(
                                f"  ⚠ Partial success. Still failed: {', '.join(still_failed)}"
                            )
                        )
                else:
                    failed_count += 1
                    self.stdout.write(
                        self.style.ERROR(
                            f"  ✗ Failed to route to any endpoint"
                        )
                    )

            except Exception as e:
                failed_count += 1
                self.stdout.write(
                    self.style.ERROR(
                        f"  ✗ Error during retry: {str(e)}"
                    )
                )
                logger.exception(
                    f"Error retrying response {response.response_id}"
                )

        # Summary
        self.stdout.write("\n" + "="*60)
        self.stdout.write(self.style.SUCCESS("\nRetry Summary:"))
        self.stdout.write(f"  Total processed: {len(responses_to_retry)}")
        self.stdout.write(
            self.style.SUCCESS(f"  Fully successful: {success_count}")
        )
        self.stdout.write(
            self.style.WARNING(f"  Partially successful: {partial_success_count}")
        )
        self.stdout.write(
            self.style.ERROR(f"  Failed: {failed_count}")
        )
        self.stdout.write("="*60 + "\n")

        if partial_success_count > 0 or failed_count > 0:
            self.stdout.write(
                self.style.WARNING(
                    f"\nNote: {partial_success_count + failed_count} response(s) still need attention. "
                    f"Run this command again to retry."
                )
            )
