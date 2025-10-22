from django.db import models
import uuid
from projects.models import Project
from forms.models import Question
from authentication.models import User
import json

# Import ResponseLink model
from .response_links import ResponseLink, ResponseLinkManager

class ResponseType(models.Model):
    """Model to define different types of responses with their characteristics"""
    # Basic identification
    name = models.CharField(max_length=100, unique=True)  # text, numeric, choice, etc.
    display_name = models.CharField(max_length=100)  # Human readable name
    description = models.TextField(blank=True)
    
    # Data characteristics
    data_type = models.CharField(max_length=50, choices=[
        ('text', 'Text'),
        ('numeric', 'Numeric'),
        ('boolean', 'Boolean'),
        ('datetime', 'Date/Time'),
        ('json', 'JSON/Structured'),
        ('file', 'File/Media'),
        ('geospatial', 'Geographic'),
    ])
    
    # Validation and structure
    validation_schema = models.JSONField(default=dict, help_text="JSON schema for validation")
    default_constraints = models.JSONField(default=dict, help_text="Default validation rules")
    
    # Analytics integration
    analytics_category = models.CharField(max_length=50, choices=[
        ('descriptive', 'Descriptive Analytics'),
        ('qualitative', 'Qualitative Analytics'),
        ('inferential', 'Inferential Analytics'),
        ('geospatial', 'Geospatial Analytics'),
        ('temporal', 'Temporal Analytics'),
    ])
    
    # UI and form building
    input_widget = models.CharField(max_length=50, default='text_input')
    supports_options = models.BooleanField(default=False)
    supports_media = models.BooleanField(default=False)
    supports_geolocation = models.BooleanField(default=False)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['display_name']
        
    def __str__(self):
        return self.display_name
    
    @classmethod
    def get_default_types(cls):
        """Create default response types if they don't exist"""
        defaults = [
            {
                'name': 'text_short',
                'display_name': 'Short Text',
                'description': 'Single line text input',
                'data_type': 'text',
                'analytics_category': 'qualitative',
                'input_widget': 'text_input',
                'validation_schema': {'max_length': 255},
                'supports_options': False,
            },
            {
                'name': 'text_long',
                'display_name': 'Long Text',
                'description': 'Multi-line text input',
                'data_type': 'text',
                'analytics_category': 'qualitative',
                'input_widget': 'textarea',
                'validation_schema': {'max_length': 10000},
                'supports_options': False,
            },
            {
                'name': 'numeric_integer',
                'display_name': 'Number (Integer)',
                'description': 'Whole numbers only',
                'data_type': 'numeric',
                'analytics_category': 'descriptive',
                'input_widget': 'number_input',
                'validation_schema': {'type': 'integer'},
                'supports_options': False,
            },
            {
                'name': 'numeric_decimal',
                'display_name': 'Number (Decimal)',
                'description': 'Numbers with decimal places',
                'data_type': 'numeric',
                'analytics_category': 'descriptive',
                'input_widget': 'number_input',
                'validation_schema': {'type': 'number'},
                'supports_options': False,
            },
            {
                'name': 'choice_single',
                'display_name': 'Single Choice',
                'description': 'Select one option from a list',
                'data_type': 'text',
                'analytics_category': 'descriptive',
                'input_widget': 'radio',
                'supports_options': True,
                'validation_schema': {'min_options': 2},
            },
            {
                'name': 'choice_multiple',
                'display_name': 'Multiple Choice',
                'description': 'Select multiple options from a list',
                'data_type': 'json',
                'analytics_category': 'descriptive',
                'input_widget': 'checkbox',
                'supports_options': True,
                'validation_schema': {'min_options': 2},
            },
            {
                'name': 'scale_rating',
                'display_name': 'Rating Scale',
                'description': 'Rate on a numeric scale (e.g., 1-5)',
                'data_type': 'numeric',
                'analytics_category': 'descriptive',
                'input_widget': 'rating',
                'validation_schema': {'min_value': 1, 'max_value': 10},
                'supports_options': False,
            },
            {
                'name': 'date',
                'display_name': 'Date',
                'description': 'Date picker',
                'data_type': 'datetime',
                'analytics_category': 'temporal',
                'input_widget': 'date_picker',
                'validation_schema': {'format': 'date'},
                'supports_options': False,
            },
            {
                'name': 'datetime',
                'display_name': 'Date & Time',
                'description': 'Date and time picker',
                'data_type': 'datetime',
                'analytics_category': 'temporal',
                'input_widget': 'datetime_picker',
                'validation_schema': {'format': 'datetime'},
                'supports_options': False,
            },
            {
                'name': 'geopoint',
                'display_name': 'GPS Location',
                'description': 'Single GPS coordinate',
                'data_type': 'geospatial',
                'analytics_category': 'geospatial',
                'input_widget': 'gps_picker',
                'supports_geolocation': True,
                'validation_schema': {'type': 'point'},
                'supports_options': False,
            },
            {
                'name': 'geoshape',
                'display_name': 'GPS Area',
                'description': 'GPS polygon/area',
                'data_type': 'geospatial',
                'analytics_category': 'geospatial',
                'input_widget': 'area_picker',
                'supports_geolocation': True,
                'validation_schema': {'type': 'polygon'},
                'supports_options': False,
            },
            {
                'name': 'image',
                'display_name': 'Photo/Image',
                'description': 'Take photo or upload image',
                'data_type': 'file',
                'analytics_category': 'qualitative',
                'input_widget': 'image_upload',
                'supports_media': True,
                'validation_schema': {'file_types': ['jpg', 'jpeg', 'png']},
                'supports_options': False,
            },
            {
                'name': 'audio',
                'display_name': 'Audio Recording',
                'description': 'Record or upload audio',
                'data_type': 'file',
                'analytics_category': 'qualitative',
                'input_widget': 'audio_recorder',
                'supports_media': True,
                'validation_schema': {'file_types': ['mp3', 'wav', 'm4a']},
                'supports_options': False,
            },
            {
                'name': 'video',
                'display_name': 'Video Recording',
                'description': 'Record or upload video',
                'data_type': 'file',
                'analytics_category': 'qualitative',
                'input_widget': 'video_recorder',
                'supports_media': True,
                'validation_schema': {'file_types': ['mp4', 'avi', 'mov']},
                'supports_options': False,
            },
            {
                'name': 'file',
                'display_name': 'File Upload',
                'description': 'Upload any file type',
                'data_type': 'file',
                'analytics_category': 'qualitative',
                'input_widget': 'file_upload',
                'supports_media': True,
                'validation_schema': {'max_size_mb': 50},
                'supports_options': False,
            },
            {
                'name': 'signature',
                'display_name': 'Digital Signature',
                'description': 'Capture digital signature',
                'data_type': 'file',
                'analytics_category': 'qualitative',
                'input_widget': 'signature_pad',
                'supports_media': True,
                'validation_schema': {'format': 'signature'},
                'supports_options': False,
            },
            {
                'name': 'barcode',
                'display_name': 'Barcode/QR Code',
                'description': 'Scan barcode or QR code',
                'data_type': 'text',
                'analytics_category': 'descriptive',
                'input_widget': 'barcode_scanner',
                'validation_schema': {'format': 'barcode'},
                'supports_options': False,
            },
        ]
        
        for default in defaults:
            cls.objects.get_or_create(name=default['name'], defaults=default)

