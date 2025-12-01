"""
API Views for Response Links
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response as DRFResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction

from django.db import models

from .response_links import ResponseLink
from .link_serializers import (
    ResponseLinkSerializer,
    ResponseLinkCreateSerializer,
    ResponseLinkPublicSerializer,
    ResponseLinkQuestionSerializer,
    WebResponseSubmissionSerializer,
)
from .models import Respondent, Response
from forms.models import Question


class ResponseLinkViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing response links
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ResponseLinkSerializer

    def get_queryset(self):
        """Filter links by user's projects"""
        user = self.request.user
        if user.is_superuser:
            return ResponseLink.objects.all()

        # Get projects user has access to
        from projects.models import ProjectMember
        user_projects = ProjectMember.objects.filter(
            user=user
        ).values_list('project_id', flat=True)

        return ResponseLink.objects.filter(
            models.Q(created_by=user) |
            models.Q(project_id__in=user_projects)
        ).distinct()

    def get_serializer_class(self):
        """Use different serializers for different actions"""
        if self.action == 'create':
            return ResponseLinkCreateSerializer
        return ResponseLinkSerializer

    def perform_create(self, serializer):
        """Create link with current user as creator"""
        # The serializer's create() method returns an unsaved instance
        # We set created_by and save it here with validation skipped initially
        link = serializer.save(created_by=self.request.user, skip_validation=True)

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Manually deactivate a link"""
        link = self.get_object()
        link.deactivate()

        return DRFResponse({
            'success': True,
            'message': 'Link deactivated successfully',
            'link': ResponseLinkSerializer(link).data
        })

    @action(detail=True, methods=['post'])
    def extend(self, request, pk=None):
        """Extend link expiration"""
        link = self.get_object()
        days = request.data.get('days', 7)

        try:
            days = int(days)
            if days < 1 or days > 365:
                raise ValueError()
        except (ValueError, TypeError):
            return DRFResponse({
                'success': False,
                'error': 'Days must be between 1 and 365'
            }, status=status.HTTP_400_BAD_REQUEST)

        link.extend_expiration(days=days)

        return DRFResponse({
            'success': True,
            'message': f'Link extended by {days} days',
            'link': ResponseLinkSerializer(link).data
        })

    @action(detail=True, methods=['get'])
    def statistics(self, request, pk=None):
        """Get detailed statistics for a link"""
        link = self.get_object()

        return DRFResponse({
            'success': True,
            'statistics': link.get_statistics()
        })

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get all active links"""
        active_links = self.get_queryset().filter(
            is_active=True,
            expires_at__gt=timezone.now()
        )

        serializer = self.get_serializer(active_links, many=True)
        return DRFResponse({
            'success': True,
            'count': active_links.count(),
            'links': serializer.data
        })

    @action(detail=False, methods=['get'])
    def expired(self, request):
        """Get all expired links"""
        expired_links = ResponseLink.objects.expired().filter(
            created_by=request.user
        )

        serializer = self.get_serializer(expired_links, many=True)
        return DRFResponse({
            'success': True,
            'count': expired_links.count(),
            'links': serializer.data
        })

    @action(detail=False, methods=['post'])
    def cleanup_expired(self, request):
        """Clean up old expired links"""
        days = request.data.get('older_than_days', 30)

        try:
            days = int(days)
        except (ValueError, TypeError):
            return DRFResponse({
                'success': False,
                'error': 'older_than_days must be a valid integer'
            }, status=status.HTTP_400_BAD_REQUEST)

        count = ResponseLink.cleanup_expired_links(older_than_days=days)

        return DRFResponse({
            'success': True,
            'message': f'Cleaned up {count} expired links',
            'deleted_count': count
        })


class PublicResponseLinkViewSet(viewsets.ViewSet):
    """
    Public ViewSet for accessing and submitting to response links (no auth required)
    """
    permission_classes = [permissions.AllowAny]

    def retrieve(self, request, pk=None):
        """
        Get public details about a response link by token
        GET /api/public/links/{token}/
        """
        link = get_object_or_404(ResponseLink, token=pk)

        # Track access
        link.increment_access()

        # Check if valid
        if not link.is_valid:
            return DRFResponse({
                'success': False,
                'error': 'This link has expired or is no longer active',
                'is_valid': False
            }, status=status.HTTP_410_GONE)

        # Return public info
        serializer = ResponseLinkPublicSerializer(link)

        return DRFResponse({
            'success': True,
            'link': serializer.data,
            'is_valid': True
        })

    @action(detail=True, methods=['get'])
    def questions(self, request, pk=None):
        """
        Get questions for a response link
        GET /api/public/links/{token}/questions/
        """
        link = get_object_or_404(ResponseLink, token=pk)

        # Check if valid
        if not link.is_valid:
            return DRFResponse({
                'success': False,
                'error': 'This link has expired or is no longer active'
            }, status=status.HTTP_410_GONE)

        # Get questions
        questions = Question.objects.filter(
            id__in=link.question_set
        ).order_by('order_index')

        # Serialize questions
        serializer = ResponseLinkQuestionSerializer(questions, many=True)

        return DRFResponse({
            'success': True,
            'questions': serializer.data,
            'total_questions': questions.count()
        })

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """
        Submit responses via a link
        POST /api/public/links/{token}/submit/
        """
        link = get_object_or_404(ResponseLink, token=pk)

        # Check if valid
        if not link.is_valid:
            return DRFResponse({
                'success': False,
                'error': 'This link has expired or is no longer active'
            }, status=status.HTTP_410_GONE)

        # Validate submission
        submission_data = {
            'token': pk,
            **request.data
        }
        serializer = WebResponseSubmissionSerializer(data=submission_data)

        if not serializer.is_valid():
            return DRFResponse({
                'success': False,
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        # Process submission
        try:
            with transaction.atomic():
                # Create or get respondent
                respondent_id = f"web_{link.token}_{timezone.now().strftime('%Y%m%d%H%M%S')}"

                respondent = Respondent.objects.create(
                    respondent_id=respondent_id,
                    project=link.project,
                    is_anonymous=True,
                    consent_given=serializer.validated_data.get('consent_given', True),
                    respondent_type=link.respondent_type or None,
                    commodity=link.commodity or None,
                    country=link.country or None,
                    demographics=serializer.validated_data.get('respondent_metadata', {})
                )

                # Submit responses
                responses_data = serializer.validated_data.get('responses', {})
                created_responses = []

                for question_id, response_value in responses_data.items():
                    question = Question.objects.get(id=question_id)

                    response = Response.objects.create(
                        project=link.project,
                        question=question,
                        respondent=respondent,
                        response_value=response_value,
                        response_source='web_link',
                        metadata={'link_token': link.token}
                    )
                    created_responses.append(response)

                # Increment link response count and potentially expire
                link.increment_response()

                return DRFResponse({
                    'success': True,
                    'message': 'Responses submitted successfully!',
                    'respondent_id': respondent.respondent_id,
                    'response_count': len(created_responses),
                    'link_expired': not link.is_valid
                }, status=status.HTTP_201_CREATED)

        except Question.DoesNotExist:
            return DRFResponse({
                'success': False,
                'error': 'Invalid question ID in responses'
            }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return DRFResponse({
                'success': False,
                'error': f'Failed to submit responses: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
