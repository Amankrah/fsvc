from rest_framework import serializers
from .models import Response, Respondent
from projects.serializers import ProjectSerializer
from forms.serializers import QuestionSerializer
from authentication.serializers import UserSerializer
from .database_router import get_database_router
import logging

logger = logging.getLogger(__name__)

class RespondentSerializer(serializers.ModelSerializer):
    """Serializer for the Respondent model aligned with QuestionBank"""
    project_details = ProjectSerializer(source='project', read_only=True)
    created_by_details = UserSerializer(source='created_by', read_only=True)
    response_count = serializers.SerializerMethodField()
    completion_rate = serializers.SerializerMethodField()
    respondent_type_display = serializers.SerializerMethodField()
    commodity_display = serializers.SerializerMethodField()
    profile_summary = serializers.SerializerMethodField()
    
    class Meta:
        model = Respondent
        fields = [
            'id', 'respondent_id', 'project', 'project_details', 'name', 'email', 'phone',
            'respondent_type', 'respondent_type_display', 'commodity', 'commodity_display', 'country',
            'demographics', 'location_data', 'created_at', 'last_response_at',
            'is_anonymous', 'consent_given', 'sync_status', 'completion_status', 'draft_name',
            'created_by', 'created_by_details',
            'response_count', 'completion_rate', 'profile_summary'
        ]
        read_only_fields = ['id', 'created_at', 'last_response_at', 'response_count', 'completion_rate',
                           'respondent_type_display', 'commodity_display', 'profile_summary']
    
    def get_response_count(self, obj):
        """Get the total number of responses by this respondent"""
        return obj.get_response_count()
    
    def get_completion_rate(self, obj):
        """Get the completion rate for this respondent"""
        return obj.get_completion_rate()
    
    def get_respondent_type_display(self, obj):
        """Get human-readable display name for respondent type"""
        return obj.get_respondent_type_display_name()
    
    def get_commodity_display(self, obj):
        """Get human-readable display name for commodity"""
        return obj.get_commodity_display_name()
    
    def get_profile_summary(self, obj):
        """Get profile summary for this respondent"""
        return obj.get_profile_summary()
    
    def validate_respondent_id(self, value):
        """Validate respondent_id uniqueness"""
        if not value or not value.strip():
            raise serializers.ValidationError("Respondent ID is required.")
        
        # Check uniqueness excluding current instance
        existing = Respondent.objects.filter(respondent_id=value.strip())
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        
        if existing.exists():
            raise serializers.ValidationError("Respondent ID must be unique.")
        
        return value.strip()
    
    def validate_email(self, value):
        """Validate email format if provided"""
        if value and not value.strip():
            return None
        return value

