import os
import sys
import django

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_core.settings.development')
django.setup()

from forms.models import Question
from projects.models import Project

# Get first project
p = Project.objects.first()

if p:
    print(f"Project: {p.name} (ID: {p.id})")
    qs = Question.objects.filter(project=p)
    print(f"\nTotal questions: {qs.count()}")

    print("\nSample questions:")
    for q in qs[:15]:
        print(f"  ID: {q.id}")
        print(f"    RespondentType: {repr(q.assigned_respondent_type)}")
        print(f"    Commodity: {repr(q.assigned_commodity)}")
        print(f"    Country: {repr(q.assigned_country)}")
        print(f"    Question: {q.question_text[:50]}...")
        print()
else:
    print("No projects found")
