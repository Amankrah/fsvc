"""
Serializers for Response Links
"""

from rest_framework import serializers
from .response_links import ResponseLink
from django.utils import timezone
from datetime import timedelta


class ResponseLinkSerializer(serializers.ModelSerializer):
    """Main serializer for ResponseLink"""

    share_url = serializers.ReadOnlyField()
    is_valid = serializers.ReadOnlyField()
    is_expired = serializers.ReadOnlyField()
    remaining_responses = serializers.ReadOnlyField()
    statistics = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        model = ResponseLink
        fields = [
            'id',
            'token',
            'project',
            'project_name',
            'created_by',
            'created_by_name',
            'question_set',
            'respondent_type',
            'commodity',
            'country',
            'is_active',
            'max_responses',
            'response_count',
            'expires_at',
            'title',
            'description',
            'custom_metadata',
            'auto_expire_after_use',
            'require_consent',
            'created_at',
            'updated_at',
            'first_accessed_at',
            'last_accessed_at',
            'access_count',
            'share_url',
            'is_valid',
            'is_expired',
            'remaining_responses',
            'statistics',
        ]
        read_only_fields = [
            'id',
            'token',
            'created_by',
            'response_count',
            'created_at',
            'updated_at',
            'first_accessed_at',
            'last_accessed_at',
            'access_count',
        ]

    def get_statistics(self, obj):
        """Get link statistics"""
        return obj.get_statistics()


class ResponseLinkCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new response links"""

    expiration_days = serializers.IntegerField(
        write_only=True,
        default=7,
        min_value=1,
        max_value=365,
        help_text="Number of days until link expires"
    )

    class Meta:
        model = ResponseLink
        fields = [
            'project',
            'question_set',
            'respondent_type',
            'commodity',
            'country',
            'max_responses',
            'title',
            'description',
            'custom_metadata',
            'auto_expire_after_use',
            'require_consent',
            'expiration_days',
        ]

    def create(self, validated_data):
        """Create new response link with auto-generated token"""
        expiration_days = validated_data.pop('expiration_days', 7)
        expires_at = timezone.now() + timedelta(days=expiration_days)

        # Get user from context
        user = self.context['request'].user

        # Use manager's create_link method
        return ResponseLink.objects.create_link(
            created_by=user,
            expires_at=expires_at,
            **validated_data
        )


class ResponseLinkPublicSerializer(serializers.ModelSerializer):
    """Public serializer for viewing link details (no sensitive data)"""

    project_name = serializers.CharField(source='project.name', read_only=True)
    question_count = serializers.SerializerMethodField()

    class Meta:
        model = ResponseLink
        fields = [
            'title',
            'description',
            'project_name',
            'question_count',
            'require_consent',
            'is_valid',
        ]

    def get_question_count(self, obj):
        """Get number of questions in this link"""
        return len(obj.question_set) if obj.question_set else 0


class ResponseLinkQuestionSerializer(serializers.Serializer):
    """Serializer for questions included in a response link"""

    id = serializers.UUIDField()
    question_text = serializers.CharField()
    response_type = serializers.CharField()
    is_required = serializers.BooleanField()
    options = serializers.JSONField(required=False)
    validation_rules = serializers.JSONField(required=False)
    order_index = serializers.IntegerField()
    is_follow_up = serializers.BooleanField()
    conditional_logic = serializers.JSONField(required=False)


class WebResponseSubmissionSerializer(serializers.Serializer):
    """Serializer for submitting responses via web link"""

    token = serializers.CharField(
        help_text="Response link token"
    )

    consent_given = serializers.BooleanField(
        default=True,
        help_text="Whether respondent gave consent"
    )

    responses = serializers.DictField(
        child=serializers.CharField(allow_blank=True),
        help_text="Map of question_id to response_value"
    )

    respondent_metadata = serializers.JSONField(
        required=False,
        default=dict,
        help_text="Optional metadata about the respondent (IP, user agent, etc.)"
    )

    def validate_token(self, value):
        """Validate that token exists and is valid"""
        try:
            link = ResponseLink.objects.get(token=value)
            if not link.is_valid:
                raise serializers.ValidationError(
                    "This link has expired or is no longer active."
                )
            return value
        except ResponseLink.DoesNotExist:
            raise serializers.ValidationError("Invalid link token.")

    def validate(self, data):
        """Cross-field validation"""
        token = data.get('token')
        responses = data.get('responses', {})

        # Get the link
        try:
            link = ResponseLink.objects.get(token=token)
        except ResponseLink.DoesNotExist:
            raise serializers.ValidationError({"token": "Invalid link token."})

        # Validate that required questions are answered
        from forms.models import Question
        questions = Question.objects.filter(
            id__in=link.question_set,
            is_required=True
        )

        unanswered_required = []
        for question in questions:
            if str(question.id) not in responses or not responses[str(question.id)]:
                unanswered_required.append(question.question_text)

        if unanswered_required:
            raise serializers.ValidationError({
                "responses": f"The following required questions must be answered: {', '.join(unanswered_required)}"
            })

        return data
