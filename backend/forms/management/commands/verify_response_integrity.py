"""
Django management command to verify response data integrity.

Checks for:
- Responses without questions (orphaned)
- Responses without respondents
- Other data integrity issues

Usage:
    python manage.py verify_response_integrity --project-id=<uuid>
"""

from django.core.management.base import BaseCommand
from django.db.models import Count, Q
from responses.models import Response, Respondent
from forms.models import Question
from projects.models import Project


class Command(BaseCommand):
    help = 'Verify response data integrity for a project'

    def add_arguments(self, parser):
        parser.add_argument(
            '--project-id',
            type=str,
            required=True,
            help='Project ID to verify'
        )

    def handle(self, *args, **options):
        project_id = options['project_id']

        self.stdout.write(self.style.WARNING('=' * 80))
        self.stdout.write(self.style.WARNING(f'RESPONSE DATA INTEGRITY VERIFICATION'))
        self.stdout.write(self.style.WARNING(f'PROJECT: {project_id}'))
        self.stdout.write(self.style.WARNING('=' * 80))
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
        # OVERALL STATISTICS
        # ===================================================================
        self.stdout.write(self.style.WARNING('OVERALL STATISTICS'))
        self.stdout.write(self.style.WARNING('-' * 80))
        self.stdout.write('')

        total_responses = Response.objects.filter(project_id=project_id).count()
        total_respondents = Respondent.objects.filter(project_id=project_id).count()
        total_questions = Question.objects.filter(project_id=project_id).count()

        self.stdout.write(f'📊 Total Responses: {total_responses}')
        self.stdout.write(f'👥 Total Respondents: {total_respondents}')
        self.stdout.write(f'❓ Total Questions: {total_questions}')
        self.stdout.write('')

        # ===================================================================
        # CHECK 1: ORPHANED RESPONSES (NO QUESTION)
        # ===================================================================
        self.stdout.write(self.style.WARNING('CHECK 1: ORPHANED RESPONSES (NO QUESTION)'))
        self.stdout.write(self.style.WARNING('-' * 80))
        self.stdout.write('')

        orphaned_responses = Response.objects.filter(
            project_id=project_id,
            question__isnull=True
        ).count()

        if orphaned_responses == 0:
            self.stdout.write(self.style.SUCCESS('✅ PASS: No orphaned responses found'))
        else:
            self.stdout.write(self.style.ERROR(
                f'❌ FAIL: Found {orphaned_responses} responses without questions ({orphaned_responses/total_responses*100:.1f}%)'
            ))
            self.stdout.write(self.style.NOTICE(
                '   Run: python manage.py cleanup_orphaned_responses --project-id=<uuid> --dry-run'
            ))

        self.stdout.write('')

        # ===================================================================
        # CHECK 2: RESPONSES WITHOUT RESPONDENTS
        # ===================================================================
        self.stdout.write(self.style.WARNING('CHECK 2: RESPONSES WITHOUT RESPONDENTS'))
        self.stdout.write(self.style.WARNING('-' * 80))
        self.stdout.write('')

        no_respondent = Response.objects.filter(
            project_id=project_id,
            respondent__isnull=True
        ).count()

        if no_respondent == 0:
            self.stdout.write(self.style.SUCCESS('✅ PASS: All responses have respondents'))
        else:
            self.stdout.write(self.style.ERROR(
                f'❌ FAIL: Found {no_respondent} responses without respondents'
            ))

        self.stdout.write('')

        # ===================================================================
        # CHECK 3: VALID RESPONSES
        # ===================================================================
        self.stdout.write(self.style.WARNING('CHECK 3: VALID RESPONSES'))
        self.stdout.write(self.style.WARNING('-' * 80))
        self.stdout.write('')

        valid_responses = Response.objects.filter(
            project_id=project_id,
            question__isnull=False,
            respondent__isnull=False
        ).count()

        self.stdout.write(self.style.SUCCESS(
            f'✅ Valid responses: {valid_responses} ({valid_responses/total_responses*100:.1f}%)'
        ))

        self.stdout.write('')

        # ===================================================================
        # CHECK 4: QUESTIONS WITH RESPONSES
        # ===================================================================
        self.stdout.write(self.style.WARNING('CHECK 4: QUESTIONS WITH RESPONSES'))
        self.stdout.write(self.style.WARNING('-' * 80))
        self.stdout.write('')

        questions_with_responses = Question.objects.filter(
            project_id=project_id,
            responses__isnull=False
        ).distinct().count()

        self.stdout.write(f'📊 Questions with at least one response: {questions_with_responses}/{total_questions}')
        unused_questions = total_questions - questions_with_responses
        if unused_questions > 0:
            self.stdout.write(f'⚠️  Unused questions: {unused_questions}')
        self.stdout.write('')

        # ===================================================================
        # CHECK 5: RESPONDENTS WITH RESPONSES
        # ===================================================================
        self.stdout.write(self.style.WARNING('CHECK 5: RESPONDENTS WITH RESPONSES'))
        self.stdout.write(self.style.WARNING('-' * 80))
        self.stdout.write('')

        respondents_with_responses = Respondent.objects.filter(
            project_id=project_id,
            responses__isnull=False
        ).distinct().count()

        self.stdout.write(f'📊 Respondents with at least one response: {respondents_with_responses}/{total_respondents}')
        empty_respondents = total_respondents - respondents_with_responses
        if empty_respondents > 0:
            self.stdout.write(f'⚠️  Respondents with no responses: {empty_respondents}')
        self.stdout.write('')

        # ===================================================================
        # FINAL SUMMARY
        # ===================================================================
        self.stdout.write(self.style.WARNING('=' * 80))
        self.stdout.write(self.style.WARNING('VERIFICATION SUMMARY'))
        self.stdout.write(self.style.WARNING('=' * 80))
        self.stdout.write('')

        issues_found = 0
        if orphaned_responses > 0:
            issues_found += 1
        if no_respondent > 0:
            issues_found += 1

        if issues_found == 0:
            self.stdout.write(self.style.SUCCESS('✅ EXCELLENT! All integrity checks passed.'))
            self.stdout.write('')
            self.stdout.write('Your response data is clean and ready for export.')
        else:
            self.stdout.write(self.style.ERROR(f'❌ Found {issues_found} integrity issue(s)'))
            self.stdout.write('')
            if orphaned_responses > 0:
                self.stdout.write(self.style.NOTICE('To fix orphaned responses:'))
                self.stdout.write(f'  python manage.py cleanup_orphaned_responses --project-id={project_id} --dry-run')
                self.stdout.write('')

        self.stdout.write('')
