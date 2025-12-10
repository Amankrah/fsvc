/**
 * QuestionFormDialog Component
 * Reusable dialog for adding/editing questions
 */

import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {
  Dialog,
  Portal,
  Button,
  Text,
  TextInput,
  Chip,
  Switch,
  Divider,
  IconButton,
} from 'react-native-paper';
import {
  RESPONSE_TYPE_CATEGORIES,
  COUNTRY_OPTIONS,
  CONDITION_OPERATORS,
} from '../../constants/formBuilder';
import { Question, RespondentType, ResponseType, ResponseTypeInfo } from '../../types';

interface QuestionFormDialogProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: () => void;
  isEditing: boolean;
  saving: boolean;

  // Form state
  newQuestion: any;
  setNewQuestion: (question: any) => void;
  optionInput: string;
  setOptionInput: (input: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  selectedTargetedRespondents: RespondentType[];
  setSelectedTargetedRespondents: (respondents: RespondentType[]) => void;
  selectedCommodities: string[];
  setSelectedCommodities: (commodities: string[]) => void;
  selectedCountries: string[];
  setSelectedCountries: (countries: string[]) => void;

  // Conditional logic
  isFollowUp: boolean;
  setIsFollowUp: (value: boolean) => void;
  parentQuestionId: string;
  setParentQuestionId: (id: string) => void;
  conditionOperator: string;
  setConditionOperator: (operator: string) => void;
  conditionValue: string;
  setConditionValue: (value: string) => void;

  // Methods
  addOption: () => void;
  removeOption: (index: number) => void;

  // Data
  responseTypes: ResponseTypeInfo[];
  questionBankChoices: any;
  questions: Question[];
}

/**
 * Helper function to get auto-assigned category based on respondent type
 * Matches backend logic in import_export.py RESPONDENT_TO_CATEGORY_MAPPING
 */
const getAutoCategoryFromRespondents = (respondent: RespondentType): string => {
  const categoryMapping: Record<string, string> = {
    'input_suppliers': 'Input Supply',
    'farmers': 'Production',
    'aggregators_lbcs': 'Distribution',
    'processors': 'Processing',
    'processors_eu': 'Processing',
    'retailers_food_vendors': 'Distribution',
    'retailers_food_vendors_eu': 'Distribution',
    'local_consumers': 'Consumption',
    'consumers_eu_prolific': 'Consumption',
    'client_business_eu_prolific': 'Consumption',
    'government': 'Governance',
    'ngos': 'Governance',
    'certification_schemes': 'Certification',
    'coop': 'Distribution',
    'chief': 'Governance',
  };

  return categoryMapping[respondent] || 'General';
};

