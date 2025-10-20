# Import/Export & FormBuilder Updates for Follow-up Questions

## Overview
Updated the QuestionBank import/export system and FormBuilder to support conditional logic and follow-up questions.

## Backend Changes

### 1. CSV/Excel Template Updates

#### New Columns Added:
- `is_follow_up` - Boolean indicating if this is a follow-up question
- `parent_question_text` - Text of the parent question (for follow-ups)
- `condition_operator` - Comparison operator (equals, contains, greater_than, etc.)
- `condition_value` - Value(s) to compare against

#### Updated Files:
- `backend/forms/import_export.py`

#### Template Structure:
```csv
question_text,question_category,response_type,targeted_respondents,targeted_commodities,targeted_countries,data_source,research_partner_name,research_partner_contact,work_package,priority_score,is_required,options,is_follow_up,parent_question_text,condition_operator,condition_value
```

### 2. Example Rows

#### Regular Question:
```csv
"What is your primary source of income?","production","choice_single","farmers,aggregators_lbcs","cocoa,maize","Ghana,Nigeria","internal","","","WP1","5","true","Farming|Trading|Processing|Other","false","","",""
```

#### Follow-up Question:
```csv
"How many hectares of farmland do you own?","production","numeric_decimal","farmers","cocoa,maize","Ghana,Nigeria","internal","","","WP1","5","true","","true","What is your primary source of income?","equals","Farming"
```

### 3. Supported Operators

All operators from conditional logic system:
- `equals`, `not_equals`
- `contains`, `not_contains`
- `greater_than`, `less_than`
- `greater_or_equal`, `less_or_equal`
- `in`, `not_in`
- `is_empty`, `is_not_empty`
- `between`

### 4. Import Logic (Two-Pass System)

#### **Pass 1: Regular Questions**
1. Import all non-follow-up questions
2. Build a map of question_text → question_id

#### **Pass 2: Follow-up Questions**
1. Resolve parent_question_text → parent_question_id
2. Convert conditional logic structure
3. Import follow-up questions with resolved parent IDs

**Code Location:** `backend/forms/import_export.py:540-644`

### 5. Conditional Logic Structure

#### In CSV (human-readable):
```csv
is_follow_up: true
parent_question_text: "Do you own a farm?"
condition_operator: equals
condition_value: Yes
```

#### Converted to (database format):
```json
{
  "enabled": true,
  "parent_question_id": "uuid-of-parent",
  "show_if": {
    "operator": "equals",
    "value": "Yes"
  }
}
```

## Migration Required

Run this migration to add fields to existing models:

```bash
cd backend
python manage.py migrate forms 0008_add_conditional_logic
```

## Usage Examples

### Example 1: Farming Follow-up

**Parent Question (Row 1):**
```csv
"Do you own a farm?","production","choice_single","farmers","cocoa","Ghana","internal","","","WP1","5","true","Yes|No","false","","",""
```

**Follow-up Question (Row 2):**
```csv
"What is the size of your farm?","production","numeric_decimal","farmers","cocoa","Ghana","internal","","","WP1","5","true","","true","Do you own a farm?","equals","Yes"
```

### Example 2: Multiple Choice Follow-up

**Parent Question:**
```csv
"Which crops do you grow?","production","choice_multiple","farmers","cocoa,maize","Ghana","internal","","","WP1","5","true","Cocoa|Maize|Rice|Other","false","","",""
```

**Follow-up Question:**
```csv
"How many cocoa trees do you have?","production","numeric_integer","farmers","cocoa","Ghana","internal","","","WP1","5","true","","true","Which crops do you grow?","contains","Cocoa"
```

### Example 3: Numeric Range Follow-up

**Parent Question:**
```csv
"How many years have you been farming?","production","numeric_integer","farmers","cocoa,maize","Ghana","internal","","","WP1","5","true","","false","","",""
```

**Follow-up Question:**
```csv
"What challenges have you faced?","production","text_long","farmers","cocoa,maize","Ghana","internal","","","WP1","5","false","","true","How many years have you been farming?","greater_or_equal","5"
```

### Example 4: "In" Operator (Multiple Values)

**Parent Question:**
```csv
"What is your age group?","demographics","choice_single","farmers","cocoa,maize","Ghana","internal","","","WP1","5","true","18-25|26-35|36-45|46-55|56+","false","","",""
```

**Follow-up Question:**
```csv
"Are you planning to retire soon?","demographics","choice_single","farmers","cocoa,maize","Ghana","internal","","","WP1","5","false","Yes|No|Maybe","true","What is your age group?","in","46-55|56+"
```

**Note:** For `in`, `not_in`, and `between` operators, use pipe-separated values.

## FormBuilder Updates Needed

### Current FormBuilder State
The FormBuilder currently supports:
- Adding/editing questions
- Setting response types
- Configuring options
- Reordering questions

### Required FormBuilder Enhancements

#### 1. Add Conditional Logic Toggle
```tsx
<Switch
  label="Make this a follow-up question"
  value={isFollowUp}
  onValueChange={setIsFollowUp}
/>
```

#### 2. Parent Question Selector
```tsx
{isFollowUp && (
  <Select
    label="Parent Question"
    options={questions.map(q => ({
      label: q.question_text,
      value: q.id
    }))}
    value={parentQuestionId}
    onChange={setParentQuestionId}
  />
)}
```

