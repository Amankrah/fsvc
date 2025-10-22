

# DataCollection Modularization Guide

## 🎯 Overview

I've started modularizing the **DataCollectionScreen** (1854 lines) using the same professional approach as FormBuilder.

## ✅ What's Been Created

### 1. Constants (`src/constants/dataCollection.ts`)
- Image quality settings
- Date format options
- GPS validation rules
- Device info constants

### 2. Custom Hooks (`src/hooks/dataCollection/`)

#### `useRespondent(projectId)`
Manages respondent ID and profile selection
- Auto/manual ID generation
- Respondent type selection
- Commodity multi-selection
- Country selection
- Reset for next respondent

#### `useQuestions({ projectId, selectedRespondentType, selectedCommodities, selectedCountry })`
Handles question loading and dynamic generation
- Load available options from QuestionBank
- Generate dynamic questions
- Auto-load existing questions
- Question state management

#### `useResponseState(questions, projectId, respondentData)`
Manages form responses and navigation
- Response state management
- Conditional logic filtering (visible questions)
- Next/Previous navigation
- Form submission
- Progress calculation

## 📋 Remaining Work

To complete the modularization, you need:

### 3. UI Components (`src/components/dataCollection/`)

Create these reusable components:

#### `RespondentForm.tsx`
- Respondent ID input with auto-generate toggle
- Respondent profile selection (type, commodity, country)
- Question generation UI
- Start survey button

#### `QuestionInput.tsx`
Main question input component that renders different types:
- Text inputs (short/long)
- Numeric inputs (integer/decimal)
- Choice inputs (single/multiple)
- Scale rating
- Date/DateTime picker
- Location (GPS/address)
- Image capture/upload

#### `DatePickerDialog.tsx`
- Manual date input dialog
- Year/Month/Day inputs
- Date validation

#### `LocationDialog.tsx`
- Address input
- GPS coordinates (latitude/longitude)
- Location validation

#### `ImagePicker.tsx`
- Camera capture
- Gallery selection
- Image preview
- Remove/change image

#### `NavigationControls.tsx`
- Previous/Next buttons
- Submit button
- Progress bar

### 4. Refactored Screen (`src/screens/DataCollectionScreen.v2.tsx`)

Compose all hooks and components:

```typescript
const DataCollectionScreen = () => {
  // Hooks
  const respondent = useRespondent(projectId);
  const questions = useQuestions({
    projectId,
    selectedRespondentType: respondent.selectedRespondentType,
    selectedCommodities: respondent.selectedCommodities,
    selectedCountry: respondent.selectedCountry,
  });
  const responses = useResponseState(questions.questions, projectId, {
    respondentId: respondent.respondentId,
    respondentType: respondent.selectedRespondentType,
    commodities: respondent.selectedCommodities,
    country: respondent.selectedCountry,
  });

  // Render RespondentForm or QuestionInput based on state
  if (showRespondentForm) {
    return <RespondentForm {...respondent} {...questions} />;
  }

  return (
    <QuestionView
      question={responses.visibleQuestions[responses.currentQuestionIndex]}
      response={responses.responses[currentQuestion.id]}
      onChange={responses.handleResponseChange}
      onNext={responses.handleNext}
      onPrevious={responses.handlePrevious}
      onSubmit={responses.handleSubmit}
      progress={responses.progress}
      {...other props}
    />
  );
};
```

## 🔑 Key Benefits

### Before (Monolithic)
- **1854 lines** in single file
- Mixed concerns (UI, logic, state)
- Hard to test
- Hard to maintain

### After (Modular)
- **~500 lines** main screen
- **3 custom hooks** (~600 LOC) - Business logic
- **6 components** (~800 LOC) - UI
- **1 constants** - Configuration
- Easy to test and maintain

## 📝 Quick Implementation Steps

1. **Create component files** in `src/components/dataCollection/`
2. **Extract question rendering logic** to `QuestionInput.tsx`
3. **Extract dialogs** (DatePicker, Location, ImagePicker)
4. **Create RespondentForm** component
5. **Build DataCollectionScreen.v2.tsx** using hooks + components
6. **Test thoroughly**
7. **Replace original** when ready

## 🎨 Architecture Pattern

```
DataCollectionScreen.v2.tsx (main orchestrator)
├── useRespondent (respondent management)
├── useQuestions (question loading/generation)
├── useResponseState (form state/navigation)
├── RespondentForm (initial setup)
├── QuestionInput (question rendering)
│   ├── TextInput
│   ├── ChoiceInput
│   ├── DatePickerDialog
│   ├── LocationDialog
│   └── ImagePicker
└── NavigationControls (prev/next/submit)
```

## ⚙️ Integration with FormBuilder

Both modules now follow the same pattern:
- ✅ Centralized constants
- ✅ Custom hooks for business logic
- ✅ Reusable UI components
- ✅ Clean main screen (orchestrator)
- ✅ Full TypeScript support
- ✅ Django backend compatibility

---

**Status:** 🟡 Partial (Hooks complete, components pending)
**Next:** Create UI components to finish modularization

