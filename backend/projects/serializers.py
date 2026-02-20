from rest_framework import serializers
from .models import Project, ProjectMember
from authentication.serializers import UserSerializer

class ProjectMemberSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)
    invited_by_details = UserSerializer(source='invited_by', read_only=True)
    permissions = serializers.SerializerMethodField()
    is_partner = serializers.SerializerMethodField()
    partner_config = serializers.SerializerMethodField()
    accessible_question_sources = serializers.SerializerMethodField()

    class Meta:
        model = ProjectMember
        fields = [
            'id', 'user', 'user_details', 'role', 'permissions',
            'partner_organization', 'is_partner', 'partner_config', 'accessible_question_sources',
            'joined_at', 'invited_by', 'invited_by_details'
        ]
        read_only_fields = ['id', 'joined_at', 'invited_by', 'permissions']

    def get_permissions(self, obj):
        """Get fixed permissions for members"""
        return obj.get_permissions()

    def get_is_partner(self, obj):
        """Check if member is a partner"""
        return obj.is_partner()

    def get_partner_config(self, obj):
        """Get partner database configuration (without sensitive data for non-owners)"""
        config = obj.get_partner_config()
        if not config:
            return None

        # Only return safe fields, hide API keys from serialization
        return {
            'name': config.get('name'),
            'contact_email': config.get('contact_email'),
            'has_database_endpoint': bool(config.get('database_endpoint')),
            'has_api_key': bool(config.get('api_key')),
        }

    def get_accessible_question_sources(self, obj):
        """Get list of question sources this member can access"""
        return obj.get_accessible_question_sources()

    def validate_user(self, value):
        """Validate that user can be added to project"""
        project = self.context.get('project')
        if project and project.created_by == value:
            raise serializers.ValidationError("Project creator is automatically a team member.")

        if project and project.members.filter(user=value).exists():
            raise serializers.ValidationError("User is already a team member of this project.")

        return value

    def validate(self, attrs):
        """Validate member data including partner organization"""
        project = self.context.get('project')
        role = attrs.get('role')
        partner_org = attrs.get('partner_organization')

        # If role is 'partner', partner_organization must be provided
        if role == 'partner':
            if not partner_org:
                raise serializers.ValidationError({
                    'partner_organization': 'Partner organization is required for partner role.'
                })

            # Validate that partner organization exists in project config
            if project:
                partner_names = [p.get('name') for p in project.partner_organizations]
                if partner_org not in partner_names:
                    raise serializers.ValidationError({
                        'partner_organization': f'Partner organization "{partner_org}" not found in project configuration. Available partners: {", ".join(partner_names)}'
                    })

        # If partner_organization is provided, role must be 'partner'
        if partner_org and role != 'partner':
            raise serializers.ValidationError({
                'partner_organization': 'Partner organization can only be set for members with role="partner".'
            })

        return attrs


