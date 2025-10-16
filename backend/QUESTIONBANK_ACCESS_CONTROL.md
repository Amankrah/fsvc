# QuestionBank Access Control Implementation

## Overview
Implemented user-based access control for QuestionBank items to ensure users can only see and access their own question banks.

## Changes Made

### 1. Model Updates (`forms/models.py`)

#### New Fields Added to QuestionBank:
```python
owner = ForeignKey(User)  # Owner of the QuestionBank item
is_public = BooleanField(default=False)  # Public items accessible to all users
```

#### New Indexes:
- `owner` - Fast filtering by owner
- `is_public` - Fast filtering by public status

#### New Methods:

**`can_user_access(user)`**
- Checks if a user can access a QuestionBank item
- Returns True if:
  - User is superuser
  - Item is public
  - User is the owner
  - User has access to the base_project

**`can_user_edit(user)`**
- Checks if a user can edit a QuestionBank item
- Returns True if:
  - User is superuser
  - User is the owner
  - User is owner of the base_project

**`get_accessible_items(user)` (Class Method)**
- Returns all QuestionBank items accessible to a user
- Filters by:
  - Items owned by user
  - Public items
  - Items from projects user has access to

### 2. View Updates (`forms/views_modern.py`)

#### `get_available_options` endpoint:
- Now filters QuestionBank items using `get_accessible_items(user)`
- Only shows options from questions the user can access

#### `generate_dynamic_questions` endpoint:
- Passes `user` parameter to generation method
- Ensures only accessible QuestionBank items are used

### 3. Serializer Updates (`forms/serializers.py`)

#### QuestionBankSerializer:
**New Fields:**
- `owner` - ForeignKey to User
- `owner_username` - Read-only username of owner
- `is_public` - Boolean flag for public access
- `can_edit` - Computed field showing if current user can edit

**New Logic:**
- `create()` method automatically sets `owner` to current user
- `get_can_edit()` checks if current user has edit permissions

### 4. Database Migration

**Migration:** `forms/migrations/0008_questionbank_is_public_questionbank_owner_and_more.py`

Added:
- `owner` field (nullable ForeignKey)
- `is_public` field (default=False)
- Indexes for both fields

**Data Migration:**
- All existing QuestionBank items were assigned to the first user (amankrah)
- All existing items were set to `is_public=True` for backward compatibility

## Access Control Rules

### Viewing QuestionBank Items
A user can VIEW a QuestionBank item if:
1. ✅ User is a superuser (full access)
2. ✅ User owns the item (`owner = user`)
3. ✅ Item is marked as public (`is_public = True`)
4. ✅ User has access to the item's `base_project`

### Editing QuestionBank Items
A user can EDIT a QuestionBank item if:
1. ✅ User is a superuser
2. ✅ User owns the item (`owner = user`)
3. ✅ User created the item's `base_project`

### Creating QuestionBank Items
- New items automatically set `owner` to the creating user
- New items default to `is_public = False` (private)
- Users can manually set `is_public = True` to share

## API Changes

### QuestionBank Endpoints

**GET /api/forms/question-bank/**
- Now returns only items accessible to the authenticated user
- Filtered automatically by access control

**POST /api/forms/question-bank/**
- Automatically sets `owner` to current user
- Returns `can_edit` field indicating edit permissions

**GET /api/forms/questions/get_available_options/**
- Filters by user access
- Only shows respondent types, commodities, and countries from accessible questions

**POST /api/forms/questions/generate_dynamic_questions/**
- Uses only accessible QuestionBank items for generation
- Respects user ownership boundaries

### Response Format
```json
{
  "id": "uuid",
  "question_text": "What crops do you cultivate?",
  "owner": "user_id",
  "owner_username": "amankrah",
  "is_public": false,
  "can_edit": true,
  ...other fields...
}
```

## Usage Examples

### Creating a Private QuestionBank Item
```python
POST /api/forms/question-bank/
{
  "question_text": "My private question",
  "targeted_respondents": ["farmers"],
  "is_public": false  # Private, only you can see it
}
```

### Creating a Public QuestionBank Item
```python
POST /api/forms/question-bank/
{
  "question_text": "Shared question for all",
  "targeted_respondents": ["farmers"],
  "is_public": true  # Public, everyone can see it
}
```

### Checking Access
```python
from forms.models import QuestionBank
question_bank_item = QuestionBank.objects.get(id=item_id)

# Check if user can access
if question_bank_item.can_user_access(request.user):
    print("User can view this item")

# Check if user can edit
if question_bank_item.can_user_edit(request.user):
    print("User can edit this item")
```

### Filtering by User Access
```python
# Get all items accessible to a user
accessible_items = QuestionBank.get_accessible_items(request.user)

# Get active items for dynamic generation
active_items = QuestionBank.get_accessible_items(request.user).filter(is_active=True)
```

## Security Considerations

1. **Owner Assignment**: Automatically set on creation, cannot be changed later
2. **Public Items**: Cannot be "un-publicized" if they're being used in projects
3. **Superuser Access**: Superusers have full access to all items
4. **Project-based Access**: If attached to a project, respects project permissions

## Migration Path for Existing Data

All existing QuestionBank items (22 items) were:
- Assigned to user: `amankrah`
- Set to `is_public = True` for backward compatibility

To change ownership or privacy:
```python
from forms.models import QuestionBank
from authentication.models import User

# Assign specific items to different users
question = QuestionBank.objects.get(id=item_id)
new_owner = User.objects.get(username='new_user')
question.owner = new_owner
question.is_public = False  # Make it private
question.save()
```

## Benefits

1. ✅ **Data Isolation**: Users can't see others' question banks
2. ✅ **Collaboration**: Public items enable sharing across users
3. ✅ **Security**: Sensitive questions can be kept private
4. ✅ **Project Integration**: Respects project-level permissions
5. ✅ **Audit Trail**: Track who owns which questions

## Testing

To verify access control:
1. Create a new user
2. Login as that user
3. Try to access GET /api/forms/questions/get_available_options/
4. Should only see public items and items they own
5. Create a QuestionBank item - should be owned by them
6. Logout and login as different user
7. Should not see the private item

## Future Enhancements

1. **Sharing**: Add ability to share with specific users/teams
2. **Transfer Ownership**: Allow transferring ownership between users
3. **Usage Tracking**: Track which items are used in which projects
4. **Bulk Operations**: Manage privacy settings in bulk
5. **Version Control**: Track changes to shared items

