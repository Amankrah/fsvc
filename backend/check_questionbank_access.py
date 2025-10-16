from forms.models import QuestionBank
from authentication.models import User

# Check testuser
testuser = User.objects.filter(username='testuser').first()
print(f'testuser exists: {testuser is not None}')

if testuser:
    accessible = QuestionBank.get_accessible_items(testuser)
    print(f'QuestionBank items accessible to testuser: {accessible.count()}')

# Check public items
public = QuestionBank.objects.filter(is_public=True).count()
print(f'Public QuestionBank items: {public}')

# Check amankrah's items
owned_by_amankrah = QuestionBank.objects.filter(owner__username='amankrah').count()
print(f'Items owned by amankrah: {owned_by_amankrah}')

# Show all QuestionBank items with their owner and public status
print('\nAll QuestionBank items:')
for qb in QuestionBank.objects.all()[:5]:
    owner_name = qb.owner.username if qb.owner else 'None'
    print(f'  - "{qb.question_text[:50]}..." | Owner: {owner_name} | Public: {qb.is_public}')

