# Follow-up Questions / Conditional Logic

This guide explains how to implement conditional follow-up questions that appear based on user responses.

## Overview

The follow-up question system allows you to:
- Show questions only when certain conditions are met
- Skip irrelevant questions based on previous answers
- Create branching survey logic
- Improve user experience by showing only relevant questions

## Data Structure

### Question Model Fields

```python
# In forms/models.py - Question model
is_follow_up = models.BooleanField(default=False)
conditional_logic = models.JSONField(null=True, blank=True)
```

### Conditional Logic Format

```json
{
  "enabled": true,
  "parent_question_id": "uuid-of-parent-question",
  "show_if": {
    "operator": "equals",
    "value": "Yes"
  }
}
```

## Supported Operators

### Comparison Operators
- `equals` - Response equals the specified value
- `not_equals` - Response does not equal the value
- `contains` - Response contains the value (for text)
- `not_contains` - Response does not contain the value
- `greater_than` - Response is greater than value (numeric)
- `less_than` - Response is less than value (numeric)
- `greater_or_equal` - Response >= value
- `less_or_equal` - Response <= value

### Set Operators
- `in` - Response matches one of multiple values
- `not_in` - Response doesn't match any value
- `between` - Response is between two values (numeric)

### Existence Operators
- `is_empty` - Response is empty/null
- `is_not_empty` - Response has a value

## Examples

### Example 1: Yes/No Follow-up

**Parent Question:**
```json
{
  "id": "q1",
  "question_text": "Do you own a farm?",
  "response_type": "choice_single",
  "options": ["Yes", "No"]
}
```

**Follow-up Question:**
```json
{
  "id": "q2",
  "question_text": "What is the size of your farm (hectares)?",
  "response_type": "numeric_decimal",
  "is_follow_up": true,
  "conditional_logic": {
    "enabled": true,
    "parent_question_id": "q1",
    "show_if": {
      "operator": "equals",
      "value": "Yes"
    }
  }
}
```

### Example 2: Multiple Choice Follow-up

**Parent Question:**
```json
{
  "id": "q3",
  "question_text": "Which crops do you grow?",
  "response_type": "choice_multiple",
  "options": ["Cocoa", "Coffee", "Rice", "Maize"]
}
```

**Follow-up Question (Cocoa-specific):**
```json
{
  "id": "q4",
  "question_text": "How many cocoa trees do you have?",
  "response_type": "numeric_integer",
  "is_follow_up": true,
  "conditional_logic": {
    "enabled": true,
    "parent_question_id": "q3",
    "show_if": {
      "operator": "contains",
      "value": "Cocoa"
    }
  }
}
```

### Example 3: Numeric Range Follow-up

**Parent Question:**
```json
{
  "id": "q5",
  "question_text": "How many years have you been farming?",
  "response_type": "numeric_integer"
}
```

**Follow-up Question (for experienced farmers):**
```json
{
  "id": "q6",
  "question_text": "What farming challenges have you faced over the years?",
  "response_type": "text_long",
  "is_follow_up": true,
  "conditional_logic": {
    "enabled": true,
    "parent_question_id": "q5",
    "show_if": {
      "operator": "greater_or_equal",
      "value": 5
    }
  }
}
```

### Example 4: Multiple Conditions (OR logic)

```json
{
  "id": "q7",
  "question_text": "Do you use any sustainable farming practices?",
  "response_type": "text_long",
  "is_follow_up": true,
  "conditional_logic": {
    "enabled": true,
    "parent_question_id": "q3",
    "show_if": {
      "operator": "in",
      "values": ["Cocoa", "Coffee"]
    }
  }
}
```

### Example 5: Age Range Follow-up

```json
{
  "id": "q8",
  "question_text": "Do you plan to retire from farming soon?",
  "response_type": "choice_single",
  "options": ["Yes", "No", "Maybe"],
  "is_follow_up": true,
  "conditional_logic": {
    "enabled": true,
    "parent_question_id": "age_question",
    "show_if": {
      "operator": "between",
      "values": [60, 100]
    }
  }
}
```

## How It Works

### Frontend (React Native)

1. **Conditional Logic Evaluation** (`src/utils/conditionalLogic.ts`)
   - Evaluates conditions in real-time as user answers questions
   - Uses `evaluateConditionalLogic()` function

2. **Question Filtering** (`DataCollectionScreen.tsx`)
   ```typescript
   const visibleQuestions = useMemo(() => {
     return filterQuestionsWithConditions(questions, responses);
   }, [questions, responses]);
   ```

3. **Dynamic Display**
   - Only visible questions are shown to the user
   - Progress bar reflects only visible questions
   - Validation checks only visible required questions

### Backend (Django)

1. **Migration** (`migrations/0008_add_conditional_logic.py`)
   - Adds `is_follow_up` and `conditional_logic` fields to Question and QuestionBank models

2. **Serialization** (API responses include conditional logic)
   - Questions with conditional_logic are sent to frontend
   - Frontend evaluates and displays accordingly

## Creating Follow-up Questions

### Via Django Admin

1. Create parent question first
2. Create follow-up question
3. Check "Is follow up" checkbox
4. Fill in "Conditional logic" JSON field:
   ```json
   {
     "enabled": true,
     "parent_question_id": "<parent-uuid>",
     "show_if": {
       "operator": "equals",
       "value": "Yes"
     }
   }
   ```

### Via API

```python
# Create follow-up question
Question.objects.create(
    project=project,
    question_text="Follow-up question text",
    response_type="text_short",
    is_follow_up=True,
    conditional_logic={
        "enabled": True,
        "parent_question_id": str(parent_question.id),
        "show_if": {
            "operator": "equals",
            "value": "Yes"
        }
    }
)
```

## Best Practices

1. **Keep Logic Simple**
   - Use one condition per follow-up question
   - For complex logic, create multiple follow-up questions

2. **Test Thoroughly**
   - Test all possible paths through your survey
   - Verify follow-ups appear/disappear correctly

3. **Order Matters**
   - Place follow-up questions immediately after their parent
   - Maintain logical question flow

4. **Clear Parent Questions**
   - Make sure parent questions have clear, unambiguous options
   - Use consistent option text (e.g., always "Yes" not "yes" or "YES")

5. **Validation**
   - Only visible questions are validated
   - Hidden follow-ups don't block submission

## Troubleshooting

### Follow-up not showing
- Check parent_question_id matches exactly
- Verify operator and value match response format
- Ensure `enabled: true` in conditional_logic
- Check `is_follow_up: true`

### Follow-up showing when it shouldn't
- Verify condition operator is correct
- Check value matches exactly (case-sensitive for text)
- Test with different parent responses

### Multiple choice issues
- Use `contains` operator for multiple choice
- Value should match one of the selected options exactly

## Future Enhancements

Potential improvements:
- AND/OR combinations (multiple conditions)
- Complex expressions
- Visual logic builder in admin interface
- Logic validation on save
- Preview/test mode for survey creators

## Migration Guide

If you have existing questions, run:
```bash
python manage.py migrate forms 0008_add_conditional_logic
```

All existing questions will have:
- `is_follow_up = False`
- `conditional_logic = None`

This means they show by default (no breaking changes).
