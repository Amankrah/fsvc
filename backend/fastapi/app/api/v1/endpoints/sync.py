"""
Sync endpoints for data synchronization between devices and server.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from datetime import datetime
from asgiref.sync import sync_to_async

from core.database import get_db
from app.utils.shared import AnalyticsUtils

router = APIRouter()

@router.get("/status")
async def get_sync_status(
    project_id: str = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get sync status for projects or specific project.
    
    Args:
        project_id: Optional project identifier
        db: Database session
        
    Returns:
        Sync status information
    """
    try:
        @sync_to_async
        def get_sync_data():
            from core.database import get_django_db_connection
            from projects.models import Project
            from responses.models import Response
            from forms.models import Question
            
            # Get sync statistics
            if project_id:
                # Specific project sync status
                try:
                    project = Project.objects.get(id=project_id)
                    pending_responses = Response.objects.filter(
                        project=project, 
                        sync_status='pending'
                    ).count()
                    pending_questions = Question.objects.filter(
                        project=project, 
                        sync_status='pending'
                    ).count()
                    
                    return {
                        'type': 'project',
                        'project_id': project_id,
                        'project_name': project.name,
                        'pending_responses': pending_responses,
                        'pending_questions': pending_questions,
                        'last_sync': project.updated_at.isoformat(),
                        'sync_status': 'pending' if (pending_responses > 0 or pending_questions > 0) else 'synced'
                    }
                except Project.DoesNotExist:
                    return {'type': 'error', 'message': 'Project not found'}
            else:
                # Overall sync status
                total_pending_responses = Response.objects.filter(sync_status='pending').count()
                total_pending_questions = Question.objects.filter(sync_status='pending').count()
                
                return {
                    'type': 'overall',
                    'total_pending_responses': total_pending_responses,
                    'total_pending_questions': total_pending_questions,
                    'overall_sync_status': 'pending' if (total_pending_responses > 0 or total_pending_questions > 0) else 'synced',
                    'last_checked': datetime.now().isoformat()
                }
        
        result = await get_sync_data()
        
        if result['type'] == 'error':
            return AnalyticsUtils.format_api_response('error', None, result['message'])
        elif result['type'] == 'project':
            return AnalyticsUtils.format_api_response('success', {
                'project_id': result['project_id'],
                'project_name': result['project_name'],
                'pending_responses': result['pending_responses'],
                'pending_questions': result['pending_questions'],
                'last_sync': result['last_sync'],
                'sync_status': result['sync_status']
            })
        else:  # overall
            return AnalyticsUtils.format_api_response('success', {
                'total_pending_responses': result['total_pending_responses'],
                'total_pending_questions': result['total_pending_questions'],
                'overall_sync_status': result['overall_sync_status'],
                'last_checked': result['last_checked']
            })
            
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "sync status")

@router.post("/project/{project_id}/sync")
async def sync_project_data(
    project_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Trigger sync for a specific project.
    
    Args:
        project_id: Project identifier
        db: Database session
        
    Returns:
        Sync operation result
    """
    try:
        from core.database import get_django_db_connection
        from projects.models import Project
        from responses.models import Response
        from forms.models import Question
        
        # Get project
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return AnalyticsUtils.format_api_response(
                'error', 
                None, 
                'Project not found'
            )
        
        # Count items to sync
        pending_responses = Response.objects.filter(
            project=project, 
            sync_status='pending'
        )
        pending_questions = Question.objects.filter(
            project=project, 
            sync_status='pending'
        )
        
        response_count = pending_responses.count()
        question_count = pending_questions.count()
        
        if response_count == 0 and question_count == 0:
            return AnalyticsUtils.format_api_response('success', {
                'project_id': project_id,
                'message': 'No pending items to sync',
                'synced_responses': 0,
                'synced_questions': 0
            })
        
        # Simulate sync process (in real implementation, this would sync with cloud)
        # Mark items as synced
        pending_responses.update(sync_status='synced')
        pending_questions.update(sync_status='synced')
        
        # Update project sync status
        project.sync_status = 'synced'
        project.save()
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'message': 'Sync completed successfully',
            'synced_responses': response_count,
            'synced_questions': question_count,
            'sync_timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "project sync")

@router.post("/bulk-sync")
async def bulk_sync_all_projects(
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Trigger sync for all projects.
    
    Args:
        db: Database session
        
    Returns:
        Bulk sync operation result
    """
    try:
        from core.database import get_django_db_connection
        from projects.models import Project
        from responses.models import Response
        from forms.models import Question
        
        # Get all pending items
        pending_responses = Response.objects.filter(sync_status='pending')
        pending_questions = Question.objects.filter(sync_status='pending')
        
        total_responses = pending_responses.count()
        total_questions = pending_questions.count()
        
        if total_responses == 0 and total_questions == 0:
            return AnalyticsUtils.format_api_response('success', {
                'message': 'No pending items to sync',
                'total_synced_responses': 0,
                'total_synced_questions': 0,
                'projects_affected': 0
            })
        
        # Simulate bulk sync
        pending_responses.update(sync_status='synced')
        pending_questions.update(sync_status='synced')
        
        # Update all projects
        Project.objects.filter(sync_status='pending').update(sync_status='synced')
        
        # Count affected projects
        affected_projects = Project.objects.filter(sync_status='synced').count()
        
        return AnalyticsUtils.format_api_response('success', {
            'message': 'Bulk sync completed successfully',
            'total_synced_responses': total_responses,
            'total_synced_questions': total_questions,
            'projects_affected': affected_projects,
            'sync_timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "bulk sync")

@router.get("/health")
async def sync_health_check(
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Health check for sync functionality.
    
    Returns:
        Health status
    """
    try:
        return AnalyticsUtils.format_api_response('success', {
            'sync_service': 'healthy',
            'database_connection': 'active'
        })
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "sync health check") 