export const QuestionFormDialog: React.FC<QuestionFormDialogProps> = ({
  visible,
  onDismiss,
  onSubmit,
  isEditing,
  saving,
  newQuestion,
  setNewQuestion,
  optionInput,
  setOptionInput,
  selectedCategory,
  setSelectedCategory,
  selectedTargetedRespondents,
  setSelectedTargetedRespondents,
  selectedCommodities,
  setSelectedCommodities,
  selectedCountries,
  setSelectedCountries,
  isFollowUp,
  setIsFollowUp,
  parentQuestionId,
  setParentQuestionId,
  conditionOperator,
  setConditionOperator,
  conditionValue,
  setConditionValue,
  addOption,
  removeOption,
  responseTypes,
  questionBankChoices,
  questions,
}) => {
  const selectedResponseTypes =
    RESPONSE_TYPE_CATEGORIES.find((cat) => cat.label === selectedCategory)?.types || [];

  const requiresOptions = ['choice_single', 'choice_multiple'].includes(newQuestion.response_type);

  const toggleRespondent = (respondent: RespondentType) => {
    setSelectedTargetedRespondents(
      selectedTargetedRespondents.includes(respondent)
        ? selectedTargetedRespondents.filter((r) => r !== respondent)
        : [...selectedTargetedRespondents, respondent]
    );
  };

  const toggleCommodity = (commodity: string) => {
    setSelectedCommodities(
      selectedCommodities.includes(commodity)
        ? selectedCommodities.filter((c) => c !== commodity)
        : [...selectedCommodities, commodity]
    );
  };

  const toggleCountry = (country: string) => {
    setSelectedCountries(
      selectedCountries.includes(country)
        ? selectedCountries.filter((c) => c !== country)
        : [...selectedCountries, country]
    );
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title style={styles.dialogTitle}>
          {isEditing ? 'Edit Question' : 'Add Question to Bank'}
        </Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Question Text */}
            <TextInput
              label="Question Text *"
              value={newQuestion.question_text}
              onChangeText={(text) => setNewQuestion({ ...newQuestion, question_text: text })}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.input}
              textColor="#ffffff"
              theme={{
                colors: {
                  primary: '#64c8ff',
                  onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                  outline: 'rgba(100, 200, 255, 0.5)',
                },
              }}
            />

            {/* Category Selection */}
            <Text style={styles.sectionTitle}>Response Type Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {RESPONSE_TYPE_CATEGORIES.map((cat) => (
                <Chip
                  key={cat.label}
                  selected={selectedCategory === cat.label}
                  onPress={() => {
                    setSelectedCategory(cat.label);
                    setNewQuestion({ ...newQuestion, response_type: cat.types[0] });
                  }}
                  style={[styles.chip, selectedCategory === cat.label && styles.selectedChip]}
                  textStyle={styles.chipText}>
                  {cat.label}
                </Chip>
              ))}
            </ScrollView>

            {/* Response Type Selection */}
            {selectedResponseTypes.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Specific Response Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {selectedResponseTypes.map((type) => {
                    const typeInfo = responseTypes.find((rt) => rt.value === type);
                    return (
                      <Chip
                        key={type}
                        selected={newQuestion.response_type === type}
                        onPress={() => setNewQuestion({ ...newQuestion, response_type: type })}
                        style={[
                          styles.chip,
                          newQuestion.response_type === type && styles.selectedChip,
                        ]}
                        textStyle={styles.chipText}>
                        {typeInfo?.display_name || type}
                      </Chip>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {/* Options for Choice Questions */}
            {requiresOptions && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Options *</Text>
                <View style={styles.optionInputRow}>
                  <TextInput
                    value={optionInput}
                    onChangeText={setOptionInput}
                    placeholder="Add an option"
                    mode="outlined"
                    style={styles.optionInput}
                    textColor="#ffffff"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    theme={{
                      colors: {
                        primary: '#64c8ff',
                        onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                        outline: 'rgba(100, 200, 255, 0.5)',
                      },
                    }}
                  />
                  <Button
                    mode="contained"
                    onPress={addOption}
                    style={styles.addOptionButton}
                    disabled={!optionInput.trim()}>
                    Add
                  </Button>
                </View>
                {newQuestion.options?.map((option: string, index: number) => (
                  <View key={index} style={styles.optionItem}>
                    <Text style={styles.optionText}>• {option}</Text>
                    <IconButton
                      icon="close"
                      size={18}
                      onPress={() => removeOption(index)}
                      iconColor="#ff6b6b"
                    />
                  </View>
                ))}
              </View>
            )}

            <Divider style={styles.divider} />

            {/* Targeted Respondents */}
            <Text style={styles.sectionTitle}>Targeted Respondents * (Select at least one)</Text>
            <View style={styles.chipContainer}>
              {questionBankChoices.respondent_types?.map((resp: any) => (
                <Chip
                  key={resp.value}
                  selected={selectedTargetedRespondents.includes(resp.value)}
                  onPress={() => toggleRespondent(resp.value)}
                  style={[
                    styles.chip,
                    selectedTargetedRespondents.includes(resp.value) && styles.selectedChip,
                  ]}
                  textStyle={styles.chipText}>
                  {resp.label}
                </Chip>
              ))}
            </View>

            {/* Targeted Commodities */}
            <Text style={styles.sectionTitle}>Targeted Commodities (Optional)</Text>
            <View style={styles.chipContainer}>
              {questionBankChoices.commodities?.map((comm: any) => (
                <Chip
                  key={comm.value}
                  selected={selectedCommodities.includes(comm.value)}
                  onPress={() => toggleCommodity(comm.value)}
                  style={[
                    styles.chip,
                    selectedCommodities.includes(comm.value) && styles.selectedChip,
                  ]}
                  textStyle={styles.chipText}>
                  {comm.label}
                </Chip>
              ))}
            </View>

            {/* Targeted Countries */}
            <Text style={styles.sectionTitle}>Targeted Countries (Optional)</Text>
            <View style={styles.chipContainer}>
              {COUNTRY_OPTIONS.map((country) => (
                <Chip
                  key={country}
                  selected={selectedCountries.includes(country)}
                  onPress={() => toggleCountry(country)}
                  style={[styles.chip, selectedCountries.includes(country) && styles.selectedChip]}
                  textStyle={styles.chipText}>
                  {country}
                </Chip>
              ))}
            </View>

            <Divider style={styles.divider} />

            {/* Custom Question Category */}
            <Text style={styles.sectionTitle}>Question Category (Optional)</Text>
            <Text style={styles.helpText}>
              Custom category for organizing questions (e.g., 'Production', 'Market Access', 'Sustainability'). Leave blank to auto-assign based on respondent type.
            </Text>
            <TextInput
              label="Category"
              value={newQuestion.question_category || ''}
              onChangeText={(text) => setNewQuestion({ ...newQuestion, question_category: text })}
              mode="outlined"
              style={styles.input}
              textColor="#ffffff"
              placeholder={
                selectedTargetedRespondents.length > 0
                  ? `Auto: ${getAutoCategoryFromRespondents(selectedTargetedRespondents[0])}`
                  : 'e.g., Production, Sustainability...'
              }
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              theme={{
                colors: {
                  primary: '#64c8ff',
                  onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                  outline: 'rgba(100, 200, 255, 0.5)',
                },
              }}
            />

            {/* Suggested Categories */}
            {!newQuestion.question_category && (
              <>
                <Text style={styles.label}>Quick Select:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {[
                    'Production',
                    'Processing',
                    'Distribution',
                    'Consumption',
                    'Input Supply',
                    'Market Access',
                    'Sustainability',
                    'Climate Impact',
                    'Social Impact',
                    'Economic Impact',
                    'Quality Standards',
                    'Certification',
                    'Governance',
                    'Policy',
                    'Technology',
                    'Finance',
                    'Nutrition',
                    'Food Safety',
                  ].map((cat) => (
                    <Chip
                      key={cat}
                      onPress={() => setNewQuestion({ ...newQuestion, question_category: cat })}
                      style={styles.chip}
                      textStyle={styles.chipText}>
                      {cat}
                    </Chip>
                  ))}
                </ScrollView>
              </>
            )}

            <Divider style={styles.divider} />

            {/* Switches */}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Required</Text>
              <Switch
                value={newQuestion.is_required}
                onValueChange={(value) => setNewQuestion({ ...newQuestion, is_required: value })}
                color="#64c8ff"
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Allow Multiple</Text>
              <Switch
                value={newQuestion.allow_multiple}
                onValueChange={(value) =>
                  setNewQuestion({ ...newQuestion, allow_multiple: value })
                }
                color="#64c8ff"
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Active</Text>
              <Switch
                value={newQuestion.is_active}
                onValueChange={(value) => setNewQuestion({ ...newQuestion, is_active: value })}
                color="#64c8ff"
              />
            </View>

            <Divider style={styles.divider} />

            {/* Section/Preamble Fields */}
            <Text style={styles.sectionTitle}>Section Grouping (Optional)</Text>
            <Text style={styles.helpText}>
              Group related questions together with a section header and introductory text
            </Text>

            <TextInput
              label="Section Header"
              value={newQuestion.section_header || ''}
              onChangeText={(text) => setNewQuestion({ ...newQuestion, section_header: text })}
              mode="outlined"
              style={styles.input}
              textColor="#ffffff"
              placeholder="e.g., Solution 1: Knowledge Sharing"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              theme={{
                colors: {
                  primary: '#64c8ff',
                  onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                  outline: 'rgba(100, 200, 255, 0.5)',
                },
              }}
            />

            <TextInput
              label="Section Preamble"
              value={newQuestion.section_preamble || ''}
              onChangeText={(text) => setNewQuestion({ ...newQuestion, section_preamble: text })}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.input}
              textColor="#ffffff"
              placeholder="Introductory text shown before first question in this section..."
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              theme={{
                colors: {
                  primary: '#64c8ff',
                  onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                  outline: 'rgba(100, 200, 255, 0.5)',
                },
              }}
            />

            <Divider style={styles.divider} />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Follow-up Question (Conditional Logic)</Text>
              <Switch value={isFollowUp} onValueChange={setIsFollowUp} color="#64c8ff" />
            </View>

            {/* Conditional Logic */}
            {isFollowUp && (
              <View style={styles.conditionalSection}>
                <Text style={styles.sectionTitle}>Conditional Logic Settings</Text>

                <Text style={styles.label}>Parent Question</Text>
                <View style={styles.chipContainer}>
                  {questions.slice(0, 10).map((q) => (
                    <Chip
                      key={q.id}
                      selected={parentQuestionId === q.id}
                      onPress={() => setParentQuestionId(q.id)}
                      style={[styles.chip, parentQuestionId === q.id && styles.selectedChip]}
                      textStyle={styles.chipText}>
                      {q.question_text.substring(0, 30)}...
                    </Chip>
                  ))}
                </View>

                <Text style={styles.label}>Condition Operator</Text>
                <View style={styles.chipContainer}>
                  {CONDITION_OPERATORS.map((op) => (
                    <Chip
                      key={op.value}
                      selected={conditionOperator === op.value}
                      onPress={() => setConditionOperator(op.value)}
                      style={[styles.chip, conditionOperator === op.value && styles.selectedChip]}
                      textStyle={styles.chipText}>
                      {op.label}
                    </Chip>
                  ))}
                </View>

                <TextInput
                  label="Condition Value"
                  value={conditionValue}
                  onChangeText={setConditionValue}
                  mode="outlined"
                  style={styles.input}
                  textColor="#ffffff"
                  placeholder="Enter the value to check against"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  theme={{
                    colors: {
                      primary: '#64c8ff',
                      onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                      outline: 'rgba(100, 200, 255, 0.5)',
                    },
                  }}
                />
              </View>
            )}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={saving}>
            Cancel
          </Button>
          <Button onPress={onSubmit} disabled={saving} loading={saving}>
            {isEditing ? 'Update' : 'Add'}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    backgroundColor: '#1a1a3a',
    borderRadius: 20,
    maxHeight: '90%',
  },
  dialogTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollArea: {
    maxHeight: 600,
    paddingHorizontal: 0,
  },
  input: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  sectionTitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  helpText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 18,
  },
  label: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    marginBottom: 8,
    marginTop: 8,
  },
  chipScroll: {
    marginBottom: 16,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  selectedChip: {
    backgroundColor: 'rgba(100, 200, 255, 0.3)',
    borderColor: '#64c8ff',
  },
  chipText: {
    color: '#ffffff',
    fontSize: 12,
  },
  section: {
    marginBottom: 16,
  },
  optionInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  optionInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  addOptionButton: {
    backgroundColor: '#64c8ff',
    justifyContent: 'center',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingLeft: 12,
    paddingRight: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  optionText: {
    color: '#ffffff',
    fontSize: 14,
  },
  divider: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  switchLabel: {
    color: '#ffffff',
    fontSize: 14,
  },
  conditionalSection: {
    backgroundColor: 'rgba(100, 200, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.3)',
  },
  autoCategoryContainer: {
    marginBottom: 16,
  },
  autoCategoryChip: {
    backgroundColor: 'rgba(100, 200, 255, 0.2)',
    borderColor: '#64c8ff',
    borderWidth: 1.5,
    alignSelf: 'flex-start',
  },
  autoCategoryText: {
    color: '#64c8ff',
    fontSize: 13,
    fontWeight: '600',
  },
  autoCategoryHint: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 6,
  },
});
