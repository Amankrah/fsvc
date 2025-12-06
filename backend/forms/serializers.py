from rest_framework import serializers
from .models import Question, QuestionBank, DynamicQuestionSession
from projects.serializers import ProjectSerializer


class QuestionBankSerializer(serializers.ModelSerializer):
    """Serializer for QuestionBank model with comprehensive validation and auto-category support"""

    project_details = ProjectSerializer(source='project', read_only=True)
    targeted_respondents_display = serializers.ReadOnlyField(source='get_targeted_respondents_display')
    targeted_commodities_display = serializers.ReadOnlyField(source='get_targeted_commodities_display')
    created_by_user_username = serializers.CharField(source='created_by_user.username', read_only=True)
    can_edit = serializers.SerializerMethodField()
    auto_category_preview = serializers.SerializerMethodField(
        help_text="Preview of category that will be auto-assigned based on targeted respondents"
    )

    class Meta:
        model = QuestionBank
        fields = [
            'id', 'question_text', 'question_category', 'targeted_respondents',
            'targeted_commodities', 'targeted_countries', 'data_source',
            'research_partner_name', 'research_partner_contact', 'work_package',
            'project', 'project_details', 'response_type', 'is_required',
            'allow_multiple', 'options', 'validation_rules', 'priority_score',
            'is_active', 'tags', 'is_owner_question', 'question_sources',
            'created_by_user', 'created_by_user_username', 'is_follow_up', 'conditional_logic',
            'section_header', 'section_preamble',
            'created_at', 'updated_at', 'created_by',
            'targeted_respondents_display', 'targeted_commodities_display',
            'can_edit', 'auto_category_preview'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by_user', 'created_by',
                           'created_by_user_username', 'can_edit', 'auto_category_preview', 'question_category']
    
    def get_can_edit(self, obj):
        """Check if current user can edit this QuestionBank item"""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            return obj.can_user_edit(request.user)
        return False

    def get_auto_category_preview(self, obj):
        """Get the category that would be auto-assigned based on targeted respondents"""
        return obj.auto_set_category_from_respondents()

    def create(self, validated_data):
        """Set created_by_user to current user when creating"""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['created_by_user'] = request.user
            validated_data['created_by'] = str(request.user)
        return super().create(validated_data)
    
    def validate_question_text(self, value):
        """Validate question text"""
        if not value or not value.strip():
            raise serializers.ValidationError("Question text is required.")
        
        if len(value.strip()) < 10:
            raise serializers.ValidationError("Question text must be at least 10 characters.")
        
        if len(value) > 2000:
            raise serializers.ValidationError("Question text cannot exceed 2000 characters.")
        
        return value.strip()
    
    def validate_targeted_respondents(self, value):
        """Validate targeted respondents"""
        if not value or len(value) == 0:
            raise serializers.ValidationError("At least one targeted respondent is required.")
        
        valid_respondents = [choice[0] for choice in QuestionBank.RESPONDENT_CHOICES]
        invalid_respondents = set(value) - set(valid_respondents)
        
        if invalid_respondents:
            raise serializers.ValidationError(
                f"Invalid respondent types: {', '.join(invalid_respondents)}"
            )
        
        return value
    
    def validate_targeted_commodities(self, value):
        """Validate targeted commodities"""
        if value is None:
            return []
        
        valid_commodities = [choice[0] for choice in QuestionBank.COMMODITY_CHOICES]
        invalid_commodities = set(value) - set(valid_commodities)
        
        if invalid_commodities:
            raise serializers.ValidationError(
                f"Invalid commodity types: {', '.join(invalid_commodities)}"
            )
        
        return value
    
    def validate_response_type(self, value):
        """Validate response type"""
        valid_types = [choice[0] for choice in QuestionBank._meta.get_field('response_type').choices]
        if value not in valid_types:
            raise serializers.ValidationError(f"Response type must be one of: {', '.join(valid_types)}")
        return value
    
    def validate_priority_score(self, value):
        """Validate priority score"""
        if value < 1 or value > 10:
            raise serializers.ValidationError("Priority score must be between 1 and 10.")
        return value
    
    def validate_research_partner_contact(self, value):
        """Validate research partner contact email"""
        if value and not value.strip():
            return None
        return value
    
    def validate(self, data):
        """Cross-field validation"""
        response_type = data.get('response_type')
        options = data.get('options')

        # Validate options for choice questions
        choice_types = ['choice_single', 'choice_multiple']
        if response_type in choice_types:
            if not options or len(options) < 2:
                raise serializers.ValidationError("Choice questions must have at least 2 options.")

            # Check for empty or duplicate options
            cleaned_options = []
            for option in options:
                cleaned_option = str(option).strip()
                if not cleaned_option:
                    raise serializers.ValidationError("Options cannot be empty.")
                if cleaned_option in cleaned_options:
                    raise serializers.ValidationError("Options must be unique.")
                cleaned_options.append(cleaned_option)

        elif response_type not in choice_types and options and len(options) > 0:
            raise serializers.ValidationError("Options should only be provided for choice questions.")

        # Note: research_partner_name is now optional for all data sources
        # The model save method will handle defaults

        return data