def get_default_response_type():
    """Get or create default response type for existing responses"""
    response_type, created = ResponseType.objects.get_or_create(
        name='text_short',
        defaults={
            'display_name': 'Short Text',
            'description': 'Single line text input',
            'data_type': 'text',
            'analytics_category': 'qualitative',
            'input_widget': 'text_input',
            'validation_schema': {'max_length': 255},
            'supports_options': False,
        }
    )
    return response_type.id

class Respondent(models.Model):
    """Model to track individuals who are answering questions"""
    # Respondent type choices (aligned with QuestionBank.RESPONDENT_CHOICES)
    RESPONDENT_CHOICES = [
        ('input_suppliers', 'Input Suppliers'),
        ('farmers', 'Farmers'),
        ('aggregators_lbcs', 'Aggregators/LBCs'),
        ('processors', 'Processors'),
        ('processors_eu', 'Processors EU'),
        ('retailers_food_vendors', 'Retailers/Food Vendors'),
        ('retailers_food_vendors_eu', 'Retailers/Food Vendors EU'),
        ('local_consumers', 'Local Consumers'),
        ('consumers_eu_prolific', 'Consumers EU (Prolific)'),
        ('client_business_eu_prolific', 'Client/Business EU (Prolific)'),
        ('government', 'Government'),
        ('ngos', 'NGOs'),
        ('certification_schemes', 'Certification Schemes'),
        ('coop', 'COOP'),
        ('chief', 'Chief'),
    ]
    
    # Commodity choices (aligned with QuestionBank.COMMODITY_CHOICES)
    COMMODITY_CHOICES = [
        ('cocoa', 'Cocoa'),
        ('maize', 'Maize'),
        ('palm_oil', 'Palm Oil'),
        ('groundnut', 'Groundnut'),
        ('honey', 'Honey'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    respondent_id = models.CharField(max_length=255, unique=True, db_index=True)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='respondents')

    # Project-specific metadata (aligned with question bank)
    respondent_type = models.CharField(
        max_length=50,
        choices=RESPONDENT_CHOICES,
        blank=True,
        null=True,
        help_text="Type of respondent from QuestionBank.RESPONDENT_CHOICES"
    )
    commodity = models.CharField(
        max_length=50,
        choices=COMMODITY_CHOICES,
        blank=True,
        null=True,
        help_text="Commodity from QuestionBank.COMMODITY_CHOICES"
    )
    country = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Country from project's targeted_countries"
    )

    # Optional demographic/metadata fields
    name = models.CharField(max_length=255, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    demographics = models.JSONField(default=dict, blank=True)  # age, gender, etc.

    # Location information
    location_data = models.JSONField(null=True, blank=True)  # GPS coordinates, address

    # Data collection metadata
    created_at = models.DateTimeField(auto_now_add=True)
    last_response_at = models.DateTimeField(null=True, blank=True)
    is_anonymous = models.BooleanField(default=True)
    consent_given = models.BooleanField(default=False)

    # Sync and tracking
    sync_status = models.CharField(max_length=20, default='pending')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_respondents')

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['project']),
            models.Index(fields=['respondent_id']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        display_name = self.name or f"Respondent {self.respondent_id}"
        return f"{display_name} ({self.project.name})"
    
    def get_response_count(self):
        """Get total number of responses by this respondent"""
        return self.responses.count()
    
    def get_completion_rate(self):
        """Get completion rate for this respondent across all project questions"""
        total_questions = self.project.questions.count()
        answered_questions = self.responses.filter(
            response_value__isnull=False
        ).exclude(response_value='').count()
        
        return (answered_questions / total_questions * 100) if total_questions > 0 else 0
    
    def update_last_response(self):
        """Update the last_response_at timestamp"""
        from django.utils import timezone
        self.last_response_at = timezone.now()
        self.save(update_fields=['last_response_at'])
    
    def get_respondent_type_display_name(self):
        """Get human-readable display name for respondent type"""
        respondent_dict = dict(self.RESPONDENT_CHOICES)
        return respondent_dict.get(self.respondent_type, self.respondent_type or 'Unknown')
    
    def get_commodity_display_name(self):
        """Get human-readable display name for commodity"""
        commodity_dict = dict(self.COMMODITY_CHOICES)
        return commodity_dict.get(self.commodity, self.commodity or 'Unknown')
    
    def get_profile_summary(self):
        """Get a summary of respondent profile"""
        return {
            'respondent_id': self.respondent_id,
            'respondent_type': self.get_respondent_type_display_name(),
            'commodity': self.get_commodity_display_name(),
            'country': self.country,
            'name': self.name,
            'total_responses': self.get_response_count(),
            'completion_rate': self.get_completion_rate(),
            'last_response_at': self.last_response_at.isoformat() if self.last_response_at else None,
        }
    
    def get_responses_by_category(self):
        """Get respondent's responses grouped by question category"""
        from django.db.models import Count
        return self.responses.values('question_category').annotate(
            total=Count('response_id')
        ).order_by('question_category')
    
    def get_applicable_question_bank_items(self):
        """Get question bank items applicable to this respondent"""
        from forms.models import QuestionBank
        
        if not self.respondent_type:
            return QuestionBank.objects.none()
        
        return QuestionBank.get_questions_for_respondent(
            respondent_type=self.respondent_type,
            commodity=self.commodity,
            country=self.country
        )

class Response(models.Model):
    """Enhanced Response model with proper response types and question bank alignment"""
    # Question category choices (aligned with QuestionBank.CATEGORY_CHOICES)
    CATEGORY_CHOICES = [
        ('production', 'Production'),
        ('processing', 'Processing'),
        ('distribution', 'Distribution'),
        ('consumption', 'Consumption'),
        ('waste_management', 'Waste Management'),
        ('input_supply', 'Input Supply'),
        ('market_access', 'Market Access'),
        ('quality_standards', 'Quality Standards'),
        ('certification', 'Certification'),
        ('sustainability', 'Sustainability'),
        ('climate_impact', 'Climate Impact'),
        ('social_impact', 'Social Impact'),
        ('economic_impact', 'Economic Impact'),
        ('governance', 'Governance'),
        ('policy', 'Policy'),
        ('technology', 'Technology'),
        ('logistics', 'Logistics'),
        ('finance', 'Finance'),
        ('nutrition', 'Nutrition'),
        ('food_safety', 'Food Safety'),
    ]
    
    # Data source choices (aligned with QuestionBank.DATA_SOURCE_CHOICES)
    DATA_SOURCE_CHOICES = [
        ('internal', 'Internal Research Team'),
        ('partner_university', 'Partner University'),
        ('partner_ngo', 'Partner NGO'),
        ('partner_government', 'Partner Government Agency'),
        ('partner_private', 'Partner Private Organization'),
        ('partner_international', 'Partner International Organization'),
        ('consultant', 'External Consultant'),
        ('collaborative', 'Collaborative Development'),
    ]
    
    # Primary identifiers
    response_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Relationships
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='responses')
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='responses')
    respondent = models.ForeignKey(Respondent, on_delete=models.CASCADE, related_name='responses')
    response_type = models.ForeignKey(ResponseType, on_delete=models.CASCADE, related_name='responses', default=get_default_response_type)

    # Question bank context (copied from question and respondent at response time for historical accuracy)
    question_bank_context = models.JSONField(
        default=dict,
        blank=True,
        help_text="Full context from question bank including: respondent_type, commodity, country, category, data_source, etc."
    )
    
    # Question metadata from QuestionBank (for easier querying and analytics)
    question_category = models.CharField(
        max_length=30,
        choices=CATEGORY_CHOICES,
        blank=True,
        help_text="Category from QuestionBank for value chain analysis"
    )
    question_data_source = models.CharField(
        max_length=30,
        choices=DATA_SOURCE_CHOICES,
        blank=True,
        default='internal',
        help_text="Data source/research partner from QuestionBank"
    )
    research_partner_name = models.CharField(
        max_length=200,
        blank=True,
        help_text="Name of research partner from QuestionBank"
    )
    work_package = models.CharField(
        max_length=100,
        blank=True,
        help_text="Work package identifier from QuestionBank"
    )
    
    # Question ownership information (aligned with Question model)
    is_owner_question = models.BooleanField(
        default=True,
        help_text="Whether this response is for a project owner question"
    )
    question_sources = models.JSONField(
        default=list,
        blank=True,
        help_text="List of sources (owner and/or partner names) for this question"
    )
    
    # Response data - keeping backward compatibility
    response_value = models.TextField(blank=True, null=True)  # For simple responses
    
    # Enhanced structured data storage
    structured_data = models.JSONField(default=dict, help_text="Type-specific structured data")
    choice_selections = models.JSONField(default=list, help_text="Selected choices for multiple choice")
    numeric_value = models.DecimalField(max_digits=20, decimal_places=6, null=True, blank=True)
    datetime_value = models.DateTimeField(null=True, blank=True)
    
    # Media and files
    media_files = models.JSONField(default=list, help_text="List of associated media files")
    
    # Geographic data
    geo_data = models.JSONField(null=True, blank=True, help_text="Geographic coordinates and shapes")
    geo_accuracy = models.FloatField(null=True, blank=True, help_text="GPS accuracy in meters")
    
    # Response metadata
    response_metadata = models.JSONField(default=dict)  # validation, formatting, etc.
    response_format = models.JSONField(default=dict, help_text="Format specifications, units, etc.")
    
    # Collection metadata
    collected_at = models.DateTimeField(auto_now_add=True)
    collected_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='collected_responses')
    
    # Location and device info
    location_data = models.JSONField(null=True, blank=True)  # GPS coordinates, location name
    device_info = models.JSONField(null=True, blank=True)   # device type, OS, app version
    
    # Data quality and validation
    is_validated = models.BooleanField(default=False)
    validation_errors = models.JSONField(null=True, blank=True)
    data_quality_score = models.FloatField(null=True, blank=True)  # 0-100 quality score
    
    # Sync status (legacy - single database)
    sync_status = models.CharField(max_length=20, default='pending')
    synced_at = models.DateTimeField(null=True, blank=True)

    # Multi-database sync tracking
    database_routing_status = models.JSONField(
        default=dict,
        help_text="Tracks submission status for each database endpoint. Format: {'owner': {...}, 'Partner A': {...}}"
    )
    routing_attempts = models.IntegerField(
        default=0,
        help_text="Number of routing attempts made"
    )
    last_routing_attempt = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp of last routing attempt"
    )
    routing_complete = models.BooleanField(
        default=False,
        help_text="True if response has been successfully sent to all target databases"
    )

    class Meta:
        ordering = ['-collected_at']
        indexes = [
            models.Index(fields=['project', 'question']),
            models.Index(fields=['respondent']),
            models.Index(fields=['response_type']),
            models.Index(fields=['collected_by']),
            models.Index(fields=['collected_at']),
            models.Index(fields=['sync_status']),
            models.Index(fields=['question_category']),
            models.Index(fields=['question_data_source']),
            models.Index(fields=['work_package']),
            models.Index(fields=['is_owner_question']),
        ]
        # Ensure one response per question per respondent
        unique_together = ['question', 'respondent']

    def __str__(self):
        return f"Response {self.response_id} to {self.question.question_text[:30]} by {self.respondent.respondent_id}"
    
    def save(self, *args, **kwargs):
        """Override save to update respondent's last_response_at and process data"""
        is_new = self.pk is None

        # Auto-populate response_type from question if not set
        if not self.response_type and self.question:
            self.response_type = self.question.get_expected_response_type()

        # Auto-populate question metadata from QuestionBank source
        if self.question and self.question.question_bank_source:
            bank_source = self.question.question_bank_source
            self.question_category = bank_source.question_category
            self.question_data_source = bank_source.data_source
            self.research_partner_name = bank_source.research_partner_name
            self.work_package = bank_source.work_package
        
        # Auto-populate question ownership from Question model
        if self.question:
            self.is_owner_question = self.question.is_owner_question
            self.question_sources = self.question.question_sources

        # Auto-populate comprehensive question bank context
        if not self.question_bank_context:
            context = {}
            
            # Respondent context
            if self.respondent:
                context.update({
                    'respondent_type': self.respondent.respondent_type,
                    'commodity': self.respondent.commodity,
                    'country': self.respondent.country,
                })
            
            # Question bank context
            if self.question and self.question.question_bank_source:
                bank_source = self.question.question_bank_source
                context.update({
                    'question_category': bank_source.question_category,
                    'data_source': bank_source.data_source,
                    'research_partner_name': bank_source.research_partner_name,
                    'research_partner_contact': bank_source.research_partner_contact,
                    'work_package': bank_source.work_package,
                    'targeted_respondents': bank_source.targeted_respondents,
                    'targeted_commodities': bank_source.targeted_commodities,
                    'targeted_countries': bank_source.targeted_countries,
                    'is_owner_question': bank_source.is_owner_question,
                    'question_sources': bank_source.question_sources,
                    'priority_score': bank_source.priority_score,
                })
            
            # Question assignment context
            if self.question:
                context.update({
                    'assigned_respondent_type': self.question.assigned_respondent_type,
                    'assigned_commodity': self.question.assigned_commodity,
                    'assigned_country': self.question.assigned_country,
                })
            
            self.question_bank_context = context

        # Auto-populate structured fields based on response type
        self._process_response_data()

        super().save(*args, **kwargs)
        if is_new:
            self.respondent.update_last_response()
    
    def _process_response_data(self):
        """Process and structure response data based on response type"""
        if not self.response_type:
            return
            
        # Extract numeric values for numeric types
        if self.response_type.data_type == 'numeric' and self.response_value:
            try:
                self.numeric_value = float(self.response_value)
            except (ValueError, TypeError):
                pass
        
        # Process datetime values
        if self.response_type.data_type == 'datetime' and self.response_value:
            from django.utils.dateparse import parse_datetime, parse_date
            try:
                if 'T' in self.response_value:  # ISO datetime format
                    self.datetime_value = parse_datetime(self.response_value)
                else:  # Date only
                    parsed_date = parse_date(self.response_value)
                    if parsed_date:
                        from django.utils import timezone
                        self.datetime_value = timezone.make_aware(
                            timezone.datetime.combine(parsed_date, timezone.datetime.min.time())
                        )
            except:
                pass
        
        # Process choice selections
        if self.response_type.supports_options and self.response_value:
            if self.response_type.name == 'choice_multiple':
                # Multiple choice - parse JSON or comma-separated
                try:
                    if self.response_value.startswith('['):
                        self.choice_selections = json.loads(self.response_value)
                    else:
                        self.choice_selections = [choice.strip() for choice in self.response_value.split(',')]
                except:
                    self.choice_selections = [self.response_value]
            else:
                # Single choice
                self.choice_selections = [self.response_value]
    
    def get_display_value(self):
        """Get formatted display value based on response type"""
        if self.response_type.data_type == 'numeric' and self.numeric_value is not None:
            return str(self.numeric_value)
        elif self.response_type.data_type == 'datetime' and self.datetime_value:
            return self.datetime_value.strftime('%Y-%m-%d %H:%M')
        elif self.response_type.supports_options and self.choice_selections:
            if len(self.choice_selections) > 1:
                return ', '.join(self.choice_selections)
            else:
                return self.choice_selections[0] if self.choice_selections else ''
        else:
            return self.response_value or ''
    
    def get_location_summary(self):
        """Get a summary of location data if available"""
        if not self.location_data:
            return None
        
        location = self.location_data
        return {
            'latitude': location.get('latitude'),
            'longitude': location.get('longitude'),
            'location_name': location.get('location_name'),
            'accuracy': location.get('accuracy'),
        }
    
    def get_device_summary(self):
        """Get device information summary"""
        if not self.device_info:
            return None
            
        device = self.device_info
        return {
            'platform': device.get('platform'),
            'device_model': device.get('device_model'),
            'os_version': device.get('os_version'),
            'app_version': device.get('app_version'),
        }
    
    def is_complete(self):
        """Check if the response is complete and valid"""
        if self.response_type.data_type == 'numeric':
            return self.numeric_value is not None
        elif self.response_type.data_type == 'datetime':
            return self.datetime_value is not None
        elif self.response_type.supports_options:
            return bool(self.choice_selections)
        else:
            return bool(self.response_value and self.response_value.strip())
    
    def can_user_access(self, user):
        """Check if a user can access this response"""
        return self.project.can_user_access(user)
    
    def validate_response(self):
        """Validate response against question's and response type's validation rules"""
        validation_errors = []
        
        # Use question's validation method if available
        if self.question:
            is_valid, error_message = self.question.validate_response_value(self.response_value)
            if not is_valid:
                validation_errors.append(error_message)
        
        # Additional response type specific validation
        if self.response_type and self.response_type.validation_schema:
            schema = self.response_type.validation_schema
            
            # Numeric validation
            if self.response_type.data_type == 'numeric' and self.numeric_value is not None:
                if 'min_value' in schema and self.numeric_value < schema['min_value']:
                    validation_errors.append(f"Value must be at least {schema['min_value']}")
                if 'max_value' in schema and self.numeric_value > schema['max_value']:
                    validation_errors.append(f"Value must be at most {schema['max_value']}")
            
            # Text length validation
            if self.response_type.data_type == 'text' and self.response_value:
                if 'max_length' in schema and len(self.response_value) > schema['max_length']:
                    validation_errors.append(f"Text must be at most {schema['max_length']} characters")
        
        # Store validation results
        self.validation_errors = validation_errors if validation_errors else None
        self.is_validated = len(validation_errors) == 0
        
        return self.is_validated
    
    def calculate_quality_score(self):
        """Calculate data quality score (0-100)"""
        score = 100.0
        
        # Deduct points for validation errors
        if self.validation_errors:
            score -= len(self.validation_errors) * 20
        
        # Deduct points for incomplete responses
        if not self.is_complete():
            score -= 30
        
        # Deduct points for missing location data (if location question)
        if self.response_type.supports_geolocation and not self.geo_data:
            score -= 10
        
        # Add points for having metadata
        if self.response_metadata:
            score += 5
        
        # Add points for media files if supported
        if self.response_type.supports_media and self.media_files:
            score += 5
        
        # Ensure score is between 0 and 100
        self.data_quality_score = max(0, min(100, score))
        return self.data_quality_score

    def update_routing_status(self, routing_results: dict):
        """
        Update database routing status based on routing results.

        Args:
            routing_results: Dict returned from DatabaseRouter.route_response()
        """
        from django.utils import timezone

        self.routing_attempts += 1
        self.last_routing_attempt = timezone.now()

        # Update status for each endpoint
        for result in routing_results.get('results', []):
            endpoint_name = result.get('endpoint_name', 'unknown')
            self.database_routing_status[endpoint_name] = {
                'success': result.get('success', False),
                'status_code': result.get('status_code'),
                'error': result.get('error'),
                'timestamp': result.get('timestamp'),
                'endpoint_url': result.get('endpoint_url'),
            }

        # Check if routing is complete (all endpoints successful)
        all_successful = all(
            status.get('success', False)
            for status in self.database_routing_status.values()
        )

        if all_successful and self.database_routing_status:
            self.routing_complete = True
            self.sync_status = 'synced'
            self.synced_at = timezone.now()
        else:
            self.routing_complete = False
            self.sync_status = 'partial' if any(
                status.get('success', False)
                for status in self.database_routing_status.values()
            ) else 'failed'

        self.save(update_fields=[
            'database_routing_status',
            'routing_attempts',
            'last_routing_attempt',
            'routing_complete',
            'sync_status',
            'synced_at'
        ])

    def get_routing_summary(self) -> dict:
        """
        Get a summary of database routing status.

        Returns:
            Dict with routing summary information
        """
        if not self.database_routing_status:
            return {
                'total_endpoints': 0,
                'successful': 0,
                'failed': 0,
                'pending': 0,
                'complete': False,
                'attempts': self.routing_attempts
            }

        successful = sum(
            1 for status in self.database_routing_status.values()
            if status.get('success', False)
        )
        failed = len(self.database_routing_status) - successful

        return {
            'total_endpoints': len(self.database_routing_status),
            'successful': successful,
            'failed': failed,
            'pending': 0,
            'complete': self.routing_complete,
            'attempts': self.routing_attempts,
            'last_attempt': self.last_routing_attempt.isoformat() if self.last_routing_attempt else None,
            'details': self.database_routing_status
        }

    def get_failed_endpoints(self) -> list:
        """
        Get list of endpoint names that failed to receive the response.

        Returns:
            List of endpoint names
        """
        return [
            name for name, status in self.database_routing_status.items()
            if not status.get('success', False)
        ]

    def needs_retry(self, max_attempts: int = 3) -> bool:
        """
        Check if response routing should be retried.

        Args:
            max_attempts: Maximum number of retry attempts

        Returns:
            True if retry is needed
        """
        return (
            not self.routing_complete and
            self.routing_attempts < max_attempts and
            len(self.get_failed_endpoints()) > 0
        )
    
    def get_question_bank_summary(self):
        """Get a summary of question bank context for this response"""
        return {
            'question_category': self.question_category,
            'data_source': self.question_data_source,
            'research_partner': self.research_partner_name,
            'work_package': self.work_package,
            'is_owner_question': self.is_owner_question,
            'question_sources': self.question_sources,
            'respondent_type': self.question_bank_context.get('respondent_type'),
            'commodity': self.question_bank_context.get('commodity'),
            'country': self.question_bank_context.get('country'),
        }
    
    def is_from_question_bank(self):
        """Check if this response is from a question bank generated question"""
        return self.question.question_bank_source is not None if self.question else False
    
    def get_value_chain_position(self):
        """Get the value chain position from question category"""
        value_chain_mapping = {
            'input_supply': 'upstream',
            'production': 'upstream',
            'processing': 'midstream',
            'distribution': 'midstream',
            'logistics': 'midstream',
            'market_access': 'midstream',
            'consumption': 'downstream',
            'waste_management': 'downstream',
        }
        return value_chain_mapping.get(self.question_category, 'cross_cutting')
    
    def should_route_to_partner(self):
        """Check if this response should be routed to research partner"""
        return (
            self.question_data_source != 'internal' and
            self.research_partner_name and
            len(self.question_sources) > 0
        )
    
    def get_partner_endpoints(self):
        """Get list of partner endpoints this response should be sent to"""
        if not self.question:
            return []
        return self.question.get_database_endpoints()
    
    @classmethod
    def get_responses_by_category(cls, project, category=None):
        """Get responses grouped by question category"""
        queryset = cls.objects.filter(project=project)
        if category:
            queryset = queryset.filter(question_category=category)
        return queryset.select_related('question', 'respondent', 'response_type')
    
    @classmethod
    def get_responses_by_data_source(cls, project, data_source=None):
        """Get responses grouped by data source/research partner"""
        queryset = cls.objects.filter(project=project)
        if data_source:
            queryset = queryset.filter(question_data_source=data_source)
        return queryset.select_related('question', 'respondent', 'response_type')
    
    @classmethod
    def get_responses_by_work_package(cls, project, work_package=None):
        """Get responses grouped by work package"""
        queryset = cls.objects.filter(project=project)
        if work_package:
            queryset = queryset.filter(work_package=work_package)
        return queryset.select_related('question', 'respondent', 'response_type')
    
    @classmethod
    def get_analytics_summary(cls, project, group_by='category'):
        """
        Get analytics summary of responses grouped by various dimensions
        
        Args:
            project: The project to analyze
            group_by: Grouping dimension - 'category', 'data_source', 'work_package', 'respondent_type'
        """
        from django.db.models import Count, Q
        
        queryset = cls.objects.filter(project=project)
        
        if group_by == 'category':
            return queryset.values('question_category').annotate(
                total_responses=Count('response_id'),
                owner_responses=Count('response_id', filter=Q(is_owner_question=True)),
                partner_responses=Count('response_id', filter=Q(is_owner_question=False)),
            ).order_by('question_category')
        
        elif group_by == 'data_source':
            return queryset.values('question_data_source', 'research_partner_name').annotate(
                total_responses=Count('response_id')
            ).order_by('question_data_source')
        
        elif group_by == 'work_package':
            return queryset.values('work_package').annotate(
                total_responses=Count('response_id')
            ).order_by('work_package')
        
        elif group_by == 'respondent_type':
            # Extract respondent_type from question_bank_context
            responses = queryset.all()
            summary = {}
            for response in responses:
                resp_type = response.question_bank_context.get('respondent_type', 'unknown')
                if resp_type not in summary:
                    summary[resp_type] = {
                        'respondent_type': resp_type,
                        'total_responses': 0,
                        'categories': set(),
                    }
                summary[resp_type]['total_responses'] += 1
                if response.question_category:
                    summary[resp_type]['categories'].add(response.question_category)
            
            # Convert sets to lists for JSON serialization
            for key in summary:
                summary[key]['categories'] = list(summary[key]['categories'])
            
            return list(summary.values())
        
        return []
