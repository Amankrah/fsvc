from django.db import models
import uuid
from projects.models import Project

# Create your models here.


class QuestionBank(models.Model):
    """
    Central repository for questions that can be dynamically assigned to different projects
    based on targeted respondents, commodities, and other criteria.
    """
    
    # Commodity choices
    COMMODITY_CHOICES = [
        ('cocoa', 'Cocoa'),
        ('maize', 'Maize'),
        ('palm_oil', 'Palm Oil'),
        ('groundnut', 'Groundnut'),
        ('honey', 'Honey'),
    ]
    
    # Targeted respondent choices
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
    
    # Question category choices based on food system value chain
    CATEGORY_CHOICES = [
        ('general', 'General'),  # Catch-all for uncategorized questions
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
    
    # Data source choices for research partners
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
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Core question information
    question_text = models.TextField(help_text="The actual question text")
    question_category = models.CharField(
        max_length=100,
        blank=True,
        default='general',
        help_text="Custom category/label for organizing questions (e.g., 'Production', 'Market Access', etc.)"
    )
    
    # Targeting information
    targeted_respondents = models.JSONField(
        help_text="List of respondent types this question targets",
        default=list
    )
    targeted_commodities = models.JSONField(
        help_text="List of commodities this question applies to",
        default=list
    )
    targeted_countries = models.JSONField(
        help_text="List of countries this question applies to",
        default=list
    )
    
    # Research partnership information (kept for backward compatibility, but simplified)
    data_source = models.CharField(
        max_length=30,
        choices=DATA_SOURCE_CHOICES,
        default='internal',
        help_text="Source/partner who created this question (default: internal)"
    )
    research_partner_name = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text="Name of the specific research partner (optional, not required for import)"
    )
    research_partner_contact = models.EmailField(
        blank=True,
        default='',
        help_text="Contact email for the research partner (optional, not required for import)"
    )
    is_owner_question = models.BooleanField(
        default=True,
        help_text="Whether this question is created by the project owner (default: True)"
    )
    question_sources = models.JSONField(
        default=list,
        blank=True,
        help_text="List of sources (owner and/or partner names) for this question (default: ['owner'])"
    )

    # Work package and project linking (optional field, not required for import)
    work_package = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Work package identifier for this question (optional, not required for import)"
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='question_bank_items',
        help_text="Project this question bank item belongs to - question banks are project-specific"
    )
    
    # Question configuration
    response_type = models.CharField(max_length=20, choices=[
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
    ])
    is_required = models.BooleanField(default=True)
    allow_multiple = models.BooleanField(default=False)
    options = models.JSONField(null=True, blank=True, help_text="For multiple choice questions")
    validation_rules = models.JSONField(null=True, blank=True)
    
    # Metadata (simplified with sensible defaults)
    priority_score = models.IntegerField(
        default=5,
        help_text="Priority for question selection (1-10, higher = more important, default: 5)"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this question is available for dynamic generation"
    )
    tags = models.JSONField(
        default=list,
        blank=True,
        help_text="Additional tags for question organization"
    )

    # Section/Group Information (for preambles and organization)
    section_header = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text="Section/group title - questions with the same section_header are grouped together"
    )
    section_preamble = models.TextField(
        blank=True,
        default='',
        help_text="Introductory text displayed before the first question in this section"
    )

    # Conditional/Follow-up Question Logic
    is_follow_up = models.BooleanField(
        default=False,
        help_text="True if this is a follow-up question template"
    )
    conditional_logic = models.JSONField(
        null=True,
        blank=True,
        help_text="Conditional logic template for questions generated from this QuestionBank"
    )

    # Creator tracking (kept for audit purposes)
    created_by_user = models.ForeignKey(
        'authentication.User',
        on_delete=models.CASCADE,
        related_name='created_question_banks',
        help_text="User who created this QuestionBank item"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.CharField(max_length=200, blank=True)  # Legacy field, kept for backward compatibility
    
    class Meta:
        ordering = ['-priority_score', 'question_category', 'created_at']
        indexes = [
            models.Index(fields=['project', 'question_category']),
            models.Index(fields=['project', 'data_source']),
            models.Index(fields=['project', 'is_active']),
            models.Index(fields=['project', 'priority_score']),
            models.Index(fields=['created_by_user']),
        ]
    
    def __str__(self):
        return f"{self.question_category}: {self.question_text[:50]}..."

    def auto_set_category_from_respondents(self):
        """
        Automatically set question_category based on the primary (first) targeted respondent.
        Uses the same mapping as the import/export functionality.
        """
        from forms.import_export import QuestionImportExport

        if self.targeted_respondents and len(self.targeted_respondents) > 0:
            primary_respondent = self.targeted_respondents[0]
            auto_category = QuestionImportExport.RESPONDENT_TO_CATEGORY_MAPPING.get(
                primary_respondent,
                'general'
            )
            return auto_category
        return 'general'

    def save(self, *args, **kwargs):
        """
        Override save to set default question_sources and category.
        """
        # Set default category if not provided
        if not self.question_category:
            self.question_category = 'general'

        # Set default question_sources if empty
        if not self.question_sources:
            self.question_sources = ['owner']

        super().save(*args, **kwargs)

    def can_user_access(self, user):
        """Check if a user can access this QuestionBank item"""
        if user.is_superuser:
            return True
        # User can access if they can access the project
        return self.project.can_user_access(user)

    def can_user_edit(self, user):
        """Check if a user can edit this QuestionBank item - only project owner and creator can edit"""
        if user.is_superuser:
            return True
        # Only project owner or question creator can edit
        return self.project.created_by == user or self.created_by_user == user
    
    def get_targeted_respondents_display(self):
        """Get human-readable list of targeted respondents"""
        respondent_dict = dict(self.RESPONDENT_CHOICES)
        return [respondent_dict.get(resp, resp) for resp in self.targeted_respondents]
    
    def get_targeted_commodities_display(self):
        """Get human-readable list of targeted commodities"""
        commodity_dict = dict(self.COMMODITY_CHOICES)
        return [commodity_dict.get(comm, comm) for comm in self.targeted_commodities]
    
    def is_applicable_for(self, respondent_type, commodity=None, country=None):
        """Check if this question is applicable for given criteria"""
        if not self.is_active:
            return False
            
        if respondent_type not in self.targeted_respondents:
            return False
            
        if commodity and self.targeted_commodities and commodity not in self.targeted_commodities:
            return False
            
        if country and self.targeted_countries and country not in self.targeted_countries:
            return False
            
        return True
    
    def create_question_instance(self, project, order_index=None):
        """Create a Question instance from this QuestionBank item for a specific project"""
        from django.db.models import Max
        
        # Auto-calculate order_index if not provided
        if order_index is None:
            max_order = Question.objects.filter(project=project).aggregate(
                max_order=Max('order_index')
            )['max_order']
            order_index = (max_order or -1) + 1
        
        return Question.objects.create(
            project=project,
            question_bank_source=self,
            question_text=self.question_text,
            response_type=self.response_type,
            is_required=self.is_required,
            allow_multiple=self.allow_multiple,
            options=self.options,
            validation_rules=self.validation_rules,
            order_index=order_index,
            targeted_respondents=self.targeted_respondents,
            is_owner_question=self.is_owner_question,
            question_sources=self.question_sources,
            # Copy research partnership information
            question_category=self.question_category,
            data_source=self.data_source,
            research_partner_name=self.research_partner_name,
            research_partner_contact=self.research_partner_contact,
            work_package=self.work_package,
            created_by_user=self.created_by_user,
            # Copy section/preamble information
            section_header=self.section_header,
            section_preamble=self.section_preamble,
        )
    
    @classmethod
    def get_accessible_items(cls, user, project=None):
        """Get QuestionBank items accessible to a user"""
        if user.is_superuser:
            if project:
                return cls.objects.filter(project=project)
            return cls.objects.all()

        # User can access question banks from projects they have access to
        from django.db.models import Q

        # Get projects where user is owner or member
        accessible_projects = Project.objects.filter(
            Q(created_by=user) | Q(members__user=user)
        ).distinct()

        queryset = cls.objects.filter(project__in=accessible_projects)

        # If specific project is requested, filter by it
        if project:
            queryset = queryset.filter(project=project)

        return queryset
    
    @classmethod
    def get_questions_for_respondent(cls, respondent_type, project, commodity=None, country=None,
                                   category=None, work_package=None, limit=None, user=None):
        """Get applicable questions for a specific respondent type with optional filters"""
        # Questions must belong to a specific project
        queryset = cls.objects.filter(project=project, is_active=True)

        # Filter by user access if provided
        if user:
            queryset = cls.get_accessible_items(user, project=project).filter(is_active=True)
        
        # Filter by respondent type
        queryset = queryset.filter(targeted_respondents__contains=[respondent_type])
        
        # Optional filters
        if commodity:
            queryset = queryset.filter(
                models.Q(targeted_commodities__contains=[commodity]) |
                models.Q(targeted_commodities=[])  # Questions that apply to all commodities
            )
        
        if country:
            queryset = queryset.filter(
                models.Q(targeted_countries__contains=[country]) |
                models.Q(targeted_countries=[])  # Questions that apply to all countries
            )
        
        if category:
            queryset = queryset.filter(question_category=category)
        
        if work_package:
            queryset = queryset.filter(work_package=work_package)
        
        queryset = queryset.order_by('-priority_score', 'question_category')
        
        if limit:
            queryset = queryset[:limit]
            
        return queryset

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

    # Link to QuestionBank for dynamic generation
    question_bank_source = models.ForeignKey(
        QuestionBank,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='question_instances',
        help_text="Source QuestionBank item if this question was dynamically generated"
    )

    question_text = models.TextField()
    response_type = models.CharField(max_length=20, choices=RESPONSE_TYPES)
    is_required = models.BooleanField(default=True)
    allow_multiple = models.BooleanField(default=False)  # Added to support frontend
    options = models.JSONField(null=True, blank=True)  # For multiple choice questions
    validation_rules = models.JSONField(null=True, blank=True)
    order_index = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    sync_status = models.CharField(max_length=20, default='pending')

    # Research partnership information (copied from QuestionBank for direct access, with sensible defaults)
    question_category = models.CharField(
        max_length=100,
        blank=True,
        default='general',
        help_text="Custom category/label for organizing questions"
    )
    data_source = models.CharField(
        max_length=30,
        choices=QuestionBank.DATA_SOURCE_CHOICES,
        default='internal',
        blank=True,
        help_text="Source/partner who created this question (default: internal)"
    )
    research_partner_name = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text="Name of the specific research partner (optional, not required)"
    )
    research_partner_contact = models.EmailField(
        blank=True,
        default='',
        help_text="Contact email for the research partner (optional, not required)"
    )
    work_package = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Work package identifier for this question (optional, not required)"
    )
    created_by_user = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_questions',
        help_text="User who created/generated this question"
    )

    # Question ownership and partner collaboration (UPDATED FOR MULTI-SOURCE SUPPORT)
    is_owner_question = models.BooleanField(
        default=True,
        help_text="True if this question belongs to the project owner"
    )

    question_sources = models.JSONField(
        default=list,
        help_text="List of sources this question belongs to. Can include 'owner' and/or partner names from project.partner_organizations"
    )

    # DEPRECATED - Keeping for backward compatibility
    partner_organization = models.JSONField(
        null=True,
        blank=True,
        help_text="DEPRECATED: Use question_sources instead. Partner organization information if this is a partner question"
    )
    partner_data_storage = models.CharField(
        max_length=200,
        blank=True,
        help_text="DEPRECATED: Use question_sources instead. Partner's data storage endpoint/location for responses"
    )

    # Targeted respondents for this question
    targeted_respondents = models.JSONField(
        default=list,
        help_text="List of respondent types this question targets"
    )

    # Additional metadata for dynamic questions
    assigned_respondent_type = models.CharField(
        max_length=50,
        blank=True,
        help_text="Respondent type this question was generated for"
    )
    assigned_commodity = models.CharField(
        max_length=50,
        blank=True,
        help_text="Commodity this question was generated for"
    )
    assigned_country = models.CharField(
        max_length=100,
        blank=True,
        help_text="Country this question was generated for"
    )

    # Section/Group Information (for preambles and organization)
    section_header = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text="Section/group title - questions with the same section_header are grouped together"
    )
    section_preamble = models.TextField(
        blank=True,
        default='',
        help_text="Introductory text displayed before the first question in this section"
    )

    # Conditional/Follow-up Question Logic
    is_follow_up = models.BooleanField(
        default=False,
        help_text="True if this question is a follow-up/conditional question"
    )
    conditional_logic = models.JSONField(
        null=True,
        blank=True,
        help_text="""
        Conditional logic for follow-up questions. Format:
        {
            "enabled": true,
            "parent_question_id": "uuid-of-parent-question",
            "show_if": {
                "operator": "equals|contains|greater_than|less_than|in|not_in",
                "value": "expected_value_or_list"
            }
        }
        """
    )

    def get_database_endpoints(self):
        """
        Get list of database endpoints where responses to this question should be sent.
        Returns: List of dicts with 'name', 'endpoint', 'api_key'
        """
        endpoints = []

        # Add owner database endpoint if owner is in question_sources
        if 'owner' in self.question_sources and self.project.owner_database_endpoint:
            endpoints.append({
                'name': 'owner',
                'endpoint': self.project.owner_database_endpoint,
                'api_key': self.project.settings.get('owner_api_key', ''),
            })

        # Add partner database endpoints
        for source in self.question_sources:
            if source != 'owner' and self.project.partner_organizations:
                # Find matching partner
                for partner in self.project.partner_organizations:
                    if partner.get('name') == source:
                        endpoints.append({
                            'name': partner.get('name'),
                            'endpoint': partner.get('database_endpoint', ''),
                            'api_key': partner.get('api_key', ''),
                        })
                        break

        return endpoints

    def should_send_to_owner(self):
        """Check if responses should be sent to owner database"""
        return 'owner' in self.question_sources

    def should_send_to_partners(self):
        """Check if responses should be sent to partner databases"""
        return any(source != 'owner' for source in self.question_sources)

    def get_partner_sources(self):
        """Get list of partner names this question belongs to"""
        return [source for source in self.question_sources if source != 'owner']

    class Meta:
        ordering = ['question_category', 'order_index', 'created_at']
        # Questions are grouped by category, then ordered by order_index
        # Removed unique_together constraint to allow flexible reordering
        # Questions are uniquely identified by their UUID primary key

    def __str__(self):
        return f"{self.question_text[:50]}..."

    def move_to_position(self, new_order_index):
        """
        Move this question to a new position in the order, shifting other questions as needed.

        Args:
            new_order_index (int): The new position for this question

        Returns:
            bool: True if successful, raises exception otherwise
        """
        from django.db import transaction

        if new_order_index < 0:
            raise ValueError("order_index cannot be negative")

        old_order_index = self.order_index

        if old_order_index == new_order_index:
            return True  # No change needed

        with transaction.atomic():
            # Get all questions in the same project ordered by order_index
            questions_in_project = Question.objects.filter(
                project=self.project
            ).exclude(
                id=self.id
            ).order_by('order_index')

            # Moving down (increasing order_index)
            if new_order_index > old_order_index:
                # Shift questions between old and new position up by 1
                questions_to_shift = questions_in_project.filter(
                    order_index__gt=old_order_index,
                    order_index__lte=new_order_index
                )
                for q in questions_to_shift:
                    q.order_index -= 1
                    q.save(update_fields=['order_index'])

            # Moving up (decreasing order_index)
            else:
                # Shift questions between new and old position down by 1
                questions_to_shift = questions_in_project.filter(
                    order_index__gte=new_order_index,
                    order_index__lt=old_order_index
                )
                for q in questions_to_shift:
                    q.order_index += 1
                    q.save(update_fields=['order_index'])

            # Update this question's order_index
            self.order_index = new_order_index
            self.save(update_fields=['order_index'])

        return True
    
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

    def _is_valid_other_response(self, response_value):
        """
        Check if a response value is a valid "Other" option with custom text.

        "Other" options allow respondents to provide custom text.
        Valid formats:
        - "Other: custom text"
        - "Others: custom text"
        - "Other (please specify): custom text"

        Returns True if the response matches an "Other" option in self.options
        and contains custom text after a colon separator.
        """
        if not isinstance(response_value, str) or ':' not in response_value:
            return False

        # Split on first colon to get base option and custom text
        parts = response_value.split(':', 1)
        if len(parts) != 2:
            return False

        base_option = parts[0].strip()
        custom_text = parts[1].strip()

        # Custom text must not be empty
        if not custom_text:
            return False

        # Check if base_option matches any option in self.options (case-insensitive)
        if self.options:
            for option in self.options:
                if option.lower().strip() == base_option.lower():
                    # Verify it's actually an "Other" type option
                    if 'other' in option.lower():
                        return True

        return False

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
                # Check if response is an "Other" option with custom text
                if self._is_valid_other_response(response_value):
                    return True, None

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
                    # Check if choice is an "Other" option with custom text
                    if self._is_valid_other_response(choice):
                        continue

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
    
    def is_dynamically_generated(self):
        """Check if this question was dynamically generated from QuestionBank"""
        return self.question_bank_source is not None
    
    def get_research_partner_info(self):
        """Get research partner information for this question"""
        if self.question_bank_source:
            return {
                'data_source': self.question_bank_source.data_source,
                'partner_name': self.question_bank_source.research_partner_name,
                'partner_contact': self.question_bank_source.research_partner_contact,
                'work_package': self.question_bank_source.work_package,
            }
        return None
    
    def should_send_response_to_partner(self):
        """Check if responses to this question should be sent to research partner"""
        return (self.question_bank_source and 
                self.question_bank_source.data_source != 'internal' and
                self.question_bank_source.research_partner_contact)
    
    @classmethod
    def generate_dynamic_questions_for_project(cls, project, respondent_type,
                                             commodity=None, country=None,
                                             categories=None, work_packages=None, user=None,
                                             use_project_bank_only=True, replace_existing=False):
        """Generate dynamic questions from QuestionBank for a specific project

        Args:
            use_project_bank_only: If True, only use questions from this project's bank.
                                   If False, use all accessible question banks. Default: True
            replace_existing: If True, replace existing questions. If False, check if questions
                            already exist for this combination and return them instead. Default: False
        """
        from django.db.models import Max
        import logging
        logger = logging.getLogger(__name__)

        questions = []

        # Check if questions already exist for this combination (when not replacing)
        if not replace_existing:
            existing_questions = cls.objects.filter(
                project=project,
                assigned_respondent_type=respondent_type,
                assigned_commodity=commodity or '',
                assigned_country=country or ''
            ).order_by('order_index')

            if existing_questions.exists():
                existing_count = existing_questions.count()
                print(f"[QuestionGen] Found {existing_count} existing questions for this combination")
                print(f"[QuestionGen] Returning existing questions instead of creating duplicates")
                logger.info(f"[QuestionGen] Found {existing_count} existing questions for respondent_type='{respondent_type}', commodity='{commodity}', country='{country}'")
                logger.info(f"[QuestionGen] Returning existing questions instead of creating duplicates")
                return list(existing_questions)

        # Get question bank items based on scope preference
        if use_project_bank_only:
            # Get questions ONLY from this specific project's question bank
            all_bank_questions = list(
                QuestionBank.objects.filter(
                    project=project,
                    is_active=True
                )
            )
            logger.info(f"[QuestionGen] Using project-specific question bank only for project '{project.name}'")
        else:
            # Get questions from all accessible question banks
            if user:
                all_bank_questions = list(QuestionBank.get_accessible_items(user).filter(is_active=True))
            else:
                all_bank_questions = list(QuestionBank.objects.filter(is_active=True))
            logger.info(f"[QuestionGen] Using all accessible question banks for user")
        print(f"[QuestionGen] Step 1: Found {len(all_bank_questions)} active QuestionBank items")
        logger.info(f"[QuestionGen] Step 1: Found {len(all_bank_questions)} active QuestionBank items")

        # DEBUG: Show first few questions' targeted_respondents
        for i, q in enumerate(all_bank_questions[:3]):
            print(f"[QuestionGen] Sample Question {i+1}: '{q.question_text[:50]}...' - Targeted: {q.targeted_respondents}")
            logger.info(f"[QuestionGen] Sample Question {i+1}: '{q.question_text[:50]}...' - Targeted: {q.targeted_respondents}")

        # Filter by respondent type
        bank_questions = [
            q for q in all_bank_questions
            if respondent_type in (q.targeted_respondents or [])
        ]
        print(f"[QuestionGen] Step 2: After respondent_type filter ('{respondent_type}'): {len(bank_questions)} questions")
        logger.info(f"[QuestionGen] Step 2: After respondent_type filter ('{respondent_type}'): {len(bank_questions)} questions")
        
        # DEBUG: If no questions, show why
        if len(bank_questions) == 0:
            print(f"[QuestionGen] ❌ No questions found for respondent_type='{respondent_type}'")
            print(f"[QuestionGen] Available respondent types in QuestionBank:")
            all_respondent_types = set()
            for q in all_bank_questions:
                if q.targeted_respondents:
                    all_respondent_types.update(q.targeted_respondents)
            print(f"[QuestionGen] {sorted(all_respondent_types)}")
            logger.warning(f"[QuestionGen] No questions found for respondent_type='{respondent_type}'")
            logger.warning(f"[QuestionGen] Available respondent types in QuestionBank:")
            logger.warning(f"[QuestionGen] {sorted(all_respondent_types)}")

        # Filter by commodity
        if commodity:
            commodities = [c.strip() for c in commodity.split(',')]
            before_count = len(bank_questions)
            bank_questions = [
                q for q in bank_questions
                if not q.targeted_commodities or
                   any(c in (q.targeted_commodities or []) for c in commodities)
            ]
            logger.info(f"[QuestionGen] Step 3: After commodity filter ({commodities}): {len(bank_questions)} questions (was {before_count})")

        # Filter by country
        if country:
            before_count = len(bank_questions)
            bank_questions = [
                q for q in bank_questions
                if not q.targeted_countries or country in (q.targeted_countries or [])
            ]
            logger.info(f"[QuestionGen] Step 4: After country filter ('{country}'): {len(bank_questions)} questions (was {before_count})")

        # Filter by categories if specified
        if categories:
            before_count = len(bank_questions)
            bank_questions = [q for q in bank_questions if q.question_category in categories]
            logger.info(f"[QuestionGen] Step 5: After categories filter ({categories}): {len(bank_questions)} questions (was {before_count})")

        # Filter by work packages if specified
        if work_packages:
            before_count = len(bank_questions)
            bank_questions = [q for q in bank_questions if q.work_package in work_packages]
            logger.info(f"[QuestionGen] Step 6: After work_packages filter ({work_packages}): {len(bank_questions)} questions (was {before_count})")

        # Sort by priority
        bank_questions.sort(key=lambda q: (-q.priority_score, q.question_category))
        logger.info(f"[QuestionGen] Step 7: Sorted {len(bank_questions)} questions by priority")
        
        # Get the maximum order_index to avoid conflicts (more reliable than count)
        max_order = cls.objects.filter(project=project).aggregate(
            max_order=Max('order_index')
        )['max_order']
        current_order = (max_order or -1) + 1
        
        logger.info(f"[QuestionGen] Step 8: Creating questions starting at order_index {current_order}")
        skipped_count = 0
        
        for i, bank_question in enumerate(bank_questions):
            # Check if question already exists with the SAME context (text + respondent + commodity + country)
            # This allows the same question text for different commodities/contexts
            existing = cls.objects.filter(
                project=project,
                question_text=bank_question.question_text,
                assigned_respondent_type=respondent_type,
                assigned_commodity=commodity or '',
                assigned_country=country or ''
            ).first()
            
            if existing:
                # Skip if question already exists with the same context
                skipped_count += 1
                print(f"[QuestionGen] Skipped duplicate question {i+1}: '{bank_question.question_text[:50]}...' (same context)")
                logger.info(f"[QuestionGen] Skipped duplicate question {i+1}: '{bank_question.question_text[:50]}...'")
                continue
            
            # Create question with proper order_index
            question = cls.objects.create(
                project=project,
                question_bank_source=bank_question,
                question_text=bank_question.question_text,
                question_category=bank_question.question_category,  # Copy custom category
                response_type=bank_question.response_type,
                is_required=bank_question.is_required,
                allow_multiple=bank_question.allow_multiple,
                options=bank_question.options,
                validation_rules=bank_question.validation_rules,
                order_index=current_order,
                assigned_respondent_type=respondent_type,
                assigned_commodity=commodity or '',
                assigned_country=country or '',
                targeted_respondents=bank_question.targeted_respondents,
                is_owner_question=bank_question.is_owner_question,
                question_sources=bank_question.question_sources,
                # Copy section/preamble information
                section_header=bank_question.section_header,
                section_preamble=bank_question.section_preamble,
            )
            
            logger.info(f"[QuestionGen] Created question {i+1}: '{bank_question.question_text[:50]}...'")
            questions.append(question)
            current_order += 1
        
        print(f"[QuestionGen] Step 9: FINAL - Created {len(questions)} new questions, skipped {skipped_count} duplicates")
        print("="*60 + "\n")
        logger.info(f"[QuestionGen] Step 9: FINAL - Created {len(questions)} new questions, skipped {skipped_count} duplicates")
        return questions
    
    @classmethod
    def get_questions_by_research_partner(cls, project, partner_type=None):
        """Get questions grouped by research partner for response distribution"""
        questions = cls.objects.filter(
            project=project,
            question_bank_source__isnull=False
        ).select_related('question_bank_source')
        
        if partner_type:
            questions = questions.filter(question_bank_source__data_source=partner_type)
        
        # Group by research partner
        partner_groups = {}
        for question in questions:
            source = question.question_bank_source
            key = f"{source.data_source}_{source.research_partner_name}"
            
            if key not in partner_groups:
                partner_groups[key] = {
                    'partner_info': {
                        'data_source': source.data_source,
                        'partner_name': source.research_partner_name,
                        'partner_contact': source.research_partner_contact,
                        'work_package': source.work_package,
                    },
                    'questions': []
                }
            
            partner_groups[key]['questions'].append(question)
        
        return partner_groups


