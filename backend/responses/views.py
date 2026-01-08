from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response as DRFResponse
from django.db.models import Count, Avg, Max, Q
from django.http import HttpResponse
from django.utils import timezone
from django_core.utils.viewsets import BaseModelViewSet
from django_core.utils.filters import ResponseFilter
from .models import Response, Respondent
from .serializers import ResponseSerializer, RespondentSerializer
from .database_router import get_database_router
import csv
import json
from io import StringIO
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Create your views here.

class ResponseViewSet(BaseModelViewSet):
    serializer_class = ResponseSerializer
    filterset_class = ResponseFilter
    search_fields = ['response_value', 'respondent_id', 'question__question_text']
    ordering_fields = ['collected_at', 'respondent_id']
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Filter responses by projects that belong to the authenticated user.
        Superusers can see all responses, regular users only see responses from their projects
        (either created by them or where they are members).
        """
        user = self.request.user
        if user.is_superuser:
            queryset = Response.objects.all()
        else:
            queryset = Response.objects.filter(
                Q(project__created_by=user) |
                Q(project__members__user=user)
            ).distinct()
        
        # Additional filtering by query parameters
        project_id = self.request.query_params.get('project_id', None)
        question_id = self.request.query_params.get('question_id', None)
        respondent_id = self.request.query_params.get('respondent_id', None)

        if project_id is not None:
            queryset = queryset.filter(project_id=project_id)
        if question_id is not None:
            queryset = queryset.filter(question_id=question_id)
        if respondent_id is not None:
            queryset = queryset.filter(respondent_id=respondent_id)

        return queryset

    @action(detail=True, methods=['post'])
    def retry_routing(self, request, pk=None):
        """
        Manually retry database routing for a specific response.
        Useful when partner database endpoints were temporarily unavailable.
        """
        try:
            response = self.get_object()

            # Check if retry is needed
            if response.routing_complete:
                return DRFResponse({
                    'message': 'Response has already been successfully routed to all endpoints',
                    'routing_summary': response.get_routing_summary()
                })

            # Get routing info before retry
            failed_endpoints_before = response.get_failed_endpoints()

            # Retry routing
            router = get_database_router()
            routing_results = router.route_response(response)

            # Update status
            response.update_routing_status(routing_results)

            # Get updated info
            failed_endpoints_after = response.get_failed_endpoints()

            return DRFResponse({
                'message': 'Routing retry completed',
                'routing_complete': response.routing_complete,
                'failed_endpoints_before': failed_endpoints_before,
                'failed_endpoints_after': failed_endpoints_after,
                'routing_summary': response.get_routing_summary(),
                'routing_results': routing_results
            })

        except Exception as e:
            logger.exception(f"Error retrying routing for response {pk}")
            return DRFResponse({
                'error': f'Failed to retry routing: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def routing_status(self, request):
        """
        Get summary of routing status across all responses.
        """
        try:
            queryset = self.get_queryset()

            project_id = request.query_params.get('project_id')
            if project_id:
                queryset = queryset.filter(project_id=project_id)

            total = queryset.count()
            complete = queryset.filter(routing_complete=True).count()
            incomplete = queryset.filter(routing_complete=False).count()
            needs_retry = queryset.filter(
                routing_complete=False,
                routing_attempts__lt=3
            ).count()

            return DRFResponse({
                'total_responses': total,
                'routing_complete': complete,
                'routing_incomplete': incomplete,
                'needs_retry': needs_retry,
                'completion_rate': round((complete / total * 100), 2) if total > 0 else 0
            })

        except Exception as e:
            logger.exception("Error getting routing status")
            return DRFResponse({
                'error': f'Failed to get routing status: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def bulk_retry_routing(self, request):
        """
        Retry routing for multiple responses in bulk.
        Accepts a list of response IDs or filters by project.
        """
        try:
            response_ids = request.data.get('response_ids', [])
            project_id = request.data.get('project_id')
            max_attempts = request.data.get('max_attempts', 3)

            queryset = self.get_queryset()

            # Filter by response IDs or project
            if response_ids:
                queryset = queryset.filter(response_id__in=response_ids)
            elif project_id:
                queryset = queryset.filter(project_id=project_id)
            else:
                return DRFResponse({
                    'error': 'Either response_ids or project_id must be provided'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Only retry incomplete responses within max attempts
            queryset = queryset.filter(
                routing_complete=False,
                routing_attempts__lt=max_attempts
            )

            responses_to_retry = list(queryset[:100])  # Limit to 100 at a time

            if not responses_to_retry:
                return DRFResponse({
                    'message': 'No responses need retry',
                    'total': 0
                })

            # Retry each response
            router = get_database_router()
            success_count = 0
            partial_success_count = 0
            failed_count = 0

            for response in responses_to_retry:
                try:
                    routing_results = router.route_response(response)
                    response.update_routing_status(routing_results)

                    if response.routing_complete:
                        success_count += 1
                    elif routing_results.get('successful_submissions', 0) > 0:
                        partial_success_count += 1
                    else:
                        failed_count += 1

                except Exception as e:
                    logger.exception(f"Error retrying response {response.response_id}")
                    failed_count += 1

            return DRFResponse({
                'message': 'Bulk retry completed',
                'total_processed': len(responses_to_retry),
                'fully_successful': success_count,
                'partially_successful': partial_success_count,
                'failed': failed_count
            })

        except Exception as e:
            logger.exception("Error in bulk retry routing")
            return DRFResponse({
                'error': f'Failed to perform bulk retry: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RespondentViewSet(BaseModelViewSet):
    serializer_class = RespondentSerializer
    search_fields = ['respondent_id', 'name', 'email']
    ordering_fields = ['created_at', 'last_response_at']
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Filter respondents by projects that belong to the authenticated user.
        Superusers can see all respondents, regular users only see respondents from their projects
        (either created by them or where they are members).
        """
        user = self.request.user
        if user.is_superuser:
            queryset = Respondent.objects.select_related('project', 'created_by').prefetch_related('responses')
        else:
            queryset = Respondent.objects.filter(
                Q(project__created_by=user) |
                Q(project__members__user=user)
            ).select_related('project', 'created_by').prefetch_related('responses').distinct()
        
        # Additional filtering by query parameters
        project_id = self.request.query_params.get('project_id', None)
        if project_id is not None:
            queryset = queryset.filter(project_id=project_id)

        return queryset

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get summary statistics for respondents"""
        try:
            queryset = self.get_queryset()
            
            total_respondents = queryset.count()
            total_responses = Response.objects.filter(
                respondent__in=queryset
            ).count()
            
            avg_responses_per_respondent = 0
            if total_respondents > 0:
                avg_responses_per_respondent = round(total_responses / total_respondents, 1)
            
            return DRFResponse({
                'total_respondents': total_respondents,
                'total_responses': total_responses,
                'avg_responses_per_respondent': avg_responses_per_respondent
            })
        except Exception as e:
            return DRFResponse({
                'error': f'Failed to get summary: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def responses(self, request, pk=None):
        """
        Get all responses for a specific respondent with detailed information and resume metadata.

        Query Parameters:
        - page: Page number for pagination (optional)
        - page_size: Number of items per page (optional, max 1000)
        - no_pagination: Set to 'true' to disable pagination (returns all responses)

        Returns:
        - responses: List of all existing responses (only those with valid questions)
        - resume_metadata: Information for resuming draft including answered question IDs
        """
        try:
            from forms.models import Question
            from django.db.models import Q
            from django_core.utils.pagination import CustomPagination

            respondent = self.get_object()

            # CRITICAL: Get ALL responses including orphaned ones (NULL question_id)
            # We'll match orphaned responses to questions by position
            # Optimize queries with select_related and prefetch_related to avoid N+1 queries
            all_responses = Response.objects.filter(
                respondent=respondent
            ).select_related(
                'question',
                'question__project',
                'question__project__created_by',
                'collected_by',
                'project',
                'project__created_by',
                'respondent',
                'respondent__project',
                'respondent__project__created_by',
                'respondent__created_by'
            ).order_by('collected_at')

            # Get available questions for this bundle (for position-based matching)
            available_questions = Question.objects.filter(
                project=respondent.project,
                assigned_respondent_type=respondent.respondent_type,
                assigned_commodity=respondent.commodity or '',
                assigned_country=respondent.country or ''
            ).exclude(
                Q(assigned_respondent_type__isnull=True) |
                Q(assigned_respondent_type='') |
                Q(assigned_commodity__isnull=True) |
                Q(assigned_commodity='') |
                Q(assigned_country__isnull=True) |
                Q(assigned_country='')
            ).order_by('order_index')

            questions_list = list(available_questions)

            # Process responses: match orphaned ones by position
            responses_to_serialize = []
            for position, response in enumerate(all_responses):
                if response.question is not None:
                    # Valid response with question - use as-is
                    responses_to_serialize.append(response)
                else:
                    # Orphaned response - match to question by position
                    if position < len(questions_list):
                        # Create a temporary response object with matched question
                        # This allows us to serialize it properly for frontend
                        response.question = questions_list[position]
                        response._matched_by_position = True  # Flag for debugging
                        responses_to_serialize.append(response)
                        logger.debug(f"Matched orphaned response at position {position} to question: {questions_list[position].question_text[:50]}")
                    else:
                        logger.warning(f"Orphaned response at position {position} exceeds available questions ({len(questions_list)})")

            responses = responses_to_serialize

            # Check if pagination is disabled
            no_pagination = request.query_params.get('no_pagination', 'false').lower() == 'true'

            # Use lightweight serializer for better performance
            from .serializers import ResponseLightSerializer

            if no_pagination:
                # Return all responses without pagination (backward compatibility)
                serializer = ResponseLightSerializer(responses, many=True)
                responses_data = serializer.data
            else:
                # Apply pagination for better performance with large datasets
                paginator = CustomPagination()
                paginator.page_size = int(request.query_params.get('page_size', 100))
                paginated_responses = paginator.paginate_queryset(responses, request)
                serializer = ResponseLightSerializer(paginated_responses, many=True)
                responses_data = serializer.data

            # Get answered question IDs from the processed responses (includes position-matched orphaned)
            answered_question_ids = []
            for resp in responses:
                if resp.question and resp.question.id:
                    answered_question_ids.append(str(resp.question.id))

            # Remove duplicates while preserving order
            seen = set()
            unique_answered_ids = []
            for qid in answered_question_ids:
                if qid not in seen:
                    seen.add(qid)
                    unique_answered_ids.append(qid)
            answered_question_ids = unique_answered_ids

            # We already have available_questions_list from position-based matching above
            available_question_count = len(questions_list)

            # Calculate resume index: find first unanswered question
            answered_ids_set = set(answered_question_ids)
            resume_index = 0
            first_unanswered_question_id = None

            for i, question in enumerate(questions_list):
                if str(question.id) not in answered_ids_set:
                    resume_index = i
                    first_unanswered_question_id = str(question.id)
                    break
            else:
                # All questions answered - resume at last question
                if questions_list:
                    resume_index = max(0, len(questions_list) - 1)

            resume_metadata = {
                'total_responses': len(responses),
                'answered_question_ids': answered_question_ids,
                'answered_count': len(answered_question_ids),
                'available_question_count': available_question_count,
                'resume_index': resume_index,  # NEW: Index to resume at
                'first_unanswered_question_id': first_unanswered_question_id,  # NEW: ID of first unanswered question
                'respondent_filters': {
                    'respondent_type': respondent.respondent_type,
                    'commodity': respondent.commodity,
                    'country': respondent.country
                }
            }

            logger.info(
                f"Retrieved {len(responses)} responses for respondent {respondent.id}, "
                f"{available_question_count} questions available for criteria: "
                f"{respondent.respondent_type}, {respondent.commodity}, {respondent.country}. "
                f"Resume index: {resume_index}"
            )

            response_data = {
                'respondent': RespondentSerializer(respondent).data,
                'responses': responses_data,
                'resume_metadata': resume_metadata
            }

            # Add pagination info if paginated
            if not no_pagination:
                response_data['pagination'] = {
                    'total': paginator.page.paginator.count,
                    'total_pages': paginator.page.paginator.num_pages,
                    'current_page': paginator.page.number,
                    'page_size': paginator.get_page_size(request),
                    'next': paginator.get_next_link(),
                    'previous': paginator.get_previous_link()
                }

            return DRFResponse(response_data)
        except Exception as e:
            logger.exception(f"Error getting responses for respondent {pk}")
            import traceback
            return DRFResponse({
                'error': f'Failed to get responses: {str(e)}',
                'traceback': traceback.format_exc()
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def with_response_counts(self, request):
        """
        Get respondents with their response counts - optimized for list view with pagination.

        Query params:
        - project_id: Filter by project (required)
        - respondent_type: Filter by respondent type
        - commodity: Filter by commodity
        - country: Filter by country
        - completion_status: Filter by status (draft/completed/abandoned)
        - page: Page number (default: 1)
        - page_size: Items per page (default: 50, max: 100)
        """
        try:
            # CRITICAL: Apply filters BEFORE annotation for correct counts
            queryset = self.get_queryset().select_related('project')

            # Filter by bundle parameters (respondent_type, commodity, country)
            # MUST be applied BEFORE annotate() to get correct response_count
            respondent_type = request.query_params.get('respondent_type')
            if respondent_type:
                queryset = queryset.filter(respondent_type__iexact=respondent_type)

            commodity = request.query_params.get('commodity')
            if commodity:
                queryset = queryset.filter(commodity__iexact=commodity)

            country = request.query_params.get('country')
            if country:
                queryset = queryset.filter(country__iexact=country)

            # Filter by completion status if provided
            completion_status = request.query_params.get('completion_status')
            if completion_status:
                queryset = queryset.filter(completion_status=completion_status)

            # NOW annotate with response counts (will only count for filtered respondents)
            queryset = queryset.annotate(
                response_count=Count('responses'),
                last_response_date=Max('responses__collected_at')
            )

            # Order by most recent first for better UX
            queryset = queryset.order_by('-created_at')

            # CRITICAL: Always use pagination for large datasets
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

            # Fallback (shouldn't reach here with pagination)
            serializer = self.get_serializer(queryset, many=True)
            return DRFResponse(serializer.data)
        except Exception as e:
            logger.exception("Error in with_response_counts")
            return DRFResponse({
                'error': f'Failed to get respondents with counts: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def format_response_for_csv(self, response_value, question_type):
        """Format response value based on question type for CSV export"""
        if not response_value or response_value in ['null', 'undefined', 'None']:
            return ''

        # Handle images - indicate that image exists instead of base64 string
        if question_type == 'image':
            # Check for base64 data URI or raw base64
            if (response_value.startswith('data:image/') or
                response_value.startswith('iVBOR') or
                response_value.startswith('/9j/')):
                return '[IMAGE ATTACHED]'
            # If it's a URL, include the URL
            elif response_value.startswith('http://') or response_value.startswith('https://'):
                return response_value
            else:
                return '[IMAGE DATA]'

        # Handle location data - extract readable format
        if question_type in ['geopoint', 'geoshape']:
            try:
                # Handle both string and already parsed JSON
                location_data = json.loads(response_value) if isinstance(response_value, str) else response_value
                parts = []
                if location_data.get('address'):
                    parts.append(location_data['address'])
                if location_data.get('latitude') and location_data.get('longitude'):
                    parts.append(f"GPS: {location_data['latitude']}, {location_data['longitude']}")
                return ' | '.join(parts) if parts else str(location_data)
            except (json.JSONDecodeError, KeyError, TypeError, AttributeError):
                return str(response_value)

        # Handle date/datetime - format as readable date
        if question_type in ['date', 'datetime']:
            try:
                if 'T' in str(response_value):
                    dt = datetime.fromisoformat(response_value.replace('Z', '+00:00'))
                    return dt.strftime('%Y-%m-%d %H:%M:%S') if question_type == 'datetime' else dt.strftime('%Y-%m-%d')
                return response_value
            except (ValueError, AttributeError):
                return response_value

        # Handle multiple choice and arrays - convert JSON array to comma-separated
        if question_type == 'choice_multiple' or (isinstance(response_value, str) and response_value.strip().startswith('[')):
            try:
                choices = json.loads(response_value) if isinstance(response_value, str) else response_value
                if isinstance(choices, list):
                    return ', '.join(str(c) for c in choices)
                return str(response_value)
            except (json.JSONDecodeError, TypeError):
                return str(response_value)

        # Handle JSON objects - format as compact JSON
        if isinstance(response_value, str) and (response_value.strip().startswith('{') or response_value.strip().startswith('[')):
            try:
                json_data = json.loads(response_value)
                return json.dumps(json_data, separators=(',', ':'))
            except json.JSONDecodeError:
                return response_value

        # Default: return as string
        return str(response_value)

    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        """Export respondents and their responses to CSV"""
        try:
            project_id = request.query_params.get('project_id')
            if not project_id:
                return DRFResponse({
                    'error': 'project_id parameter is required'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get respondents for the project
            queryset = self.get_queryset().filter(project_id=project_id).select_related('project')

            if not queryset.exists():
                return DRFResponse({
                    'error': 'No respondents found for this project'
                }, status=status.HTTP_404_NOT_FOUND)

            # Get all questions for the project
            from forms.models import Question
            questions = list(Question.objects.filter(project_id=project_id))

            # Sort by category order first, then by order_index
            CATEGORY_ORDER = [
                'Sociodemographics',
                'Environmental LCA',
                'Social LCA',
                'Vulnerability',
                'Fairness',
                'Solutions',
                'Informations',
                'Proximity and Value',
            ]

            def get_category_sort_key(question):
                category = question.question_category or ''
                try:
                    return (CATEGORY_ORDER.index(category), question.order_index)
                except ValueError:
                    return (9999, question.order_index)

            questions.sort(key=get_category_sort_key)

            # Create CSV
            output = StringIO()
            writer = csv.writer(output)

            # Write header row
            headers = ['Respondent ID', 'Respondent Type', 'Commodity', 'Country']
            # Add question headers with category prefix
            for i, q in enumerate(questions):
                category_prefix = f"[{q.question_category}] " if q.question_category else ""
                headers.append(f'{category_prefix}Q{i+1}: {q.question_text[:100]}')
            writer.writerow(headers)

            # Write data rows
            for respondent in queryset:
                row = [
                    respondent.respondent_id,
                    respondent.respondent_type or '',
                    respondent.commodity or '',
                    respondent.country or ''
                ]

                # Get responses for this respondent
                responses_dict = {}
                responses = Response.objects.filter(
                    respondent=respondent,
                    project_id=project_id
                ).select_related('question')

                for response in responses:
                    # Skip responses with deleted questions
                    if not response.question:
                        continue
                    formatted_value = self.format_response_for_csv(
                        response.response_value,
                        response.question.response_type
                    )
                    responses_dict[response.question_id] = formatted_value

                # Add response values in question order
                for question in questions:
                    row.append(responses_dict.get(question.id, ''))

                writer.writerow(row)

            # Create HTTP response
            csv_data = output.getvalue()
            output.close()

            response = HttpResponse(csv_data, content_type='text/csv')
            filename = f'responses_{project_id}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            response['Content-Disposition'] = f'attachment; filename="{filename}"'

            return response

        except Exception as e:
            return DRFResponse({
                'error': f'Failed to export CSV: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def export_json(self, request):
        """Export respondents and their responses to JSON format"""
        try:
            project_id = request.query_params.get('project_id')
            if not project_id:
                return DRFResponse({
                    'error': 'project_id parameter is required'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get respondents for the project
            queryset = self.get_queryset().filter(project_id=project_id).select_related('project')

            if not queryset.exists():
                return DRFResponse({
                    'error': 'No respondents found for this project'
                }, status=status.HTTP_404_NOT_FOUND)

            # Get all questions for the project
            from forms.models import Question
            questions = list(Question.objects.filter(project_id=project_id))

            # Sort by category order first, then by order_index
            CATEGORY_ORDER = [
                'Sociodemographics',
                'Environmental LCA',
                'Social LCA',
                'Vulnerability',
                'Fairness',
                'Solutions',
                'Informations',
                'Proximity and Value',
            ]

            def get_category_sort_key(question):
                category = question.question_category or ''
                try:
                    return (CATEGORY_ORDER.index(category), question.order_index)
                except ValueError:
                    return (9999, question.order_index)

            questions.sort(key=get_category_sort_key)

            # Build export data
            export_data = {
                'project_id': project_id,
                'exported_at': datetime.now().isoformat(),
                'total_respondents': queryset.count(),
                'questions': [
                    {
                        'id': q.id,
                        'text': q.question_text,
                        'response_type': q.response_type,
                        'category': q.question_category,
                        'order': q.order_index,
                        'assigned_respondent_type': q.assigned_respondent_type,
                        'assigned_commodity': q.assigned_commodity,
                        'assigned_country': q.assigned_country
                    } for q in questions
                ],
                'respondents': []
            }

            # Add respondent data
            for respondent in queryset:
                respondent_data = {
                    'respondent_id': respondent.respondent_id,
                    'respondent_type': respondent.respondent_type,
                    'commodity': respondent.commodity,
                    'country': respondent.country,
                    'responses': []
                }

                # Get responses for this respondent
                responses = Response.objects.filter(
                    respondent=respondent,
                    project_id=project_id
                ).select_related('question').order_by('question__order_index')

                for response in responses:
                    # Skip responses with deleted questions
                    if not response.question:
                        continue

                    response_data = {
                        'question_id': response.question_id,
                        'question_text': response.question.question_text,
                        'question_category': response.question.question_category,
                        'assigned_respondent_type': response.question.assigned_respondent_type,
                        'assigned_commodity': response.question.assigned_commodity,
                        'assigned_country': response.question.assigned_country
                    }

                    # Parse response value based on type
                    raw_value = response.response_value
                    if response.question.response_type == 'image':
                        # For images, indicate presence rather than including base64
                        if raw_value and (raw_value.startswith('data:image/') or
                                         raw_value.startswith('iVBOR') or
                                         raw_value.startswith('/9j/')):
                            response_data['value'] = '[IMAGE_DATA]'
                            response_data['has_image'] = True
                        else:
                            response_data['value'] = raw_value
                            response_data['has_image'] = False
                    elif response.question.response_type in ['geopoint', 'geoshape']:
                        # Parse location JSON
                        try:
                            response_data['value'] = json.loads(raw_value) if isinstance(raw_value, str) else raw_value
                        except (json.JSONDecodeError, TypeError):
                            response_data['value'] = raw_value
                    elif response.question.response_type == 'choice_multiple':
                        # Parse array
                        try:
                            response_data['value'] = json.loads(raw_value) if isinstance(raw_value, str) else raw_value
                        except (json.JSONDecodeError, TypeError):
                            response_data['value'] = raw_value
                    else:
                        # Try to parse as JSON, otherwise keep as string
                        if raw_value and isinstance(raw_value, str) and (raw_value.strip().startswith('{') or raw_value.strip().startswith('[')):
                            try:
                                response_data['value'] = json.loads(raw_value)
                            except json.JSONDecodeError:
                                response_data['value'] = raw_value
                        else:
                            response_data['value'] = raw_value

                    respondent_data['responses'].append(response_data)

                export_data['respondents'].append(respondent_data)

            # Create HTTP response with pretty-printed JSON
            json_data = json.dumps(export_data, indent=2, ensure_ascii=False)
            response = HttpResponse(json_data, content_type='application/json')
            filename = f'responses_{project_id}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
            response['Content-Disposition'] = f'attachment; filename="{filename}"'

            return response

        except Exception as e:
            return DRFResponse({
                'error': f'Failed to export JSON: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def export_bundle_pivot(self, request):
        """
        Export responses in bundle-based pivot format for a SPECIFIC bundle.
        Questions as rows, respondents as columns.

        CRITICAL: ALL three filter parameters are REQUIRED to prevent timeout with large datasets.

        Required Parameters:
        - project_id: Project UUID
        - respondent_type: Type of respondent (e.g., 'farmers')
        - commodity: Commodity (e.g., 'maize')
        - country: Country (e.g., 'Ghana')

        Format:
        - Columns: Question_Index | Question | Question_Category | Respondent_ID_1 | Respondent_ID_2 | ...
        - Rows: One row per question in the bundle
        - Questions ordered by order_index
        """
        try:
            from collections import defaultdict
            from forms.models import Question

            # Validate ALL required parameters
            project_id = request.query_params.get('project_id')
            respondent_type = request.query_params.get('respondent_type')
            commodity = request.query_params.get('commodity')
            country = request.query_params.get('country')

            if not all([project_id, respondent_type, commodity, country]):
                return DRFResponse({
                    'error': 'All filter parameters are required: project_id, respondent_type, commodity, country. This prevents system timeout with large datasets.'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Log the received filter values for debugging
            logger.info(f"Export bundle request - Project: {project_id}, Type: {respondent_type}, Commodity: {commodity}, Country: {country}")

            # Get ALL respondents matching the specific bundle (NO PAGINATION for export)
            # CRITICAL: Query directly from model to bypass any pagination from viewset
            # Use case-insensitive matching for string fields to handle variations
            user = self.request.user

            # Apply user permissions: superusers see all, regular users see only their projects
            if user.is_superuser:
                respondents = Respondent.objects.filter(
                    project_id=project_id,
                    respondent_type__iexact=respondent_type,
                    commodity__iexact=commodity,
                    country__iexact=country
                ).select_related('project').order_by('respondent_id')
            else:
                respondents = Respondent.objects.filter(
                    Q(project__created_by=user) | Q(project__members__user=user),
                    project_id=project_id,
                    respondent_type__iexact=respondent_type,
                    commodity__iexact=commodity,
                    country__iexact=country
                ).select_related('project').distinct().order_by('respondent_id')

            if not respondents.exists():
                return DRFResponse({
                    'error': f'No respondents found for bundle: {respondent_type}, {commodity}, {country}'
                }, status=status.HTTP_404_NOT_FOUND)

            # Create CSV
            output = StringIO()
            writer = csv.writer(output)

            # Convert to list to avoid re-querying and get accurate count
            bundle_respondents = list(respondents)
            total_respondents = len(bundle_respondents)

            # Write bundle header with debug info
            writer.writerow([f'=== BUNDLE: {respondent_type} | {commodity} | {country} ==='])
            writer.writerow([f'Total Respondents: {total_respondents}'])
            writer.writerow([f'DEBUG: Respondent IDs: {[r.respondent_id for r in bundle_respondents]}'])
            writer.writerow([f'DEBUG: Respondent UUIDs: {[str(r.id) for r in bundle_respondents]}'])
            writer.writerow([])  # Empty row

            logger.info(f"Exporting bundle: {respondent_type}, {commodity}, {country} - {total_respondents} respondents")

            # Log sample of respondent IDs for debugging
            if total_respondents > 0:
                sample_ids = [r.respondent_id for r in bundle_respondents[:5]]
                logger.info(f"Sample respondent IDs: {sample_ids}")

            # Get ALL questions for this specific bundle with CUSTOM CATEGORY ORDERING
            # Match frontend category order: Sociodemographics, Environmental LCA, Social LCA, etc.
            from django.db.models import Case, When, Value, IntegerField

            # Get ALL questions for this specific bundle with CUSTOM CATEGORY ORDERING
            # Use case-insensitive matching for bundle assignment fields
            questions = Question.objects.filter(
                project_id=project_id,
                assigned_respondent_type__iexact=respondent_type,
                assigned_commodity__iexact=commodity,
                assigned_country__iexact=country
            ).annotate(
                category_priority=Case(
                    When(question_category__iexact='Sociodemographics', then=Value(0)),
                    When(question_category__iexact='Environmental LCA', then=Value(1)),
                    When(question_category__iexact='Social LCA', then=Value(2)),
                    When(question_category__iexact='Vulnerability', then=Value(3)),
                    When(question_category__iexact='Fairness', then=Value(4)),
                    When(question_category__iexact='Solutions', then=Value(5)),
                    When(question_category__iexact='Informations', then=Value(6)),
                    When(question_category__iexact='Proximity and Value', then=Value(7)),
                    default=Value(9999),  # Unknown categories go to the end
                    output_field=IntegerField()
                )
            ).order_by('category_priority', 'order_index')

            total_questions = questions.count()
            logger.info(f"Found {total_questions} questions for bundle with custom category ordering applied")

            # Log first few question categories for debugging
            if total_questions > 0:
                sample_questions = list(questions[:5])
                categories = [(q.question_category, q.order_index) for q in sample_questions]
                logger.info(f"Sample question categories (category, order_index): {categories}")

            if not questions.exists():
                writer.writerow(['No questions found for this bundle'])
            else:
                # Build header row: Question | Question_Category | Respondent_ID columns
                header = ['Question_Index', 'Question', 'Question_Category']
                for respondent in bundle_respondents:
                    header.append(respondent.respondent_id)
                writer.writerow(header)

                # Collect all responses for this bundle
                # Create a mapping: {question_id: {respondent_uuid: response_value}}
                response_matrix = defaultdict(dict)
                respondent_ids = [r.id for r in bundle_respondents]  # Get UUIDs for filtering

                logger.info(f"Fetching responses for {len(respondent_ids)} respondents")
                logger.info(f"Respondent UUIDs: {respondent_ids}")

                # CRITICAL: Get ALL responses, including orphaned ones (question_id is NULL)
                # STRATEGY: Since all respondents in same bundle answer same questions in same order,
                # we can match orphaned responses to current questions by POSITION
                responses = Response.objects.filter(
                    respondent_id__in=respondent_ids,
                    project_id=project_id
                ).select_related('question', 'respondent').order_by('respondent_id', 'collected_at')

                total_responses = responses.count()
                logger.info(f"Found {total_responses} total responses for bundle export")

                # Debug: Log responses per respondent
                from collections import Counter
                respondent_response_counts = Counter([r.respondent_id for r in responses])
                responses_with_valid_questions = 0
                responses_with_orphaned_questions = 0
                orphaned_matched_by_position = 0

                for resp_id, count in respondent_response_counts.items():
                    respondent_obj = next((r for r in bundle_respondents if r.id == resp_id), None)
                    resp_identifier = respondent_obj.respondent_id if respondent_obj else 'Unknown'
                    logger.info(f"  Respondent {resp_identifier} ({resp_id}): {count} responses")

                # Convert questions to list for position-based matching
                questions_list = list(questions)

                # Group responses by respondent for position-based matching
                responses_by_respondent = defaultdict(list)
                for response in responses:
                    responses_by_respondent[response.respondent_id].append(response)

                # Process each respondent's responses
                for respondent_uuid, respondent_responses in responses_by_respondent.items():
                    # Sort by collected_at to maintain order
                    respondent_responses.sort(key=lambda r: r.collected_at if r.collected_at else datetime.min)

                    for position, response in enumerate(respondent_responses):
                        if response.question is not None:
                            # Valid response with question
                            responses_with_valid_questions += 1
                            formatted_value = self.format_response_for_csv(
                                response.response_value,
                                response.question.response_type
                            )
                            response_matrix[response.question_id][response.respondent_id] = formatted_value
                        else:
                            # Orphaned response - match by position
                            responses_with_orphaned_questions += 1
                            if position < len(questions_list):
                                matched_question = questions_list[position]
                                orphaned_matched_by_position += 1
                                # Use the matched question's response type for formatting
                                formatted_value = self.format_response_for_csv(
                                    response.response_value,
                                    matched_question.response_type
                                )
                                response_matrix[matched_question.id][response.respondent_id] = formatted_value
                                logger.debug(f"Matched orphaned response at position {position} to question: {matched_question.question_text[:50]}")
                            else:
                                logger.warning(f"Orphaned response at position {position} exceeds available questions ({len(questions_list)})")

                logger.info(f"  Valid responses: {responses_with_valid_questions}")
                logger.info(f"  Orphaned responses: {responses_with_orphaned_questions} (matched {orphaned_matched_by_position} by position)")

                # DEBUG: Add response count summary to CSV
                writer.writerow(['=== DEBUG: RESPONSE COUNTS PER RESPONDENT ==='])
                writer.writerow([f'Position-based matching applied for orphaned responses (NULL question_id)'])
                for respondent in bundle_respondents:
                    # Count total responses (including orphaned ones)
                    total_resp = respondent_response_counts.get(respondent.id, 0)
                    # Count responses in matrix (includes both valid and matched orphaned)
                    matrix_resp = sum(1 for q_id, resp_dict in response_matrix.items() if respondent.id in resp_dict)
                    writer.writerow([f'Respondent {respondent.respondent_id}: {total_resp} collected, {matrix_resp} in export'])
                writer.writerow([f'Total responses in export matrix: {sum(len(resp_dict) for resp_dict in response_matrix.values())}'])
                writer.writerow([f'Valid responses (with question_id): {responses_with_valid_questions}'])
                writer.writerow([f'Orphaned responses (NULL question_id): {responses_with_orphaned_questions} (matched {orphaned_matched_by_position} by position)'])
                writer.writerow([])  # Empty row

                # Write data rows - one row per question
                for idx, question in enumerate(questions, 1):
                    row = [
                        idx,  # Question index
                        question.question_text,
                        question.question_category or 'Uncategorized'
                    ]

                    # Add response for each respondent
                    for respondent in bundle_respondents:
                        response_value = response_matrix.get(question.id, {}).get(respondent.id, '')
                        row.append(response_value)

                    writer.writerow(row)

            # Create HTTP response
            csv_data = output.getvalue()
            output.close()

            response = HttpResponse(csv_data, content_type='text/csv')
            filename = f'bundle_pivot_{project_id}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            response['Content-Disposition'] = f'attachment; filename="{filename}"'

            return response

        except Exception as e:
            import traceback
            logger.exception("Error in export_bundle_pivot")
            return DRFResponse({
                'error': f'Failed to export bundle pivot: {str(e)}',
                'traceback': traceback.format_exc()
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def save_draft(self, request):
        """
        Save draft responses for a respondent to continue later.
        Creates/updates respondent with draft status and saves partial responses.
        """
        try:
            # Extract data from request
            project_id = request.data.get('project')
            respondent_id = request.data.get('respondent_id')
            respondent_data = request.data.get('respondent_data', {})
            responses_data = request.data.get('responses', [])

            if not project_id or not respondent_id:
                return DRFResponse({
                    'error': 'project and respondent_id are required'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get or create respondent with draft status
            respondent, created = Respondent.objects.get_or_create(
                respondent_id=respondent_id,
                project_id=project_id,
                defaults={
                    'is_anonymous': respondent_data.get('is_anonymous', True),
                    'consent_given': respondent_data.get('consent_given', True),
                    'respondent_type': respondent_data.get('respondent_type'),
                    'commodity': respondent_data.get('commodity'),
                    'country': respondent_data.get('country'),
                    'completion_status': 'draft',
                    'created_by': request.user,
                }
            )

            # Update existing respondent if not created
            if not created:
                respondent.completion_status = 'draft'
                respondent.respondent_type = respondent_data.get('respondent_type') or respondent.respondent_type
                respondent.commodity = respondent_data.get('commodity') or respondent.commodity
                respondent.country = respondent_data.get('country') or respondent.country
                respondent.save()

            # Save or update responses
            saved_count = 0
            for response_item in responses_data:
                question_id = response_item.get('question_id')
                response_value = response_item.get('response_value')

                if question_id and response_value:
                    # Update or create response
                    response, resp_created = Response.objects.update_or_create(
                        project_id=project_id,
                        question_id=question_id,
                        respondent=respondent,
                        defaults={
                            'response_value': response_value,
                            'collected_by': request.user,
                            'device_info': response_item.get('device_info', {}),
                        }
                    )
                    saved_count += 1

            # Update last_response_at
            respondent.last_response_at = timezone.now()

            # Check if all questions are answered to determine completion status
            # Get all generated questions for this respondent's criteria
            from forms.models import Question
            generated_questions = Question.objects.filter(
                project_id=project_id,
                assigned_respondent_type=respondent.respondent_type,
                assigned_commodity=respondent.commodity or '',
                assigned_country=respondent.country or ''
            )

            total_questions = generated_questions.count()
            answered_questions = respondent.responses.count()

            # Only mark as draft if not all questions are answered
            if total_questions > 0 and answered_questions >= total_questions:
                respondent.completion_status = 'completed'
            else:
                respondent.completion_status = 'draft'

            respondent.save()

            return DRFResponse({
                'message': 'Draft saved successfully',
                'respondent_id': str(respondent.id),
                'respondent_identifier': respondent.respondent_id,
                'responses_saved': saved_count,
                'created': created,
                'completion_status': respondent.completion_status,
                'total_questions': total_questions,
                'answered_questions': answered_questions,
            }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

        except Exception as e:
            logger.exception(f"Error saving draft responses")
            return DRFResponse({
                'error': f'Failed to save draft: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def get_drafts(self, request):
        """Get all draft respondents for a project"""
        try:
            project_id = request.query_params.get('project_id')
            if not project_id:
                return DRFResponse({
                    'error': 'project_id parameter is required'
                }, status=status.HTTP_400_BAD_REQUEST)

            drafts = Respondent.objects.filter(
                project_id=project_id,
                completion_status='draft'
            ).annotate(
                response_count=Count('responses')
            ).order_by('-last_response_at')

            serializer = RespondentSerializer(drafts, many=True)
            return DRFResponse({
                'drafts': serializer.data,
                'count': drafts.count()
            })

        except Exception as e:
            return DRFResponse({
                'error': f'Failed to get drafts: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
