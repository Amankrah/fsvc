# FormBuilder Modular Architecture

## Overview

The FormBuilder module has been refactored into a production-ready, modular architecture following industry best practices. This document outlines the structure, patterns, and usage guidelines.

## Architecture Principles

1. **Separation of Concerns** - Business logic, UI, and data are cleanly separated
2. **Reusability** - Components and hooks are designed for reuse across the application
3. **Maintainability** - Clear structure makes code easy to understand and modify
4. **Type Safety** - Full TypeScript support with strict typing
5. **Django Backend Compatibility** - Fully aligned with Django REST API structure

## Directory Structure

```
FsdaFrontend/src/
├── constants/
│   └── formBuilder.ts              # Centralized constants and configuration
├── hooks/
│   └── formBuilder/
│       ├── index.ts                # Hook exports
│       ├── useQuestionBank.ts      # Question CRUD operations
│       ├── useQuestionFilters.ts   # Search and filtering logic
│       ├── useQuestionForm.ts      # Form state management
│       └── useImportExport.ts      # Import/export operations
├── components/
│   └── formBuilder/
│       ├── index.ts                # Component exports
│       ├── QuestionCard.tsx        # Question display component
│       └── SearchFilterBar.tsx     # Filter UI component
└── screens/
    ├── FormBuilderScreen.tsx       # Original (legacy)
    └── FormBuilderScreen.v2.tsx    # Refactored version
```

## Core Modules

### 1. Constants (`constants/formBuilder.ts`)

Centralizes all configuration and constant values:

- **RESPONSE_TYPE_CATEGORIES** - Question response type categories
- **COUNTRY_OPTIONS** - Available country selections
- **CONDITION_OPERATORS** - Conditional logic operators
- **PRIORITY_SCORES** - Priority score options
- **DEFAULT_QUESTION_STATE** - Default form state

**Usage:**
```typescript
import { RESPONSE_TYPE_CATEGORIES, DEFAULT_QUESTION_STATE } from '../constants/formBuilder';
```

### 2. Custom Hooks

#### `useQuestionBank(projectId: string)`

Manages all question bank operations including CRUD and data fetching.

**Features:**
- Question loading and refreshing
- Create, update, delete operations
- Bulk operations (delete all, duplicate)
- Response types and choices loading
- Loading and error states

**Returns:**
```typescript
{
  questions: Question[]
  loading: boolean
  refreshing: boolean
  saving: boolean
  responseTypes: ResponseTypeInfo[]
  questionBankChoices: QuestionBankChoices
  loadProjectAndQuestions: () => Promise<void>
  loadResponseTypes: () => Promise<void>
  loadQuestionBankChoices: () => Promise<void>
  handleRefresh: () => Promise<void>
  createQuestion: (data: any) => Promise<boolean>
  updateQuestion: (id: string, data: any) => Promise<boolean>
  deleteQuestion: (id: string) => Promise<void>
  duplicateQuestion: (id: string) => Promise<void>
  deleteAllQuestionBank: () => Promise<void>
}
```

**Usage:**
```typescript
const {
  questions,
  loading,
  createQuestion,
  updateQuestion,
  deleteQuestion
} = useQuestionBank(projectId);
```

#### `useQuestionFilters(questions: Question[])`

Handles search and filtering logic with multi-select support.

**Features:**
- Text search
- Category filtering (multi-select)
- Respondent type filtering (multi-select)
- Active filter tracking
- Clear all filters

**Returns:**
```typescript
{
  filteredQuestions: Question[]
  searchQuery: string
  setSearchQuery: (query: string) => void
  selectedCategoryFilters: string[]
  selectedRespondentFilters: string[]
  isFilterExpanded: boolean
  setIsFilterExpanded: (expanded: boolean) => void
  toggleCategoryFilter: (category: string) => void
  toggleRespondentFilter: (respondent: string) => void
  clearAllFilters: () => void
  hasActiveFilters: boolean
  activeFiltersCount: number
}
```

**Usage:**
```typescript
const {
  filteredQuestions,
  searchQuery,
  setSearchQuery,
  toggleCategoryFilter,
  clearAllFilters
} = useQuestionFilters(questions);
```

#### `useQuestionForm()`

Manages question form state and validation.

**Features:**
- Form state management
- Option management (add/remove)
- Conditional logic state
- Form validation
- Form reset
- Load question for editing
- Build question data for API

