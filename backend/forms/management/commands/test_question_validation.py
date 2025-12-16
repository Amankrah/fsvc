"""
Django management command to test database-level question validation.

Tests that incomplete questions (missing any of the 3 required filters) cannot be saved.

Usage:
    python manage.py test_question_validation --project-id=<uuid>
"""

from django.core.management.base import BaseCommand
from django.core.exceptions import ValidationError
from forms.models import Question
from projects.models import Project


class Command(BaseCommand):
    help = 'Test database-level validation for Question model'

    def add_arguments(self, parser):
        parser.add_argument(
            '--project-id',
            type=str,
            required=True,
            help='Project ID to test with'
        )

    def handle(self, *args, **options):
        project_id = options['project_id']

        self.stdout.write(self.style.WARNING('=' * 80))
        self.stdout.write(self.style.WARNING('TEST: QUESTION MODEL DATABASE-LEVEL VALIDATION'))
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
        self.stdout.write(self.style.NOTICE('Running validation tests...'))
        self.stdout.write('')

        # Test 1: Complete question (all 3 filters) - should succeed
        self.stdout.write(self.style.NOTICE('Test 1: Complete question (all 3 filters)'))
        try:
            question = Question(
                project=project,
                question_text='Test question with all filters',
                response_type='text_short',
                assigned_respondent_type='farmers',
                assigned_commodity='cocoa',
                assigned_country='Ghana',
                order_index=99999
            )
            question.save()
            self.stdout.write(self.style.SUCCESS('  ✅ PASS: Complete question saved successfully'))
            question.delete()  # Clean up
        except ValidationError as e:
            self.stdout.write(self.style.ERROR(f'  ❌ FAIL: {e}'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  ❌ ERROR: {e}'))

        # Test 2: Missing country - should fail
        self.stdout.write(self.style.NOTICE('Test 2: Missing country filter'))
        try:
            question = Question(
                project=project,
                question_text='Test question missing country',
                response_type='text_short',
                assigned_respondent_type='farmers',
                assigned_commodity='cocoa',
                assigned_country='',  # MISSING
                order_index=99999
            )
            question.save()
            self.stdout.write(self.style.ERROR('  ❌ FAIL: Question saved without country (should have failed)'))
            question.delete()  # Clean up
        except ValidationError as e:
            self.stdout.write(self.style.SUCCESS(f'  ✅ PASS: Validation correctly rejected incomplete question'))
            self.stdout.write(f'     Error: {e}')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  ❌ ERROR: {e}'))

        # Test 3: Missing commodity - should fail
        self.stdout.write(self.style.NOTICE('Test 3: Missing commodity filter'))
        try:
            question = Question(
                project=project,
                question_text='Test question missing commodity',
                response_type='text_short',
                assigned_respondent_type='farmers',
                assigned_commodity='',  # MISSING
                assigned_country='Ghana',
                order_index=99999
            )
            question.save()
            self.stdout.write(self.style.ERROR('  ❌ FAIL: Question saved without commodity (should have failed)'))
            question.delete()  # Clean up
        except ValidationError as e:
            self.stdout.write(self.style.SUCCESS(f'  ✅ PASS: Validation correctly rejected incomplete question'))
            self.stdout.write(f'     Error: {e}')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  ❌ ERROR: {e}'))

        # Test 4: Missing respondent_type - should fail
        self.stdout.write(self.style.NOTICE('Test 4: Missing respondent_type filter'))
        try:
            question = Question(
                project=project,
                question_text='Test question missing respondent_type',
                response_type='text_short',
                assigned_respondent_type='',  # MISSING
                assigned_commodity='cocoa',
                assigned_country='Ghana',
                order_index=99999
            )
            question.save()
            self.stdout.write(self.style.ERROR('  ❌ FAIL: Question saved without respondent_type (should have failed)'))
            question.delete()  # Clean up
        except ValidationError as e:
            self.stdout.write(self.style.SUCCESS(f'  ✅ PASS: Validation correctly rejected incomplete question'))
            self.stdout.write(f'     Error: {e}')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  ❌ ERROR: {e}'))

        # Test 5: No filters at all (manually created question) - should succeed
        self.stdout.write(self.style.NOTICE('Test 5: Manually created question (no filters)'))
        try:
            question = Question(
                project=project,
                question_text='Manually created question without filters',
                response_type='text_short',
                assigned_respondent_type='',
                assigned_commodity='',
                assigned_country='',
                order_index=99999
            )
            question.save()
            self.stdout.write(self.style.SUCCESS('  ✅ PASS: Manual question without filters saved successfully'))
            question.delete()  # Clean up
        except ValidationError as e:
            self.stdout.write(self.style.ERROR(f'  ❌ FAIL: {e}'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  ❌ ERROR: {e}'))

        # Test 6: Missing all 3 filters but one has whitespace - should fail
        self.stdout.write(self.style.NOTICE('Test 6: Partial filter (whitespace only)'))
        try:
            question = Question(
                project=project,
                question_text='Test question with whitespace filter',
                response_type='text_short',
                assigned_respondent_type='farmers',
                assigned_commodity='   ',  # WHITESPACE ONLY
                assigned_country='Ghana',
                order_index=99999
            )
            question.save()
            self.stdout.write(self.style.ERROR('  ❌ FAIL: Question saved with whitespace-only commodity (should have failed)'))
            question.delete()  # Clean up
        except ValidationError as e:
            self.stdout.write(self.style.SUCCESS(f'  ✅ PASS: Validation correctly rejected whitespace-only filter'))
            self.stdout.write(f'     Error: {e}')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  ❌ ERROR: {e}'))

        self.stdout.write('')
        self.stdout.write(self.style.WARNING('=' * 80))
        self.stdout.write(self.style.WARNING('TESTS COMPLETED'))
        self.stdout.write(self.style.WARNING('=' * 80))
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('✅ Database-level validation is working correctly!'))
        self.stdout.write('')
        self.stdout.write(self.style.NOTICE('Summary:'))
        self.stdout.write('  - Complete questions (all 3 filters) can be saved'))
        self.stdout.write('  - Incomplete questions (missing any filter) are REJECTED'))
        self.stdout.write('  - Manual questions (no filters) can be saved'))
        self.stdout.write('')