class QuestionSerializer(serializers.ModelSerializer):
    project_details = ProjectSerializer(source='project', read_only=True)
    question_bank_source_details = QuestionBankSerializer(source='question_bank_source', read_only=True)
    is_dynamically_generated = serializers.ReadOnlyField()
    research_partner_info = serializers.ReadOnlyField(source='get_research_partner_info')
    should_send_response_to_partner = serializers.ReadOnlyField()
    
    class Meta:
        model = Question
        fields = [
            'id', 'project', 'project_details', 'question_bank_source',
            'question_bank_source_details', 'question_text', 'response_type',
            'is_required', 'allow_multiple', 'options', 'validation_rules', 'order_index',
            'created_at', 'sync_status', 'assigned_respondent_type', 'assigned_commodity',
            'assigned_country', 'is_dynamically_generated', 'research_partner_info',
            'should_send_response_to_partner', 'is_owner_question', 'partner_organization',
            'partner_data_storage', 'targeted_respondents', 'question_sources',
            # Research partnership fields (copied from QuestionBank)
            'question_category', 'data_source', 'research_partner_name',
            'research_partner_contact', 'work_package', 'created_by_user',
            # Section/preamble fields
            'section_header', 'section_preamble',
            # Conditional logic fields
            'is_follow_up', 'conditional_logic'
        ]
        read_only_fields = ['id', 'created_at']
        
    def validate_question_text(self, value):
        """Validate question text"""
        if not value or not value.strip():
            raise serializers.ValidationError("Question text is required.")
        
        if len(value.strip()) < 1:
            raise serializers.ValidationError("Question text cannot be empty.")
        
        if len(value) > 1000:
            raise serializers.ValidationError("Question text cannot exceed 1000 characters.")
        
        return value.strip()
    
    def validate_response_type(self, value):
        """Validate response type"""
        valid_types = [choice[0] for choice in Question.RESPONSE_TYPES]
        if value not in valid_types:
            raise serializers.ValidationError(f"Response type must be one of: {', '.join(valid_types)}")
        return value
    
    def validate_options(self, value):
        """Validate options for multiple choice questions"""
        if value is not None and value != []:  # Only validate if options are actually provided
            if not isinstance(value, list):
                raise serializers.ValidationError("Options must be a list.")
            
            if len(value) < 2:
                raise serializers.ValidationError("Multiple choice questions must have at least 2 options.")
            
            if len(value) > 20:
                raise serializers.ValidationError("Multiple choice questions cannot have more than 20 options.")
            
            # Check for empty or duplicate options
            cleaned_options = []
            for option in value:
                if not option or not str(option).strip():
                    raise serializers.ValidationError("Options cannot be empty.")
                cleaned_option = str(option).strip()
                if cleaned_option in cleaned_options:
                    raise serializers.ValidationError("Options must be unique.")
                cleaned_options.append(cleaned_option)
        
        return value
    
    def validate_order_index(self, value):
        """Ensure order_index is unique within the project"""
        project = self.initial_data.get('project')
        if project and value is not None:
            existing_question = Question.objects.filter(
                project=project, 
                order_index=value
            ).exclude(id=self.instance.id if self.instance else None)
            
            if existing_question.exists():
                raise serializers.ValidationError(
                    f"Question with order_index {value} already exists in this project."
                )
        return value
    
    def validate(self, data):
        """Cross-field validation"""
        response_type = data.get('response_type')
        options = data.get('options')
        
        # Check if options are provided for choice questions (both new and legacy types)
        choice_types = ['choice', 'choice_single', 'choice_multiple']
        if response_type in choice_types and (not options or options == []):
            raise serializers.ValidationError("Options are required for choice questions.")
        
        # Check if options are provided for non-choice questions
        if response_type not in choice_types and options and options != []:
            raise serializers.ValidationError("Options should only be provided for choice questions.")
        
        # Check if allow_multiple is set for non-choice questions
        if data.get('allow_multiple', False) and response_type not in choice_types:
            raise serializers.ValidationError("Multiple answers can only be allowed for choice questions.")
        
        return data