class DynamicQuestionSession(models.Model):
    """
    Tracks dynamic question generation sessions for projects.
    Helps manage and audit the question generation process.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        Project, 
        on_delete=models.CASCADE, 
        related_name='question_generation_sessions'
    )
    
    # Session parameters
    respondent_type = models.CharField(max_length=50)
    commodity = models.CharField(max_length=50, blank=True)
    country = models.CharField(max_length=100, blank=True)
    categories = models.JSONField(default=list, blank=True)
    work_packages = models.JSONField(default=list, blank=True)
    
    # Generation results
    questions_generated = models.PositiveIntegerField(default=0)
    questions_from_partners = models.JSONField(
        default=dict, 
        help_text="Count of questions from each research partner"
    )
    
    # Session metadata
    created_by = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-created_at']
        
    def __str__(self):
        return f"Dynamic questions for {self.respondent_type} in {self.project} ({self.created_at.strftime('%Y-%m-%d')})"
    
    def get_generated_questions(self):
        """Get all questions generated in this session"""
        return Question.objects.filter(
            project=self.project,
            assigned_respondent_type=self.respondent_type,
            created_at__gte=self.created_at
        ).select_related('question_bank_source')
    
    def get_partner_distribution(self):
        """Get distribution of questions by research partner"""
        questions = self.get_generated_questions()
        distribution = {}
        
        for question in questions:
            if question.question_bank_source:
                source = question.question_bank_source.data_source
                if source not in distribution:
                    distribution[source] = 0
                distribution[source] += 1
        
        return distribution
