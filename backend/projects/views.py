from django.shortcuts import render
from django.db import models
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django_core.utils.viewsets import BaseModelViewSet
from django_core.utils.filters import ProjectFilter
from .models import Project, ProjectMember
from .serializers import (
    ProjectSerializer, 
    ProjectMemberSerializer, 
    ProjectMemberInviteSerializer, 
    ProjectMemberUpdateSerializer
)

User = get_user_model()

# Create your views here.

class ProjectViewSet(BaseModelViewSet):
    serializer_class = ProjectSerializer
    filterset_class = ProjectFilter
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at', 'updated_at']
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Filter projects by the authenticated user.
        Users can see projects they created or are members of.
        Superusers can see all projects.
        """
        user = self.request.user
        if user.is_superuser:
            return Project.objects.all()
        
        # Get projects where user is creator or member
        return Project.objects.filter(
            models.Q(created_by=user) | models.Q(members__user=user)
        ).distinct()

    def perform_create(self, serializer):
        """Automatically set the created_by field to the authenticated user"""
        # Web clients and API clients that create directly on the server are already synced
        serializer.save(created_by=self.request.user, sync_status='synced')

    def perform_update(self, serializer):
        """Ensure only the project creator can update the project"""
        project = serializer.instance
        user = self.request.user

        # Check if user can update this project
        if not project.can_user_access(user):
            raise permissions.PermissionDenied("You don't have permission to update this project.")

        # Update sync status to synced since update is happening directly on server
        # (When client updates via API, the data is already synced to the server)
        serializer.save(sync_status='synced')

    def perform_destroy(self, instance):
        """Ensure only the project creator can delete the project"""
        user = self.request.user
        
        # Only project creator can delete
        if instance.created_by != user and not user.is_superuser:
            raise permissions.PermissionDenied("You don't have permission to delete this project.")
        
        instance.delete()

    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        """Get project summary statistics"""
        project = self.get_object()
        return Response(project.get_summary_stats())

    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        """Get detailed project statistics"""
        project = self.get_object()
        stats = {
            'question_count': project.get_question_count(),
            'response_count': project.get_response_count(),
            'analytics_count': project.get_analytics_count(),
            'participants_count': project.get_participants_count(),
            'team_members_count': project.get_team_members_count(),
            'created_at': project.created_at,
            'updated_at': project.updated_at,
            'sync_status': project.sync_status,
        }
        return Response(stats)

    @action(detail=True, methods=['get'])
    def available_options(self, request, pk=None):
        """
        Get available respondent types, commodities, and countries
        from the project's question bank for question generation.
        """
        project = self.get_object()

        # Check if user can access this project
        if not project.can_user_access(request.user):
            return Response(
                {'error': 'You do not have permission to access this project'},
                status=status.HTTP_403_FORBIDDEN
            )

        options = project.get_available_question_options()
        return Response(options)

    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        """Get all team members for a project including pending invitations"""
        project = self.get_object()

        # Check if user can view team members
        if not project.can_user_access(request.user):
            return Response(
                {'error': 'You do not have permission to view team members'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Get active team members
        team_members = project.get_team_members()

        # Get pending invitations
        from .models import PendingInvitation
        pending_invitations = []

        # Only show pending invitations to project owner
        if project.created_by == request.user or request.user.is_superuser:
            pending_invites = PendingInvitation.objects.filter(
                project=project,
                status='pending'
            ).select_related('invited_by')

            for invite in pending_invites:
                pending_invitations.append({
                    'id': str(invite.id),
                    'email': invite.email,
                    'role': invite.role,
                    'permissions': invite.get_permissions_list(),
                    'invited_by': invite.invited_by.username if invite.invited_by else 'Unknown',
                    'invited_at': invite.created_at.isoformat(),
                    'expires_at': invite.expires_at.isoformat(),
                    'is_valid': invite.is_valid(),
                    'status': invite.status,
                    'is_pending': True,
                })

        return Response({
            'team_members': team_members,
            'pending_invitations': pending_invitations,
            'total_count': len(team_members),
            'pending_count': len(pending_invitations),
            'total_including_pending': len(team_members) + len(pending_invitations)
        })
    
    @action(detail=True, methods=['get'])
    def get_team_members(self, request, pk=None):
        """Get all team members for a project (alias for members)"""
        return self.members(request, pk)

    @action(detail=True, methods=['post'])
    def invite_member(self, request, pk=None):
        """Invite a user to join the project team"""
        project = self.get_object()
        
        # Log the incoming request data for debugging
        print(f"Invite member request data: {request.data}")
        
        # Check if user can manage team members (creator or admin)
        if project.created_by != request.user and not request.user.is_superuser:
            return Response(
                {'error': 'Only project creators can invite team members'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = ProjectMemberInviteSerializer(
            data=request.data, 
            context={'project': project, 'request': request}
        )
        
        if serializer.is_valid():
            validated_data = serializer.validated_data
            invited_user = validated_data['user_object']
            role = validated_data['role']
            partner_organization = validated_data.get('partner_organization')

            print(f"Inviting user: {invited_user.username} with role: {role}")

            # Create team membership directly
            # Permissions are fixed - all members get the same permissions (handled by model)
            member = ProjectMember.objects.create(
                project=project,
                user=invited_user,
                role=role,
                partner_organization=partner_organization if role == 'partner' else None,
                invited_by=request.user
            )

            # Create notification for the invited user
            self._create_invitation_notification(invited_user, project, request.user)

            return Response({
                'message': f'Successfully invited {invited_user.username} to project {project.name}. They will receive a notification to accept the invitation.',
                'member': {
                    'id': str(member.id),
                    'user_email': invited_user.email,
                    'username': invited_user.username,
                    'role': member.role,
                    'permissions': member.get_permissions(),
                    'joined_at': member.joined_at.isoformat()
                },
                'invitation_type': 'notification'
            }, status=status.HTTP_201_CREATED)
        
        print(f"Serializer validation errors: {serializer.errors}")
        return Response({
            'error': 'Invalid data provided',
            'details': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    def _create_invitation_notification(self, invited_user, project, inviter):
        """Create a notification for the invited user"""
        try:
            from authentication.models import UserNotification
            
            # Create in-app notification
            notification = UserNotification.create_team_invitation_notification(
                user=invited_user,
                project=project,
                inviter=inviter,
                role=project.members.get(user=invited_user).role
            )
            
            print(f"NOTIFICATION CREATED: {invited_user.username} has been invited to project '{project.name}' by {inviter.username}")
            
            # TODO: Send email notification
            # You could add email sending here using Django's email system
            
            return notification
            
        except Exception as e:
            print(f"Error creating invitation notification: {e}")
            return None
    
    def _send_invitation_email(self, pending_invitation):
        """Send invitation email to the pending user"""
        try:
            from django.core.mail import send_mail
            from django.conf import settings
            
            subject = f"You're invited to join {pending_invitation.project.name}!"
            message = f"""
