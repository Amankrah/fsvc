# Duplicate Questions Fix - Summary

## Problem Identified
- **Project "Test Project name" had 55 question instances but only 23 unique questions**
- 32 duplicate instances were found (some questions appeared 2-4 times)
- Average duplication factor: 2.39x

## Root Cause
The duplicates were likely caused by **importing the same CSV file multiple times** without any database constraint to prevent duplicate questions in the same project.

## Solution Implemented

### 1. Removed Existing Duplicates ✅
- Created management command: `remove_duplicate_questions`
- Successfully removed 32 duplicate questions
- Kept the first occurrence of each unique question
- Final result: 23 unique questions (matching the original CSV template)

### 2. Added Database Constraint ✅
- Created migration: `0006_add_unique_constraint_question.py`
- Added unique constraint: `unique_question_per_project`
- **Prevents duplicate questions** with the same `question_text` in the same `project`

### 3. Updated API Pagination ✅
- Increased `max_page_size` from 100 to 1000 in `CustomPagination`
- Updated frontend API to request `page_size=1000` when loading questions
- **Ensures all questions are loaded** (no more showing only 10 out of 55)

## How to Prevent Future Duplicates

### ✅ Database Level (Already Implemented)
The unique constraint will automatically reject any attempt to create duplicate questions:
```python
UniqueConstraint(
    fields=['project', 'question_text'],
    name='unique_question_per_project'
)
```

### ⚠️ Application Level Recommendations

1. **CSV Import Best Practices:**
   - The import function already checks for existing questions by `question_text` and `question_category`
   - If importing multiple times, it will **update** existing questions instead of creating duplicates
   - However, be careful: importing updates ALL fields of existing questions

2. **QuestionBank → Question Generation:**
   - When generating questions from QuestionBank, the system should check for existing questions
   - Consider adding a check in `create_question_instance()` method

3. **Bulk Create Operations:**
   - The `bulk_create` endpoint already has a `replace=true` option that clears existing questions first
   - Use this when you want to completely replace project questions

## Available Commands

### Check for Duplicates (Future Use)
```bash
python manage.py remove_duplicate_questions --dry-run
```

### Remove Duplicates (if they occur again)
```bash
python manage.py remove_duplicate_questions
```

### Target Specific Project
```bash
python manage.py remove_duplicate_questions --project-id <project-id>
```

## Results

**Before:**
- 55 question instances (32 duplicates)
- Dashboard showed: 55 questions ❌
- Form Builder showed: 10 questions (pagination issue) ❌

**After:**
- 23 question instances (0 duplicates) ✅
- Dashboard shows: 23 questions ✅
- Form Builder shows: 23 questions ✅
- Unique constraint prevents future duplicates ✅

## Files Created/Modified

### Created:
- `forms/migrations/0006_add_unique_constraint_question.py` - Database constraint
- `forms/management/commands/remove_duplicate_questions.py` - Cleanup command

### Modified:
- `django_core/utils/pagination.py` - Increased max_page_size to 1000
- `FsdaFrontend/src/services/api.ts` - Request page_size=1000 for questions
- `backend/projects/serializers.py` - Fixed question count to use `obj.questions.count()`
- `backend/api/v1/views.py` - Fixed dashboard stats to count Question instances
- `backend/forms/models.py` - Fixed order_index conflicts in dynamic question generation
  - `generate_dynamic_questions_for_project()`: Uses Max() instead of count(), checks for duplicates
  - `create_question_instance()`: Auto-calculates order_index to avoid conflicts

## Additional Issues Fixed

### Order Index Conflicts in Dynamic Generation
**Error:** `UNIQUE constraint failed: forms_question.project_id, forms_question.order_index`

**Cause:** 
- The `generate_dynamic_questions_for_project()` method was using `.count()` to get starting order_index
- This caused race conditions and conflicts with existing questions
- Questions have a `unique_together` constraint on `['project', 'order_index']`

**Fix:**
- Changed to use `Max('order_index')` instead of count
- Added duplicate check before creating questions
- Auto-calculate order_index in `create_question_instance()` if not provided
- Skip questions that already exist (by question_text)

## Testing
To verify everything is working:
1. Dashboard should show 23 questions for "Test Project name" ✅
2. Form Builder should show all 23 questions (not just 10) ✅
3. Try importing the same CSV again - it should update existing questions, not create duplicates ✅
4. Try creating a duplicate question manually - should get a database constraint error ✅
5. Generate dynamic questions - should not get order_index conflicts ✅

---
*Fix completed: [Date]*
*Issues: Question count discrepancy (55 vs 23), duplicate questions, order_index conflicts*
*Status: ✅ Resolved*

