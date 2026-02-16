import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "django_core.settings.development")
django.setup()

from responses.models import Respondent
from django.db.models import Count

def check_respondents():
    total = Respondent.objects.count()
    with_creator = Respondent.objects.filter(created_by__isnull=False).count()
    without_creator = Respondent.objects.filter(created_by__isnull=True).count()
    
    print(f"Total Respondents: {total}")
    print(f"With 'created_by' set: {with_creator}")
    print(f"Without 'created_by' set: {without_creator}")
    
    if with_creator > 0:
        print("\nBreakdown by Creator:")
        creators = Respondent.objects.filter(created_by__isnull=False).values('created_by__username').annotate(count=Count('id'))
        for c in creators:
            print(f"- {c['created_by__username']}: {c['count']}")

if __name__ == "__main__":
    check_respondents()
