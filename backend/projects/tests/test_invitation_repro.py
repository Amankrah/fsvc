from django.test import TestCase
from django.contrib.auth import get_user_model
from projects.models import Project, ProjectMember
from projects.views import ProjectViewSet
from rest_framework.test import APIRequestFactory, force_authenticate

User = get_user_model()

class InvitationReproTest(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.owner = User.objects.create_user(username='owner', email='owner@example.com', password='password')
        self.user_to_invite = User.objects.create_user(username='invitee', email='invitee@example.com', password='password')
        self.project = Project.objects.create(name='Test Project', created_by=self.owner)

    def test_invitation_flow(self):
        # 1. Verify user is NOT a member initially
        self.assertFalse(self.project.members.filter(user=self.user_to_invite).exists())
        
        # 2. Verify get_queryset does NOT return the project for the user
        view = ProjectViewSet()
        request = self.factory.get('/projects/')
        force_authenticate(request, user=self.user_to_invite)
        view.request = request
        queryset = view.get_queryset()
        self.assertFalse(queryset.filter(id=self.project.id).exists())

        # 3. Invite the user
        invite_data = {
            'user_id': str(self.user_to_invite.id),
            'role': 'member'
        }
        
        # We need to call invite_member as the owner
        request = self.factory.post(f'/projects/{self.project.id}/invite_member/', invite_data, format='json')
        force_authenticate(request, user=self.owner)
        view = ProjectViewSet.as_view({'post': 'invite_member'})
        response = view(request, pk=self.project.id)
        
        self.assertEqual(response.status_code, 201)
        
        # 4. Verify user IS a member immediately
        self.assertTrue(self.project.members.filter(user=self.user_to_invite).exists())
        
        # 5. Verify get_queryset DOES return the project for the user
        view = ProjectViewSet()
        request = self.factory.get('/projects/')
        force_authenticate(request, user=self.user_to_invite)
        view.request = request
        queryset = view.get_queryset()
        self.assertTrue(queryset.filter(id=self.project.id).exists())
        
        print("\n\nTest Result: User visibility confirmed immediately after invitation.\n")
