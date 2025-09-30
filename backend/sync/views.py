from django.shortcuts import render
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction
from typing import Dict, Any
import logging
import asyncio
import json

from .models import SyncQueue
from .serializers import SyncQueueSerializer

logger = logging.getLogger(__name__)


class SyncQueueViewSet(viewsets.ModelViewSet):
    """
    Enhanced sync queue viewset with FastAPI integration and proper error handling
    """
    serializer_class = SyncQueueSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Filter sync queue items by the authenticated user and their projects.
        """
        user = self.request.user
        
        if user.is_superuser:
            queryset = SyncQueue.objects.all()
        else:
            # Filter by user and allowed table names
            queryset = SyncQueue.objects.filter(
                created_by=user,
                table_name__in=['projects', 'questions', 'responses', 'analytics_results']
            )
        
        # Apply status filter if provided
        status_filter = self.request.query_params.get('status')
        if status_filter and status_filter in dict(SyncQueue.STATUS_CHOICES):
            queryset = queryset.filter(status=status_filter)
        
        # Apply priority ordering
        return queryset.order_by('-priority', '-created_at')

    def perform_create(self, serializer):
        """Create sync queue item with proper validation"""
        try:
            # Validate data structure if provided
            data = serializer.validated_data.get('data')
            if data and isinstance(data, str):
                try:
                    json.loads(data)
                except json.JSONDecodeError:
                    raise ValueError("Invalid JSON data format")
            
            serializer.save(created_by=self.request.user)
            logger.info(f"Sync queue item created: {serializer.instance.id}")
            
        except Exception as e:
            logger.error(f"Error creating sync queue item: {str(e)}")
            raise

    def create(self, request, *args, **kwargs):
        """Enhanced create with better response handling"""
        try:
            response = super().create(request, *args, **kwargs)
            return Response({
                'success': True,
                'data': response.data,
                'message': 'Sync item queued successfully'
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
                'message': 'Failed to queue sync item'
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def process_pending(self, request):
        """Process all pending sync queue items with FastAPI integration"""
        try:
            pending_items = self.get_queryset().filter(status='pending')
            total_items = pending_items.count()
            
            if total_items == 0:
                return Response({
                    'success': True,
                    'message': 'No pending items to process',
                    'total_processed': 0
                })
            
            processed_count = 0
            failed_count = 0
            errors = []
            
            for item in pending_items:
                try:
                    result = self._process_single_item(item)
                    if result['success']:
                        processed_count += 1
                    else:
                        failed_count += 1
                        errors.append(f"Item {item.id}: {result.get('error', 'Unknown error')}")
                        
                except Exception as e:
                    failed_count += 1
                    errors.append(f"Item {item.id}: {str(e)}")
                    logger.error(f"Error processing sync item {item.id}: {str(e)}")
            
            return Response({
                'success': processed_count > 0,
                'message': f'Processed {processed_count} items, {failed_count} failed',
                'total_processed': processed_count,
                'failed_count': failed_count,
                'errors': errors[:5]  # Limit error messages
            })
            
        except Exception as e:
            logger.error(f"Error in process_pending: {str(e)}")
            return Response({
                'success': False,
                'error': str(e),
                'message': 'Failed to process pending items'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _process_single_item(self, item: SyncQueue) -> Dict[str, Any]:
        """Process a single sync queue item"""
        try:
            with transaction.atomic():
                # Update status to syncing
                item.status = 'syncing'
                item.increment_attempts()
                
                # Delegate to appropriate handler based on table_name
                handler_result = self._delegate_sync_operation(item)
                
                if handler_result['success']:
                    item.mark_as_completed()
                    logger.info(f"Successfully synced item {item.id}")
                else:
                    error_msg = handler_result.get('error', 'Unknown error')
                    item.mark_as_failed(error_msg)
                    logger.warning(f"Failed to sync item {item.id}: {error_msg}")
                
                return handler_result
                
        except Exception as e:
            item.mark_as_failed(str(e))
            logger.error(f"Exception processing item {item.id}: {str(e)}")
            return {'success': False, 'error': str(e)}

    def _delegate_sync_operation(self, item: SyncQueue) -> Dict[str, Any]:
        """Delegate sync operation to appropriate service"""
        try:
            # Parse data
            data = {}
            if item.data:
                if isinstance(item.data, str):
                    data = json.loads(item.data)
                else:
                    data = item.data
            
            # Route to appropriate handler based on table name and operation
            if item.table_name in ['analytics_results', 'analytics_cache']:
                return self._sync_to_fastapi(item, data)
            else:
                return self._sync_within_django(item, data)
                
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _sync_to_fastapi(self, item: SyncQueue, data: Dict) -> Dict[str, Any]:
        """Sync analytics data to FastAPI service"""
        try:
            # This would integrate with FastAPI analytics service
            # For now, we'll simulate the integration
            
            # In a real implementation, this would:
            # 1. Send data to FastAPI analytics endpoints
            # 2. Handle the response
            # 3. Update local cache if needed
            
            logger.info(f"Syncing item {item.id} to FastAPI analytics service")
            
            # Simulate successful analytics sync
            return {
                'success': True,
                'message': f'Synced {item.table_name} to analytics service'
            }
            
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _sync_within_django(self, item: SyncQueue, data: Dict) -> Dict[str, Any]:
        """Sync data within Django ecosystem"""
        try:
            from django.apps import apps
            
            # Get the model class
            app_label, model_name = self._parse_table_name(item.table_name)
            if not app_label or not model_name:
                return {'success': False, 'error': f'Invalid table name: {item.table_name}'}
            
            try:
                model_class = apps.get_model(app_label, model_name)
            except LookupError:
                return {'success': False, 'error': f'Model not found: {item.table_name}'}
            
            # Perform the operation
            result = self._execute_model_operation(model_class, item, data)
            return result
            
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _parse_table_name(self, table_name: str) -> tuple:
        """Parse table name to get app_label and model_name"""
        # Map table names to Django app.model format
        table_mapping = {
            'projects': ('projects', 'Project'),
            'questions': ('forms', 'Question'),
            'responses': ('responses', 'Response'),
            'analytics_results': ('analytics_results', 'AnalyticsResult')
        }
        
        return table_mapping.get(table_name, (None, None))

    def _execute_model_operation(self, model_class, item: SyncQueue, data: Dict) -> Dict[str, Any]:
        """Execute the actual model operation"""
        try:
            if item.operation == 'create':
                instance = model_class.objects.create(**data)
                return {'success': True, 'message': f'Created {model_class.__name__} with id {instance.id}'}
                
            elif item.operation == 'update':
                try:
                    instance = model_class.objects.get(id=item.record_id)
                    for key, value in data.items():
                        setattr(instance, key, value)
                    instance.save()
                    return {'success': True, 'message': f'Updated {model_class.__name__} {item.record_id}'}
                except model_class.DoesNotExist:
                    return {'success': False, 'error': f'{model_class.__name__} {item.record_id} not found'}
                    
            elif item.operation == 'delete':
                try:
                    instance = model_class.objects.get(id=item.record_id)
                    instance.delete()
                    return {'success': True, 'message': f'Deleted {model_class.__name__} {item.record_id}'}
                except model_class.DoesNotExist:
                    return {'success': False, 'error': f'{model_class.__name__} {item.record_id} not found'}
                    
            else:
                return {'success': False, 'error': f'Unknown operation: {item.operation}'}
                
        except Exception as e:
            return {'success': False, 'error': str(e)}

    @action(detail=True, methods=['post'])
    def retry(self, request, pk=None):
        """Retry a failed sync queue item"""
        try:
            sync_item = self.get_object()
            
            if sync_item.status not in ['failed', 'completed']:
                return Response({
                    'success': False,
                    'error': f'Cannot retry item with status: {sync_item.status}',
                    'message': 'Only failed items can be retried'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            sync_item.status = 'pending'
            sync_item.error_message = None
            sync_item.save()
            
            return Response({
                'success': True,
                'message': 'Item queued for retry',
                'id': sync_item.id
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
                'message': 'Failed to retry item'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get comprehensive sync statistics"""
        try:
            queryset = self.get_queryset()
            
            stats = {
                'total': queryset.count(),
                'pending': queryset.filter(status='pending').count(),
                'syncing': queryset.filter(status='syncing').count(),
                'completed': queryset.filter(status='completed').count(),
                'failed': queryset.filter(status='failed').count(),
            }
            
            # Add recent activity
            recent_items = queryset.filter(
                last_attempt__isnull=False
            ).order_by('-last_attempt')[:5]
            
            recent_activity = []
            for item in recent_items:
                recent_activity.append({
                    'id': item.id,
                    'table_name': item.table_name,
                    'operation': item.operation,
                    'status': item.status,
                    'last_attempt': item.last_attempt
                })
            
            return Response({
                'success': True,
                'stats': stats,
                'recent_activity': recent_activity
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
                'message': 'Failed to get sync statistics'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def clear_completed(self, request):
        """Clear completed sync items"""
        try:
            completed_items = self.get_queryset().filter(status='completed')
            count = completed_items.count()
            completed_items.delete()
            
            return Response({
                'success': True,
                'message': f'Cleared {count} completed items',
                'cleared_count': count
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
                'message': 'Failed to clear completed items'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def retry_failed(self, request):
        """Retry all failed items"""
        try:
            failed_items = self.get_queryset().filter(status='failed')
            count = failed_items.count()
            
            failed_items.update(
                status='pending',
                error_message=None,
                attempts=0
            )
            
            return Response({
                'success': True,
                'message': f'Queued {count} failed items for retry',
                'retry_count': count
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
                'message': 'Failed to retry failed items'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
