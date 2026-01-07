from django.shortcuts import render
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.core.mail import send_mail
from django.conf import settings
from django.db import models
from django.db.models import Q
from .serializers import (
    UserRegistrationSerializer, 
    UserSerializer, 
    ChangePasswordSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer
)
from .models import PasswordResetToken, UserNotification
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = UserRegistrationSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        user_data = UserSerializer(user).data
        
        # Create welcome notification
        UserNotification.create_welcome_notification(user)
        
        return Response({
            'token': token.key,
            'user': user_data
        }, status=status.HTTP_201_CREATED)

class LoginView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        username = request.data.get('username')
        email = request.data.get('email')
        password = request.data.get('password')

        # Support both username and email authentication
        if not password:
            return Response(
                {'error': 'Please provide password'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not username and not email:
            return Response(
                {'error': 'Please provide either username or email'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Try to authenticate with username or email
        user = None
        if username:
            user = authenticate(username=username, password=password)
        elif email:
            user = authenticate(email=email, password=password)

        if not user:
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        token, _ = Token.objects.get_or_create(user=user)
        serializer = UserSerializer(user)

        return Response({
            'token': token.key,
            'user_data': serializer.data
        })

class LogoutView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        try:
            request.user.auth_token.delete()
            return Response({'message': 'Successfully logged out'})
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

class UserProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user

class ChangePasswordView(generics.UpdateAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = ChangePasswordSerializer

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            if not user.check_password(serializer.data.get("old_password")):
                return Response(
                    {"old_password": ["Wrong password."]},
                    status=status.HTTP_400_BAD_REQUEST
                )

            user.set_password(serializer.data.get("new_password"))
            user.save()
            return Response({'message': 'Password updated successfully'})

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ForgotPasswordView(APIView):
    """Handle password reset requests"""
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        if serializer.is_valid():
            username_or_email = serializer.validated_data['username_or_email']
            
            # Find user by username or email
            user = None
            try:
                user = User.objects.get(
                    Q(username=username_or_email) | Q(email=username_or_email)
                )
            except User.DoesNotExist:
                # For security, return success even if user doesn't exist
                return Response({
                    'message': 'If a user with that username or email exists, password reset instructions have been sent.'
                }, status=status.HTTP_200_OK)
            
            # Clean up old tokens for this user
            PasswordResetToken.objects.filter(user=user).delete()
            
            # Create new reset token
            reset_token = PasswordResetToken.objects.create(user=user)
            
            # For mobile app: always return token directly in development mode
            # In production, you would send email and not return the token
            message = f'Password reset token: {reset_token.token} (Development mode)'
            
            # Also try to send email if configured (but don't let it block the response)
            try:
                if hasattr(settings, 'EMAIL_BACKEND') and settings.EMAIL_BACKEND and settings.EMAIL_BACKEND != 'django.core.mail.backends.console.EmailBackend':
                    # Real email backend configured, send email
                    reset_url = f"http://localhost:3000/reset-password?token={reset_token.token}"
                    send_mail(
                        'Password Reset Request',
                        f'Click the following link to reset your password: {reset_url}',
                        settings.DEFAULT_FROM_EMAIL,
                        [user.email],
                        fail_silently=True,  # Don't block on email failures
                    )
            except Exception as e:
                # Email failed, but that's ok for mobile app
                print(f"Email sending failed: {e}")
                pass
            
            return Response({'message': message}, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ResetPasswordView(APIView):
    """Handle password reset with token"""
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if serializer.is_valid():
            token = serializer.validated_data['token']
            new_password = serializer.validated_data['new_password']
            
            try:
                reset_token = PasswordResetToken.objects.get(token=token)
                
                if not reset_token.is_valid():
                    return Response({
                        'error': 'Invalid or expired token'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Reset password
                user = reset_token.user
                user.set_password(new_password)
                user.save()
                
                # Mark token as used
                reset_token.mark_used()
                
                return Response({
                    'message': 'Password has been reset successfully'
                }, status=status.HTTP_200_OK)
                
            except PasswordResetToken.DoesNotExist:
                return Response({
                    'error': 'Invalid token'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UserSearchView(APIView):
    """Search for users by username or email for team member invitations"""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        
        if not query:
            return Response({'users': []})
        
        if len(query) < 2:
            return Response({'users': []})  # Require at least 2 characters
        
        # Only allow users with permission to create projects to search for users
        if not request.user.can_create_projects():
            return Response(
                {'error': 'You do not have permission to search for users'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Search users by username, email, first_name, last_name
        users = User.objects.filter(
            Q(username__icontains=query) |
            Q(email__icontains=query) |
            Q(first_name__icontains=query) |
            Q(last_name__icontains=query)
        ).exclude(
            id=request.user.id  # Exclude current user
        ).values(
            'id', 'username', 'email', 'first_name', 'last_name', 'role', 'institution'
        )[:10]  # Limit to 10 results
        
        # Format the results for frontend
        formatted_users = []
        for user in users:
            full_name = f"{user['first_name']} {user['last_name']}".strip()
            if not full_name:
                full_name = user['username']
            
            display_text = f"{user['username']} ({user['email']})"
            if full_name != user['username']:
                display_text = f"{full_name} - {user['username']} ({user['email']})"
            
            formatted_users.append({
                'id': user['id'],
                'username': user['username'],
                'email': user['email'],
                'full_name': full_name,
                'display_text': display_text,
                'role': user['role'],
                'institution': user['institution'] or ''
            })
        
        return Response({'users': formatted_users})


class NotificationListView(APIView):
    """Get user's notifications"""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        notifications = request.user.notifications.filter(
            is_read=False
        ).order_by('-created_at')[:20]  # Last 20 unread notifications
        
        formatted_notifications = []
        for notification in notifications:
            formatted_notifications.append({
                'id': str(notification.id),
                'title': notification.title,
                'message': notification.message,
                'type': notification.notification_type,
                'priority': notification.priority,
                'is_read': notification.is_read,
                'created_at': notification.created_at.isoformat(),
                'action_url': notification.action_url,
                'action_text': notification.action_text,
                'related_project_id': str(notification.related_project_id) if notification.related_project_id else None,
                'is_expired': notification.is_expired(),
            })
        
        unread_count = request.user.get_unread_notifications_count()
        
        return Response({
            'notifications': formatted_notifications,
            'unread_count': unread_count,
            'total_count': len(formatted_notifications)
        })


class MarkNotificationReadView(APIView):
    """Mark a notification as read"""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, notification_id):
        try:
            notification = request.user.notifications.get(id=notification_id)
            notification.mark_as_read()
            
            return Response({
                'message': 'Notification marked as read',
                'notification_id': str(notification.id)
            })
            
        except UserNotification.DoesNotExist:
            return Response({
                'error': 'Notification not found'
            }, status=status.HTTP_404_NOT_FOUND)


class MarkAllNotificationsReadView(APIView):
    """Mark all notifications as read"""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        updated_count = request.user.notifications.filter(is_read=False).update(
            is_read=True,
            read_at=timezone.now()
        )
        
        return Response({
            'message': f'Marked {updated_count} notifications as read',
            'updated_count': updated_count
        })


class UserSearchView(APIView):
    """Search for registered users by email or username"""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        
        if not query:
            return Response({
                'users': [],
                'message': 'Enter at least 2 characters to search'
            })
        
        if len(query) < 2:
            return Response({
                'users': [],
                'message': 'Enter at least 2 characters to search'
            })
        
        # Search by email or username (case insensitive)
        users = User.objects.filter(
            models.Q(email__icontains=query) | 
            models.Q(username__icontains=query) |
            models.Q(first_name__icontains=query) |
            models.Q(last_name__icontains=query)
        ).exclude(
            id=request.user.id  # Exclude current user
        )[:10]  # Limit to 10 results
        
        formatted_users = []
        for user in users:
            formatted_users.append({
                'id': str(user.id),
                'email': user.email,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'full_name': f"{user.first_name} {user.last_name}".strip() or user.username,
                'role': user.role,
                'institution': user.institution
            })
        
        return Response({
            'users': formatted_users,
            'count': len(formatted_users),
            'query': query
        })