class ProjectSerializer(serializers.ModelSerializer):
    created_by_details = UserSerializer(source='created_by', read_only=True)
    question_count = serializers.SerializerMethodField()
    response_count = serializers.SerializerMethodField()
    team_members_count = serializers.SerializerMethodField()
    team_members = serializers.SerializerMethodField()
    user_permissions = serializers.SerializerMethodField()
    membership_status = serializers.SerializerMethodField()
    
    class Meta:
        model = Project
        fields = [
            'id', 'name', 'description', 'created_by', 'created_by_details',
            'created_at', 'updated_at', 'sync_status', 'cloud_id',
            'settings', 'metadata', 'question_count', 'response_count',
            'team_members_count', 'team_members', 'user_permissions', 'membership_status',
            'has_partners', 'partner_organizations', 'owner_database_endpoint',
            'targeted_respondents', 'targeted_commodities', 'targeted_countries'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'question_count', 'response_count',
                           'team_members_count', 'team_members', 'user_permissions', 'created_by',
                           'targeted_respondents', 'targeted_commodities', 'targeted_countries']
        
    def validate_name(self, value):
        """Validate project name"""
        if not value or not value.strip():
            raise serializers.ValidationError("Project name is required.")
        
        # Check for duplicate names within the same user's projects
        user = self.context['request'].user
        project_id = self.instance.id if self.instance else None
        
        # Exclude current project from duplicate check (for updates)
        existing_projects = Project.objects.filter(created_by=user, name__iexact=value.strip())
        if project_id:
            existing_projects = existing_projects.exclude(id=project_id)
        
        if existing_projects.exists():
            raise serializers.ValidationError("A project with this name already exists.")
        
        return value.strip()
    
    def validate_description(self, value):
        """Validate project description"""
        if value and len(value) > 1000:
            raise serializers.ValidationError("Description cannot exceed 1000 characters.")
        return value

    def validate_partner_organizations(self, value):
        """Validate that partner user IDs exist and are registered users"""
        from django.contrib.auth import get_user_model
        User = get_user_model()

        if not value:
            return value

        for partner in value:
            # Check if user_id is provided
            user_id = partner.get('user_id')
            if not user_id:
                raise serializers.ValidationError(
                    f"Partner '{partner.get('name', 'unknown')}' must have a user_id. "
                    "Partners must be registered users on the platform."
                )

            # Verify that the user exists
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                raise serializers.ValidationError(
                    f"User with ID '{user_id}' does not exist. "
                    "Partners must be registered users on the platform."
                )
            except ValueError:
                raise serializers.ValidationError(
                    f"Invalid user_id format: '{user_id}'"
                )

            # Optionally verify that the user is not the project creator
            request = self.context.get('request')
            if request and user.id == request.user.id:
                raise serializers.ValidationError(
                    "You cannot add yourself as a partner organization."
                )

        return value

    def get_question_count(self, obj):
        """Get the number of questions in this project"""
        # Count actual Question instances in the project, not QuestionBank items
        return obj.questions.count()
    
    def get_response_count(self, obj):
        """Get the number of respondents in this project"""
        return obj.get_participants_count()
    
    def get_team_members_count(self, obj):
        """Get the number of team members in this project"""
        return obj.get_team_members_count()
    
    def get_team_members(self, obj):
        """Get team members for this project"""
        request = self.context.get('request')
        if not request:
            return []
        
        # Only return team members if user has permission to view them
        user = request.user
        if not obj.can_user_access(user):
            return []
        
        # The get_team_members() method now returns serializable data directly
        return obj.get_team_members()
    
    def get_user_permissions(self, obj):
        """Get current user's permissions for this project"""
        request = self.context.get('request')
        if not request:
            return []
        
        return obj.get_user_permissions(request.user)

    def get_membership_status(self, obj):
        """Get current user's membership status for this project"""
        request = self.context.get('request')
        if not request:
            return None
        
        try:
            member = obj.members.get(user=request.user)
            return member.status
        except:
            # If user is creator, they are active
            if obj.created_by == request.user:
                return 'active'
            return None


class ProjectMemberInviteSerializer(serializers.Serializer):
    """Serializer for inviting registered users to projects"""
    user_id = serializers.UUIDField()
    role = serializers.ChoiceField(choices=ProjectMember.ROLE_CHOICES, default='member')
    partner_organization = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate_user_id(self, value):
        """Validate user ID and check if user exists"""
        from authentication.models import User

        try:
            user = User.objects.get(id=value)
            return user
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found.")

    def validate(self, attrs):
        """Validate the invite data"""
        project = self.context.get('project')
        user = attrs.get('user_id')  # This is now a User object from validate_user_id

        # Validate user constraints
        if project.created_by == user:
            raise serializers.ValidationError("Cannot invite project creator as a team member.")

        if project.members.filter(user=user).exists():
            raise serializers.ValidationError(f"User {user.username} is already a team member of this project.")

        # Store user object for easy access in the view
        attrs['user_object'] = user

        return attrs


class ProjectMemberUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating project member role"""

    class Meta:
        model = ProjectMember
        fields = ['role', 'partner_organization']

    def validate_role(self, value):
        """Validate role change"""
        # Add any business logic for role changes here
        return value

    def validate(self, attrs):
        """Validate update data"""
        role = attrs.get('role', self.instance.role)
        partner_org = attrs.get('partner_organization', self.instance.partner_organization)

        # If role is 'partner', partner_organization must be provided
        if role == 'partner' and not partner_org:
            raise serializers.ValidationError({
                'partner_organization': 'Partner organization is required for partner role.'
            })

        # If partner_organization is provided, role must be 'partner'
        if partner_org and role != 'partner':
            raise serializers.ValidationError({
                'partner_organization': 'Partner organization can only be set for members with role="partner".'
            })

        return attrs 