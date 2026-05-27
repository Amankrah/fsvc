import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'api.settings')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()
try:
    u = User.objects.get(username='amankrah')
    u.set_password('SecurePass354!')
    u.save()
    print(f"Successfully reset password for user: {u.username}")
except User.DoesNotExist:
    print("User 'amankrah' not found. Creating...")
    u = User.objects.create_superuser('amankrah', 'amankrah@example.com', 'SecurePass354!')
    print(f"Successfully created superuser: {u.username}")
