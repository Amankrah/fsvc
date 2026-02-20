import os
import django
import sys

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_core.settings.development')
try:
    django.setup()
except Exception as e:
    print(f"Error setting up Django: {e}")
    sys.exit(1)

from django.contrib.auth import get_user_model
from projects.models import Project, ProjectMember
from projects.views import ProjectViewSet
from authentication.models import UserNotification
from rest_framework.test import APIRequestFactory, force_authenticate

User = get_user_model()

def run_test():
    try:
        print("Creating users...")
        # Use simple names to avoid unique constraint issues if running multiple times
        # Ideally we should clean up or use unique names
        import uuid
        uid = str(uuid.uuid4())[:8]
        owner, _ = User.objects.get_or_create(username=f'owner_{uid}', email=f'owner_{uid}@repro.com')
        invitee, _ = User.objects.get_or_create(username=f'invitee_{uid}', email=f'invitee_{uid}@repro.com')
        
        print("Creating project...")
        project = Project.objects.create(name=f'Repro Project {uid}', created_by=owner)
        
        # 1. Invite User
        print("\n1. Inviting user...")
        invite_data = {
            'user_object': invitee, # passed by serializer? No, serializer expects data
             # The serializer expects 'user_id' or email?
             # Let's see ProjectMemberInviteSerializer in serializers.py
             # It takes 'user_id' or 'email'
        }
        # Actually standard invite uses user_id
        invite_payload = {
            'user_id': str(invitee.id),
            'role': 'member'
        }
        
        factory = APIRequestFactory()
        request = factory.post(f'/projects/{project.id}/invite_member/', invite_payload, format='json')
        force_authenticate(request, user=owner)
        view = ProjectViewSet.as_view({'post': 'invite_member'})
        response = view(request, pk=project.id)
        
        print(f"Invite response status: {response.status_code}")
        if response.status_code != 201:
            print(f"Error: {response.data}")
            return

        # 2. Verify Pending Status
        print("\n2. Verifying Pending Status...")
        member = ProjectMember.objects.get(project=project, user=invitee)
        print(f"Member status: {member.status}")
        
        if member.status != 'pending':
            print("FAILURE: Member status should be 'pending'")
        else:
            print("SUCCESS: Member status is 'pending'")

        # 3. Verify Visibility (Can see project while pending)
        print("\n3. Verifying Visibility...")
        request = factory.get('/projects/')
        force_authenticate(request, user=invitee)
        view_func = ProjectViewSet.as_view({'get': 'list'})
        response = view_func(request)
        
        results = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        can_see = False
        membership_status_in_api = None
        if isinstance(results, list):
             for p in results:
                 if p['id'] == str(project.id):
                     can_see = True
                     membership_status_in_api = p.get('membership_status')
                     break
        
        print(f"Can invitee see project? {can_see}")
        print(f"API membership_status: {membership_status_in_api}")
        
        if not can_see:
             print("FAILURE: Project not visible to invited user")
        elif membership_status_in_api != 'pending':
             print(f"FAILURE: API reported status {membership_status_in_api}, expected 'pending'")
        else:
             print("SUCCESS: Project is visible with 'pending' status")

        # 4. Accept Invitation
        print("\n4. Accepting Invitation...")
        # Get notification
        notification = UserNotification.objects.filter(
            user=invitee,
            notification_type='team_invitation',
            related_project_id=project.id
        ).latest('created_at')
        
        print(f"Found notification: {notification.id}")
        
        accept_payload = {
            'notification_id': str(notification.id)
        }
        
        request = factory.post(f'/projects/{project.id}/accept_invitation/', accept_payload, format='json')
        force_authenticate(request, user=invitee)
        view = ProjectViewSet.as_view({'post': 'accept_invitation'})
        response = view(request, pk=project.id)
        
        print(f"Accept response status: {response.status_code}")
        if response.status_code != 200:
             print(f"Error details: {response.data}")

        # 5. Verify Active Status
        print("\n5. Verifying Active Status...")
        member.refresh_from_db()
        print(f"Member status: {member.status}")
        
        if member.status != 'active':
            print("FAILURE: Member status should be 'active'")
        else:
            print("SUCCESS: Member status is 'active'")
            
        # Verify API again
        request = factory.get('/projects/')
        force_authenticate(request, user=invitee)
        response = view_func(request)
        results = response.data['results'] if 'results' in response.data else response.data
        
        status_after = None
        for p in results:
             if p['id'] == str(project.id):
                 status_after = p.get('membership_status')
                 break
        
        print(f"API membership_status after accept: {status_after}")
        if status_after == 'active':
            print("SUCCESS: API reports 'active' status")
        else:
            print("FAILURE: API status mismatch")

        # 6. Verify Member Removal
        print("\n6. Verifying Member Removal...")
        # Remove user
        remove_url = f'/projects/projects/{project.id}/remove_member/?user_id={invitee.id}'
        request = factory.delete(remove_url)
        force_authenticate(request, user=owner)
        view = ProjectViewSet.as_view({'delete': 'remove_member'})
        response = view(request, pk=project.id)
        
        print(f"Remove response status: {response.status_code}")
        if response.status_code != 200:
             print(f"Error details: {response.data}")
             
        # Check membership
        is_member_still = ProjectMember.objects.filter(project=project, user=invitee).exists()
        print(f"Is user still member? {is_member_still}")
        
        if not is_member_still:
            print("SUCCESS: Member removed successfully")
        else:
             print("FAILURE: Member still exists")
             
        # Check visibility
        request = factory.get('/projects/')
        force_authenticate(request, user=invitee)
        response = view_func(request)
        results = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        
        can_see_final = False
        if isinstance(results, list):
             can_see_final = any(p['id'] == str(project.id) for p in results)
             
        print(f"Can removed user see project? {can_see_final}")
        if not can_see_final:
            print("SUCCESS: Project correctly hidden from removed user")
        else:
            print("FAILURE: Project still visible to removed user")

        # Inspect Member details
        print("\nINSPECTING MEMBER SERIALIZATION:")
        # We need to recreate the member since it was deleted
        member = ProjectMember.objects.create(project=project, user=invitee, role='member')
        from projects.serializers import ProjectMemberSerializer
        member_serializer = ProjectMemberSerializer(member)
        import json
        with open('member_debug.txt', 'w') as f:
            f.write(json.dumps(member_serializer.data, indent=2, default=str))
        print("Serialized data written to member_debug.txt")
        
        # Cleanup
        project.delete()
        owner.delete()
        invitee.delete()
        
    except Exception as e:
        print(f"EXCEPTION: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    run_test()
