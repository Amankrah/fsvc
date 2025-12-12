"""Delete all generated questions for a specific project"""
from django.core.management.base import BaseCommand
from django.db.models import Count
from forms.models import Question
from projects.models import Project


class Command(BaseCommand):
    help = 'Delete all generated questions for a specific project'

    def add_arguments(self, parser):
        parser.add_argument('project_id', type=str, help='Project UUID to delete questions from')

    def handle(self, *args, **options):
        project_id = options['project_id']

        try:
            # Get project details
            project = Project.objects.get(id=project_id)
            self.stdout.write('\n' + '='*60)
            self.stdout.write('PROJECT DETAILS')
            self.stdout.write('='*60)
            self.stdout.write(f'Project Name: {project.name}')
            self.stdout.write(f'Project ID: {project.id}')
            self.stdout.write(f'Created By: {project.created_by}')
            self.stdout.write(f'Created At: {project.created_at}')

            # Get all questions for this project
            questions = Question.objects.filter(project=project)
            count = questions.count()

            self.stdout.write('\n' + '='*60)
            self.stdout.write('QUESTIONS TO DELETE')
            self.stdout.write('='*60)
            self.stdout.write(f'Total Questions: {count}')

            if count > 0:
                # Show breakdown by bundle
                bundles = questions.values(
                    'assigned_respondent_type',
                    'assigned_commodity',
                    'assigned_country'
                ).annotate(count=Count('id'))

                self.stdout.write('\nBreakdown by Generation Bundle:')
                for bundle in bundles:
                    resp = bundle['assigned_respondent_type']
                    comm = bundle['assigned_commodity'] or 'All'
                    ctry = bundle['assigned_country'] or 'All'
                    cnt = bundle['count']
                    self.stdout.write(f'  - {resp} / {comm} / {ctry}: {cnt} questions')

                self.stdout.write('\n' + '='*60)
                self.stdout.write(f'DELETING ALL {count} QUESTIONS...')
                self.stdout.write('='*60)

                # Delete all questions
                deleted_count, deleted_details = questions.delete()

                self.stdout.write(self.style.SUCCESS(f'\nSuccessfully deleted {deleted_count} objects'))
                self.stdout.write('\nDeleted objects breakdown:')
                for model, cnt in deleted_details.items():
                    if cnt > 0:
                        self.stdout.write(f'  - {model}: {cnt}')

                # Verify deletion
                remaining = Question.objects.filter(project=project).count()
                self.stdout.write(f'\nRemaining questions: {remaining}')
                self.stdout.write('='*60 + '\n')
            else:
                self.stdout.write('No questions found for this project.')
                self.stdout.write('='*60 + '\n')

        except Project.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'\nERROR: Project with ID "{project_id}" not found'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\nERROR: {e}'))
            import traceback
            traceback.print_exc()