Hello!

{pending_invitation.invited_by.username} has invited you to join the project "{pending_invitation.project.name}" on our research platform.

Your role: {pending_invitation.role.title()}

MOBILE APP USERS:
Open the FSDA app and enter this invitation code:
{pending_invitation.invitation_token}

Or tap this link if your app supports it:
{pending_invitation.get_invitation_url()}

This invitation will expire on {pending_invitation.expires_at.strftime('%B %d, %Y at %I:%M %p')}.

If you have any questions, please contact {pending_invitation.invited_by.email}.

Best regards,
Research Data Collection Team
            """.strip()

            # For now, just print the email content (in development)
            print(f"\n{'='*80}")
            print(f"EMAIL INVITATION for {pending_invitation.email}:")
            print(f"{'='*80}")
            print(f"Subject: {subject}")
            print(f"Message:\n{message}")
            print(f"\nInvitation Token: {pending_invitation.invitation_token}")
            print(f"Deep Link: {pending_invitation.get_invitation_url()}")
            print(f"{'='*80}\n")
            
            # TODO: Uncomment to actually send emails
            # send_mail(
            #     subject,
            #     message,
            #     settings.DEFAULT_FROM_EMAIL,
            #     [pending_invitation.email],
            #     fail_silently=False,
            # )
            
            return True
            
        except Exception as e:
            print(f"Error sending invitation email: {e}")
            return False

    @action(detail=True, methods=['patch'])
    def update_member(self, request, pk=None):
        """Update a team member's role and permissions"""
        project = self.get_object()
        
        # Check if user can manage team members
        if project.created_by != request.user and not request.user.is_superuser:
            return Response(
                {'error': 'Only project creators can update team members'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        user_id = request.data.get('user_id')
        if not user_id:
            return Response(
                {'error': 'user_id is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user_to_update = User.objects.get(id=user_id)
            member = project.members.get(user=user_to_update)
            
            serializer = ProjectMemberUpdateSerializer(
                member, 
                data=request.data, 
                partial=True
            )
            
            if serializer.is_valid():
                # Get the old values before saving
                old_role = member.role
                old_permissions = member.get_permissions_list()
                
                serializer.save()
                
                # Create activity record for the update
                project.create_activity(
                    activity_type='member_updated',
                    actor=request.user,
                    target_user=user_to_update,
                    metadata={
                        'old_role': old_role,
                        'new_role': member.role,
                        'old_permissions': old_permissions,
                        'new_permissions': member.get_permissions_list()
                    }
                )
                
                return Response({
                    'message': 'Team member updated successfully',
                    'member': ProjectMemberSerializer(member).data
                })
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except ProjectMember.DoesNotExist:
            return Response(
                {'error': 'User is not a team member'}, 
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['delete'])
    def remove_member(self, request, pk=None):
        """Remove a team member from the project"""
        project = self.get_object()
        
        # Check if user can manage team members
        if project.created_by != request.user and not request.user.is_superuser:
            return Response(
                {'error': 'Only project creators can remove team members'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Try to get user_id from query params first, then from request data
        user_id = request.query_params.get('user_id') or request.data.get('user_id')
        if not user_id:
            return Response(
                {'error': 'user_id is required as query parameter or in request body'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user_to_remove = User.objects.get(id=user_id)
            success, message = project.remove_team_member(user_to_remove, actor=request.user)
            
            if success:
                return Response({'message': message})
            else:
                return Response(
                    {'error': message}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
                
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['delete'])
    def cancel_invitation(self, request, pk=None):
        """Cancel a pending invitation"""
        project = self.get_object()

        # Check if user can manage team members
        if project.created_by != request.user and not request.user.is_superuser:
            return Response(
                {'error': 'Only project creators can cancel invitations'},
                status=status.HTTP_403_FORBIDDEN
            )

        invitation_id = request.query_params.get('invitation_id') or request.data.get('invitation_id')
        if not invitation_id:
            return Response(
                {'error': 'invitation_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            from .models import PendingInvitation
            invitation = PendingInvitation.objects.get(id=invitation_id, project=project)

            success, message = invitation.cancel_invitation(actor=request.user)

            if success:
                return Response({'message': message})
            else:
                return Response(
                    {'error': message},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except PendingInvitation.DoesNotExist:
            return Response(
                {'error': 'Invitation not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'])
    def resend_invitation(self, request, pk=None):
        """Resend a pending invitation"""
        project = self.get_object()

        # Check if user can manage team members
        if project.created_by != request.user and not request.user.is_superuser:
            return Response(
                {'error': 'Only project creators can resend invitations'},
                status=status.HTTP_403_FORBIDDEN
            )

        invitation_id = request.data.get('invitation_id')
        if not invitation_id:
            return Response(
                {'error': 'invitation_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            from .models import PendingInvitation
            invitation = PendingInvitation.objects.get(id=invitation_id, project=project)

            if invitation.status != 'pending':
                return Response(
                    {'error': 'Can only resend pending invitations'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Update expiry date
            from datetime import timedelta
            from django.utils import timezone
            invitation.expires_at = timezone.now() + timedelta(days=7)
            invitation.save()

            # Resend email
            self._send_invitation_email(invitation)

            return Response({
                'message': f'Invitation resent to {invitation.email}',
                'invitation': {
                    'id': str(invitation.id),
                    'email': invitation.email,
                    'expires_at': invitation.expires_at.isoformat(),
                }
            })

        except PendingInvitation.DoesNotExist:
            return Response(
                {'error': 'Invitation not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['get'])
    def my_memberships(self, request):
        """Get all projects where the current user is a member"""
        user = request.user
        memberships = ProjectMember.objects.filter(user=user).select_related('project')
        
        projects_data = []
        for membership in memberships:
            project = membership.project
            projects_data.append({
                'project': ProjectSerializer(project, context={'request': request}).data,
                'membership': ProjectMemberSerializer(membership).data
            })
        
        return Response({
            'memberships': projects_data,
            'total_count': len(projects_data)
        })

    @action(detail=False, methods=['get'])
    def available_users(self, request):
        """Get list of users that can be invited to projects"""
        # Only allow project creators and admins to see available users
        if not request.user.can_create_projects():
            return Response(
                {'error': 'You do not have permission to view available users'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get all users except the current user
        users = User.objects.exclude(id=request.user.id).values(
            'id', 'username', 'email', 'role', 'institution'
        )
        
        return Response({
            'users': list(users),
            'total_count': users.count()
        })

    @action(detail=False, methods=['post'])
    def accept_invitation(self, request):
        """Accept a pending invitation using the invitation token"""
        token = request.data.get('invitation_token')
        if not token:
            return Response(
                {'error': 'invitation_token is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from .models import PendingInvitation
            invitation = PendingInvitation.objects.get(invitation_token=token)
            
            if not invitation.is_valid():
                return Response(
                    {'error': 'This invitation has expired or is no longer valid'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Accept the invitation
            success, result = invitation.accept_invitation(request.user)
            
            if success:
                member_serializer = ProjectMemberSerializer(result)
                return Response({
                    'message': f'Welcome to {invitation.project.name}! You have successfully joined as {invitation.role.title()}.',
                    'project': {
                        'id': str(invitation.project.id),
                        'name': invitation.project.name,
                        'description': invitation.project.description,
                    },
                    'member': member_serializer.data
                }, status=status.HTTP_200_OK)
            else:
                return Response(
                    {'error': result}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
                
        except PendingInvitation.DoesNotExist:
            return Response(
                {'error': 'Invalid invitation token'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': f'Error processing invitation: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def accept_invitation(self, request, pk=None):
        """Accept a team invitation notification"""
        project = self.get_object()
        notification_id = request.data.get('notification_id')
        
        if not notification_id:
            return Response({
                'error': 'notification_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            from authentication.models import UserNotification
            
            # Get and validate notification
            notification = UserNotification.objects.get(
                id=notification_id,
                user=request.user,
                notification_type='team_invitation',
                related_project_id=project.id
            )
            
            if notification.is_expired():
                return Response({
                    'error': 'This invitation has expired'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if user is already a member
            if not project.members.filter(user=request.user).exists():
                return Response({
                    'error': 'You are not invited to this project'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Accept the invitation - user should already be added to project during invitation
            # Just mark the notification as read and confirm acceptance
            notification.mark_as_read()
            
            return Response({
                'message': f'Successfully joined project {project.name}',
                'project': {
                    'id': str(project.id),
                    'name': project.name,
                    'description': project.description
                }
            })
            
        except UserNotification.DoesNotExist:
            return Response({
                'error': 'Invitation notification not found'
            }, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['post'])
    def decline_invitation(self, request, pk=None):
        """Decline a team invitation notification"""
        project = self.get_object()
        notification_id = request.data.get('notification_id')
        
        if not notification_id:
            return Response({
                'error': 'notification_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            from authentication.models import UserNotification
            
            # Get and validate notification
            notification = UserNotification.objects.get(
                id=notification_id,
                user=request.user,
                notification_type='team_invitation',
                related_project_id=project.id
            )
            
            # Remove user from project if they were added during invitation
            member = project.members.filter(user=request.user).first()
            if member:
                member.delete()
            
            # Mark notification as read
            notification.mark_as_read()
            
            return Response({
                'message': f'Declined invitation to join project {project.name}'
            })
            
        except UserNotification.DoesNotExist:
            return Response({
                'error': 'Invitation notification not found'
            }, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'])
    def get_invitation_info(self, request):
        """Get information about a pending invitation (for registration page)"""
        token = request.query_params.get('token')
        if not token:
            return Response(
                {'error': 'token parameter is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from .models import PendingInvitation
            invitation = PendingInvitation.objects.get(invitation_token=token)
            
            return Response({
                'invitation': {
                    'id': str(invitation.id),
                    'email': invitation.email,
                    'role': invitation.role,
                    'project_name': invitation.project.name,
                    'project_description': invitation.project.description,
                    'invited_by': invitation.invited_by.username,
                    'expires_at': invitation.expires_at.isoformat(),
                    'is_valid': invitation.is_valid(),
                    'status': invitation.status
                }
            })
            
        except PendingInvitation.DoesNotExist:
            return Response(
                {'error': 'Invalid invitation token'}, 
                status=status.HTTP_404_NOT_FOUND
            )
