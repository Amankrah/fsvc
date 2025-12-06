# Generated manually for data migration

from django.db import migrations


def populate_questionbank_fields(apps, schema_editor):
    """
    Populate the new project and created_by_user fields from legacy fields.

    Strategy:
    1. For project: Use base_project if it existed (but it was removed in previous migration)
    2. For created_by_user: Use owner if it existed (but it was removed in previous migration)
    3. For items without data: Use first superuser as fallback
    """
    QuestionBank = apps.get_model('forms', 'QuestionBank')
    User = apps.get_model('authentication', 'User')
    Project = apps.get_model('projects', 'Project')

    # Get first superuser as fallback
    first_superuser = User.objects.filter(is_superuser=True).first()

    if not first_superuser:
        # If no superuser, get the first user
        first_superuser = User.objects.first()

    if not first_superuser:
        print("WARNING: No users found in database. Skipping QuestionBank data migration.")
        return

    # Get first project as fallback
    first_project = Project.objects.first()

    if not first_project:
        print("WARNING: No projects found. Creating a default project for QuestionBank migration...")
        first_project = Project.objects.create(
            name="Default Project (Migration)",
            description="Auto-created during migration for existing QuestionBank items",
            created_by=first_superuser
        )

    # Update all QuestionBank items
    question_bank_items = QuestionBank.objects.all()
    updated_count = 0

    for item in question_bank_items:
        needs_update = False

        # Set project if not set
        if item.project_id is None:
            item.project = first_project
            needs_update = True

        # Set created_by_user if not set
        if item.created_by_user_id is None:
            item.created_by_user = first_superuser
            needs_update = True

        if needs_update:
            item.save(update_fields=['project', 'created_by_user'])
            updated_count += 1

    print(f"Updated {updated_count} QuestionBank items with project and created_by_user")


def reverse_populate(apps, schema_editor):
    """
    Reverse migration - set fields back to null
    """
    QuestionBank = apps.get_model('forms', 'QuestionBank')
    QuestionBank.objects.all().update(project=None, created_by_user=None)


class Migration(migrations.Migration):

    dependencies = [
        ('forms', '0011_remove_questionbank_forms_quest_questio_82043e_idx_and_more'),
        ('authentication', '0001_initial'),  # Ensure User model is available
        ('projects', '0006_remove_projectmember_permissions_and_more'),  # Ensure Project model is available
    ]

    operations = [
        migrations.RunPython(populate_questionbank_fields, reverse_populate),
    ]
