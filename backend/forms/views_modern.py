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

from .models import Question, QuestionBank, DynamicQuestionSession
from .serializers import (
    QuestionSerializer, QuestionBankSerializer, DynamicQuestionSessionSerializer,
    QuestionBankSearchSerializer, GenerateDynamicQuestionsSerializer
)
from .validators import (
    validate_question_order,
    validate_conditional_logic_integrity,
    auto_fix_question_order
)
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

        # Validate follow-up question conditional logic
        if serializer.validated_data.get('is_follow_up') and serializer.validated_data.get('conditional_logic'):
            is_valid, errors = validate_conditional_logic_integrity(serializer.validated_data['conditional_logic'])
            if not is_valid:
                raise ValidationError({'conditional_logic': errors})

            # Verify parent question exists and comes before this question
            parent_id = serializer.validated_data['conditional_logic'].get('parent_question_id')
            if parent_id:
                try:
                    parent = Question.objects.get(id=parent_id, project=project)
                    # Parent must have lower order_index
                    if parent.order_index >= serializer.validated_data['order_index']:
                        raise ValidationError(
                            f"Follow-up question must appear AFTER its parent question. "
                            f"Parent is at position {parent.order_index}, but this question is at {serializer.validated_data['order_index']}. "
                            f"Please use a higher order_index."
                        )
                except Question.DoesNotExist:
                    raise ValidationError(f"Parent question with ID {parent_id} not found in this project")

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

        # Validate follow-up question conditional logic if being updated
        if serializer.validated_data.get('is_follow_up') and serializer.validated_data.get('conditional_logic'):
            is_valid, errors = validate_conditional_logic_integrity(serializer.validated_data['conditional_logic'])
            if not is_valid:
                raise ValidationError({'conditional_logic': errors})

            # Verify parent question exists and ordering is correct
            parent_id = serializer.validated_data['conditional_logic'].get('parent_question_id')
            if parent_id:
                try:
                    parent = Question.objects.get(id=parent_id, project=instance.project)
                    new_order = serializer.validated_data.get('order_index', old_order)
                    # Parent must have lower order_index
                    if parent.order_index >= new_order:
                        raise ValidationError(
                            f"Follow-up question must appear AFTER its parent question. "
                            f"Parent is at position {parent.order_index}, but this question would be at {new_order}. "
                            f"Please use a higher order_index."
                        )
                except Question.DoesNotExist:
                    raise ValidationError(f"Parent question with ID {parent_id} not found in this project")

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
    def bulk_delete(self, request):
        """
        Bulk delete questions with multiple filter options
        
        Options:
        - question_ids: List of question IDs to delete
        - project_id: Delete all questions from a project
        - question_bank_source_id: Delete all questions generated from a specific QuestionBank
        - assigned_respondent_type: Delete all questions for a specific respondent type
        """
        question_ids = request.data.get('question_ids', [])
        project_id = request.data.get('project_id')
        question_bank_source_id = request.data.get('question_bank_source_id')
        assigned_respondent_type = request.data.get('assigned_respondent_type')
        
        if not any([question_ids, project_id, question_bank_source_id, assigned_respondent_type]):
            return Response(
                {'error': 'Must provide at least one filter: question_ids, project_id, question_bank_source_id, or assigned_respondent_type'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            with transaction.atomic():
                queryset = self.get_queryset()
                
                # Apply filters
                if question_ids:
                    queryset = queryset.filter(id__in=question_ids)
                
                if project_id:
                    from projects.models import Project
                    try:
                        project = Project.objects.get(id=project_id)
                        # Check permissions
                        if not project.can_user_edit(request.user):
                            raise ValidationError(f"No permission to delete questions from project {project_id}")
                        queryset = queryset.filter(project_id=project_id)
                    except Project.DoesNotExist:
                        return Response(
                            {'error': f'Project {project_id} not found'},
                            status=status.HTTP_404_NOT_FOUND
                        )
                
                if question_bank_source_id:
                    queryset = queryset.filter(question_bank_source_id=question_bank_source_id)
                
                if assigned_respondent_type:
                    queryset = queryset.filter(assigned_respondent_type=assigned_respondent_type)
                
                # Get count before deletion
                question_count = queryset.count()
                
                if question_count == 0:
                    return Response(
                        {'message': 'No questions found matching the filters', 'deleted_count': 0},
                        status=status.HTTP_200_OK
                    )
                
                # Get unique project IDs for cache clearing
                project_ids = queryset.values_list('project_id', flat=True).distinct()
                
                # Delete questions
                queryset.delete()
                
                # Clear cache for affected projects
                for pid in project_ids:
                    self._clear_project_cache(pid)
                
                logger.info(f"Bulk deleted {question_count} questions by {request.user}")
                
                return Response({
                    'message': f'Successfully deleted {question_count} question{"s" if question_count != 1 else ""}',
                    'deleted_count': question_count
                }, status=status.HTTP_200_OK)
                
        except Exception as e:
            logger.exception("Error in bulk delete")
            return Response(
                {'error': f'Failed to delete questions: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
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
        """
        Bulk update question order by providing a list of question IDs in the desired order.

        Request body:
        {
            "question_ids": ["uuid1", "uuid2", "uuid3", ...],  // Ordered list
            "project_id": "project_uuid"  // Optional, for validation
        }

        OR

        {
            "questions": [
                {"id": "uuid1", "order_index": 0},
                {"id": "uuid2", "order_index": 1},
                ...
            ],
            "project_id": "project_uuid"  // Optional, for validation
        }
        """
        question_ids = request.data.get('question_ids', [])
        questions_data = request.data.get('questions', [])
        project_id = request.data.get('project_id')

        # Support both formats
        if question_ids and not questions_data:
            # Convert question_ids list to questions format with sequential order_index
            questions_data = [
                {'id': qid, 'order_index': idx}
                for idx, qid in enumerate(question_ids)
            ]
        elif not questions_data:
            return Response(
                {'error': 'Either question_ids or questions must be provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not isinstance(questions_data, list) or len(questions_data) == 0:
            return Response(
                {'error': 'questions must be a non-empty list'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            with transaction.atomic():
                # Extract all question IDs
                all_question_ids = [q['id'] for q in questions_data]

                # Verify all questions exist and user has permission
                questions = list(self.get_queryset().filter(id__in=all_question_ids))

                if len(questions) != len(all_question_ids):
                    return Response(
                        {'error': 'Some questions not found or no permission'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Verify all questions belong to the same project
                project_ids = set(str(q.project_id) for q in questions)
                if len(project_ids) > 1:
                    return Response(
                        {'error': 'All questions must belong to the same project'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Optional project_id validation
                if project_id and str(list(project_ids)[0]) != str(project_id):
                    return Response(
                        {'error': 'Questions do not belong to the specified project'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Check user has edit permission for the project
                project = questions[0].project
                if not project.can_user_edit(request.user):
                    raise ValidationError("You don't have permission to reorder questions in this project")

                # Build a map of question_id -> new_order_index
                order_map = {str(q['id']): q['order_index'] for q in questions_data}

                # Sort questions by their new order_index to process in order
                sorted_updates = sorted(questions_data, key=lambda x: x['order_index'])

                # Update each question's order_index
                # We do this in a specific order to avoid conflicts
                for update_data in sorted_updates:
                    question = next(q for q in questions if str(q.id) == str(update_data['id']))
                    new_order = update_data['order_index']

                    if question.order_index != new_order:
                        question.order_index = new_order
                        question.save(update_fields=['order_index'])

                # Normalize order indices to ensure they're sequential and start from 0
                all_questions_in_project = Question.objects.filter(
                    project=project
                ).order_by('order_index')

                for idx, q in enumerate(all_questions_in_project):
                    if q.order_index != idx:
                        q.order_index = idx
                        q.save(update_fields=['order_index'])

                # Validate question order for follow-up questions
                questions_for_validation = []
                for q in all_questions_in_project:
                    questions_for_validation.append({
                        'id': str(q.id),
                        'question_text': q.question_text,
                        'order_index': q.order_index,
                        'is_follow_up': q.is_follow_up,
                        'conditional_logic': q.conditional_logic
                    })

                is_valid, validation_errors = validate_question_order(questions_for_validation)
                if not is_valid:
                    # Rollback transaction and return errors
                    raise ValidationError({
                        'order_validation_errors': validation_errors,
                        'message': 'The new question order violates follow-up question constraints. Parent questions must come before their follow-ups.'
                    })

                # Clear cache for the project
                self._clear_project_cache(str(project.id))

                # Return updated questions in new order
                updated_questions = Question.objects.filter(
                    project=project
                ).order_by('order_index')

                serializer = self.get_serializer(updated_questions, many=True)

                logger.info(f"Bulk updated order for {len(all_question_ids)} questions in project {project.id}")
                return Response({
                    'message': f'Successfully reordered {len(all_question_ids)} questions',
                    'questions': serializer.data
                })

        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error in bulk_update_order: {e}")
            return Response(
                {'error': f'Failed to update order: {str(e)}'},
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
    
    @action(detail=False, methods=['post'])
    def generate_dynamic_questions(self, request):
        """Generate dynamic questions from QuestionBank for a project"""
        serializer = GenerateDynamicQuestionsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Get validated data
            project_id = serializer.validated_data['project']
            respondent_type = serializer.validated_data['respondent_type']
            commodity = serializer.validated_data.get('commodity')
            country = serializer.validated_data.get('country')
            categories = serializer.validated_data.get('categories', [])
            work_packages = serializer.validated_data.get('work_packages', [])
            use_project_bank_only = serializer.validated_data.get('use_project_bank_only', True)
            replace_existing = serializer.validated_data.get('replace_existing', False)
            notes = serializer.validated_data.get('notes', '')
            
            # Get project and check permissions
            from projects.models import Project
            try:
                project = Project.objects.get(id=project_id)
            except Project.DoesNotExist:
                return Response(
                    {'error': 'Project not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Members can generate questions (use question bank), but only owners can add to question bank
            if not project.can_user_access(request.user):
                raise ValidationError("You don't have permission to generate questions for this project")
            
            # DEBUG: Log parameters
            print("\n" + "="*60)
            print("GENERATE DYNAMIC QUESTIONS DEBUG")
            print("="*60)
            print(f"Project: {project.name} ({project_id})")
            print(f"Respondent Type: '{respondent_type}'")
            print(f"Commodity: '{commodity}'")
            print(f"Country: '{country}'")
            print(f"Categories: {categories}")
            print(f"Work Packages: {work_packages}")
            print(f"Use Project Bank Only: {use_project_bank_only}")
            print(f"Replace Existing: {replace_existing}")

            # Check QuestionBank items available
            total_bank_items = QuestionBank.objects.filter(is_active=True).count()
            print(f"Total active QuestionBank items: {total_bank_items}")

            logger.info(f"========== GENERATE DYNAMIC QUESTIONS DEBUG ==========")
            logger.info(f"Project: {project.name} ({project_id})")
            logger.info(f"Respondent Type: {respondent_type}")
            logger.info(f"Commodity: {commodity}")
            logger.info(f"Country: {country}")
            logger.info(f"Categories: {categories}")
            logger.info(f"Work Packages: {work_packages}")
            logger.info(f"Use Project Bank Only: {use_project_bank_only}")
            logger.info(f"Replace Existing: {replace_existing}")
            logger.info(f"Total active QuestionBank items: {total_bank_items}")
            
            with transaction.atomic():
                # Create dynamic question session
                session = DynamicQuestionSession.objects.create(
                    project=project,
                    respondent_type=respondent_type,
                    commodity=commodity or '',
                    country=country or '',
                    categories=categories,
                    work_packages=work_packages,
                    created_by=str(request.user),
                    notes=notes
                )
                
                # Remove existing questions if replace_existing is True
                if replace_existing:
                    existing_questions = Question.objects.filter(project=project)
                    existing_count = existing_questions.count()
                    existing_questions.delete()
                    logger.info(f"Removed {existing_count} existing questions from project {project_id}")
                
                # Generate dynamic questions
                print(f"Calling Question.generate_dynamic_questions_for_project...")
                logger.info(f"Calling Question.generate_dynamic_questions_for_project...")
                generated_questions = Question.generate_dynamic_questions_for_project(
                    project=project,
                    respondent_type=respondent_type,
                    commodity=commodity,
                    country=country,
                    categories=categories,
                    work_packages=work_packages,
                    user=request.user,  # Pass user for access control
                    use_project_bank_only=use_project_bank_only,  # Control question bank scope
                    replace_existing=replace_existing  # Pass replace_existing flag
                )

                # Validate generated questions order (only if new questions were created)
                if generated_questions and replace_existing:
                    questions_for_validation = []
                    for q in generated_questions:
                        questions_for_validation.append({
                            'id': str(q.id),
                            'question_text': q.question_text,
                            'order_index': q.order_index,
                            'is_follow_up': q.is_follow_up,
                            'conditional_logic': q.conditional_logic
                        })

                    is_valid, validation_errors = validate_question_order(questions_for_validation)
                    if not is_valid:
                        logger.warning(f"Generated questions have invalid order: {validation_errors}")
                        # Note: We log but don't fail, as generation should handle ordering correctly

                # Determine if we returned existing questions or created new ones
                returned_existing = (
                    not replace_existing and
                    len(generated_questions) > 0 and
                    all(q.question_bank_source is not None for q in generated_questions[:min(3, len(generated_questions))])
                )

                print(f"✅ {'Returned existing' if returned_existing else 'Generated'} {len(generated_questions)} questions")
                print("="*60 + "\n")
                logger.info(f"{'Returned existing' if returned_existing else 'Generated'} {len(generated_questions)} questions")
                logger.info(f"======================================================")

                # Update session with results
                session.questions_generated = len(generated_questions)

                # Count questions by research partner
                partner_distribution = {}
                for question in generated_questions:
                    if question.question_bank_source:
                        partner = question.question_bank_source.data_source
                        partner_distribution[partner] = partner_distribution.get(partner, 0) + 1

                session.questions_from_partners = partner_distribution
                session.save()

                # Serialize the generated questions
                question_serializer = QuestionSerializer(generated_questions, many=True)
                session_serializer = DynamicQuestionSessionSerializer(session)

                # Clear cache
                self._clear_project_cache(project.id)

                logger.info(
                    f"{'Returned existing' if returned_existing else 'Generated'} {len(generated_questions)} dynamic questions for project {project_id}, "
                    f"respondent: {respondent_type}, commodity: {commodity}"
                )

                return Response({
                    'questions': question_serializer.data,
                    'session': session_serializer.data,
                    'summary': {
                        'questions_generated': len(generated_questions),
                        'partner_distribution': partner_distribution,
                        'respondent_type': respondent_type,
                        'commodity': commodity,
                        'categories': categories,
                        'work_packages': work_packages,
                        'replaced_existing': replace_existing,
                        'returned_existing': returned_existing
                    }
                }, status=status.HTTP_201_CREATED)
                
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error generating dynamic questions: {e}")
            return Response(
                {'error': 'Failed to generate questions'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def preview_dynamic_questions(self, request):
        """Preview questions that would be generated without creating them"""
        serializer = QuestionBankSearchSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Get search parameters
            respondent_type = serializer.validated_data['respondent_type']
            commodity = serializer.validated_data.get('commodity')
            country = serializer.validated_data.get('country')
            categories = serializer.validated_data.get('categories', [])
            work_packages = serializer.validated_data.get('work_packages', [])
            data_sources = serializer.validated_data.get('data_sources', [])
            limit = serializer.validated_data.get('limit')
            
            # Get applicable questions from QuestionBank - filtered by user ownership
            questions = QuestionBank.get_questions_for_respondent(
                respondent_type=respondent_type,
                commodity=commodity,
                country=country,
                limit=limit,
                user=request.user  # Pass user to apply ownership filtering
            )
            
            # Apply additional filters
            if categories:
                questions = questions.filter(question_category__in=categories)
            
            if work_packages:
                questions = questions.filter(work_package__in=work_packages)
            
            if data_sources:
                questions = questions.filter(data_source__in=data_sources)
            
            questions = questions.filter(is_active=True).distinct()
            
            # Serialize results
            result_serializer = QuestionBankSerializer(questions, many=True)
            
            # Calculate preview statistics
            partner_distribution = {}
            category_distribution = {}
            
            for question in questions:
                # Partner distribution
                partner = question.data_source
                partner_distribution[partner] = partner_distribution.get(partner, 0) + 1
                
                # Category distribution
                category = question.question_category
                category_distribution[category] = category_distribution.get(category, 0) + 1
            
            return Response({
                'preview_questions': result_serializer.data,
                'preview_summary': {
                    'total_questions': questions.count(),
                    'partner_distribution': partner_distribution,
                    'category_distribution': category_distribution,
                    'search_parameters': serializer.validated_data
                }
            })
            
        except Exception as e:
            logger.error(f"Error in preview_dynamic_questions: {e}")
            return Response(
                {'error': 'Failed to preview questions'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def get_available_options(self, request):
        """
        Get available respondent types, commodities, and countries
        from the project's QuestionBank items (NOT from project configuration).

        This allows users to generate questions based on what's actually
        in their question bank, not pre-configured settings.
        """
        project_id = request.query_params.get('project_id')
        if not project_id:
            return Response(
                {'error': 'project_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Check project access
            from projects.models import Project
            project = Project.objects.get(id=project_id)
            if not project.can_user_access(request.user):
                raise ValidationError("You don't have permission to access this project")

            # Get all active QuestionBank items for this project
            question_bank_items = QuestionBank.objects.filter(
                project=project,
                is_active=True
            )

            # Extract unique values from QuestionBank items
            available_respondent_types = set()
            available_commodities = set()
            available_countries = set()
            available_categories = set()
            available_work_packages = set()

            for item in question_bank_items:
                # Collect respondent types
                if item.targeted_respondents:
                    available_respondent_types.update(item.targeted_respondents)

                # Collect commodities
                if item.targeted_commodities:
                    available_commodities.update(item.targeted_commodities)

                # Collect countries
                if item.targeted_countries:
                    available_countries.update(item.targeted_countries)

                # Collect categories
                if item.question_category:
                    available_categories.add(item.question_category)

                # Collect work packages
                if item.work_package:
                    available_work_packages.add(item.work_package)

            # Get display names for choices
            respondent_choices = dict(QuestionBank.RESPONDENT_CHOICES)
            commodity_choices = dict(QuestionBank.COMMODITY_CHOICES)
            category_choices = dict(QuestionBank.CATEGORY_CHOICES)

            # Build response with display names
            respondent_types_with_display = [
                {'value': rt, 'display': respondent_choices.get(rt, rt)}
                for rt in sorted(available_respondent_types)
            ]

            commodities_with_display = [
                {'value': c, 'display': commodity_choices.get(c, c)}
                for c in sorted(available_commodities)
            ]

            categories_with_display = [
                {'value': cat, 'display': category_choices.get(cat, cat)}
                for cat in sorted(available_categories)
            ]

            return Response({
                'available_options': {
                    'respondent_types': respondent_types_with_display,
                    'commodities': commodities_with_display,
                    'countries': sorted(list(available_countries)),
                    'categories': categories_with_display,
                    'work_packages': sorted(list(available_work_packages)),
                },
                'summary': {
                    'project_name': project.name,
                    'total_question_bank_items': question_bank_items.count(),
                    'respondent_types_count': len(available_respondent_types),
                    'commodities_count': len(available_commodities),
                    'countries_count': len(available_countries),
                    'categories_count': len(available_categories),
                    'work_packages_count': len(available_work_packages),
                }
            })

        except Project.DoesNotExist:
            return Response(
                {'error': 'Project not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            logger.error(f"Error in get_available_options: {e}")
            return Response(
                {'error': 'Failed to get available options'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def get_partner_distribution(self, request):
        """Get questions grouped by research partner for a project"""
        project_id = request.query_params.get('project_id')
        if not project_id:
            return Response(
                {'error': 'project_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Check project access
            from projects.models import Project
            project = Project.objects.get(id=project_id)
            if not project.can_user_access(request.user):
                raise ValidationError("You don't have permission to access this project")
            
            # Get partner distribution
            partner_groups = Question.get_questions_by_research_partner(project)
            
            # Serialize the data
            response_data = {}
            total_questions = 0
            
            for key, group in partner_groups.items():
                questions_serializer = QuestionSerializer(group['questions'], many=True)
                response_data[key] = {
                    'partner_info': group['partner_info'],
                    'questions': questions_serializer.data,
                    'question_count': len(group['questions'])
                }
                total_questions += len(group['questions'])
            
            return Response({
                'partner_distribution': response_data,
                'summary': {
                    'total_partners': len(partner_groups),
                    'total_questions': total_questions,
                    'project_id': project_id
                }
            })
            
        except Project.DoesNotExist:
            return Response(
                {'error': 'Project not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error getting partner distribution: {e}")
            return Response(
                {'error': 'Failed to get partner distribution'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
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


class QuestionBankViewSet(BaseModelViewSet):
    """ViewSet for managing QuestionBank with search and filtering capabilities"""
    
    serializer_class = QuestionBankSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['question_text', 'research_partner_name', 'work_package']
    ordering_fields = ['question_text', 'question_category', 'priority_score', 'created_at', 'data_source']
    ordering = ['-priority_score', 'question_category', 'created_at']
    permission_classes = [permissions.IsAuthenticated]
    
    # Caching configuration
    cache_timeout = 600  # 10 minutes for question bank
    
    def get_queryset(self):
        """Optimized queryset with user access filtering - users can see QuestionBanks from projects they can access"""
        queryset = QuestionBank.objects.select_related('project', 'created_by_user')

        # Filter by user access to projects (not by owner, as QuestionBanks are project-specific)
        user = self.request.user
        if not user.is_superuser:
            # Get QuestionBank items from accessible projects using the model's method
            queryset = QuestionBank.get_accessible_items(user)

        # Filter by project_id if provided in query params
        project_id = self.request.query_params.get('project_id')
        if project_id:
            queryset = queryset.filter(project_id=project_id)

        # Filter by active status by default
        if self.request.query_params.get('include_inactive', '').lower() != 'true':
            queryset = queryset.filter(is_active=True)

        return queryset.distinct()
    
    def perform_create(self, serializer):
        """Enhanced question bank creation with user tracking"""
        # Set created_by_user and created_by to current user
        serializer.validated_data['created_by_user'] = self.request.user
        serializer.validated_data['created_by'] = str(self.request.user)

        # Only project owner can add to question bank (members can only use existing questions)
        project = serializer.validated_data.get('project')
        if project and not project.can_user_edit(self.request.user):
            raise ValidationError("Only project owners can add questions to the question bank")

        with transaction.atomic():
            question_bank = serializer.save()
            logger.info(f"QuestionBank created: {question_bank.id} by {self.request.user}")
    
    def perform_update(self, serializer):
        """Enhanced question bank update with permission checks"""
        instance = self.get_object()

        # Check if user can edit this question bank item using the model's method
        if not instance.can_user_edit(self.request.user):
            raise ValidationError("You don't have permission to edit this question")

        with transaction.atomic():
            question_bank = serializer.save()
            logger.info(f"QuestionBank updated: {question_bank.id} by {self.request.user}")
    
    def perform_destroy(self, instance):
        """Enhanced question bank deletion with permission checks"""
        # Check if user can edit this question bank item using the model's method
        if not instance.can_user_edit(self.request.user):
            raise ValidationError("You don't have permission to delete this question")

        # Soft delete by setting is_active to False instead of actual deletion
        # to preserve data integrity for generated questions
        instance.is_active = False
        instance.save()

        logger.info(f"QuestionBank soft deleted: {instance.id} by {self.request.user}")
    
    @action(detail=True, methods=['delete'])
    def hard_delete(self, request, pk=None):
        """
        Permanently delete a QuestionBank item and optionally all generated questions.
        
        Query params:
        - delete_generated_questions: If 'true', also deletes all Questions generated from this QuestionBank
        """
        try:
            instance = self.get_object()

            # Check permissions using the model's method
            if not instance.can_user_edit(request.user):
                return Response(
                    {'error': "You don't have permission to delete this QuestionBank item"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            delete_generated = request.query_params.get('delete_generated_questions', '').lower() == 'true'
            
            with transaction.atomic():
                generated_count = 0
                
                if delete_generated:
                    # Delete all questions generated from this QuestionBank
                    generated_questions = Question.objects.filter(question_bank_source=instance)
                    generated_count = generated_questions.count()
                    
                    # Get project IDs for cache clearing
                    project_ids = generated_questions.values_list('project_id', flat=True).distinct()
                    
                    # Delete generated questions
                    generated_questions.delete()
                    
                    # Clear cache for affected projects
                    from forms.views_modern import ModernQuestionViewSet
                    viewset = ModernQuestionViewSet()
                    for project_id in project_ids:
                        viewset._clear_project_cache(project_id)
                
                # Hard delete the QuestionBank item
                question_text = instance.question_text[:50]
                instance.delete()
                
                logger.info(f"QuestionBank hard deleted: {pk} by {request.user}, generated questions deleted: {generated_count}")
                
                return Response({
                    'message': f'QuestionBank "{question_text}..." permanently deleted',
                    'deleted_generated_questions': generated_count
                }, status=status.HTTP_200_OK)
                
        except Exception as e:
            logger.exception("Error in hard delete")
            return Response(
                {'error': f'Failed to delete QuestionBank: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        """
        Bulk delete QuestionBank items with optional hard delete.
        
        Body params:
        - question_bank_ids: List of QuestionBank IDs to delete
        - hard_delete: If true, permanently delete (default: soft delete)
        - delete_generated_questions: If true and hard_delete=true, also delete generated Questions
        """
        question_bank_ids = request.data.get('question_bank_ids', [])
        hard_delete = request.data.get('hard_delete', False)
        delete_generated = request.data.get('delete_generated_questions', False)
        
        if not question_bank_ids:
            return Response(
                {'error': 'Must provide question_bank_ids'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            with transaction.atomic():
                queryset = self.get_queryset().filter(id__in=question_bank_ids)
                
                # Check permissions for all items using the model's method
                for item in queryset:
                    if not item.can_user_edit(request.user):
                        return Response(
                            {'error': f"You don't have permission to delete QuestionBank: {item.question_text[:50]}..."},
                            status=status.HTTP_403_FORBIDDEN
                        )
                
                count = queryset.count()
                generated_count = 0
                
                if count == 0:
                    return Response(
                        {'message': 'No QuestionBank items found', 'deleted_count': 0},
                        status=status.HTTP_200_OK
                    )
                
                if hard_delete:
                    if delete_generated:
                        # Delete all generated questions
                        generated_questions = Question.objects.filter(question_bank_source__in=queryset)
                        generated_count = generated_questions.count()
                        
                        # Get project IDs for cache clearing
                        project_ids = generated_questions.values_list('project_id', flat=True).distinct()
                        
                        # Delete generated questions
                        generated_questions.delete()
                        
                        # Clear cache
                        from forms.views_modern import ModernQuestionViewSet
                        viewset = ModernQuestionViewSet()
                        for project_id in project_ids:
                            viewset._clear_project_cache(project_id)
                    
                    # Hard delete QuestionBank items
                    queryset.delete()
                    message = f'Permanently deleted {count} QuestionBank item{"s" if count != 1 else ""}'
                else:
                    # Soft delete
                    queryset.update(is_active=False)
                    message = f'Soft deleted {count} QuestionBank item{"s" if count != 1 else ""}'
                
                logger.info(f"Bulk deleted {count} QuestionBank items by {request.user}")
                
                return Response({
                    'message': message,
                    'deleted_count': count,
                    'deleted_generated_questions': generated_count
                }, status=status.HTTP_200_OK)
                
        except Exception as e:
            logger.exception("Error in bulk delete")
            return Response(
                {'error': f'Failed to delete QuestionBank items: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def search_for_respondent(self, request):
        """Search question bank for specific respondent type with filters"""
        serializer = QuestionBankSearchSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Get search parameters
            respondent_type = serializer.validated_data['respondent_type']
            commodity = serializer.validated_data.get('commodity')
            country = serializer.validated_data.get('country')
            categories = serializer.validated_data.get('categories', [])
            work_packages = serializer.validated_data.get('work_packages', [])
            data_sources = serializer.validated_data.get('data_sources', [])
            limit = serializer.validated_data.get('limit')
            include_inactive = serializer.validated_data.get('include_inactive', False)
            
            # Use the model's class method to get applicable questions - filtered by user ownership
            questions = QuestionBank.get_questions_for_respondent(
                respondent_type=respondent_type,
                commodity=commodity,
                country=country,
                limit=limit,
                user=request.user  # Pass user to apply ownership filtering
            )
            
            # Apply additional filters
            if categories:
                questions = questions.filter(question_category__in=categories)
            
            if work_packages:
                questions = questions.filter(work_package__in=work_packages)
            
            if data_sources:
                questions = questions.filter(data_source__in=data_sources)
            
            # Apply active filter
            if not include_inactive:
                questions = questions.filter(is_active=True)
            
            # Serialize results
            questions = questions.distinct()
            result_serializer = QuestionBankSerializer(questions, many=True)
            
            return Response({
                'questions': result_serializer.data,
                'count': questions.count(),
                'search_parameters': serializer.validated_data
            })
            
        except Exception as e:
            logger.error(f"Error in search_for_respondent: {e}")
            return Response(
                {'error': 'Failed to search questions'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def get_choices(self, request):
        """Get available choices for question bank fields"""
        cache_key = "question_bank_choices"
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)
        
        choices_data = {
            'respondent_types': [
                {'value': choice[0], 'label': choice[1]}
                for choice in QuestionBank.RESPONDENT_CHOICES
            ],
            'commodities': [
                {'value': choice[0], 'label': choice[1]}
                for choice in QuestionBank.COMMODITY_CHOICES
            ],
            'categories': [
                {'value': choice[0], 'label': choice[1]}
                for choice in QuestionBank.CATEGORY_CHOICES
            ],
            'data_sources': [
                {'value': choice[0], 'label': choice[1]}
                for choice in QuestionBank.DATA_SOURCE_CHOICES
            ]
        }
        
        # Cache for 1 hour
        cache.set(cache_key, choices_data, 3600)
        return Response(choices_data)
    
    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """Duplicate a question bank item"""
        question_bank = self.get_object()
        
        try:
            # Create a copy (question_category will be auto-set from targeted_respondents)
            new_question_bank = QuestionBank.objects.create(
                question_text=f"Copy of {question_bank.question_text}",
                targeted_respondents=question_bank.targeted_respondents.copy(),
                targeted_commodities=question_bank.targeted_commodities.copy(),
                targeted_countries=question_bank.targeted_countries.copy(),
                data_source=question_bank.data_source,
                research_partner_name=question_bank.research_partner_name,
                research_partner_contact=question_bank.research_partner_contact,
                work_package=question_bank.work_package,
                project=question_bank.project,  # Changed from base_project to project
                response_type=question_bank.response_type,
                is_required=question_bank.is_required,
                allow_multiple=question_bank.allow_multiple,
                options=question_bank.options.copy() if question_bank.options else None,
                validation_rules=question_bank.validation_rules.copy() if question_bank.validation_rules else None,
                priority_score=question_bank.priority_score,
                tags=question_bank.tags.copy(),
                created_by=str(request.user),
                created_by_user=request.user  # Added required field
            )
            
            serializer = QuestionBankSerializer(new_question_bank)
            logger.info(f"QuestionBank duplicated: {question_bank.id} -> {new_question_bank.id}")
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error duplicating question bank: {e}")
            return Response(
                {'error': f'Failed to duplicate question: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def download_csv_template(self, request):
        """Download CSV template for importing questions"""
        from .import_export import QuestionImportExport
        return QuestionImportExport.generate_csv_template()

    @action(detail=False, methods=['get'])
    def download_excel_template(self, request):
        """Download Excel template for importing questions"""
        from .import_export import QuestionImportExport
        return QuestionImportExport.generate_excel_template()

    @action(detail=False, methods=['post'])
    def import_questions(self, request):
        """Import questions from CSV or Excel file"""
        from .import_export import QuestionImportExport

        if 'file' not in request.FILES:
            return Response(
                {'error': 'No file provided. Please upload a CSV or Excel file.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        file = request.FILES['file']
        file_name = file.name.lower()

        # Validate file type
        if not (file_name.endswith('.csv') or file_name.endswith('.xlsx') or file_name.endswith('.xls')):
            return Response(
                {'error': 'Invalid file type. Please upload a CSV or Excel (.xlsx, .xls) file.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Parse file based on type
            if file_name.endswith('.csv'):
                questions_data, parse_errors = QuestionImportExport.parse_csv(file)
            else:
                questions_data, parse_errors = QuestionImportExport.parse_excel(file)

            # If there are parse errors, return them
            if parse_errors:
                return Response({
                    'error': 'Failed to parse file',
                    'details': parse_errors,
                    'questions_parsed': len(questions_data)
                }, status=status.HTTP_400_BAD_REQUEST)

            # If no questions were parsed
            if not questions_data:
                return Response({
                    'error': 'No valid questions found in file. Please check the template format.'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get project from request data (required for project-specific question banks)
            project_id = request.data.get('project_id')
            if not project_id:
                return Response({
                    'error': 'project_id is required. Question banks are project-specific.'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get project and verify user has access
            try:
                from projects.models import Project
                project = Project.objects.get(id=project_id)

                # Check if user can edit project (collect data)
                if not project.can_user_collect_data(request.user):
                    return Response({
                        'error': 'You do not have permission to add questions to this project.'
                    }, status=status.HTTP_403_FORBIDDEN)

            except Project.DoesNotExist:
                return Response({
                    'error': f'Project with id {project_id} not found.'
                }, status=status.HTTP_404_NOT_FOUND)

            # Import questions to question bank
            result = QuestionImportExport.import_questions_to_bank(
                questions_data,
                project=project,
                created_by_user=request.user,
                created_by=str(request.user)
            )

            # Prepare response
            response_data = {
                'message': 'Import completed successfully',
                'created': result['created'],
                'updated': result['updated'],
                'total_processed': result['total_processed'],
                'errors': result['errors']
            }

            logger.info(f"Questions imported by {request.user}: {result['total_processed']} processed, {len(result['errors'])} errors")
            if result['errors']:
                logger.error(f"Import errors: {result['errors']}")

            # Return appropriate status based on errors
            if result['errors']:
                return Response(response_data, status=status.HTTP_207_MULTI_STATUS)
            else:
                return Response(response_data, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Error importing questions: {e}")
            return Response(
                {'error': f'Failed to import questions: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DynamicQuestionSessionViewSet(BaseModelViewSet):
    """ViewSet for managing dynamic question generation sessions"""
    
    serializer_class = DynamicQuestionSessionSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['respondent_type', 'commodity', 'country', 'notes']
    ordering_fields = ['created_at', 'respondent_type', 'questions_generated']
    ordering = ['-created_at']
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter sessions by user access to projects"""
        queryset = DynamicQuestionSession.objects.select_related('project')
        
        user = self.request.user
        if not user.is_superuser:
            queryset = queryset.filter(
                Q(project__created_by=user) |
                Q(project__members__user=user)
            )
        
        return queryset.distinct()
    
    def perform_create(self, serializer):
        """Create session with user tracking"""
        serializer.validated_data['created_by'] = str(self.request.user)
        
        # Check project permissions
        project = serializer.validated_data['project']
        if not project.can_user_edit(self.request.user):
            raise ValidationError("You don't have permission to generate questions for this project")
        
        session = serializer.save()
        logger.info(f"Dynamic question session created: {session.id}")


# Maintain backward compatibility
QuestionViewSet = ModernQuestionViewSet