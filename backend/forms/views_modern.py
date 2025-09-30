from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.db import transaction, models
from django.db.models import Prefetch, Q, Count, Max, F
from django.utils import timezone
from django.core.cache import cache
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Question
from .serializers import QuestionSerializer
from django_core.utils.viewsets import BaseModelViewSet
from django_core.utils.filters import QuestionFilter
import logging

logger = logging.getLogger(__name__)


class ModernQuestionViewSet(BaseModelViewSet):
    """Modern, optimized Question ViewSet with enhanced performance and features"""
    
    serializer_class = QuestionSerializer
    filterset_class = QuestionFilter
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['question_text', 'project__name']
    ordering_fields = ['question_text', 'order_index', 'created_at', 'response_type']
    ordering = ['order_index', 'created_at']
    permission_classes = [permissions.IsAuthenticated]
    
    # Caching configuration
    cache_timeout = 300  # 5 minutes
    
    def get_queryset(self):
        """Optimized queryset with prefetching and user filtering"""
        queryset = Question.objects.select_related('project').prefetch_related('project__members')
        
        # Filter by user access
        user = self.request.user
        if not user.is_superuser:
            queryset = queryset.filter(
                Q(project__created_by=user) | 
                Q(project__members__user=user)
            )
        
        # Filter by project if specified
        project_id = self.request.query_params.get('project_id')
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        
        return queryset.distinct()
    
    def perform_create(self, serializer):
        """Enhanced question creation with validation and auto-ordering"""
        project = serializer.validated_data['project']
        
        # Check user permissions
        if not project.can_user_edit(self.request.user):
            raise ValidationError("You don't have permission to add questions to this project")
        
        # Auto-set order_index if not provided
        if 'order_index' not in serializer.validated_data:
            max_order = Question.objects.filter(project=project).aggregate(
                max_order=Max('order_index')
            )['max_order']
            serializer.validated_data['order_index'] = (max_order or -1) + 1
        
        # Validate response type specific data
        self._validate_response_type_data(serializer.validated_data)
        
        # Save with transaction
        with transaction.atomic():
            question = serializer.save()
            self._clear_project_cache(project.id)
            logger.info(f"Question created: {question.id} for project {project.id}")
    
    def perform_update(self, serializer):
        """Enhanced question update with change tracking"""
        instance = self.get_object()
        old_order = instance.order_index
        
        # Check permissions
        if not instance.project.can_user_edit(self.request.user):
            raise ValidationError("You don't have permission to edit this question")
        
        # Validate response type specific data
        self._validate_response_type_data(serializer.validated_data)
        
        with transaction.atomic():
            # Handle order changes
            new_order = serializer.validated_data.get('order_index', old_order)
            if new_order != old_order:
                instance.move_to_position(new_order)
            
            question = serializer.save()
            self._clear_project_cache(instance.project.id)
            logger.info(f"Question updated: {question.id}")
    
    def perform_destroy(self, instance):
        """Enhanced question deletion with cleanup"""
        project_id = instance.project.id
        
        # Check permissions
        if not instance.project.can_user_edit(self.request.user):
            raise ValidationError("You don't have permission to delete this question")
        
        with transaction.atomic():
            # Reorder remaining questions
            Question.objects.filter(
                project=instance.project,
                order_index__gt=instance.order_index
            ).update(order_index=F('order_index') - 1)
            
            instance.delete()
            self._clear_project_cache(project_id)
            logger.info(f"Question deleted: {instance.id} from project {project_id}")
    
    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """Optimized bulk creation of questions with validation"""
        if not isinstance(request.data, list):
            return Response(
                {'error': 'Expected a list of questions for bulk creation'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(request.data) == 0:
            return Response(
                {'error': 'No questions provided to create'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(request.data) > 100:  # Reasonable limit
            return Response(
                {'error': f'Cannot create more than 100 questions at once. You provided {len(request.data)} questions.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            with transaction.atomic():
                created_questions = []
                
                # Group by project for efficiency
                questions_by_project = {}
                for question_data in request.data:
                    project_id = question_data.get('project')
                    if not project_id:
                        raise ValidationError("Project ID is required for all questions")
                    
                    if project_id not in questions_by_project:
                        questions_by_project[project_id] = []
                    questions_by_project[project_id].append(question_data)
                
                # Process each project's questions
                for project_id, project_questions in questions_by_project.items():
                    try:
                        from projects.models import Project
                        project = Project.objects.get(id=project_id)
                        
                        # Check permissions
                        if not project.can_user_edit(request.user):
                            raise ValidationError(f"No permission to edit project {project_id}")
                        
                        # Clear existing questions if this is a full replacement
                        if request.query_params.get('replace', '').lower() == 'true':
                            Question.objects.filter(project=project).delete()
                        
                        # Create questions using standard bulk_create
                        # First, convert data to Question instances
                        question_objects = []
                        for question_data in project_questions:
                            serializer = self.get_serializer(data=question_data)
                            if serializer.is_valid(raise_exception=True):
                                validated_data = serializer.validated_data.copy()
                                validated_data['project'] = project
                                question_objects.append(Question(**validated_data))
                        
                        questions = Question.objects.bulk_create(question_objects)
                        created_questions.extend(questions)
                        
                        # Clear cache
                        self._clear_project_cache(project_id)
                        
                    except Project.DoesNotExist:
                        raise ValidationError(f"Project {project_id} not found")
                
                # Serialize response with success message
                serializer = self.get_serializer(created_questions, many=True)
                
                response_data = {
                    'questions': serializer.data,
                    'message': f'Successfully created {len(created_questions)} question{"s" if len(created_questions) != 1 else ""}',
                    'count': len(created_questions)
                }
                
                logger.info(f"Bulk created {len(created_questions)} questions")
                return Response(response_data, status=status.HTTP_201_CREATED)
                
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error in bulk_create: {e}")
            return Response(
                {'error': 'Failed to create questions'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def bulk_update_order(self, request):
        """Bulk update question order"""
        question_ids = request.data.get('question_ids', [])
        
        if not isinstance(question_ids, list):
            return Response(
                {'error': 'question_ids must be a list'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            with transaction.atomic():
                # Verify all questions exist and user has permission
                questions = list(self.get_queryset().filter(id__in=question_ids))
                
                if len(questions) != len(question_ids):
                    return Response(
                        {'error': 'Some questions not found or no permission'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Update order
                Question.bulk_update_order(question_ids)
                
                # Clear cache for affected projects
                project_ids = set(q.project_id for q in questions)
                for project_id in project_ids:
                    self._clear_project_cache(project_id)
                
                logger.info(f"Bulk updated order for {len(question_ids)} questions")
                return Response({'message': 'Order updated successfully'})
                
        except Exception as e:
            logger.error(f"Error in bulk_update_order: {e}")
            return Response(
                {'error': 'Failed to update order'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """Duplicate a question"""
        question = self.get_object()
        
        try:
            # Get target project (default to same project)
            target_project_id = request.data.get('target_project', question.project.id)
            
            if target_project_id != question.project.id:
                from projects.models import Project
                target_project = Project.objects.get(id=target_project_id)
                
                if not target_project.can_user_edit(request.user):
                    raise ValidationError("No permission to add questions to target project")
            else:
                target_project = question.project
            
            # Duplicate the question
            new_question = question.duplicate(
                new_project=target_project,
                new_order_index=request.data.get('order_index')
            )
            
            # Clear cache
            self._clear_project_cache(target_project.id)
            if target_project.id != question.project.id:
                self._clear_project_cache(question.project.id)
            
            serializer = self.get_serializer(new_question)
            logger.info(f"Question duplicated: {question.id} -> {new_question.id}")
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error duplicating question: {e}")
            return Response(
                {'error': f'Failed to duplicate question: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['get'])
    def analytics(self, request, pk=None):
        """Get analytics data for a question"""
        question = self.get_object()
        
        # Check cache first
        cache_key = f"question_analytics_{question.id}"
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)
        
        try:
            # Get comprehensive analytics
            analytics_data = {
                'question_summary': question.get_response_summary(),
                'validation_schema': question.get_validation_schema(),
                'response_type_info': {
                    'type': question.response_type,
                    'display_name': question.display_name,
                    'is_choice_type': question.is_choice_type,
                    'is_numeric_type': question.is_numeric_type,
                    'is_media_type': question.is_media_type,
                    'is_location_type': question.is_location_type
                },
                'metadata': {
                    'created_at': question.created_at.isoformat(),
                    'updated_at': question.updated_at.isoformat(),
                    'order_index': question.order_index,
                    'is_required': question.is_required,
                    'priority': question.priority
                }
            }
            
            # Add type-specific analytics
            if question.is_choice_type and question.options:
                # Could add choice distribution analysis here
                analytics_data['choice_distribution'] = {
                    'total_options': len(question.options),
                    'options': question.options
                }
            
            # Cache the results
            cache.set(cache_key, analytics_data, self.cache_timeout)
            
            return Response(analytics_data)
            
        except Exception as e:
            logger.error(f"Error getting question analytics: {e}")
            return Response(
                {'error': 'Failed to get analytics'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def response_types(self, request):
        """Get available response types with metadata"""
        cache_key = "question_response_types"
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)
        
        # Build response types with metadata
        response_types = []
        for value, display_name in Question.RESPONSE_TYPES:
            response_type_info = {
                'value': value,
                'display_name': display_name,
                'category': self._get_response_type_category(value),
                'supports_options': value in ['choice_single', 'choice_multiple'],
                'supports_validation': value in ['numeric_integer', 'numeric_decimal', 'scale_rating', 'text_short', 'text_long'],
                'supports_media': value in ['image', 'audio', 'video', 'file', 'signature'],
                'supports_location': value in ['geopoint', 'geoshape'],
                'default_validation_rules': self._get_default_validation_rules(value)
            }
            response_types.append(response_type_info)
        
        # Cache the results
        cache.set(cache_key, response_types, 3600)  # Cache for 1 hour
        
        return Response(response_types)
    
    @action(detail=False, methods=['post'])
    def validate_questions(self, request):
        """Validate question data without saving"""
        if not isinstance(request.data, list):
            questions_data = [request.data]
        else:
            questions_data = request.data
        
        validation_results = []
        
        for i, question_data in enumerate(questions_data):
            try:
                # Create a temporary instance for validation
                serializer = self.get_serializer(data=question_data)
                
                if serializer.is_valid():
                    # Additional custom validation
                    self._validate_response_type_data(serializer.validated_data)
                    validation_results.append({
                        'index': i,
                        'valid': True,
                        'data': serializer.validated_data
                    })
                else:
                    validation_results.append({
                        'index': i,
                        'valid': False,
                        'errors': serializer.errors
                    })
                    
            except ValidationError as e:
                validation_results.append({
                    'index': i,
                    'valid': False,
                    'errors': {'validation_error': str(e)}
                })
            except Exception as e:
                validation_results.append({
                    'index': i,
                    'valid': False,
                    'errors': {'general_error': str(e)}
                })
        
        # Summary
        valid_count = sum(1 for result in validation_results if result['valid'])
        
        return Response({
            'results': validation_results,
            'summary': {
                'total': len(validation_results),
                'valid': valid_count,
                'invalid': len(validation_results) - valid_count
            }
        })
    
    # Private helper methods
    def _validate_response_type_data(self, validated_data):
        """Validate response type specific data"""
        response_type = validated_data.get('response_type')
        
        if response_type in ['choice_single', 'choice_multiple']:
            options = validated_data.get('options')
            if not options or not isinstance(options, list) or len(options) < 2:
                raise ValidationError("Choice questions must have at least 2 options")
            
            # Check for empty options
            if any(not str(opt).strip() for opt in options):
                raise ValidationError("All options must have text")
        
        elif response_type == 'scale_rating':
            rules = validated_data.get('validation_rules', {})
            min_val = rules.get('min_value', 1)
            max_val = rules.get('max_value', 5)
            
            if not isinstance(min_val, int) or not isinstance(max_val, int):
                raise ValidationError("Scale rating must have integer min and max values")
            
            if min_val >= max_val:
                raise ValidationError("Maximum value must be greater than minimum value")
        
        elif response_type in ['numeric_integer', 'numeric_decimal']:
            rules = validated_data.get('validation_rules', {})
            if 'min_value' in rules and 'max_value' in rules:
                if rules['min_value'] >= rules['max_value']:
                    raise ValidationError("Maximum value must be greater than minimum value")
    
    def _get_response_type_category(self, response_type):
        """Get category for response type"""
        categories = {
            'text_short': 'text',
            'text_long': 'text',
            'numeric_integer': 'numeric',
            'numeric_decimal': 'numeric',
            'scale_rating': 'numeric',
            'choice_single': 'choice',
            'choice_multiple': 'choice',
            'date': 'datetime',
            'datetime': 'datetime',
            'geopoint': 'location',
            'geoshape': 'location',
            'image': 'media',
            'audio': 'media',
            'video': 'media',
            'file': 'media',
            'signature': 'special',
            'barcode': 'special'
        }
        return categories.get(response_type, 'other')
    
    def _get_default_validation_rules(self, response_type):
        """Get default validation rules for response type"""
        defaults = {
            'text_short': {'min_length': 1, 'max_length': 255},
            'text_long': {'min_length': 1, 'max_length': 10000},
            'numeric_integer': {'data_type': 'integer'},
            'numeric_decimal': {'data_type': 'decimal'},
            'scale_rating': {'min_value': 1, 'max_value': 5},
            'date': {'format': 'date'},
            'datetime': {'format': 'datetime'},
            'geopoint': {'requires_gps': True},
            'geoshape': {'requires_gps': True},
            'image': {'max_size_mb': 50, 'accepted_formats': ['jpg', 'jpeg', 'png']},
            'audio': {'max_size_mb': 100, 'accepted_formats': ['mp3', 'wav', 'm4a']},
            'video': {'max_size_mb': 500, 'accepted_formats': ['mp4', 'mov', 'avi']},
            'file': {'max_size_mb': 100},
        }
        return defaults.get(response_type, {})
    
    def _clear_project_cache(self, project_id):
        """Clear project-related cache entries"""
        cache_keys = [
            f"project_questions_{project_id}",
            f"project_analytics_{project_id}",
            f"question_analytics_*"  # Wildcard pattern (would need custom implementation)
        ]
        for key in cache_keys:
            cache.delete(key)


# Maintain backward compatibility
QuestionViewSet = ModernQuestionViewSet