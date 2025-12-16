"""
Django management command to verify filter metadata coverage for respondents and responses.

This command provides a detailed report of which respondents and responses have complete
filter metadata (respondent_type, commodity, country).

Usage:
    python manage.py verify_filter_metadata --project-id=<uuid>
"""

from django.core.management.base import BaseCommand
from django.db.models import Count, Q
from responses.models import Respondent, Response
from projects.models import Project


class Command(BaseCommand):
    help = 'Verify filter metadata coverage for respondents and responses'

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
        self.stdout.write(self.style.WARNING(f'FILTER METADATA VERIFICATION FOR PROJECT: {project_id}'))
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
        # RESPONDENT VERIFICATION
        # ===================================================================
        self.stdout.write(self.style.WARNING('RESPONDENT FILTER METADATA'))
        self.stdout.write(self.style.WARNING('-' * 80))
        self.stdout.write('')

        total_respondents = Respondent.objects.filter(project=project).count()
        self.stdout.write(f'📊 Total respondents: {total_respondents}')
        self.stdout.write('')

        # Complete filter metadata
        complete_respondents = Respondent.objects.filter(
            project=project,
            respondent_type__isnull=False,
            commodity__isnull=False,
            country__isnull=False
        ).exclude(
            Q(respondent_type='') | Q(commodity='') | Q(country='')
        ).count()

        # Missing filters
        missing_respondent_type = Respondent.objects.filter(
            project=project
        ).filter(
            Q(respondent_type__isnull=True) | Q(respondent_type='')
        ).count()

        missing_commodity = Respondent.objects.filter(
            project=project
        ).filter(
            Q(commodity__isnull=True) | Q(commodity='')
        ).count()

        missing_country = Respondent.objects.filter(
            project=project
        ).filter(
            Q(country__isnull=True) | Q(country='')
        ).count()

        missing_any = Respondent.objects.filter(
            project=project
        ).filter(
            Q(respondent_type__isnull=True) | Q(respondent_type='') |
            Q(commodity__isnull=True) | Q(commodity='') |
            Q(country__isnull=True) | Q(country='')
        ).count()

        self.stdout.write('Respondent Filter Coverage:')
        self.stdout.write(f'  ✅ Complete metadata: {complete_respondents} ({complete_respondents/total_respondents*100:.1f}%)' if total_respondents > 0 else '  ✅ Complete metadata: 0 (0%)')
        self.stdout.write(f'  ⚠️ Missing any filter: {missing_any} ({missing_any/total_respondents*100:.1f}%)' if total_respondents > 0 else '  ⚠️ Missing any filter: 0 (0%)')
        self.stdout.write('')
        self.stdout.write('Missing by field:')
        self.stdout.write(f'  - Missing respondent_type: {missing_respondent_type}')
        self.stdout.write(f'  - Missing commodity: {missing_commodity}')
        self.stdout.write(f'  - Missing country: {missing_country}')

        if missing_any > 0:
            self.stdout.write('')
            self.stdout.write(self.style.NOTICE('Sample respondents with missing filters (first 5):'))
            missing_respondents = Respondent.objects.filter(
                project=project
            ).filter(
                Q(respondent_type__isnull=True) | Q(respondent_type='') |
                Q(commodity__isnull=True) | Q(commodity='') |
                Q(country__isnull=True) | Q(country='')
            )[:5]

            for resp in missing_respondents:
                response_count = resp.responses.count()
                self.stdout.write(
                    f'  - {resp.respondent_id}: '
                    f'Type="{resp.respondent_type or "MISSING"}", '
                    f'Commodity="{resp.commodity or "MISSING"}", '
                    f'Country="{resp.country or "MISSING"}" '
                    f'({response_count} responses)'
                )

        self.stdout.write('')
        self.stdout.write('')

        # ===================================================================
        # RESPONSE VERIFICATION
        # ===================================================================
        self.stdout.write(self.style.WARNING('RESPONSE FILTER METADATA'))
        self.stdout.write(self.style.WARNING('-' * 80))
        self.stdout.write('')

        total_responses = Response.objects.filter(project=project).count()
        self.stdout.write(f'📊 Total responses: {total_responses}')
        self.stdout.write('')

        # Complete context (has all 3 assigned_ fields)
        complete_context = Response.objects.filter(
            project=project
        ).filter(
            Q(question_bank_context__has_key='assigned_respondent_type') &
            Q(question_bank_context__has_key='assigned_commodity') &
            Q(question_bank_context__has_key='assigned_country')
        ).count()

        # Missing context
        missing_context = Response.objects.filter(
            project=project
        ).filter(
            Q(question_bank_context__isnull=True) |
            Q(question_bank_context={}) |
            ~Q(question_bank_context__has_key='assigned_respondent_type') |
            ~Q(question_bank_context__has_key='assigned_commodity') |
            ~Q(question_bank_context__has_key='assigned_country')
        ).count()

        self.stdout.write('Response Filter Coverage:')
        self.stdout.write(f'  ✅ Complete metadata: {complete_context} ({complete_context/total_responses*100:.1f}%)' if total_responses > 0 else '  ✅ Complete metadata: 0 (0%)')
        self.stdout.write(f'  ⚠️ Missing/incomplete metadata: {missing_context} ({missing_context/total_responses*100:.1f}%)' if total_responses > 0 else '  ⚠️ Missing/incomplete metadata: 0 (0%)')

        if missing_context > 0:
            self.stdout.write('')
            self.stdout.write(self.style.NOTICE('Sample responses with missing metadata (first 5):'))
            missing_responses = Response.objects.filter(
                project=project
            ).filter(
                Q(question_bank_context__isnull=True) |
                Q(question_bank_context={}) |
                ~Q(question_bank_context__has_key='assigned_respondent_type') |
                ~Q(question_bank_context__has_key='assigned_commodity') |
                ~Q(question_bank_context__has_key='assigned_country')
            ).select_related('question', 'respondent')[:5]

            for resp in missing_responses:
                context = resp.question_bank_context or {}
                self.stdout.write(
                    f'  - Response {str(resp.response_id)[:8]}... to Q: "{resp.question.question_text[:40]}..." '
                    f'by {resp.respondent.respondent_id}'
                )
                self.stdout.write(
                    f'    Context: Type="{context.get("assigned_respondent_type", "MISSING")}", '
                    f'Commodity="{context.get("assigned_commodity", "MISSING")}", '
                    f'Country="{context.get("assigned_country", "MISSING")}"'
                )

        self.stdout.write('')
        self.stdout.write('')

        # ===================================================================
        # FILTER COMBINATIONS
        # ===================================================================
        self.stdout.write(self.style.WARNING('FILTER COMBINATIONS IN USE'))
        self.stdout.write(self.style.WARNING('-' * 80))
        self.stdout.write('')

        # Get unique filter combinations from respondents
        respondent_combinations = Respondent.objects.filter(
            project=project,
            respondent_type__isnull=False,
            commodity__isnull=False,
            country__isnull=False
        ).exclude(
            Q(respondent_type='') | Q(commodity='') | Q(country='')
        ).values('respondent_type', 'commodity', 'country').annotate(
            count=Count('id')
        ).order_by('respondent_type', 'commodity', 'country')

        if respondent_combinations.exists():
            self.stdout.write(f'📊 {respondent_combinations.count()} unique filter combinations:')
            self.stdout.write('')
            for combo in respondent_combinations:
                self.stdout.write(
                    f'  - {combo["respondent_type"]} + {combo["commodity"]} + {combo["country"]}: '
                    f'{combo["count"]} respondent(s)'
                )
        else:
            self.stdout.write('⚠️ No complete filter combinations found')

        self.stdout.write('')
        self.stdout.write('')

        # ===================================================================
        # RECOMMENDATIONS
        # ===================================================================
        self.stdout.write(self.style.WARNING('=' * 80))
        self.stdout.write(self.style.WARNING('RECOMMENDATIONS'))
        self.stdout.write(self.style.WARNING('=' * 80))
        self.stdout.write('')

        if missing_any == 0 and missing_context == 0:
            self.stdout.write(self.style.SUCCESS('✅ EXCELLENT! All respondents and responses have complete filter metadata.'))
            self.stdout.write('')
            self.stdout.write('Your data is fully tagged and ready for analysis by filter combinations.')
        else:
            if missing_any > 0:
                self.stdout.write(self.style.WARNING(
                    f'⚠️ {missing_any} respondents are missing filter metadata.'
                ))
                self.stdout.write('   Run: python manage.py backfill_respondent_filters --project-id=<uuid> --dry-run')
                self.stdout.write('   to see what would be updated.')
                self.stdout.write('')

            if missing_context > 0:
                self.stdout.write(self.style.WARNING(
                    f'⚠️ {missing_context} responses are missing filter metadata in question_bank_context.'
                ))
                self.stdout.write('   Run: python manage.py backfill_respondent_filters --project-id=<uuid> --dry-run')
                self.stdout.write('   to see what would be updated.')
                self.stdout.write('')

            self.stdout.write(self.style.NOTICE('After reviewing the dry-run results, run without --dry-run to apply changes.'))

        self.stdout.write('')
