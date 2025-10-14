from django.db import models
import uuid
from authentication.models import User
from django.utils import timezone

class Project(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_projects')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    sync_status = models.CharField(max_length=20, default='pending')
    cloud_id = models.CharField(max_length=255, blank=True, null=True)
    settings = models.JSONField(default=dict)  # Project-specific settings
    metadata = models.JSONField(default=dict)  # Additional metadata

    # Partner collaboration configuration
    has_partners = models.BooleanField(
        default=False,
        help_text="Whether this project involves partner organizations"
    )
    partner_organizations = models.JSONField(
        default=list,
        help_text="List of partner organizations. Format: [{'name': 'Partner ABC', 'contact_email': 'email@partner.org', 'database_endpoint': 'https://...' (optional), 'api_key': '...' (optional)}]"
    )

    # Owner database endpoint (AWS RDS or other) - Optional
    owner_database_endpoint = models.URLField(
        max_length=500,
        blank=True,
        null=True,
        help_text="Optional: AWS RDS or database endpoint URL where owner's responses should be stored"
    )

    # Targeted respondents configuration
    targeted_respondents = models.JSONField(
        default=list,
        help_text="List of respondent types targeted for this project"
    )

    # Targeted commodities
    targeted_commodities = models.JSONField(
        default=list,
        help_text="List of commodities this project focuses on"
    )

    # Targeted countries/regions
    targeted_countries = models.JSONField(
        default=list,
        help_text="List of countries/regions this project covers"
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name
    
    def get_question_count(self):
        """Get the number of questions in this project"""
        return self.questions.count()
    
    def get_response_count(self):
        """Get the number of responses in this project"""
        return self.responses.count()
    
    def get_analytics_count(self):
        """Get the number of analytics results for this project"""
        return self.analytics_results.count()
    
    def get_participants_count(self):
        """Get the number of unique participants (respondents) in this project"""
        return self.responses.values('respondent_id').distinct().count()
    
    def get_team_members_count(self):
        """Get the number of team members in this project (including creator)"""
        return self.members.count() + 1  # +1 for creator
    
    def get_team_members(self):
        """Get all team members including the creator"""
        members = list(self.members.select_related('user').all())
        # Add creator as owner with serializable data
        creator_member = {
            'id': str(self.created_by.id),
            'username': self.created_by.username,
            'email': self.created_by.email,
            'role': 'owner',
            'permissions': ['all'],
            'joined_at': self.created_at.isoformat(),
            'is_creator': True
        }
        return [creator_member] + [
            {
                'id': str(member.user.id),
                'username': member.user.username,
                'email': member.user.email,
                'role': member.role,
                'permissions': member.permissions.split(',') if member.permissions else [],
                'joined_at': member.joined_at.isoformat(),
                'is_creator': False
            } for member in members
        ]
    
    def add_team_member(self, user, role='member', permissions=None, actor=None):
        """Add a team member to the project"""
        if user == self.created_by:
            return False, "Project creator is already a team member"
        
        if self.members.filter(user=user).exists():
            return False, "User is already a team member"
        
        if permissions is None:
            permissions = ['view_project', 'view_responses']
        
        member = ProjectMember.objects.create(
            project=self,
            user=user,
            role=role,
            permissions=','.join(permissions) if isinstance(permissions, list) else permissions
        )
        
        # Create activity record
        if actor:
            self.create_activity(
                activity_type='member_added',
                actor=actor,
                target_user=user,
                metadata={
                    'role': role,
                    'permissions': permissions if isinstance(permissions, list) else permissions.split(',')
                }
            )
        
        return True, member
    
    def remove_team_member(self, user, actor=None):
        """Remove a team member from the project"""
        if user == self.created_by:
            return False, "Cannot remove project creator"
        
        try:
            member = self.members.get(user=user)
            # Store member info before deletion for activity
            member_role = member.role
            member_permissions = member.get_permissions_list()
            
            # Create activity record before deletion
            if actor:
                self.create_activity(
                    activity_type='member_removed',
                    actor=actor,
                    target_user=user,
                    metadata={
                        'role': member_role,
                        'permissions': member_permissions
                    }
                )
            
            member.delete()
            return True, "Team member removed successfully"
        except ProjectMember.DoesNotExist:
            return False, "User is not a team member"
    
    def update_team_member(self, user, role=None, permissions=None, actor=None):
        """Update a team member's role and permissions"""
        if user == self.created_by:
            return False, "Cannot modify project creator permissions"
        
        try:
            member = self.members.get(user=user)
            # Store old values for activity
            old_role = member.role
            old_permissions = member.get_permissions_list()
            
            # Update member
            if role:
                member.role = role
            if permissions:
                member.permissions = ','.join(permissions) if isinstance(permissions, list) else permissions
            member.save()
            
            # Create activity record
            if actor:
                self.create_activity(
                    activity_type='member_updated',
                    actor=actor,
                    target_user=user,
                    metadata={
                        'old_role': old_role,
                        'new_role': member.role,
                        'old_permissions': old_permissions,
                        'new_permissions': member.get_permissions_list()
                    }
                )
            
            return True, member
        except ProjectMember.DoesNotExist:
            return False, "User is not a team member"
    
    def can_user_access(self, user):
        """Check if a user can access this project"""
        if user.is_superuser:
            return True
        if self.created_by == user:
            return True
        if self.members.filter(user=user).exists():
            return True
        if hasattr(user, 'role') and user.role in ['admin', 'researcher']:
            return True
        return False
    
    def can_user_edit(self, user):
        """Check if a user can edit this project (create/modify questions, etc.)"""
        if user.is_superuser:
            return True
        if self.created_by == user:
            return True
        # Check if user is a team member with edit permissions
        try:
            member = self.members.get(user=user)
            permissions = member.permissions.split(',') if member.permissions else []
            return 'all' in permissions or 'edit_project' in permissions or 'manage_questions' in permissions
        except ProjectMember.DoesNotExist:
            # Check if user has admin/researcher role
            if hasattr(user, 'role') and user.role in ['admin', 'researcher']:
                return True
            return False
    
    def get_user_permissions(self, user):
        """Get specific permissions for a user in this project"""
        if user.is_superuser or self.created_by == user:
            return ['all']
        
        try:
            member = self.members.get(user=user)
            return member.permissions.split(',') if member.permissions else ['view_project']
        except ProjectMember.DoesNotExist:
            if user.role in ['admin', 'researcher']:
                return ['view_project', 'view_responses']
            return []
    
    def get_summary_stats(self):
        """Get summary statistics for the project"""
        return {
            'question_count': self.get_question_count(),
            'response_count': self.get_response_count(),
            'analytics_count': self.get_analytics_count(),
            'participants_count': self.get_participants_count(),
            'team_members_count': self.get_team_members_count(),
        }
    
    def create_activity(self, activity_type, actor, target_user=None, description=None, metadata=None):
        """Create an activity record for this project"""
        if metadata is None:
            metadata = {}
        
        if description is None:
            # Generate default descriptions
            if activity_type == 'member_added':
                target_name = target_user.first_name or target_user.username if target_user else 'Unknown'
                description = f'{actor.first_name or actor.username} added {target_name} to the team'
            elif activity_type == 'member_removed':
                target_name = target_user.first_name or target_user.username if target_user else 'Unknown'
                description = f'{actor.first_name or actor.username} removed {target_name} from the team'
            elif activity_type == 'member_updated':
                target_name = target_user.first_name or target_user.username if target_user else 'Unknown'
                role = metadata.get('new_role', '')
                description = f'{actor.first_name or actor.username} updated {target_name}\'s role{" to " + role if role else ""}'
            else:
                description = f'{actor.first_name or actor.username} performed {activity_type} on {self.name}'
        
        return ProjectMemberActivity.objects.create(
            project=self,
            activity_type=activity_type,
            actor=actor,
            target_user=target_user,
            description=description,
            metadata=metadata
        )


class ProjectMember(models.Model):
    """Model to represent team members in a project"""
    
    ROLE_CHOICES = [
        ('member', 'Member'),
        ('analyst', 'Analyst'),
        ('collaborator', 'Collaborator'),
        ('partner', 'Partner Organization'),
        ('viewer', 'Viewer'),
    ]
    
    PERMISSION_CHOICES = [
        ('view_project', 'View Project'),
        ('edit_project', 'Edit Project'),
        ('view_responses', 'View Responses'),
        ('edit_responses', 'Edit Responses'),
        ('delete_responses', 'Delete Responses'),
        ('view_analytics', 'View Analytics'),
        ('run_analytics', 'Run Analytics'),
        ('manage_questions', 'Manage Questions'),
        ('export_data', 'Export Data'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='project_memberships')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='member')
    permissions = models.TextField(
        help_text="Comma-separated list of permissions",
        default='view_project,view_responses'
    )

    # Partner organization affiliation
    partner_organization = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Name of partner organization this member represents (must match project.partner_organizations)"
    )

    joined_at = models.DateTimeField(auto_now_add=True)
    invited_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sent_invitations'
    )
    
    class Meta:
        unique_together = ['project', 'user']
        ordering = ['joined_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.project.name} ({self.role})"
    
    def get_permissions_list(self):
        """Get permissions as a list"""
        return self.permissions.split(',') if self.permissions else []
    
    def has_permission(self, permission):
        """Check if member has a specific permission"""
        return permission in self.get_permissions_list()
    
    def add_permission(self, permission):
        """Add a permission to the member"""
        current_permissions = self.get_permissions_list()
        if permission not in current_permissions:
            current_permissions.append(permission)
            self.permissions = ','.join(current_permissions)
            self.save()
    
    def remove_permission(self, permission):
        """Remove a permission from the member"""
        current_permissions = self.get_permissions_list()
        if permission in current_permissions:
            current_permissions.remove(permission)
            self.permissions = ','.join(current_permissions)
            self.save()
    
    def is_partner(self):
        """Check if this member represents a partner organization"""
        return self.role == 'partner' and self.partner_organization is not None

    def get_partner_config(self):
        """
        Get the partner organization's database configuration from the project.
        Returns the partner dict or None if not a partner or config not found.
        """
        if not self.is_partner():
            return None

        for partner in self.project.partner_organizations:
            if partner.get('name') == self.partner_organization:
                return partner

        return None

    def get_accessible_question_sources(self):
        """
        Get list of question sources this member can view responses for.
        - Owner members: can see 'owner' questions only
        - Partner members: can see their partner's questions only
        - Collaborator/Analyst: can see all questions
        """
        if self.role in ['collaborator', 'analyst']:
            # Full access - can see all question sources
            sources = ['owner']
            for partner in self.project.partner_organizations:
                sources.append(partner.get('name'))
            return sources
        elif self.is_partner():
            # Partner member - only see their own partner's questions
            return [self.partner_organization]
        else:
            # Regular member - only see owner questions
            return ['owner']

    @classmethod
    def get_default_permissions_for_role(cls, role):
        """Get default permissions for a role"""
        role_permissions = {
            'viewer': ['view_project', 'view_responses'],
            'member': ['view_project', 'view_responses', 'edit_responses', 'view_analytics'],
            'analyst': ['view_project', 'view_responses', 'view_analytics', 'run_analytics', 'export_data'],
            'collaborator': ['view_project', 'edit_project', 'view_responses', 'edit_responses',
                           'view_analytics', 'run_analytics', 'manage_questions', 'export_data'],
            'partner': ['view_project', 'view_responses', 'view_analytics', 'export_data'],
        }
        return role_permissions.get(role, ['view_project', 'view_responses'])

class ProjectMemberActivity(models.Model):
    """Model to track activities related to team members and project management"""
    ACTIVITY_TYPES = [
        ('member_added', 'Team Member Added'),
        ('member_removed', 'Team Member Removed'),
        ('member_updated', 'Team Member Updated'),
        ('project_created', 'Project Created'),
        ('project_updated', 'Project Updated'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('Project', on_delete=models.CASCADE, related_name='activities')
    activity_type = models.CharField(max_length=20, choices=ACTIVITY_TYPES)
    actor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='performed_activities')  # User who performed the action
    target_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='target_activities', null=True, blank=True)  # User who was affected (for member activities)
    
    # Activity details
    description = models.TextField()  # Human-readable description
    metadata = models.JSONField(default=dict)  # Additional data (role, permissions, etc.)
    
    # Timestamps
    created_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['project', 'created_at']),
            models.Index(fields=['activity_type', 'created_at']),
            models.Index(fields=['actor', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.actor.username} {self.get_activity_type_display()} - {self.project.name}"


class PendingInvitation(models.Model):
    """Model for pending invitations to users who don't have accounts yet"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('expired', 'Expired'),
        ('cancelled', 'Cancelled'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('Project', on_delete=models.CASCADE, related_name='pending_invitations')
    email = models.EmailField(help_text="Email of the person being invited")
    role = models.CharField(max_length=20, choices=ProjectMember.ROLE_CHOICES, default='member')
    permissions = models.TextField(
        help_text="Comma-separated list of permissions",
        default='view_project,view_responses'
    )
    
    # Invitation details
    invited_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_pending_invitations')
    invitation_token = models.CharField(max_length=100, unique=True, help_text="Unique token for invitation link")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Optional: associated user (set when they register)
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='received_pending_invitations')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(help_text="When invitation expires")
    accepted_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        unique_together = ['project', 'email']  # One pending invitation per email per project
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email', 'status']),
            models.Index(fields=['invitation_token']),
            models.Index(fields=['status', 'expires_at']),
        ]
    
    def save(self, *args, **kwargs):
        if not self.invitation_token:
            import secrets
            self.invitation_token = secrets.token_urlsafe(32)
        if not self.expires_at:
            from datetime import timedelta
            self.expires_at = timezone.now() + timedelta(days=7)  # 7 days to accept
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Pending invitation: {self.email} → {self.project.name} ({self.status})"
    
    def is_valid(self):
        """Check if invitation is still valid"""
        return self.status == 'pending' and timezone.now() < self.expires_at
    
    def get_permissions_list(self):
        """Get permissions as a list"""
        return self.permissions.split(',') if self.permissions else []
    
    def get_invitation_url(self):
        """Get the invitation URL for the email"""
        # For mobile app, return just the token - app will handle the deep link
        # Format: fsda://invite/{token}
        return f"fsda://invite/{self.invitation_token}"

    def get_web_invitation_url(self):
        """Get the web invitation URL (for future web app)"""
        # In a real app, you'd use your domain
        return f"http://localhost:8000/accept-invitation/{self.invitation_token}/"
    
    def accept_invitation(self, user):
        """Accept the invitation and create project membership"""
        if not self.is_valid():
            return False, "Invitation has expired or is no longer valid"
        
        # Check if user is already a member
        if self.project.members.filter(user=user).exists():
            return False, "User is already a member of this project"
        
        # Create project membership
        success, result = self.project.add_team_member(
            user=user,
            role=self.role,
            permissions=self.get_permissions_list(),
            actor=user  # User accepts their own invitation
        )
        
        if success:
            # Update invitation status
            self.status = 'accepted'
            self.user = user
            self.accepted_at = timezone.now()
            self.save()
            
            # Create notification for the user
            from authentication.models import UserNotification
            UserNotification.create_team_invitation_notification(
                user=user,
                project=self.project,
                inviter=self.invited_by,
                role=self.role
            )
            
            return True, result
        else:
            return False, result
    
    def cancel_invitation(self, actor):
        """Cancel the invitation"""
        if self.status == 'pending':
            self.status = 'cancelled'
            self.save()
            
            # Create activity record
            self.project.create_activity(
                activity_type='member_removed',  # Use existing type
                actor=actor,
                target_user=None,  # No target user since they didn't register yet
                metadata={
                    'invitation_cancelled': True,
                    'email': self.email,
                    'role': self.role
                }
            )
            
            return True, "Invitation cancelled successfully"
        else:
            return False, "Cannot cancel invitation that is not pending"
    
    @classmethod
    def create_pending_invitation(cls, project, email, role, permissions, invited_by):
        """Create a new pending invitation"""
        # Check if there's already a pending invitation
        existing = cls.objects.filter(
            project=project,
            email=email,
            status='pending'
        ).first()
        
        if existing:
            if existing.is_valid():
                return False, "A pending invitation already exists for this email"
            else:
                # Update expired invitation
                existing.status = 'expired'
                existing.save()
        
        # Create new invitation
        invitation = cls.objects.create(
            project=project,
            email=email,
            role=role,
            permissions=','.join(permissions) if isinstance(permissions, list) else permissions,
            invited_by=invited_by
        )
        
        return True, invitation
