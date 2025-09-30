"""
Enhanced data synchronization manager with Django integration.
"""

import os
import sys
import django
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
import uuid
import logging
from datetime import datetime
from .conflict_resolver import ConflictResolver
import asyncio
import json
import requests
from functools import lru_cache

# Setup Django integration
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '..', '..'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_core.settings.development')
django.setup()

logger = logging.getLogger(__name__)


class SyncManager:
    """Enhanced sync manager with Django integration and analytics pipeline."""
    
    def __init__(self, db: Session):
        """
        Initialize the sync manager.
        
        Args:
            db: SQLAlchemy database session
        """
        self.db = db
        self.resolver = ConflictResolver(db)
        self._active_syncs: Dict[str, Dict[str, Any]] = {}
        self._sync_callbacks: List[callable] = []
        
        # Django integration
        self.django_sync_url = "http://127.0.0.1:8000/api/sync/sync-queue/"
        
    def add_sync_callback(self, callback: callable) -> None:
        """Add callback for sync events"""
        if callback not in self._sync_callbacks:
            self._sync_callbacks.append(callback)
    
    def remove_sync_callback(self, callback: callable) -> None:
        """Remove sync callback"""
        if callback in self._sync_callbacks:
            self._sync_callbacks.remove(callback)
    
    def _notify_callbacks(self, event: str, data: Dict[str, Any]) -> None:
        """Notify all registered callbacks"""
        for callback in self._sync_callbacks:
            try:
                callback(event, data)
            except Exception as e:
                logger.error(f"Error in sync callback: {e}")
    
    async def start_sync(self, source: str, target: str, sync_type: str = "full") -> str:
        """
        Start a new synchronization process.
        
        Args:
            source: Source system identifier
            target: Target system identifier
            sync_type: Type of sync (full, incremental, analytics_only)
            
        Returns:
            Sync process identifier
        """
        sync_id = str(uuid.uuid4())
        self._active_syncs[sync_id] = {
            "source": source,
            "target": target,
            "sync_type": sync_type,
            "status": "running",
            "started_at": datetime.utcnow(),
            "progress": 0,
            "processed_items": 0,
            "total_items": 0,
            "conflicts": [],
            "errors": []
        }
        
        # Notify callbacks
        self._notify_callbacks("sync_started", {"sync_id": sync_id, "source": source, "target": target})
        
        # Start the sync process asynchronously
        asyncio.create_task(self._run_sync(sync_id))
        
        return sync_id
    
    async def get_status(self, sync_id: str) -> Dict[str, Any]:
        """
        Get the status of a synchronization process.
        
        Args:
            sync_id: Sync process identifier
            
        Returns:
            Dictionary with sync status
        """
        if sync_id not in self._active_syncs:
            raise ValueError(f"Sync process {sync_id} not found")
        
        return self._active_syncs[sync_id]
    
    async def get_all_active_syncs(self) -> Dict[str, Dict[str, Any]]:
        """Get all active sync processes"""
        return self._active_syncs.copy()
    
    async def cancel_sync(self, sync_id: str) -> bool:
        """
        Cancel a running sync process.
        
        Args:
            sync_id: Sync process identifier
            
        Returns:
            True if cancelled successfully
        """
        if sync_id not in self._active_syncs:
            return False
        
        sync_info = self._active_syncs[sync_id]
        if sync_info["status"] == "running":
            sync_info["status"] = "cancelled"
            sync_info["cancelled_at"] = datetime.utcnow()
            
            self._notify_callbacks("sync_cancelled", {"sync_id": sync_id})
            return True
        
        return False
    
    async def _run_sync(self, sync_id: str):
        """
        Run the synchronization process.
        
        Args:
            sync_id: Sync process identifier
        """
        sync_info = self._active_syncs[sync_id]
        
        try:
            logger.info(f"Starting sync process {sync_id}")
            
            # Get sync type and route to appropriate handler
            sync_type = sync_info.get("sync_type", "full")
            
            if sync_type == "analytics_only":
                await self._sync_analytics_data(sync_id)
            elif sync_type == "django_to_fastapi":
                await self._sync_django_to_fastapi(sync_id)
            elif sync_type == "incremental":
                await self._sync_incremental(sync_id)
            else:
                await self._sync_full(sync_id)
            
            sync_info["status"] = "completed"
            sync_info["completed_at"] = datetime.utcnow()
            sync_info["progress"] = 100
            
            logger.info(f"Sync process {sync_id} completed successfully")
            self._notify_callbacks("sync_completed", {"sync_id": sync_id, "success": True})
            
        except Exception as e:
            sync_info["status"] = "failed"
            sync_info["error"] = str(e)
            sync_info["failed_at"] = datetime.utcnow()
            sync_info["errors"].append(str(e))
            
            logger.error(f"Sync process {sync_id} failed: {str(e)}")
            self._notify_callbacks("sync_failed", {"sync_id": sync_id, "error": str(e)})
    
    async def _sync_analytics_data(self, sync_id: str):
        """Sync analytics data specifically"""
        sync_info = self._active_syncs[sync_id]
        
        try:
            # Get analytics data from Django
            analytics_data = await self._get_django_analytics_data()
            
            if not analytics_data:
                logger.info(f"No analytics data to sync for {sync_id}")
                return
            
            sync_info["total_items"] = len(analytics_data)
            
            for i, item in enumerate(analytics_data):
                if sync_info["status"] == "cancelled":
                    break
                
                # Process analytics item
                await self._process_analytics_item(item)
                
                sync_info["processed_items"] += 1
                sync_info["progress"] = int((i + 1) / len(analytics_data) * 100)
                
                # Small delay to prevent overwhelming
                await asyncio.sleep(0.1)
            
        except Exception as e:
            logger.error(f"Error syncing analytics data: {e}")
            raise
    
    async def _sync_django_to_fastapi(self, sync_id: str):
        """Sync data from Django to FastAPI"""
        sync_info = self._active_syncs[sync_id]
        
        try:
            # Get pending sync items from Django
            sync_items = await self._get_django_sync_queue()
            
            if not sync_items:
                logger.info(f"No sync items to process for {sync_id}")
                return
            
            sync_info["total_items"] = len(sync_items)
            
            for i, item in enumerate(sync_items):
                if sync_info["status"] == "cancelled":
                    break
                
                # Process sync item
                result = await self._process_django_sync_item(item)
                
                if result["success"]:
                    sync_info["processed_items"] += 1
                else:
                    sync_info["errors"].append(f"Item {item.get('id', 'unknown')}: {result.get('error', 'Unknown error')}")
                
                sync_info["progress"] = int((i + 1) / len(sync_items) * 100)
                
                # Small delay
                await asyncio.sleep(0.05)
            
        except Exception as e:
            logger.error(f"Error syncing Django to FastAPI: {e}")
            raise
    
    async def _sync_incremental(self, sync_id: str):
        """Perform incremental sync"""
        sync_info = self._active_syncs[sync_id]
        
        try:
            # Get changes since last sync (implementation would vary)
            changes = await self._get_incremental_changes()
            
            sync_info["total_items"] = len(changes) if changes else 0
            
            if changes:
                for i, change in enumerate(changes):
                    if sync_info["status"] == "cancelled":
                        break
                    
                    # Process change
                    await self._process_incremental_change(change)
                    
                    sync_info["processed_items"] += 1
                    sync_info["progress"] = int((i + 1) / len(changes) * 100)
                    
                    await asyncio.sleep(0.1)
            
        except Exception as e:
            logger.error(f"Error in incremental sync: {e}")
            raise
    
    async def _sync_full(self, sync_id: str):
        """Perform full synchronization"""
        sync_info = self._active_syncs[sync_id]
        
        try:
            # Combine analytics and regular sync
            await self._sync_analytics_data(sync_id)
            
            if sync_info["status"] != "cancelled":
                await self._sync_django_to_fastapi(sync_id)
            
        except Exception as e:
            logger.error(f"Error in full sync: {e}")
            raise
    
    @lru_cache(maxsize=1)
    def _get_django_connection_params(self) -> Dict[str, str]:
        """Get Django connection parameters (cached)"""
        return {
            "base_url": "http://127.0.0.1:8000",
            "sync_endpoint": "/api/sync/sync-queue/",
            "analytics_endpoint": "/api/analytics/results/"
        }
    
    async def _get_django_analytics_data(self) -> List[Dict[str, Any]]:
        """Get analytics data from Django"""
        try:
            # This would make an actual HTTP request to Django
            # For now, we'll simulate it
            
            # In production, this would be:
            # response = requests.get(f"{base_url}/api/analytics/results/")
            # return response.json()
            
            # Simulated analytics data
            return [
                {
                    "id": "analytics_1",
                    "type": "descriptive",
                    "data": {"mean": 45.2, "std": 12.1},
                    "created_at": datetime.utcnow().isoformat()
                }
            ]
            
        except Exception as e:
            logger.error(f"Error getting Django analytics data: {e}")
            return []
    
    async def _get_django_sync_queue(self) -> List[Dict[str, Any]]:
        """Get sync queue items from Django"""
        try:
            # This would make an actual HTTP request to Django
            # For now, we'll simulate it
            
            # Simulated sync queue data
            return [
                {
                    "id": 1,
                    "table_name": "analytics_results",
                    "operation": "create",
                    "data": {"result": "processed"},
                    "status": "pending"
                }
            ]
            
        except Exception as e:
            logger.error(f"Error getting Django sync queue: {e}")
            return []
    
    async def _get_incremental_changes(self) -> List[Dict[str, Any]]:
        """Get incremental changes since last sync"""
        # This would implement logic to get only changed data
        # For now, return empty list
        return []
    
    async def _process_analytics_item(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """Process a single analytics item"""
        try:
            # This would process the analytics item in the FastAPI context
            # For example: store in analytics database, trigger computations, etc.
            
            logger.info(f"Processing analytics item: {item.get('id', 'unknown')}")
            
            # Simulate processing
            await asyncio.sleep(0.1)
            
            return {"success": True, "processed_id": item.get("id")}
            
        except Exception as e:
            logger.error(f"Error processing analytics item: {e}")
            return {"success": False, "error": str(e)}
    
    async def _process_django_sync_item(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """Process a Django sync queue item"""
        try:
            logger.info(f"Processing Django sync item: {item.get('id', 'unknown')}")
            
            # Route based on table name
            table_name = item.get("table_name", "")
            operation = item.get("operation", "")
            
            if table_name == "analytics_results":
                return await self._process_analytics_item(item.get("data", {}))
            else:
                # Handle other table types
                return {"success": True, "message": f"Processed {table_name} {operation}"}
            
        except Exception as e:
            logger.error(f"Error processing Django sync item: {e}")
            return {"success": False, "error": str(e)}
    
    async def _process_incremental_change(self, change: Dict[str, Any]) -> Dict[str, Any]:
        """Process an incremental change"""
        try:
            # Process the incremental change
            logger.info(f"Processing incremental change: {change.get('id', 'unknown')}")
            
            return {"success": True}
            
        except Exception as e:
            logger.error(f"Error processing incremental change: {e}")
            return {"success": False, "error": str(e)}
    
    async def cleanup_completed_syncs(self, max_age_hours: int = 24) -> int:
        """Clean up old completed sync processes"""
        cutoff_time = datetime.utcnow().replace(hour=datetime.utcnow().hour - max_age_hours)
        
        to_remove = []
        for sync_id, sync_info in self._active_syncs.items():
            if sync_info["status"] in ["completed", "failed", "cancelled"]:
                completed_at = sync_info.get("completed_at") or sync_info.get("failed_at") or sync_info.get("cancelled_at")
                if completed_at and completed_at < cutoff_time:
                    to_remove.append(sync_id)
        
        for sync_id in to_remove:
            del self._active_syncs[sync_id]
        
        return len(to_remove) 