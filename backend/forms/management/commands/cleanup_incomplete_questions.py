"""
Django management command to find and delete generated questions that don't have all 3 filters.
Only deletes questions WITHOUT responses to preserve collected data.

Usage:
    python manage.py cleanup_incomplete_questions --project-id=f7672c4b-db61-421a-8c41-15aa5909e760 --dry-run
    python manage.py cleanup_incomplete_questions --project-id=f7672c4b-db61-421a-8c41-15aa5909e760
"""

from django.core.management.base import BaseCommand
from django.db.models import Q, Count
from forms.models import Question


class Command(BaseCommand):
    help = 'Find and delete generated questions without all 3 required filters (respondent_type, commodity, country)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--project-id',
            type=str,
            required=True,
            help='Project ID to clean up questions for'
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
        self.stdout.write(self.style.WARNING(f'CLEANUP INCOMPLETE QUESTIONS FOR PROJECT: {project_id}'))
        self.stdout.write(self.style.WARNING('=' * 80))
        self.stdout.write('')

        if dry_run:
            self.stdout.write(self.style.NOTICE('🔍 DRY RUN MODE - No changes will be made'))
            self.stdout.write('')

        # Find all questions for this project with incomplete filters
        incomplete_questions = Question.objects.filter(
            problem_id=project_id
        ).filter(
            Q(assigned_respondent_type__isnull=True) |
            Q(assigned_respondent_type='') |
            Q(assigned_commodity__isnull=True) |
            Q(assigned_commodity='') |
            Q(assigned_country__isnull=True) |
            Q(assigned_country='')
        ).annotate(
            response_count=Count('responses')
        )

        total_incomplete = incomplete_questions.count()

        if total_incomplete == 0:
            self.stdout.write(self.style.SUCCESS('✅ No incomplete questions found! Database is clean.'))
            return

        self.stdout.write(self.style.WARNING(f'📊 Found {total_incomplete} incomplete questions'))
        self.stdout.write('')

        # Separate into questions with responses vs without
        questions_with_responses = incomplete_questions.filter(response_count__gt=0)
        questions_without_responses = incomplete_questions.filter(response_count=0)

        count_with_responses = questions_with_responses.count()
        count_without_responses = questions_without_responses.count()

        # Report questions WITH responses (will be preserved)
        if count_with_responses > 0:
            self.stdout.write(self.style.ERROR(f'⚠️  PRESERVED: {count_with_responses} questions have responses (CANNOT DELETE)'))
            self.stdout.write('')
            self.stdout.write(self.style.NOTICE('Questions with responses (preserved):'))
            for q in questions_with_responses:
                self.stdout.write(
                    f'  - ID: {q.id} | Responses: {q.response_count} | '
                    f'Type: "{q.assigned_respondent_type or "MISSING"}" | '
                    f'Commodity: "{q.assigned_commodity or "MISSING"}" | '
                    f'Country: "{q.assigned_country or "MISSING"}"'
                )
                self.stdout.write(f'    Text: {q.question_text[:80]}...')
            self.stdout.write('')

        # Report questions WITHOUT responses (will be deleted)
        if count_without_responses > 0:
            self.stdout.write(self.style.WARNING(f'🗑️  TO DELETE: {count_without_responses} questions have NO responses'))
            self.stdout.write('')
            self.stdout.write(self.style.NOTICE('Questions to be deleted (no responses):'))
            for q in questions_without_responses:
                self.stdout.write(
                    f'  - ID: {q.id} | '
                    f'Type: "{q.assigned_respondent_type or "MISSING"}" | '
                    f'Commodity: "{q.assigned_commodity or "MISSING"}" | '
                    f'Country: "{q.assigned_country or "MISSING"}"'
                )
                self.stdout.write(f'    Text: {q.question_text[:80]}...')
            self.stdout.write('')

            if not dry_run:
                # Perform the deletion
                self.stdout.write(self.style.WARNING('⏳ Deleting questions without responses...'))
                deleted_count, _ = questions_without_responses.delete()
                self.stdout.write(self.style.SUCCESS(f'✅ Successfully deleted {deleted_count} questions'))
            else:
                self.stdout.write(self.style.NOTICE('🔍 DRY RUN: Would delete these questions in real run'))
        else:
            self.stdout.write(self.style.SUCCESS('✅ No questions to delete (all incomplete questions have responses)'))

        # Summary
        self.stdout.write('')
        self.stdout.write(self.style.WARNING('=' * 80))
        self.stdout.write(self.style.WARNING('SUMMARY'))
        self.stdout.write(self.style.WARNING('=' * 80))
        self.stdout.write(f'Total incomplete questions found: {total_incomplete}')
        self.stdout.write(f'Questions preserved (have responses): {count_with_responses}')
        if not dry_run:
            self.stdout.write(self.style.SUCCESS(f'Questions deleted (no responses): {count_without_responses}'))
        else:
            self.stdout.write(self.style.NOTICE(f'Questions that would be deleted: {count_without_responses}'))
        self.stdout.write('')

        if dry_run:
            self.stdout.write(self.style.NOTICE('🔍 This was a DRY RUN - no changes were made'))
            self.stdout.write(self.style.NOTICE('Run without --dry-run flag to perform actual deletion'))