**Returns:**
```typescript
{
  newQuestion: any
  setNewQuestion: (question: any) => void
  optionInput: string
  setOptionInput: (input: string) => void
  selectedCategory: string
  setSelectedCategory: (category: string) => void
  selectedTargetedRespondents: RespondentType[]
  setSelectedTargetedRespondents: (respondents: RespondentType[]) => void
  selectedCommodities: string[]
  setSelectedCommodities: (commodities: string[]) => void
  selectedCountries: string[]
  setSelectedCountries: (countries: string[]) => void
  isFollowUp: boolean
  setIsFollowUp: (value: boolean) => void
  parentQuestionId: string
  setParentQuestionId: (id: string) => void
  conditionOperator: string
  setConditionOperator: (operator: string) => void
  conditionValue: string
  setConditionValue: (value: string) => void
  resetForm: () => void
  loadQuestionForEdit: (question: Question) => void
  validateQuestion: () => boolean
  buildQuestionData: () => any
  addOption: () => void
  removeOption: (index: number) => void
}
```

**Usage:**
```typescript
const {
  newQuestion,
  validateQuestion,
  buildQuestionData,
  resetForm
} = useQuestionForm();

const handleSubmit = async () => {
  if (!validateQuestion()) return;
  const data = buildQuestionData();
  await createQuestion(data);
  resetForm();
};
```

#### `useImportExport(onImportSuccess: () => Promise<void>)`

Handles CSV/Excel import and export operations.

**Features:**
- Template download (CSV/Excel)
- File import with progress tracking
- Cross-platform support (Web & Mobile)
- Error handling with detailed messages

**Returns:**
```typescript
{
  showImportExportDialog: boolean
  setShowImportExportDialog: (show: boolean) => void
  importing: boolean
  importProgress: number
  importResult: any
  handleDownloadTemplate: (format: 'csv' | 'excel') => Promise<void>
  handleImportQuestions: () => Promise<void>
}
```

**Usage:**
```typescript
const {
  handleDownloadTemplate,
  handleImportQuestions,
  importing,
  importProgress
} = useImportExport(loadQuestions);
```

### 3. Components

#### `QuestionCard`

Displays a single question with all metadata and actions.

**Props:**
```typescript
{
  question: Question
  index: number
  responseTypes: ResponseTypeInfo[]
  questionBankChoices: any
  onEdit: (question: Question) => void
  onDuplicate: (questionId: string) => void
  onDelete: (questionId: string) => void
}
```

**Features:**
- Question metadata display
- Response type badges
- Priority indicators
- Targeted respondents/commodities/countries
- Action buttons (edit, duplicate, delete)

#### `SearchFilterBar`

Collapsible search and filter interface.

**Props:**
```typescript
{
  isExpanded: boolean
  onToggleExpanded: () => void
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedCategoryFilters: string[]
  selectedRespondentFilters: string[]
  onToggleCategoryFilter: (category: string) => void
  onToggleRespondentFilter: (respondent: string) => void
  onClearAllFilters: () => void
  hasActiveFilters: boolean
  activeFiltersCount: number
  filteredCount: number
  totalCount: number
  categories: Array<{ value: string; label: string }>
  respondentTypes: Array<{ value: string; label: string }>
}
```

**Features:**
- Collapsible interface
- Text search
- Multi-select filters
- Active filter badges
- Results counter

## Django Backend Integration

### API Endpoints Used

```typescript
// Question Bank Operations
apiService.getQuestionBank({ page_size: 1000 })
apiService.createQuestionBankItem(questionData)
apiService.updateQuestionBankItem(questionId, questionData)
apiService.deleteQuestionBankItem(questionId)
apiService.duplicateQuestionBankItem(questionId)
apiService.deleteAllQuestionBankItems(confirm, deleteGenerated)

// Metadata
apiService.getResponseTypes()
apiService.getQuestionBankChoices()

// Import/Export
apiService.downloadCSVTemplate()
apiService.downloadExcelTemplate()
apiService.importQuestions(file)
```

### Data Structure Alignment

The question data structure aligns with Django's `QuestionBank` model:

```typescript
{
  question_text: string
  question_category: string
  response_type: ResponseType
  is_required: boolean
  allow_multiple: boolean
  options: string[]
  validation_rules: object
  targeted_respondents: RespondentType[]
  targeted_commodities: string[]
  targeted_countries: string[]
  data_source: string
  research_partner_name: string
  research_partner_contact: string
  work_package: string
  priority_score: number
  is_active: boolean
  tags: string[]
  is_follow_up: boolean
  conditional_logic: {
    enabled: boolean
    parent_question_id: string
    show_if: {
      operator: string
      value: string
    }
  }
  base_project: string
}
```

## Migration Guide

### From Original to Refactored Version

1. **Replace the screen file:**
   ```bash
   mv FormBuilderScreen.tsx FormBuilderScreen.old.tsx
   mv FormBuilderScreen.v2.tsx FormBuilderScreen.tsx
   ```

2. **Verify imports in navigation:**
   ```typescript
   import FormBuilderScreen from '../screens/FormBuilderScreen';
   ```

