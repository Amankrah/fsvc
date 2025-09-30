"""
Management command to set up ResponseType data.
Run this after migrations to ensure all response types are available.
"""

from django.core.management.base import BaseCommand
from responses.models import ResponseType


class Command(BaseCommand):
    help = 'Set up ResponseType data for the survey system'

    def handle(self, *args, **options):
        self.stdout.write('Setting up ResponseType data...')
        
        # Create default response types
        ResponseType.get_default_types()
        
        self.stdout.write(
            self.style.SUCCESS('Successfully set up ResponseType data')
        )
        
        # Show created types
        types = ResponseType.objects.all()
        self.stdout.write(f'Created {types.count()} response types:')
        for response_type in types:
            self.stdout.write(f'  - {response_type.name}: {response_type.display_name}') 