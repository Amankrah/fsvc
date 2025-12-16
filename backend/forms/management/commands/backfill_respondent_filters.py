"""
Django management command to backfill filter metadata for existing respondents and responses.

This command identifies respondents and responses that are missing filter metadata and
populates them based on the questions they answered.

Usage:
    python manage.py backfill_respondent_filters --project-id=<uuid> --dry-run
    python manage.py backfill_respondent_filters --project-id=<uuid>
"""

from django.core.management.base import BaseCommand
from django.db.models import Count, Q
from responses.models import Respondent, Response
from forms.models import Question
from projects.models import Project


class Command(BaseCommand):
    help = 'Backfill filter metadata for existing respondents and responses'

    def add_arguments(self, parser):
        parser.add_argument(
            '--project-id',
            type=str,
            required=True,
            help='Project ID to backfill filters for'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be updated without actually updating'
        )

    def handle(self, *args, **options):
        project_id = options['project_id']
        dry_run = options['dry_run']

        self.stdout.write(self.style.WARNING('=' * 80))
        self.stdout.write(self.style.WARNING(f'BACKFILL FILTER METADATA FOR PROJECT: {project_id}'))
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

        # ===================================================================
        # PART 1: BACKFILL RESPONDENT FILTERS
        # ===================================================================
        self.stdout.write(self.style.WARNING('PART 1: BACKFILLING RESPONDENT FILTERS'))
        self.stdout.write(self.style.WARNING('-' * 80))
        self.stdout.write('')

        # Find respondents with missing filters
        respondents_missing_filters = Respondent.objects.filter(
            project=project
        ).filter(
            Q(respondent_type__isnull=True) | Q(respondent_type='') |
            Q(commodity__isnull=True) | Q(commodity='') |
            Q(country__isnull=True) | Q(country='')
        )

        total_missing = respondents_missing_filters.count()
        self.stdout.write(f'📊 Found {total_missing} respondents with missing filter metadata')
        self.stdout.write('')

        if total_missing == 0:
            self.stdout.write(self.style.SUCCESS('✅ All respondents have complete filter metadata!'))
        else:
            updated_count = 0
            skipped_count = 0

            for respondent in respondents_missing_filters:
                self.stdout.write(f'Processing respondent: {respondent.respondent_id}')

                # Get the first response from this respondent to determine filters
                first_response = Response.objects.filter(
                    respondent=respondent
                ).select_related('question').first()

                if not first_response or not first_response.question:
                    self.stdout.write(self.style.WARNING(
                        f'  ⚠️ SKIPPED: No responses found for respondent {respondent.respondent_id}'
                    ))
                    skipped_count += 1
                    continue

                question = first_response.question

                # Check if question has all 3 filters
                if not question.assigned_respondent_type or not question.assigned_commodity or not question.assigned_country:
                    self.stdout.write(self.style.WARNING(
                        f'  ⚠️ SKIPPED: Question missing filters - '
                        f'Type: "{question.assigned_respondent_type}", '
                        f'Commodity: "{question.assigned_commodity}", '
                        f'Country: "{question.assigned_country}"'
                    ))
                    skipped_count += 1
                    continue

                # Backfill the respondent filters
                old_values = {
                    'respondent_type': respondent.respondent_type,
                    'commodity': respondent.commodity,
                    'country': respondent.country,
                }

                new_values = {
                    'respondent_type': question.assigned_respondent_type,
                    'commodity': question.assigned_commodity,
                    'country': question.assigned_country,
                }

                self.stdout.write(f'  Old: Type="{old_values["respondent_type"]}", '
                                f'Commodity="{old_values["commodity"]}", '
                                f'Country="{old_values["country"]}"')
                self.stdout.write(f'  New: Type="{new_values["respondent_type"]}", '
                                f'Commodity="{new_values["commodity"]}", '
                                f'Country="{new_values["country"]}"')

                if not dry_run:
                    respondent.respondent_type = new_values['respondent_type']
                    respondent.commodity = new_values['commodity']
                    respondent.country = new_values['country']
                    respondent.save(update_fields=['respondent_type', 'commodity', 'country'])
                    self.stdout.write(self.style.SUCCESS(f'  ✅ UPDATED'))
                else:
                    self.stdout.write(self.style.NOTICE(f'  🔍 DRY RUN: Would update'))

                updated_count += 1
                self.stdout.write('')

            self.stdout.write('')
            self.stdout.write(self.style.WARNING('RESPONDENT SUMMARY:'))
            self.stdout.write(f'Total respondents missing filters: {total_missing}')
            if not dry_run:
                self.stdout.write(self.style.SUCCESS(f'✅ Updated: {updated_count}'))
            else:
                self.stdout.write(self.style.NOTICE(f'Would update: {updated_count}'))
            self.stdout.write(self.style.WARNING(f'⚠️ Skipped: {skipped_count}'))

        self.stdout.write('')
        self.stdout.write('')

        # ===================================================================
        # PART 2: BACKFILL RESPONSE question_bank_context
        # ===================================================================
        self.stdout.write(self.style.WARNING('PART 2: BACKFILLING RESPONSE QUESTION_BANK_CONTEXT'))
        self.stdout.write(self.style.WARNING('-' * 80))
        self.stdout.write('')

        # Find responses with empty or incomplete question_bank_context
        responses_missing_context = Response.objects.filter(
            project=project
        ).filter(
            Q(question_bank_context__isnull=True) |
            Q(question_bank_context={}) |
            ~Q(question_bank_context__has_key='assigned_respondent_type') |
            ~Q(question_bank_context__has_key='assigned_commodity') |
            ~Q(question_bank_context__has_key='assigned_country')
        ).select_related('question', 'respondent')

        total_responses_missing = responses_missing_context.count()
        self.stdout.write(f'📊 Found {total_responses_missing} responses with missing/incomplete filter metadata')
        self.stdout.write('')

        if total_responses_missing == 0:
            self.stdout.write(self.style.SUCCESS('✅ All responses have complete filter metadata!'))
        else:
            response_updated_count = 0
            response_skipped_count = 0

            # Process in batches for efficiency
            batch_size = 100
            for i in range(0, total_responses_missing, batch_size):
                batch = responses_missing_context[i:i+batch_size]

                for response in batch:
                    if response.question and response.respondent:
                        question = response.question
                        respondent = response.respondent

                        # Build context from question and respondent
                        context = response.question_bank_context or {}

                        # Add question assignment filters
                        if question.assigned_respondent_type:
                            context['assigned_respondent_type'] = question.assigned_respondent_type
                        if question.assigned_commodity:
                            context['assigned_commodity'] = question.assigned_commodity
                        if question.assigned_country:
                            context['assigned_country'] = question.assigned_country

                        # Add respondent filters
                        if respondent.respondent_type:
                            context['respondent_type'] = respondent.respondent_type
                        if respondent.commodity:
                            context['commodity'] = respondent.commodity
                        if respondent.country:
                            context['country'] = respondent.country

                        # Only update if we have complete filter information
                        has_complete_filters = (
                            context.get('assigned_respondent_type') and
                            context.get('assigned_commodity') and
                            context.get('assigned_country')
                        )

                        if has_complete_filters:
                            if not dry_run:
                                response.question_bank_context = context
                                response.save(update_fields=['question_bank_context'])
                            response_updated_count += 1
                        else:
                            response_skipped_count += 1
                    else:
                        response_skipped_count += 1

                if not dry_run and (i + batch_size) % 1000 == 0:
                    self.stdout.write(f'  Processed {i + batch_size}/{total_responses_missing} responses...')

            self.stdout.write('')
            self.stdout.write(self.style.WARNING('RESPONSE SUMMARY:'))
            self.stdout.write(f'Total responses missing filter metadata: {total_responses_missing}')
            if not dry_run:
                self.stdout.write(self.style.SUCCESS(f'✅ Updated: {response_updated_count}'))
            else:
                self.stdout.write(self.style.NOTICE(f'Would update: {response_updated_count}'))
            self.stdout.write(self.style.WARNING(f'⚠️ Skipped (incomplete data): {response_skipped_count}'))

        self.stdout.write('')
        self.stdout.write('')

        # ===================================================================
        # FINAL SUMMARY
        # ===================================================================
        self.stdout.write(self.style.WARNING('=' * 80))
        self.stdout.write(self.style.WARNING('FINAL SUMMARY'))
        self.stdout.write(self.style.WARNING('=' * 80))
        self.stdout.write('')

        if dry_run:
            self.stdout.write(self.style.NOTICE('🔍 DRY RUN RESULTS:'))
            self.stdout.write(f'  Would update {updated_count} respondents')
            self.stdout.write(f'  Would update {response_updated_count} responses')
            self.stdout.write(f'  Would skip {skipped_count} respondents (no responses or incomplete question data)')
            self.stdout.write(f'  Would skip {response_skipped_count} responses (incomplete data)')
            self.stdout.write('')
            self.stdout.write(self.style.NOTICE('Run without --dry-run to apply changes'))
        else:
            self.stdout.write(self.style.SUCCESS('✅ BACKFILL COMPLETED:'))
            self.stdout.write(f'  ✅ Updated {updated_count} respondents with filter metadata')
            self.stdout.write(f'  ✅ Updated {response_updated_count} responses with filter metadata')
            self.stdout.write(f'  ⚠️ Skipped {skipped_count} respondents (no responses or incomplete question data)')
            self.stdout.write(f'  ⚠️ Skipped {response_skipped_count} responses (incomplete data)')

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('✅ All filter metadata has been backfilled!'))
        self.stdout.write('')
        self.stdout.write(self.style.NOTICE('You can now query:'))
        self.stdout.write('  - Respondents by their filter combinations (respondent_type, commodity, country)')
        self.stdout.write('  - Responses by the question filters they were answering')
        self.stdout.write('  - Track which set of questions each respondent answered')
        self.stdout.write('')
