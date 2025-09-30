from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
import uuid
import secrets
from datetime import timedelta

class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=[
        ('admin', 'Administrator'),
        ('researcher', 'Researcher'),
        ('field_worker', 'Field Worker'),
    ], default='researcher')
    institution = models.CharField(max_length=255, blank=True, help_text="Organization or institution the user belongs to")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.email
    
    def get_projects_count(self):
        """Get the number of projects created by this user"""
        return self.created_projects.count()
    
    def get_responses_collected_count(self):
        """Get the number of responses collected by this user"""
        return self.collected_responses.count()
    
    def get_sync_operations_count(self):
        """Get the number of sync operations initiated by this user"""
        return self.sync_operations.count()
    
    def can_access_project(self, project):
        """Check if this user can access a specific project"""
        if self.is_superuser:
            return True
        if project.created_by == self:
            return True
        if self.role in ['admin', 'researcher']:
            return True
        return False
    
    def can_manage_users(self):
        """Check if this user can manage other users"""
        return self.is_superuser or self.role == 'admin'
    
    def can_create_projects(self):
        """Check if this user can create projects"""
        return self.is_superuser or self.role in ['admin', 'researcher']
    
    def can_collect_data(self):
        """Check if this user can collect data"""
        return self.is_superuser or self.role in ['admin', 'researcher', 'field_worker']
    
    def get_user_summary(self):
        """Get a summary of user activity"""
        return {
            'projects_created': self.get_projects_count(),
            'responses_collected': self.get_responses_collected_count(),
            'sync_operations': self.get_sync_operations_count(),
            'can_manage_users': self.can_manage_users(),
            'can_create_projects': self.can_create_projects(),
            'can_collect_data': self.can_collect_data(),
        }

    def get_unread_notifications_count(self):
        """Get count of unread notifications"""
        return self.notifications.filter(is_read=False).count()


class PasswordResetToken(models.Model):
    """Model for secure password reset tokens"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_reset_tokens')
    token = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-created_at']
    
    def save(self, *args, **kwargs):
        if not self.token:
            self.token = secrets.token_urlsafe(32)
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=24)  # 24 hour expiry
        super().save(*args, **kwargs)
    
    def is_valid(self):
        """Check if token is valid (not used and not expired)"""
        return not self.used and timezone.now() < self.expires_at
    
    def mark_used(self):
        """Mark token as used"""
        self.used = True
        self.save()
    
    def __str__(self):
        return f"Reset token for {self.user.email} - {'Valid' if self.is_valid() else 'Invalid'}"


class UserNotification(models.Model):
    """Model for user notifications including team invitations"""
    
    NOTIFICATION_TYPES = [
        ('team_invitation', 'Team Invitation'),
        ('project_update', 'Project Update'),
        ('system_message', 'System Message'),
        ('welcome', 'Welcome Message'),
    ]
    
    PRIORITY_LEVELS = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    
    # Notification content
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES, default='system_message')
    priority = models.CharField(max_length=10, choices=PRIORITY_LEVELS, default='medium')
    
    # Status
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    
    # Related objects (optional)
    related_project_id = models.UUIDField(null=True, blank=True, help_text="ID of related project")
    related_user_id = models.UUIDField(null=True, blank=True, help_text="ID of related user (e.g., who sent invitation)")
    
    # Metadata
    action_url = models.CharField(max_length=500, blank=True, help_text="URL for action button")
    action_text = models.CharField(max_length=100, blank=True, help_text="Text for action button")
    expires_at = models.DateTimeField(null=True, blank=True, help_text="When notification expires")
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['notification_type', 'created_at']),
            models.Index(fields=['priority', 'created_at']),
        ]
    
    def __str__(self):
        status = "Read" if self.is_read else "Unread"
        return f"{self.user.username} - {self.title} ({status})"
    
    def mark_as_read(self):
        """Mark notification as read"""
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save()
    
    def is_expired(self):
        """Check if notification has expired"""
        if self.expires_at:
            return timezone.now() > self.expires_at
        return False
    
    @classmethod
    def create_team_invitation_notification(cls, user, project, inviter, role):
        """Create a team invitation notification"""
        return cls.objects.create(
            user=user,
            title=f"Team Invitation: {project.name}",
            message=f"{inviter.username} has invited you to join the project '{project.name}' as a {role.title()}. "
                   f"You can now access the project and collaborate with the team.",
            notification_type='team_invitation',
            priority='medium',
            related_project_id=project.id,
            related_user_id=inviter.id,
            action_text="View Project",
            action_url=f"/projects/{project.id}/",
            expires_at=timezone.now() + timedelta(days=30)  # Invitation expires in 30 days
        )
    
    @classmethod
    def create_welcome_notification(cls, user):
        """Create a welcome notification for new users"""
        return cls.objects.create(
            user=user,
            title="Welcome to the Research Platform!",
            message="Welcome to our research data collection platform. You can now create projects, "
                   "collect data, collaborate with team members, and run analytics on your data.",
            notification_type='welcome',
            priority='low',
            action_text="Get Started",
            action_url="/dashboard/"
        )