class DynamicQuestionSessionSerializer(serializers.ModelSerializer):
    """Serializer for DynamicQuestionSession model"""
    
    project_details = ProjectSerializer(source='project', read_only=True)
    partner_distribution = serializers.ReadOnlyField(source='get_partner_distribution')
    questions_count = serializers.SerializerMethodField()
    
    class Meta:
        model = DynamicQuestionSession
        fields = [
            'id', 'project', 'project_details', 'respondent_type', 'commodity',
            'country', 'categories', 'work_packages', 'questions_generated',
            'questions_from_partners', 'created_by', 'created_at', 'notes',
            'partner_distribution', 'questions_count'
        ]
        read_only_fields = ['id', 'created_at', 'questions_generated', 'questions_from_partners']
    
    def get_questions_count(self, obj):
        """Get count of questions generated in this session"""
        return obj.get_generated_questions().count()
    
    def validate_respondent_type(self, value):
        """Validate respondent type"""
        valid_respondents = [choice[0] for choice in QuestionBank.RESPONDENT_CHOICES]
        if value not in valid_respondents:
            raise serializers.ValidationError(
                f"Invalid respondent type. Must be one of: {', '.join(valid_respondents)}"
            )
        return value
    
    def validate_commodity(self, value):
        """Validate commodity"""
        if value:
            valid_commodities = [choice[0] for choice in QuestionBank.COMMODITY_CHOICES]
            if value not in valid_commodities:
                raise serializers.ValidationError(
                    f"Invalid commodity. Must be one of: {', '.join(valid_commodities)}"
                )
        return value
    
    def validate_categories(self, value):
        """Validate categories"""
        if value:
            valid_categories = [choice[0] for choice in QuestionBank.CATEGORY_CHOICES]
            invalid_categories = set(value) - set(valid_categories)
            if invalid_categories:
                raise serializers.ValidationError(
                    f"Invalid categories: {', '.join(invalid_categories)}"
                )
        return value


class QuestionBankSearchSerializer(serializers.Serializer):
    """Serializer for question bank search parameters"""
    
    respondent_type = serializers.ChoiceField(
        choices=QuestionBank.RESPONDENT_CHOICES,
        required=True,
        help_text="Type of respondent to get questions for"
    )
    commodity = serializers.ChoiceField(
        choices=QuestionBank.COMMODITY_CHOICES,
        required=False,
        allow_null=True,
        help_text="Specific commodity to filter by"
    )
    country = serializers.CharField(
        max_length=100,
        required=False,
        allow_null=True,
        help_text="Specific country to filter by"
    )
    categories = serializers.MultipleChoiceField(
        choices=QuestionBank.CATEGORY_CHOICES,
        required=False,
        allow_empty=True,
        help_text="Question categories to filter by"
    )
    work_packages = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False,
        allow_empty=True,
        help_text="Work packages to filter by"
    )
    data_sources = serializers.MultipleChoiceField(
        choices=QuestionBank.DATA_SOURCE_CHOICES,
        required=False,
        allow_empty=True,
        help_text="Data sources to filter by"
    )
    limit = serializers.IntegerField(
        min_value=1,
        max_value=500,
        required=False,
        help_text="Maximum number of questions to return"
    )
    include_inactive = serializers.BooleanField(
        default=False,
        help_text="Whether to include inactive questions"
    )


class GenerateDynamicQuestionsSerializer(serializers.Serializer):
    """Serializer for dynamic question generation request"""
    
    project = serializers.UUIDField(
        help_text="Project ID to generate questions for"
    )
    respondent_type = serializers.ChoiceField(
        choices=QuestionBank.RESPONDENT_CHOICES,
        help_text="Type of respondent"
    )
    commodity = serializers.ChoiceField(
        choices=QuestionBank.COMMODITY_CHOICES,
        required=False,
        allow_null=True,
        help_text="Specific commodity"
    )
    country = serializers.CharField(
        max_length=100,
        required=False,
        allow_null=True,
        help_text="Specific country"
    )
    categories = serializers.MultipleChoiceField(
        choices=QuestionBank.CATEGORY_CHOICES,
        required=False,
        allow_empty=True,
        help_text="Question categories to include"
    )
    work_packages = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False,
        allow_empty=True,
        help_text="Work packages to include"
    )
    replace_existing = serializers.BooleanField(
        default=False,
        help_text="Whether to replace existing questions or append"
    )
    notes = serializers.CharField(
        max_length=1000,
        required=False,
        allow_blank=True,
        help_text="Optional notes for this generation session"
    )