class ResponseSerializer(serializers.ModelSerializer):
    """Updated serializer for the restructured Response model with QuestionBank alignment"""
    project_details = ProjectSerializer(source='project', read_only=True)
    question_details = QuestionSerializer(source='question', read_only=True)
    respondent_details = RespondentSerializer(source='respondent', read_only=True)
    collected_by_details = UserSerializer(source='collected_by', read_only=True)
    location_summary = serializers.SerializerMethodField()
    device_summary = serializers.SerializerMethodField()
    is_complete = serializers.SerializerMethodField()
    routing_summary = serializers.SerializerMethodField()
    question_bank_summary = serializers.SerializerMethodField()
    is_from_question_bank = serializers.SerializerMethodField()
    value_chain_position = serializers.SerializerMethodField()
    
    class Meta:
        model = Response
        fields = [
            'response_id', 'project', 'project_details', 'question', 'question_details',
            'respondent', 'respondent_details', 'response_value', 'response_metadata',
            'question_bank_context', 'question_category', 'question_data_source',
            'research_partner_name', 'work_package', 'is_owner_question', 'question_sources',
            'collected_at', 'collected_by', 'collected_by_details', 'location_data',
            'device_info', 'is_validated', 'validation_errors', 'data_quality_score',
            'sync_status', 'synced_at', 'location_summary', 'device_summary', 'is_complete',
            'database_routing_status', 'routing_attempts', 'routing_complete', 'routing_summary',
            'question_bank_summary', 'is_from_question_bank', 'value_chain_position'
        ]
        read_only_fields = ['response_id', 'collected_at', 'synced_at', 'is_validated',
                           'validation_errors', 'data_quality_score', 'location_summary',
                           'device_summary', 'is_complete', 'question_bank_context',
                           'question_category', 'question_data_source', 'research_partner_name',
                           'work_package', 'is_owner_question', 'question_sources',
                           'database_routing_status', 'routing_attempts', 'routing_complete',
                           'routing_summary', 'question_bank_summary', 'is_from_question_bank',
                           'value_chain_position']
    
    def get_location_summary(self, obj):
        """Get location data summary"""
        return obj.get_location_summary()
    
    def get_device_summary(self, obj):
        """Get device information summary"""
        return obj.get_device_summary()
    
    def get_is_complete(self, obj):
        """Check if response is complete"""
        return obj.is_complete()

    def get_routing_summary(self, obj):
        """Get database routing summary"""
        return obj.get_routing_summary()
    
    def get_question_bank_summary(self, obj):
        """Get question bank context summary"""
        return obj.get_question_bank_summary()
    
    def get_is_from_question_bank(self, obj):
        """Check if response is from question bank generated question"""
        return obj.is_from_question_bank()
    
    def get_value_chain_position(self, obj):
        """Get value chain position for this response"""
        return obj.get_value_chain_position()
    
    def validate(self, attrs):
        """Validate that question belongs to the specified project and respondent belongs to same project"""
        project = attrs.get('project')
        question = attrs.get('question')
        respondent = attrs.get('respondent')
        
        if project and question and question.project != project:
            raise serializers.ValidationError(
                "Question must belong to the specified project."
            )
        
        if project and respondent and respondent.project != project:
            raise serializers.ValidationError(
                "Respondent must belong to the specified project."
            )
        
        return attrs
    
    def validate_response_value(self, value):
        """Basic validation for response value"""
        if value is None:
            return value

        # Convert to string and validate length
        str_value = str(value).strip()

        # Check if it's a base64 image (data URI)
        is_image = str_value.startswith('data:image/')

        # Allow larger values for images (up to 5MB base64 encoded)
        # Base64 encoding increases size by ~33%, so 5MB binary = ~6.7MB base64
        max_length = 7000000 if is_image else 10000

        if len(str_value) > max_length:
            if is_image:
                raise serializers.ValidationError(
                    "Image size too large. Please use a smaller image or reduce quality."
                )
            else:
                raise serializers.ValidationError(
                    "Response value cannot exceed 10,000 characters."
                )

        return str_value
    
    def create(self, validated_data):
        """Override create to perform validation, quality scoring, and database routing"""
        response = super().create(validated_data)

        # Validate the response against question rules
        response.validate_response()

        # Calculate quality score
        response.calculate_quality_score()

        # Save the validation results and quality score
        response.save(update_fields=['is_validated', 'validation_errors', 'data_quality_score'])

        # Route response to all target databases based on question sources
        try:
            router = get_database_router()
            routing_results = router.route_response(response)

            # Update routing status
            response.update_routing_status(routing_results)

            logger.info(
                f"Response {response.response_id} routed to {routing_results.get('total_endpoints', 0)} endpoints. "
                f"Successful: {routing_results.get('successful_submissions', 0)}, "
                f"Failed: {routing_results.get('failed_submissions', 0)}"
            )
        except Exception as e:
            logger.exception(
                f"Error routing response {response.response_id} to databases: {str(e)}"
            )
            # Don't fail the response creation if routing fails
            # The response is saved locally and routing can be retried

        return response
    
    def update(self, instance, validated_data):
        """Override update to re-validate and recalculate quality score"""
        response = super().update(instance, validated_data)
        
        # Re-validate the response
        response.validate_response()
        
        # Recalculate quality score
        response.calculate_quality_score()
        
        # Save the validation results and quality score
        response.save(update_fields=['is_validated', 'validation_errors', 'data_quality_score'])
        
        return response 