"""
Views for API v1.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q
from django.utils import timezone
from datetime import timedelta
from forms.models import Question
from forms.serializers import QuestionSerializer
from projects.models import Project
from responses.models import Response as ResponseModel, Respondent
from sync.models import SyncQueue
from authentication.models import User
import logging
from django.db import models

logger = logging.getLogger(__name__)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """Get comprehensive dashboard statistics"""
    try:
        user = request.user
        logger.info(f"Dashboard stats requested by user: {user.email}")
    
        # Get user's projects - consistent with ProjectViewSet logic
        if user.is_superuser:
            user_projects = Project.objects.all()
            # For superusers, show both personal and total stats
            personal_projects = Project.objects.filter(created_by=user)
        else:
            # Regular users only see their own projects
            user_projects = Project.objects.filter(created_by=user)
            personal_projects = user_projects
    
        # Basic statistics - user-specific
        # Count completed forms (respondents)
        total_respondents = Respondent.objects.filter(
            project__in=user_projects
        ).count()
    
        active_projects = user_projects.count()
        
        # Team members calculation using new ProjectMember model
        team_member_ids = set()
        
        # Add project creators from user's accessible projects
        project_creators = user_projects.values_list('created_by_id', flat=True).distinct()
        team_member_ids.update(project_creators)
        
        # Add team members from ProjectMember model
        from projects.models import ProjectMember
        project_members = ProjectMember.objects.filter(
            project__in=user_projects
        ).values_list('user_id', flat=True).distinct()
        team_member_ids.update(project_members)
        
        # Add response collectors from user's accessible projects (for backward compatibility)
        response_collectors = ResponseModel.objects.filter(
            project__in=user_projects,
            collected_by__isnull=False
        ).values_list('collected_by_id', flat=True).distinct()
        team_member_ids.update(response_collectors)
        
        team_members = len(team_member_ids)
    
        # Sync queue statistics - user-specific
        # Match the logic from SyncQueueViewSet but filter by created_by for user-specific data
        if user.is_superuser:
            user_sync_queue = SyncQueue.objects.all()
        else:
            # For regular users, show sync items they created or related to their projects
            # Use simpler filtering that works with SQLite
            user_project_ids = list(user_projects.values_list('id', flat=True))
            user_sync_queue = SyncQueue.objects.filter(
                models.Q(created_by=user) |
                models.Q(table_name='projects', record_id__in=[str(pid) for pid in user_project_ids])
            ).distinct()
        
        pending_sync = user_sync_queue.filter(status='pending').count()
        failed_sync = user_sync_queue.filter(status='failed').count()
        
        # Recent activity count (last 7 days) - user-specific
        seven_days_ago = timezone.now() - timedelta(days=7)
        recent_responses = ResponseModel.objects.filter(
            project__in=user_projects,
            collected_at__gte=seven_days_ago
        ).count()
        
        # Response completion rate - user-specific
        # Count actual Question instances in user's projects
        from forms.models import Question
        total_questions = Question.objects.filter(
            project__in=user_projects
        ).count()
        completed_responses = ResponseModel.objects.filter(
            project__in=user_projects,
            response_value__isnull=False
        ).exclude(response_value='').count()
        
        completion_rate = 0
        if total_questions > 0:
            expected_responses = total_questions * user_projects.count()  # Simplified calculation
            completion_rate = (completed_responses / max(expected_responses, 1)) * 100
            completion_rate = min(completion_rate, 100)  # Cap at 100%
        
        # User role-based statistics
        user_can_manage = user.is_superuser or user.role == 'admin'
        user_can_create_projects = user.can_create_projects()
        user_can_collect_data = user.can_collect_data()
        
        stats = {
            'total_respondents': total_respondents,
            'active_projects': active_projects, 
            'team_members': team_members,
            'pending_sync': pending_sync,
            'failed_sync': failed_sync,
            'recent_responses': recent_responses,
            'completion_rate': round(completion_rate, 1),
            'user_permissions': {
                'can_manage_users': user_can_manage,
                'can_create_projects': user_can_create_projects,
                'can_collect_data': user_can_collect_data,
            },
            'summary': {
                'projects_with_responses': user_projects.filter(responses__isnull=False).distinct().count(),
                'total_questions': total_questions,
                'avg_respondents_per_project': round(total_respondents / max(active_projects, 1), 1),
                'personal_projects': personal_projects.count() if user.is_superuser else active_projects,
            }
        }
        
        logger.info(f"Dashboard stats calculated successfully for user {user.email}")
        return Response(stats)
        
    except Exception as e:
        logger.error(f"Error calculating dashboard stats for user {request.user.email}: {str(e)}")
        return Response({
            'error': 'Failed to calculate dashboard statistics',
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def activity_stream(request):
    """Get recent comprehensive activity stream"""
    try:
        user = request.user
        logger.info(f"Activity stream requested by user: {user.email}")
    
        # Get user's projects - consistent with ProjectViewSet logic
        if user.is_superuser:
            user_projects = Project.objects.all()
        else:
            user_projects = Project.objects.filter(created_by=user)
    
        # Get recent activities (last 30 days)
        thirty_days_ago = timezone.now() - timedelta(days=30)
        activities = []
    
        # Recent responses (with better details) - from user's accessible projects
        recent_responses = ResponseModel.objects.filter(
            project__in=user_projects,
            collected_at__gte=thirty_days_ago
        ).select_related('project', 'collected_by', 'question').order_by('-collected_at')[:15]
    
        for response in recent_responses:
            collector_name = "Anonymous"
            if response.collected_by:
                collector_name = response.collected_by.first_name or response.collected_by.username
            
            activities.append({
                'text': f'Response collected for "{response.project.name}" by {collector_name}',
                'timestamp': response.collected_at.isoformat(),
                'verb': 'submitted',
                'type': 'response',
                'project_name': response.project.name,
                'project_id': str(response.project.id)
            })
    
        # Recent projects - user's accessible projects
        recent_projects = user_projects.filter(
            created_at__gte=thirty_days_ago
        ).order_by('-created_at')[:10]
    
        for project in recent_projects:
            creator_name = project.created_by.first_name or project.created_by.username
            activities.append({
                'text': f'Project "{project.name}" created by {creator_name}',
                'timestamp': project.created_at.isoformat(),
                'verb': 'created',
                'type': 'project',
                'project_name': project.name,
                'project_id': str(project.id)
            })
        
        # Recent team member activities - user-specific
        from projects.models import ProjectMemberActivity
        team_activities = ProjectMemberActivity.objects.filter(
            project__in=user_projects,
            created_at__gte=thirty_days_ago
        ).select_related('project', 'actor', 'target_user').order_by('-created_at')[:10]
        
        for activity in team_activities:
            activities.append({
                'text': activity.description,
                'timestamp': activity.created_at.isoformat(),
                'verb': activity.activity_type,
                'type': 'team_member',
                'project_name': activity.project.name,
                'project_id': str(activity.project.id),
                'actor_name': activity.actor.first_name or activity.actor.username,
                'target_name': activity.target_user.first_name or activity.target_user.username if activity.target_user else None
            })
        
        # Recent sync activities - user-specific
        user_sync_queue = SyncQueue.objects.filter(
            created_at__gte=thirty_days_ago,
            status__in=['completed', 'failed']
        )
        
        # Filter sync queue to user-specific items
        if not user.is_superuser:
            user_project_ids = list(user_projects.values_list('id', flat=True))
            user_sync_queue = user_sync_queue.filter(
                models.Q(created_by=user) |
                models.Q(table_name='projects', record_id__in=[str(pid) for pid in user_project_ids])
            ).distinct()
        
        recent_syncs = user_sync_queue.order_by('-created_at')[:5]
        
        for sync_item in recent_syncs:
            status_text = "completed" if sync_item.status == 'completed' else "failed"
            activities.append({
                'text': f'Data sync {status_text} for {sync_item.table_name}',
                'timestamp': sync_item.created_at.isoformat(),
                'verb': 'synced' if sync_item.status == 'completed' else 'sync_failed',
                'type': 'sync',
                'table_name': sync_item.table_name
            })
    
        # Sort by timestamp (most recent first)
        activities.sort(key=lambda x: x['timestamp'], reverse=True)
    
        # Return top 20 activities
        result = activities[:20]
        logger.info(f"Activity stream calculated successfully for user {user.email}, {len(result)} activities")
        return Response(result)
        
    except Exception as e:
        logger.error(f"Error fetching activity stream for user {request.user.email}: {str(e)}")
        return Response({
            'error': 'Failed to fetch activity stream',
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_combined(request):
    """Get combined dashboard data (stats + activity) in a single request"""
    try:
        user = request.user
        logger.info(f"Combined dashboard data requested by user: {user.email}")
        
        # Get user's projects - consistent with ProjectViewSet logic
        if user.is_superuser:
            user_projects = Project.objects.all()
        else:
            user_projects = Project.objects.filter(created_by=user)
        
        # Calculate statistics - user-specific
        total_respondents = Respondent.objects.filter(
            project__in=user_projects
        ).count()
        
        active_projects = user_projects.count()
        
        # Team members calculation using new ProjectMember model
        team_member_ids = set()
        
        # Add project creators from user's accessible projects
        project_creators = user_projects.values_list('created_by_id', flat=True).distinct()
        team_member_ids.update(project_creators)
        
        # Add team members from ProjectMember model
        from projects.models import ProjectMember
        project_members = ProjectMember.objects.filter(
            project__in=user_projects
        ).values_list('user_id', flat=True).distinct()
        team_member_ids.update(project_members)
        
        # Add response collectors from user's accessible projects (for backward compatibility)
        response_collectors = ResponseModel.objects.filter(
            project__in=user_projects,
            collected_by__isnull=False
        ).values_list('collected_by_id', flat=True).distinct()
        team_member_ids.update(response_collectors)
        
        team_members = len(team_member_ids)
        
        # Sync statistics - user-specific
        if user.is_superuser:
            user_sync_queue = SyncQueue.objects.all()
        else:
            # For regular users, show sync items they created or related to their projects
            # Use simpler filtering that works with SQLite
            user_project_ids = list(user_projects.values_list('id', flat=True))
            user_sync_queue = SyncQueue.objects.filter(
                models.Q(created_by=user) |
                models.Q(table_name='projects', record_id__in=[str(pid) for pid in user_project_ids])
            ).distinct()
        
        pending_sync = user_sync_queue.filter(status='pending').count()
        failed_sync = user_sync_queue.filter(status='failed').count()
        
        # Recent activity count
        seven_days_ago = timezone.now() - timedelta(days=7)
        recent_responses = ResponseModel.objects.filter(
            project__in=user_projects,
            collected_at__gte=seven_days_ago
        ).count()
        
        # Activity feed (last 15 items) - user-specific
        thirty_days_ago = timezone.now() - timedelta(days=30)
        activities = []
        
        # Recent responses from user's accessible projects
        recent_response_objs = ResponseModel.objects.filter(
            project__in=user_projects,
            collected_at__gte=thirty_days_ago
        ).select_related('project', 'collected_by').order_by('-collected_at')[:10]
        
        for response in recent_response_objs:
            collector_name = "Anonymous"
            if response.collected_by:
                collector_name = response.collected_by.first_name or response.collected_by.username
            
            activities.append({
                'text': f'Response collected for "{response.project.name}" by {collector_name}',
                'timestamp': response.collected_at.isoformat(),
                'verb': 'submitted',
                'type': 'response'
            })
        
        # Recent projects from user's accessible projects
        recent_project_objs = user_projects.filter(
            created_at__gte=thirty_days_ago
        ).order_by('-created_at')[:5]
        
        for project in recent_project_objs:
            creator_name = project.created_by.first_name or project.created_by.username
            activities.append({
                'text': f'Project "{project.name}" created by {creator_name}',
                'timestamp': project.created_at.isoformat(),
                'verb': 'created',
                'type': 'project'
            })
        
        # Recent team member activities from user's accessible projects
        from projects.models import ProjectMemberActivity
        team_activities = ProjectMemberActivity.objects.filter(
            project__in=user_projects,
            created_at__gte=thirty_days_ago
        ).select_related('project', 'actor', 'target_user').order_by('-created_at')[:8]
        
        for activity in team_activities:
            activities.append({
                'text': activity.description,
                'timestamp': activity.created_at.isoformat(),
                'verb': activity.activity_type,
                'type': 'team_member'
            })
        
        # Sort activities by timestamp
        activities.sort(key=lambda x: x['timestamp'], reverse=True)
        
        # Combined response
        combined_data = {
            'stats': {
                'total_respondents': total_respondents,
                'active_projects': active_projects,
                'team_members': team_members,
                'pending_sync': pending_sync,
                'failed_sync': failed_sync,
                'recent_responses': recent_responses,
                'user_permissions': {
                    'can_manage_users': user.is_superuser or user.role == 'admin',
                    'can_create_projects': user.can_create_projects(),
                    'can_collect_data': user.can_collect_data(),
                }
            },
            'activity_feed': activities[:15],
            'timestamp': timezone.now().isoformat()
        }
        
        logger.info(f"Combined dashboard data calculated successfully for user {user.email}")
        return Response(combined_data)
        
    except Exception as e:
        logger.error(f"Error fetching combined dashboard data for user {request.user.email}: {str(e)}")
        return Response({
            'error': 'Failed to fetch dashboard data',
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Example ViewSet
# class ExampleViewSet(viewsets.ModelViewSet):
#     permission_classes = [IsAuthenticated]
#     queryset = Example.objects.all()
#     serializer_class = ExampleSerializer 

class QuestionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = QuestionSerializer

    def get_queryset(self):
        project_id = self.kwargs.get('project_pk')
        return Question.objects.filter(project_id=project_id)

    def perform_create(self, serializer):
        project_id = self.kwargs.get('project_pk')
        project = Project.objects.get(id=project_id)
        serializer.save(project=project)

    @action(detail=False, methods=['get'])
    def reorder(self, request, project_pk=None):
        """Reorder questions within a project"""
        questions = self.get_queryset()
        order_data = request.data.get('order', [])
        
        if not order_data:
            return Response(
                {'error': 'Order data is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update order_index for each question
        for index, question_id in enumerate(order_data):
            Question.objects.filter(id=question_id).update(order_index=index)

        return Response({'status': 'Questions reordered successfully'}) 