"""
Management command to remove duplicate questions from projects
"""
from django.core.management.base import BaseCommand
from django.db.models import Count
from forms.models import Question
from projects.models import Project


class Command(BaseCommand):
    help = 'Remove duplicate questions from projects (keeps the first occurrence)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--project-id',
            type=str,
            help='Specific project ID to clean (optional)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting',
        )

    def handle(self, *args, **options):
        project_id = options.get('project_id')
        dry_run = options.get('dry_run', False)

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be made'))

        # Get projects to process
        if project_id:
            projects = Project.objects.filter(id=project_id)
            if not projects.exists():
                self.stdout.write(self.style.ERROR(f'Project {project_id} not found'))
                return
        else:
            projects = Project.objects.all()

        total_duplicates = 0
        total_kept = 0

        for project in projects:
            self.stdout.write(f'\nProcessing project: {project.name}')
            
            # Get all questions for this project
            questions = Question.objects.filter(project=project).order_by('created_at')
            
            # Find duplicates by question_text
            seen_texts = set()
            duplicates_to_delete = []
            kept_questions = []
            
            for question in questions:
                if question.question_text in seen_texts:
                    # This is a duplicate
                    duplicates_to_delete.append(question)
                else:
                    # This is the first occurrence - keep it
                    seen_texts.add(question.question_text)
                    kept_questions.append(question)
            
            if duplicates_to_delete:
                self.stdout.write(
                    self.style.WARNING(
                        f'  Found {len(duplicates_to_delete)} duplicate questions '
                        f'(keeping {len(kept_questions)} unique ones)'
                    )
                )
                
                # Show some examples
                for i, dup in enumerate(duplicates_to_delete[:5]):
                    self.stdout.write(f'    - "{dup.question_text[:60]}..."')
                
                if len(duplicates_to_delete) > 5:
                    self.stdout.write(f'    ... and {len(duplicates_to_delete) - 5} more')
                
                if not dry_run:
                    # Delete the duplicates
                    deleted_count = 0
                    for dup in duplicates_to_delete:
                        dup.delete()
                        deleted_count += 1
                    
                    self.stdout.write(
                        self.style.SUCCESS(f'  ✓ Deleted {deleted_count} duplicate questions')
                    )
                    total_duplicates += deleted_count
                else:
                    self.stdout.write(
                        self.style.NOTICE(f'  [DRY RUN] Would delete {len(duplicates_to_delete)} questions')
                    )
                    total_duplicates += len(duplicates_to_delete)  # Add to total even in dry-run
                
                total_kept += len(kept_questions)
            else:
                self.stdout.write(self.style.SUCCESS(f'  ✓ No duplicates found'))

        # Summary
        self.stdout.write('\n' + '='*60)
        if dry_run:
            self.stdout.write(
                self.style.NOTICE(
                    f'DRY RUN COMPLETE: Would have deleted {total_duplicates} duplicates '
                    f'and kept {total_kept} unique questions'
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f'CLEANUP COMPLETE: Deleted {total_duplicates} duplicates, '
                    f'kept {total_kept} unique questions'
                )
            )
        self.stdout.write('='*60 + '\n')

