from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from authentication.models import User
import json
from typing import Dict, Any


class SyncQueueManager(models.Manager):
    """Custom manager for SyncQueue with useful methods"""
    
    def pending(self):
        """Get all pending sync items"""
        return self.filter(status='pending')
    
    def failed(self):
        """Get all failed sync items"""
        return self.filter(status='failed')
    
    def completed(self):
        """Get all completed sync items"""
        return self.filter(status='completed')
    
    def by_priority(self):
        """Get items ordered by priority"""
        return self.order_by('-priority', 'created_at')
    
    def for_user(self, user):
        """Get sync items for a specific user"""
        return self.filter(created_by=user)
    
    def for_table(self, table_name):
        """Get sync items for a specific table"""
        return self.filter(table_name=table_name)
    
    def retry_failed(self):
        """Reset all failed items to pending"""
        return self.failed().update(
            status='pending',
            error_message=None,
            attempts=0
        )
    
    def cleanup_completed(self, days_old=7):
        """Clean up completed items older than specified days"""
        cutoff_date = timezone.now() - timezone.timedelta(days=days_old)
        return self.completed().filter(created_at__lt=cutoff_date).delete()


class SyncQueue(models.Model):
    """
    Enhanced sync queue model with optimized indexing and better functionality
    """
    
    OPERATION_CHOICES = [
        ('create', 'Create'),
        ('update', 'Update'),
        ('delete', 'Delete'),
        ('sync', 'Sync'),  # For generic sync operations
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('syncing', 'Syncing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    
    # Priority levels
    PRIORITY_LOW = 0
    PRIORITY_NORMAL = 5
    PRIORITY_HIGH = 10
    PRIORITY_URGENT = 15
    
    PRIORITY_CHOICES = [
        (PRIORITY_LOW, 'Low'),
        (PRIORITY_NORMAL, 'Normal'),
        (PRIORITY_HIGH, 'High'),
        (PRIORITY_URGENT, 'Urgent'),
    ]

    # Core fields
    table_name = models.CharField(
        max_length=255,
        db_index=True,
        help_text="Name of the table/model being synchronized"
    )
    record_id = models.CharField(
        max_length=255,
        db_index=True,
        help_text="ID of the record being synchronized"
    )
    operation = models.CharField(
        max_length=10, 
        choices=OPERATION_CHOICES,
        db_index=True
    )
    data = models.JSONField(
        null=True, 
        blank=True,
        help_text="JSON data for the sync operation"
    )
    
    # User and tracking fields
    created_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='sync_operations',
        db_index=True
    )
    created_at = models.DateTimeField(
        default=timezone.now,
        db_index=True
    )
    updated_at = models.DateTimeField(auto_now=True)
    
    # Sync execution fields
    attempts = models.PositiveIntegerField(
        default=0,
        help_text="Number of sync attempts"
    )
    max_attempts = models.PositiveIntegerField(
        default=3,
        help_text="Maximum number of retry attempts"
    )
    last_attempt = models.DateTimeField(
        null=True, 
        blank=True,
        help_text="Timestamp of last sync attempt"
    )
    next_retry = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Scheduled time for next retry"
    )
    
    # Status and error handling
    status = models.CharField(
        max_length=10, 
        choices=STATUS_CHOICES, 
        default='pending',
        db_index=True
    )
    error_message = models.TextField(
        blank=True, 
        null=True,
        help_text="Error message from failed sync attempts"
    )
    error_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of consecutive errors"
    )
    
    # Priority and scheduling
    priority = models.IntegerField(
        choices=PRIORITY_CHOICES,
        default=PRIORITY_NORMAL,
        db_index=True,
        help_text="Priority level for sync processing"
    )
    
    # Generic foreign key for referencing actual model instances
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    object_id = models.PositiveIntegerField(null=True, blank=True)
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # Metadata
    sync_source = models.CharField(
        max_length=100,
        default='gui',
        help_text="Source system that initiated the sync"
    )
    sync_target = models.CharField(
        max_length=100,
        default='django',
        help_text="Target system for the sync"
    )
    
    # Custom manager
    objects = SyncQueueManager()

    class Meta:
        db_table = 'sync_queue'
        verbose_name = 'Sync Queue Item'
        verbose_name_plural = 'Sync Queue Items'
        
        # Optimized ordering
        ordering = ['-priority', 'created_at']
        
        # Comprehensive indexing strategy
        indexes = [
            # Primary query patterns
            models.Index(fields=['status', 'priority', 'created_at'], name='sync_status_priority_idx'),
            models.Index(fields=['created_by', 'status'], name='sync_user_status_idx'),
            models.Index(fields=['table_name', 'status'], name='sync_table_status_idx'),
            models.Index(fields=['table_name', 'record_id'], name='sync_table_record_idx'),
            
            # Performance indexes
            models.Index(fields=['next_retry'], name='sync_retry_schedule_idx'),
            models.Index(fields=['last_attempt'], name='sync_last_attempt_idx'),
            models.Index(fields=['created_at'], name='sync_created_at_idx'),
            
            # Composite indexes for complex queries
            models.Index(fields=['status', 'attempts', 'max_attempts'], name='sync_retry_logic_idx'),
            models.Index(fields=['sync_source', 'sync_target', 'status'], name='sync_source_target_idx'),
        ]
        
        # Constraints
        constraints = [
            models.CheckConstraint(
                check=models.Q(attempts__gte=0),
                name='sync_attempts_positive'
            ),
            models.CheckConstraint(
                check=models.Q(max_attempts__gt=0),
                name='sync_max_attempts_positive'
            ),
            models.CheckConstraint(
                check=models.Q(priority__gte=0),
                name='sync_priority_positive'
            ),
        ]

    def __str__(self):
        return f"{self.get_operation_display()} - {self.table_name}:{self.record_id} ({self.get_status_display()})"
    
    def clean(self):
        """Model validation"""
        super().clean()
        
        # Validate JSON data
        if self.data:
            if isinstance(self.data, str):
                try:
                    json.loads(self.data)
                except json.JSONDecodeError:
                    raise ValidationError({'data': 'Invalid JSON format'})
        
        # Validate attempts don't exceed max_attempts
        if self.attempts > self.max_attempts:
            raise ValidationError({'attempts': 'Attempts cannot exceed max_attempts'})
    
    def save(self, *args, **kwargs):
        """Enhanced save method with validation"""
        self.full_clean()
        super().save(*args, **kwargs)
    
    @property
    def can_retry(self) -> bool:
        """Check if item can be retried"""
        return (
            self.status in ['failed', 'pending'] and 
            self.attempts < self.max_attempts
        )
    
    @property
    def is_expired(self) -> bool:
        """Check if item has exceeded retry attempts"""
        return self.attempts >= self.max_attempts
    
    @property
    def should_retry_now(self) -> bool:
        """Check if item should be retried now"""
        if not self.can_retry:
            return False
        if not self.next_retry:
            return True
        return timezone.now() >= self.next_retry
    
    def increment_attempts(self, save: bool = True) -> None:
        """Increment the number of attempts and update timestamps"""
        self.attempts += 1
        self.last_attempt = timezone.now()
        
        # Calculate next retry time with exponential backoff
        if self.can_retry:
            delay_minutes = min(60, 5 * (2 ** (self.attempts - 1)))  # Max 1 hour delay
            self.next_retry = timezone.now() + timezone.timedelta(minutes=delay_minutes)
        
        if save:
            self.save(update_fields=['attempts', 'last_attempt', 'next_retry'])
    
    def mark_as_failed(self, error_message: str = "", save: bool = True) -> None:
        """Mark the sync operation as failed"""
        self.status = 'failed'
        self.error_message = error_message
        self.error_count += 1
        self.increment_attempts(save=False)
        
        if save:
            self.save(update_fields=[
                'status', 'error_message', 'error_count', 
                'attempts', 'last_attempt', 'next_retry'
            ])
    
    def mark_as_completed(self, save: bool = True) -> None:
        """Mark the sync operation as completed"""
        self.status = 'completed'
        self.error_message = None
        self.error_count = 0
        self.next_retry = None
        
        if save:
            self.save(update_fields=['status', 'error_message', 'error_count', 'next_retry'])
    
    def mark_as_syncing(self, save: bool = True) -> None:
        """Mark the sync operation as currently syncing"""
        self.status = 'syncing'
        
        if save:
            self.save(update_fields=['status'])
    
    def reset_for_retry(self, save: bool = True) -> None:
        """Reset item for retry"""
        if not self.can_retry:
            raise ValueError("Item cannot be retried")
        
        self.status = 'pending'
        self.error_message = None
        self.next_retry = None
        
        if save:
            self.save(update_fields=['status', 'error_message', 'next_retry'])
    
    def get_data_as_dict(self) -> Dict[str, Any]:
        """Get data field as dictionary"""
        if not self.data:
            return {}
        
        if isinstance(self.data, dict):
            return self.data
        
        if isinstance(self.data, str):
            try:
                return json.loads(self.data)
            except json.JSONDecodeError:
                return {}
        
        return {}
    
    def set_data_from_dict(self, data: Dict[str, Any]) -> None:
        """Set data field from dictionary"""
        self.data = data
    
    @classmethod
    def create_sync_item(
        cls,
        table_name: str,
        record_id: str,
        operation: str,
        data: Dict[str, Any] = None,
        user: User = None,
        priority: int = PRIORITY_NORMAL
    ) -> 'SyncQueue':
        """Factory method to create sync items"""
        return cls.objects.create(
            table_name=table_name,
            record_id=record_id,
            operation=operation,
            data=data,
            created_by=user,
            priority=priority
        )
    
    @classmethod
    def get_stats(cls) -> Dict[str, int]:
        """Get sync queue statistics"""
        return {
            'total': cls.objects.count(),
            'pending': cls.objects.pending().count(),
            'syncing': cls.objects.filter(status='syncing').count(),
            'completed': cls.objects.completed().count(),
            'failed': cls.objects.failed().count(),
            'cancelled': cls.objects.filter(status='cancelled').count(),
        }
