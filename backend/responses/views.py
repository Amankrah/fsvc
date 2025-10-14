from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response as DRFResponse
from django.db.models import Count, Avg, Max
from django.http import HttpResponse
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
        Superusers can see all responses, regular users only see responses from their projects.
        """
        user = self.request.user
        if user.is_superuser:
            queryset = Response.objects.all()
        else:
            queryset = Response.objects.filter(project__created_by=user)
        
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
        Superusers can see all respondents, regular users only see respondents from their projects.
        """
        user = self.request.user
        if user.is_superuser:
            queryset = Respondent.objects.select_related('project', 'created_by').prefetch_related('responses')
        else:
            queryset = Respondent.objects.filter(project__created_by=user).select_related('project', 'created_by').prefetch_related('responses')
        
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
        """Get all responses for a specific respondent with detailed information"""
        try:
            respondent = self.get_object()
            responses = Response.objects.filter(
                respondent=respondent
            ).select_related('question', 'collected_by', 'project').order_by('collected_at')
            
            serializer = ResponseSerializer(responses, many=True)
            return DRFResponse({
                'respondent': RespondentSerializer(respondent).data,
                'responses': serializer.data
            })
        except Exception as e:
            return DRFResponse({
                'error': f'Failed to get responses: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def with_response_counts(self, request):
        """Get respondents with their response counts - optimized for list view"""
        try:
            queryset = self.get_queryset().annotate(
                response_count=Count('responses'),
                last_response_date=Max('responses__collected_at')
            ).order_by('-created_at')

            # Pagination
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

            serializer = self.get_serializer(queryset, many=True)
            return DRFResponse(serializer.data)
        except Exception as e:
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
            questions = Question.objects.filter(project_id=project_id).order_by('order_index')

            # Create CSV
            output = StringIO()
            writer = csv.writer(output)

            # Write header row
            headers = ['Respondent ID', 'Name', 'Email', 'Created At', 'Last Response At']
            headers.extend([f'Q{i+1}: {q.question_text[:50]}' for i, q in enumerate(questions)])
            writer.writerow(headers)

            # Write data rows
            for respondent in queryset:
                row = [
                    respondent.respondent_id,
                    respondent.name or '',
                    respondent.email or '',
                    respondent.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                    respondent.last_response_at.strftime('%Y-%m-%d %H:%M:%S') if respondent.last_response_at else ''
                ]

                # Get responses for this respondent
                responses_dict = {}
                responses = Response.objects.filter(
                    respondent=respondent,
                    project_id=project_id
                ).select_related('question')

                for response in responses:
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
            questions = Question.objects.filter(project_id=project_id).order_by('order_index')

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
                        'order': q.order_index
                    } for q in questions
                ],
                'respondents': []
            }

            # Add respondent data
            for respondent in queryset:
                respondent_data = {
                    'respondent_id': respondent.respondent_id,
                    'name': respondent.name,
                    'email': respondent.email,
                    'created_at': respondent.created_at.isoformat(),
                    'last_response_at': respondent.last_response_at.isoformat() if respondent.last_response_at else None,
                    'responses': []
                }

                # Get responses for this respondent
                responses = Response.objects.filter(
                    respondent=respondent,
                    project_id=project_id
                ).select_related('question').order_by('question__order_index')

                for response in responses:
                    response_data = {
                        'question_id': response.question_id,
                        'question_text': response.question.question_text,
                        'response_type': response.question.response_type,
                        'collected_at': response.collected_at.isoformat(),
                        'is_validated': response.is_validated
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
