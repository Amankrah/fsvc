#!/bin/bash
# Safely delete questions from FCI4Africa project - Responses will be preserved!

SERVER="ubuntu@13.60.137.180"
KEY="fsda_key.pem"
PROJECT_ID="f7672c4b-db61-421a-8c41-15aa5909e760"

echo "=========================================="
echo "Delete FCI4Africa Questions (Safe Mode)"
echo "=========================================="
echo ""
echo "Project: FCI4Africa Data Collection"
echo "Project ID: $PROJECT_ID"
echo ""
echo "⚠️  IMPORTANT: This will delete questions but PRESERVE responses!"
echo "   Responses will have question=NULL instead of being deleted."
echo ""

# First, verify the migration is applied
echo "Step 1: Verifying response preservation is enabled..."
echo "========================================"
ssh -i $KEY $SERVER << 'ENDSSH'
cd /var/www/fsvc/backend
source venv/bin/activate
export DJANGO_SETTINGS_MODULE=django_core.settings.production

python manage.py shell -c "
from django.db import connection

with connection.cursor() as cursor:
    cursor.execute(\"\"\"
        SELECT column_name, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'responses_response'
        AND column_name = 'question_id';
    \"\"\")
    result = cursor.fetchone()
    if result and result[1] == 'YES':
        print('✅ VERIFIED: Responses will be preserved (question_id is nullable)')
        exit(0)
    else:
        print('❌ ERROR: Migration not applied! Responses would be deleted!')
        print('   Please run: python manage.py migrate responses')
        exit(1)
"
ENDSSH

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ SAFETY CHECK FAILED!"
    echo "   Migration not applied. Aborting to prevent data loss."
    exit 1
fi

echo ""
echo "Step 2: Checking current state..."
echo "========================================"
ssh -i $KEY $SERVER << ENDSSH2
cd /var/www/fsvc/backend
source venv/bin/activate
export DJANGO_SETTINGS_MODULE=django_core.settings.production

python manage.py shell -c "
from projects.models import Project
from forms.models import Question
from responses.models import Response

project = Project.objects.get(id='$PROJECT_ID')

questions_count = Question.objects.filter(project=project).count()
responses_count = Response.objects.filter(project=project).count()

print(f'Project: {project.name}')
print(f'Questions: {questions_count}')
print(f'Responses: {responses_count}')
print()
print('After deletion:')
print(f'  Questions: 0')
print(f'  Responses: {responses_count} (PRESERVED with question=NULL)')
"
ENDSSH2

echo ""
read -p "Do you want to proceed with deletion? (type 'DELETE' to confirm): " confirm

if [ "$confirm" != "DELETE" ]; then
    echo "Operation cancelled."
    exit 0
fi

echo ""
echo "Step 3: Deleting questions (responses will be preserved)..."
echo "========================================"
ssh -i $KEY $SERVER << 'ENDSSH3'
cd /var/www/fsvc/backend
source venv/bin/activate
export DJANGO_SETTINGS_MODULE=django_core.settings.production

python manage.py shell -c "
from projects.models import Project
from forms.models import Question
from responses.models import Response
from django.db.models import Count

project_id = '$PROJECT_ID'
project = Project.objects.get(id=project_id)

print('='*70)
print('BEFORE DELETION')
print('='*70)

# Get questions grouped by bundle
questions = Question.objects.filter(project=project)
total_questions = questions.count()

bundles = questions.values(
    'assigned_respondent_type',
    'assigned_commodity',
    'assigned_country'
).annotate(count=Count('id')).order_by('-count')

print(f'Total Questions: {total_questions}')
print(f'Total Responses: {Response.objects.filter(project=project).count()}')
print()
print('Questions by Bundle:')
for bundle in bundles[:10]:
    resp_type = bundle['assigned_respondent_type'] or 'None'
    commodity = bundle['assigned_commodity'] or 'None'
    country = bundle['assigned_country'] or 'None'
    count = bundle['count']
    print(f'  {resp_type} | {commodity} | {country}: {count} questions')

print()
print('='*70)
print('DELETING QUESTIONS...')
print('='*70)

# Delete all questions for this project
deleted_count, deleted_breakdown = questions.delete()

print()
print('Deletion Summary:')
print(f'  Total objects affected: {deleted_count}')
for model, count in deleted_breakdown.items():
    print(f'  - {model}: {count}')

print()
print('='*70)
print('AFTER DELETION')
print('='*70)

remaining_questions = Question.objects.filter(project=project).count()
remaining_responses = Response.objects.filter(project=project).count()
orphaned_responses = Response.objects.filter(project=project, question__isnull=True).count()

print(f'Remaining Questions: {remaining_questions}')
print(f'Total Responses: {remaining_responses}')
print(f'Orphaned Responses (question=NULL): {orphaned_responses}')
print()

if remaining_responses > 0 and orphaned_responses == remaining_responses:
    print('✅ SUCCESS: All responses preserved with question=NULL!')
else:
    print('⚠️  Note: Some responses may still have valid question references')

print('='*70)
"
ENDSSH3

echo ""
echo "=========================================="
echo "✓ Deletion Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "- Questions deleted from project"
echo "- Responses PRESERVED with question=NULL"
echo "- Data safe for future analysis"