#### 3. Operator Selector
```tsx
{isFollowUp && (
  <Select
    label="Show this question when"
    options={[
      { label: 'equals', value: 'equals' },
      { label: 'contains', value: 'contains' },
      { label: 'greater than', value: 'greater_than' },
      // ... all operators
    ]}
    value={operator}
    onChange={setOperator}
  />
)}
```

#### 4. Value Input
```tsx
{isFollowUp && (
  <TextInput
    label="Value"
    value={conditionValue}
    onChangeText={setConditionValue}
    helper="For 'in' operator, use comma-separated values"
  />
)}
```

#### 5. Preview Logic
Show a visual preview of conditional logic:
```
IF [Parent Question] [operator] [value]
THEN show this question
```

## API Response Updates

### Question Object (with follow-up):
```json
{
  "id": "uuid",
  "question_text": "How many hectares?",
  "response_type": "numeric_decimal",
  "is_follow_up": true,
  "conditional_logic": {
    "enabled": true,
    "parent_question_id": "parent-uuid",
    "show_if": {
      "operator": "equals",
      "value": "Yes"
    }
  }
}
```

## Testing Checklist

### Import/Export
- [ ] Download CSV template - verify new columns present
- [ ] Import CSV with regular questions only
- [ ] Import CSV with follow-up questions
- [ ] Verify parent question ID resolution
- [ ] Test all operators (equals, contains, greater_than, etc.)
- [ ] Test "in" operator with multiple values
- [ ] Export questions - verify conditional logic included
- [ ] Import exported file - verify round-trip works

### FormBuilder
- [ ] Create regular question
- [ ] Toggle "follow-up" switch
- [ ] Select parent question
- [ ] Choose operator
- [ ] Enter condition value
- [ ] Save question
- [ ] Edit follow-up question
- [ ] Reorder questions - verify parent references maintained
- [ ] Delete parent question - handle orphaned follow-ups

### Data Collection
- [ ] Answer parent question with matching value - follow-up appears
- [ ] Answer parent question with non-matching value - follow-up hidden
- [ ] Change parent answer - follow-up appears/disappears dynamically
- [ ] Submit form - only visible questions validated
- [ ] Verify responses saved correctly

## Error Handling

### Import Errors
- `parent_question_text required for follow-up questions`
- `condition_operator required for follow-up questions`
- `Invalid condition_operator '{operator}'`
- `Parent question '{text}' not found`
- `condition_value required for operator '{operator}'`

### Resolution Strategy
1. Import regular questions first (Pass 1)
2. Build question text → ID mapping
3. Resolve parent references (Pass 2)
4. If parent not found, check existing QuestionBank
5. If still not found, report error and skip

## File Locations

### Backend
- `backend/forms/import_export.py` - Import/export logic
- `backend/forms/models.py` - Question/QuestionBank models
- `backend/forms/migrations/0008_add_conditional_logic.py` - Migration

### Frontend
- `FsdaFrontend/src/utils/conditionalLogic.ts` - Evaluation engine
- `FsdaFrontend/src/screens/DataCollectionScreen.tsx` - Collection flow
- `FsdaFrontend/src/screens/FormBuilderScreen.tsx` - Builder UI (needs update)

### Documentation
- `docs/FOLLOW_UP_QUESTIONS.md` - User guide
- `docs/IMPORT_EXPORT_FOLLOWUP_UPDATES.md` - This file

## Next Steps

1. **Run Migration:**
   ```bash
   cd backend
   python manage.py migrate forms
   ```

2. **Test Import/Export:**
   - Download new template
   - Create test questions with follow-ups
   - Import and verify

3. **Update FormBuilder UI:**
   - Add follow-up question toggle
   - Add parent question selector
   - Add operator/value inputs
   - Test creation and editing

4. **End-to-End Testing:**
   - Create survey with follow-ups via import
   - Test data collection flow
   - Verify conditional logic works
   - Test all operators

## Benefits

✅ **CSV Import/Export** - Full support for conditional logic
✅ **Two-Pass Import** - Resolves parent references automatically
✅ **Backward Compatible** - Existing imports still work
✅ **Comprehensive** - All 12 operators supported
✅ **Validated** - Operator and value validation during import
✅ **User-Friendly** - Human-readable CSV format

## Example Complete CSV

```csv
question_text,question_category,response_type,targeted_respondents,targeted_commodities,targeted_countries,data_source,research_partner_name,research_partner_contact,work_package,priority_score,is_required,options,is_follow_up,parent_question_text,condition_operator,condition_value
"Do you own a farm?","production","choice_single","farmers","cocoa,maize","Ghana","internal","","","WP1","5","true","Yes|No","false","","",""
"What is your farm size (hectares)?","production","numeric_decimal","farmers","cocoa,maize","Ghana","internal","","","WP1","5","true","","true","Do you own a farm?","equals","Yes"
"Which crops do you grow?","production","choice_multiple","farmers","cocoa,maize","Ghana","internal","","","WP1","5","true","Cocoa|Maize|Rice","true","Do you own a farm?","equals","Yes"
"How many cocoa trees?","production","numeric_integer","farmers","cocoa","Ghana","internal","","","WP1","5","false","","true","Which crops do you grow?","contains","Cocoa"
```

This creates a 4-question survey with branching logic!
