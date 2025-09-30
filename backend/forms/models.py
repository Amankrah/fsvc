from django.db import models
import uuid
from projects.models import Project

# Create your models here.

class Question(models.Model):
    RESPONSE_TYPES = [
        # Text Response Types
        ('text_short', 'Short Text'),
        ('text_long', 'Long Text'),
        
        # Numeric Response Types
        ('numeric_integer', 'Number (Integer)'),
        ('numeric_decimal', 'Number (Decimal)'),
        ('scale_rating', 'Rating Scale'),
        
        # Choice Response Types
        ('choice_single', 'Single Choice'),
        ('choice_multiple', 'Multiple Choice'),
        
        # Date & Time Response Types
        ('date', 'Date'),
        ('datetime', 'Date & Time'),
        
        # Location Response Types
        ('geopoint', 'GPS Location'),
        ('geoshape', 'Geographic Shape'),
        
        # Media Response Types
        ('image', 'Photo/Image'),
        ('audio', 'Audio Recording'),
        ('video', 'Video Recording'),
        ('file', 'File Upload'),
        
        # Special Response Types
        ('signature', 'Digital Signature'),
        ('barcode', 'Barcode/QR Code'),
        
        # Legacy types for backward compatibility
        ('numeric', 'Numeric (Legacy)'),
        ('text', 'Text (Legacy)'),
        ('choice', 'Multiple Choice (Legacy)'),
        ('scale', 'Scale (Legacy)'),
        ('location', 'Location (Legacy)'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='questions')
    question_text = models.TextField()
    response_type = models.CharField(max_length=20, choices=RESPONSE_TYPES)
    is_required = models.BooleanField(default=True)
    allow_multiple = models.BooleanField(default=False)  # Added to support frontend
    options = models.JSONField(null=True, blank=True)  # For multiple choice questions
    validation_rules = models.JSONField(null=True, blank=True)
    order_index = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    sync_status = models.CharField(max_length=20, default='pending')

    class Meta:
        ordering = ['order_index', 'created_at']
        unique_together = ['project', 'order_index']

    def __str__(self):
        return f"{self.question_text[:50]}..."
    
    def get_response_count(self):
        """Get the number of responses for this question"""
        return self.responses.count()
    
    def get_unique_respondents_count(self):
        """Get the number of unique respondents for this question"""
        return self.responses.values('respondent_id').distinct().count()
    
    def get_completion_rate(self):
        """Get the completion rate for this question"""
        total_responses = self.get_response_count()
        if total_responses == 0:
            return 0.0
        
        # For required questions, assume all responses are complete
        if self.is_required:
            return 100.0
        
        # For optional questions, check if response_value is not empty
        complete_responses = self.responses.exclude(response_value='').count()
        return (complete_responses / total_responses) * 100 if total_responses > 0 else 0.0
    
    def get_response_summary(self):
        """Get a summary of responses for this question"""
        return {
            'total_responses': self.get_response_count(),
            'unique_respondents': self.get_unique_respondents_count(),
            'completion_rate': self.get_completion_rate(),
        }
    
    def can_user_access(self, user):
        """Check if a user can access this question"""
        return self.project.can_user_access(user)
    
    def get_expected_response_type(self):
        """Get the expected ResponseType for this question"""
        from responses.models import ResponseType
        
        # Map question response_type to ResponseType name
        type_mapping = {
            'text_short': 'text_short',
            'text_long': 'text_long',
            'numeric_integer': 'numeric_integer',
            'numeric_decimal': 'numeric_decimal',
            'scale_rating': 'scale_rating',
            'choice_single': 'choice_single',
            'choice_multiple': 'choice_multiple',
            'date': 'date',
            'datetime': 'datetime',
            'geopoint': 'geopoint',
            'geoshape': 'geoshape',
            'image': 'image',
            'audio': 'audio',
            'video': 'video',
            'file': 'file',
            'signature': 'signature',
            'barcode': 'barcode',
            # Legacy mappings
            'numeric': 'numeric_integer',
            'text': 'text_short',
            'choice': 'choice_multiple',
            'scale': 'scale_rating',
            'location': 'geopoint',
        }
        
        response_type_name = type_mapping.get(self.response_type, 'text_short')
        try:
            return ResponseType.objects.get(name=response_type_name)
        except ResponseType.DoesNotExist:
            # Fallback to default
            return ResponseType.objects.get(name='text_short')
    
    def validate_response_value(self, response_value):
        """Validate a response value against this question's rules"""
        if not response_value and self.is_required:
            return False, "This question is required"
        
        if not response_value:
            return True, None  # Empty response is valid for non-required questions
        
        # Type-specific validation
        if self.response_type in ['choice_single', 'choice_multiple', 'choice']:
            if not self.options:
                return False, "Question has no options defined"
            
            if self.response_type == 'choice_single':
                if response_value not in self.options:
                    return False, f"'{response_value}' is not a valid option"
            else:  # multiple choice
                if isinstance(response_value, str):
                    choices = [c.strip() for c in response_value.split(',')]
                elif isinstance(response_value, list):
                    choices = response_value
                else:
                    choices = [str(response_value)]
                
                for choice in choices:
                    if choice not in self.options:
                        return False, f"'{choice}' is not a valid option"
        
        # Numeric validation
        elif self.response_type in ['numeric_integer', 'numeric_decimal', 'scale_rating', 'numeric', 'scale']:
            try:
                value = float(response_value)
                if self.validation_rules:
                    min_val = self.validation_rules.get('min_value')
                    max_val = self.validation_rules.get('max_value')
                    if min_val is not None and value < min_val:
                        return False, f"Value must be at least {min_val}"
                    if max_val is not None and value > max_val:
                        return False, f"Value must be at most {max_val}"
            except (ValueError, TypeError):
                return False, "Value must be a number"
        
        # Text validation
        elif self.response_type in ['text_short', 'text_long', 'text']:
            if self.validation_rules:
                max_length = self.validation_rules.get('max_length')
                if max_length and len(str(response_value)) > max_length:
                    return False, f"Text must be at most {max_length} characters"
        
        return True, None
    
    def get_default_response_data(self):
        """Get default response data structure for this question type"""
        if self.response_type in ['choice_single', 'choice_multiple', 'choice']:
            return {
                'response_value': '',
                'choice_selections': [],
                'structured_data': {'selected_options': []}
            }
        elif self.response_type in ['numeric_integer', 'numeric_decimal', 'scale_rating', 'numeric', 'scale']:
            return {
                'response_value': '',
                'numeric_value': None,
                'structured_data': {'numeric_value': None}
            }
        elif self.response_type in ['date', 'datetime']:
            return {
                'response_value': '',
                'datetime_value': None,
                'structured_data': {'datetime_value': None}
            }
        elif self.response_type in ['geopoint', 'geoshape', 'location']:
            return {
                'response_value': '',
                'geo_data': None,
                'structured_data': {'geo_data': None}
            }
        elif self.response_type in ['image', 'audio', 'video', 'file', 'signature']:
            return {
                'response_value': '',
                'media_files': [],
                'structured_data': {'media_files': []}
            }
        else:  # text types
            return {
                'response_value': '',
                'structured_data': {'text_value': ''}
            }