3. **Test all functionality:**
   - Create question
   - Edit question
   - Delete question
   - Duplicate question
   - Search and filter
   - Import/export

### Future Enhancements

1. **Extract Dialog Components:**
   - `QuestionFormDialog` - Add/Edit question dialog
   - `ImportExportDialog` - Import/export dialog
   - `ConditionalLogicSection` - Conditional logic UI

2. **Add Unit Tests:**
   ```typescript
   // hooks/formBuilder/__tests__/
   useQuestionBank.test.ts
   useQuestionFilters.test.ts
   useQuestionForm.test.ts

   // components/formBuilder/__tests__/
   QuestionCard.test.tsx
   SearchFilterBar.test.tsx
   ```

3. **Performance Optimizations:**
   - Implement virtualized list for large question sets
   - Add debouncing to search input
   - Memoize expensive computations

4. **Accessibility:**
   - Add ARIA labels
   - Keyboard navigation
   - Screen reader support

## Best Practices

### 1. Hook Usage

✅ **DO:**
```typescript
// Use hooks at the top level
const FormBuilder = () => {
  const { questions, loading } = useQuestionBank(projectId);
  // Component logic
};
```

❌ **DON'T:**
```typescript
// Don't call hooks conditionally
const FormBuilder = () => {
  if (someCondition) {
    const { questions } = useQuestionBank(projectId); // ❌ Wrong
  }
};
```

### 2. Component Composition

✅ **DO:**
```typescript
// Keep components focused and reusable
<QuestionCard
  question={question}
  onEdit={handleEdit}
  onDelete={handleDelete}
/>
```

❌ **DON'T:**
```typescript
// Don't create monolithic components
<GiantQuestionComponent
  allProps={everything}
/>
```

### 3. State Management

✅ **DO:**
```typescript
// Use appropriate hooks for each concern
const questions = useQuestionBank(projectId);
const filters = useQuestionFilters(questions.questions);
const form = useQuestionForm();
```

❌ **DON'T:**
```typescript
// Don't mix concerns in state
const [everythingInOneState, setEverything] = useState({
  questions,
  filters,
  form,
  // ... ❌ Wrong
});
```

## Testing

### Hook Testing Example

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useQuestionFilters } from '../useQuestionFilters';

test('filters questions by search query', () => {
  const questions = [
    { id: '1', question_text: 'What is your name?' },
    { id: '2', question_text: 'What is your age?' },
  ];

  const { result } = renderHook(() => useQuestionFilters(questions));

  act(() => {
    result.current.setSearchQuery('name');
  });

  expect(result.current.filteredQuestions).toHaveLength(1);
  expect(result.current.filteredQuestions[0].id).toBe('1');
});
```

### Component Testing Example

```typescript
import { render, fireEvent } from '@testing-library/react-native';
import { QuestionCard } from '../QuestionCard';

test('calls onEdit when edit button is pressed', () => {
  const onEdit = jest.fn();
  const question = { id: '1', question_text: 'Test question' };

  const { getByTestId } = render(
    <QuestionCard
      question={question}
      onEdit={onEdit}
      // ... other props
    />
  );

  fireEvent.press(getByTestId('edit-button'));
  expect(onEdit).toHaveBeenCalledWith(question);
});
```

## Performance Considerations

1. **Memoization:**
   - Use `React.memo` for components that don't change often
   - Use `useMemo` for expensive computations
   - Use `useCallback` for stable function references

2. **List Optimization:**
   - Consider `react-native-fast-list` for large lists
   - Implement windowing/virtualization for 100+ items

3. **Debouncing:**
   - Add debounce to search input (300ms recommended)
   - Throttle filter operations if expensive

## Troubleshooting

### Common Issues

1. **Questions not loading:**
   - Check `projectId` is passed correctly
   - Verify API endpoint in `apiService`
   - Check network tab for errors

2. **Filters not working:**
   - Ensure `questions` array is passed to `useQuestionFilters`
   - Check filter criteria matches data structure

3. **Form validation failing:**
   - Verify required fields are filled
   - Check `selectedTargetedRespondents` has values
   - Ensure choice questions have 2+ options

## Contributing

When adding new features to FormBuilder:

1. **Add constants** to `constants/formBuilder.ts`
2. **Create hooks** for business logic in `hooks/formBuilder/`
3. **Create components** for UI in `components/formBuilder/`
4. **Update screen** to use new hooks/components
5. **Add tests** for new functionality
6. **Update this documentation**

## Support

For questions or issues:
- Check this documentation first
- Review existing code for patterns
- Check Django backend API documentation
- Contact the development team

---

**Version:** 1.0.0
**Last Updated:** 2025-10-22
**Maintainer:** Development Team
