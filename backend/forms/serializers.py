from rest_framework import serializers
from .models import Question
from projects.serializers import ProjectSerializer

class QuestionSerializer(serializers.ModelSerializer):
    project_details = ProjectSerializer(source='project', read_only=True)
    
    class Meta:
        model = Question
        fields = [
            'id', 'project', 'project_details', 'question_text', 'response_type', 
            'is_required', 'allow_multiple', 'options', 'validation_rules', 'order_index', 
            'created_at', 'sync_status'
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