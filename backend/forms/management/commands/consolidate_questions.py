from django.core.management.base import BaseCommand
from forms.models import Question, QuestionBank
from django.db.models import Count
import difflib

class Command(BaseCommand):
    help = 'Consolidate legacy questions by linking them to QuestionBank items'

    def add_arguments(self, parser):
        parser.add_argument('--project_id', type=str, help='Project ID to run consolidation for')
        parser.add_argument('--dry-run', action='store_true', help='Preview changes without saving')
        parser.add_argument('--auto-create', action='store_true', help='Automatically create QuestionBank items for unlinked questions')

    def handle(self, *args, **options):
        project_id = options['project_id']
        dry_run = options['dry_run']
        auto_create = options['auto_create']

        if not project_id:
            self.stdout.write(self.style.ERROR('Please provide a project_id'))
            return

        self.stdout.write(f"Consolidating questions for project: {project_id}")
        
        # 1. Get all unlinked questions
        unlinked_questions = Question.objects.filter(
            project_id=project_id,
            question_bank_source__isnull=True
        )
        
        self.stdout.write(f"Found {unlinked_questions.count()} unlinked questions.")

        # 2. Get existing QuestionBank items
        qb_items = list(QuestionBank.objects.filter(project_id=project_id))
        self.stdout.write(f"Found {len(qb_items)} existing QuestionBank items.")

        # Group unlinked questions by text/category to avoid repetitive processing
        # Use a tuple key: (question_text, question_category)
        grouped_questions = {}
        for q in unlinked_questions:
            key = (q.question_text.strip(), q.question_category)
            if key not in grouped_questions:
                grouped_questions[key] = []
            grouped_questions[key].append(q)

        updated_count = 0
        created_qb_count = 0

        for (q_text, q_cat), questions in grouped_questions.items():
            # Try to find a match in existing QB items
            match = None
            
            # 1. Exact match on Text AND Category
            for qb in qb_items:
                if qb.question_text.strip() == q_text and qb.question_category == q_cat:
                    match = qb
                    break
            
            # 2. Relaxed match on Text only (if strict fail)
            if not match:
                for qb in qb_items:
                    if qb.question_text.strip() == q_text:
                        match = qb
                        break

            if match:
                self.stdout.write(self.style.SUCCESS(f"MATCH: '{q_text}' -> QB: {match.id} ({match.question_text})"))
                if not dry_run:
                    for q in questions:
                        q.question_bank_source = match
                        q.save()
                    updated_count += len(questions)
            else:
                self.stdout.write(self.style.WARNING(f"NO MATCH: '{q_text}' (Category: {q_cat}) - {len(questions)} instances"))
                
                if auto_create:
                    # Create new QB item using metadata from the first question instance
                    sample_q = questions[0]
                    self.stdout.write(self.style.MIGRATE(f"CREATING QB ITEM for: '{q_text}'"))
                    
                    if not dry_run:
                        new_qb = QuestionBank.objects.create(
                            project_id=project_id,
                            question_text=sample_q.question_text,
                            question_category=sample_q.question_category,
                            response_type=sample_q.response_type,
                            is_required=sample_q.is_required,
                            options=sample_q.options,
                            section_header=sample_q.section_header,
                            # Default tracking
                            targeted_respondents=[sample_q.assigned_respondent_type] if sample_q.assigned_respondent_type else [],
                            targeted_commodities=[sample_q.assigned_commodity] if sample_q.assigned_commodity else [],
                            targeted_countries=[sample_q.assigned_country] if sample_q.assigned_country else [],
                            data_source='internal',
                            is_active=False # Inactive so it doesn't get auto-generated elsewhere? Or True? Let's say True.
                        )
                        qb_items.append(new_qb) # Add to list for future matches
                        created_qb_count += 1
                        
                        # Link questions
                        for q in questions:
                            q.question_bank_source = new_qb
                            q.save()
                        updated_count += len(questions)

        if dry_run:
            self.stdout.write(self.style.SUCCESS(f"[DRY RUN] Would link {updated_count} questions. Would create {created_qb_count} new QB items."))
        else:
            self.stdout.write(self.style.SUCCESS(f"DONE. Linked {updated_count} questions. Created {created_qb_count} new QB items."))
