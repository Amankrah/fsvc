# QuestionBank Access Control Fix

## Issue
QuestionBanks were incorrectly set to public, allowing users to see other users' question templates. This violated the privacy requirement that each user should only access their own QuestionBank items.

## Solution Applied

### 1. Reverted Public Access
```bash
python manage.py shell -c "from forms.models import QuestionBank; QuestionBank.objects.all().update(is_public=False)"
```
Result: All 22 QuestionBank items set back to private.

### 2. Backend Access Control (forms/views_modern.py)

#### QuestionBankViewSet.get_queryset()
**Before:** Filtered by `base_project` (allowed access to project members)
**After:** Filters by `owner=user` (only user's own items)

```python
def get_queryset(self):
    """Optimized queryset with user access filtering - each user sees only their own QuestionBanks"""
    queryset = QuestionBank.objects.select_related('base_project', 'owner')
    
    # Filter by owner - users can ONLY see their own QuestionBank items
    user = self.request.user
    if not user.is_superuser:
        queryset = queryset.filter(owner=user)
    
    # Filter by active status by default
    if self.request.query_params.get('include_inactive', '').lower() != 'true':
        queryset = queryset.filter(is_active=True)
    
    return queryset.distinct()
```

#### QuestionBankViewSet.perform_create()
Sets `owner` and `created_by` to current user:
```python
serializer.validated_data['owner'] = self.request.user
serializer.validated_data['created_by'] = str(self.request.user)
```

#### QuestionBankViewSet.perform_update()
Checks ownership before allowing updates:
```python
if instance.owner != self.request.user and not self.request.user.is_superuser:
    raise ValidationError("You don't have permission to edit this question - it belongs to another user")
```

#### QuestionBankViewSet.perform_destroy()
Checks ownership before allowing deletion (soft delete):
```python
if instance.owner != self.request.user and not self.request.user.is_superuser:
    raise ValidationError("You don't have permission to delete this question - it belongs to another user")
```

#### search_for_respondent() action
Updated to pass user parameter:
```python
questions = QuestionBank.get_questions_for_respondent(
    respondent_type=respondent_type,
    commodity=commodity,
    country=country,
    limit=limit,
    user=request.user  # Pass user to apply ownership filtering
)
```

### 3. Model Methods (forms/models.py)

#### QuestionBank.get_accessible_items()
**Before:** Returned items based on `is_public`, `owner`, and `base_project` access
**After:** Only returns items owned by the user

```python
@classmethod
def get_accessible_items(cls, user):
    """Get QuestionBank items accessible to a user - only returns items owned by the user"""
    if user.is_superuser:
        return cls.objects.all()
    
    # User can ONLY access their own QuestionBank items
    # QuestionBanks are private to each user
    return cls.objects.filter(owner=user)
```

#### QuestionBank.can_user_access()
Simplified to only check ownership:
```python
def can_user_access(self, user):
    """Check if a user can access this QuestionBank item - only owner can access"""
    if user.is_superuser:
        return True
    # Only the owner can access their QuestionBank items
    return self.owner == user
```

#### QuestionBank.can_user_edit()
Simplified to only check ownership:
```python
def can_user_edit(self, user):
    """Check if a user can edit this QuestionBank item - only owner can edit"""
    if user.is_superuser:
        return True
    # Only the owner can edit their QuestionBank items
    return self.owner == user
```

### 4. Frontend Updates (FsdaFrontend/src/screens/DashboardScreen.tsx)

#### Dashboard Stats
Updated to clearly indicate QuestionBank count is user-specific and fixed pagination parameter:
```typescript
// Load QuestionBank count (user's own question templates)
// Since QuestionBanks are filtered by owner on backend, this only returns the current user's templates
const questionBankData = await apiService.getQuestionBank({ page_size: 1000 });
const questionBankCount = Array.isArray(questionBankData) 
  ? questionBankData.length 
  : (questionBankData.total || questionBankData.count || questionBankData.results?.length || 0);

setStats({
  totalProjects: projectList.length,
  totalQuestions: questionBankCount, // User's own QuestionBank templates only
  totalResponses,
  totalMembers,
});
```

**Note:** Changed from `limit` to `page_size` parameter to match backend pagination settings. The backend uses `CustomPagination` with `page_size_query_param = 'page_size'` (default page_size is 10).

### 5. Backend API Stats (api/v1/views.py)

Added `questionbank_templates` count to dashboard stats:
```python
# Count user's own QuestionBank templates (private to each user)
questionbank_count = QuestionBank.objects.filter(
    owner=user,
    is_active=True
).count()

stats = {
    # ... other stats ...
    'questionbank_templates': questionbank_count,  # User's own QuestionBank templates
    'summary': {
        # ...
        'total_questions': total_questions,  # Generated questions in projects
        'questionbank_templates': questionbank_count,  # User's own templates
        # ...
    }
}
```

## Key Points

1. **QuestionBanks are now private**: Each user can only see, edit, and delete their own QuestionBank items.

2. **Ownership is enforced**: All CRUD operations check the `owner` field.

3. **Dynamic question generation**: When users generate questions for projects, they can only select from their own QuestionBank templates.

4. **Dashboard stats**: The "Questions" count on the dashboard shows only the user's own QuestionBank templates.

5. **Superuser access**: Superusers can still access all QuestionBank items for administrative purposes.

## Testing

To verify the fix works:

1. Create QuestionBank items as User A
2. Login as User B
3. Verify User B cannot see User A's QuestionBank items
4. Verify User B can only see their own QuestionBank items
5. Verify dashboard shows correct count per user

## Migration Status

The migration `0008_questionbank_is_public_questionbank_owner_and_more.py` adds the necessary fields:
- `owner` (ForeignKey to User)
- `is_public` (BooleanField, default=False)

All existing QuestionBank items have been set to `is_public=False` and should have their `owner` field populated.

## Pagination Fix

### Issue Found
User "amankrah" had **22 QuestionBank items** in the database but the dashboard was showing only **10 questions**.

### Root Cause
The backend uses `CustomPagination` with:
- Default `page_size = 10`
- Query parameter: `page_size_query_param = 'page_size'`
- Max allowed: `max_page_size = 1000`

The frontend was incorrectly passing `limit: 10000` instead of `page_size: 1000`, causing the API to return only the default 10 items per page.

### Fix Applied
1. Updated `api.ts` to use `page_size` parameter instead of `limit`
2. Updated `DashboardScreen.tsx` to pass `page_size: 1000`
3. Updated response parsing to check `questionBankData.total` first (which contains the total count from pagination)

Now the dashboard correctly shows all of the user's QuestionBank templates (up to 1000 items).

