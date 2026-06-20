/**
 * QuestionFormDialog Component
 * Full-screen bottom sheet for adding/editing questions.
 * Savanna Intelligence design: white card, green accents, warm tokens.
 *
 * Section selector appears first — users can pick an existing section,
 * create a new one, or skip sections entirely. The chosen section
 * persists across consecutive adds (managed by useQuestionForm).
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform,
  Keyboard,
  TextInput as RNTextInput,
} from 'react-native';
import {
  Text,
  Icon,
  Switch,
  TextInput,
} from 'react-native-paper';
import {
  RESPONSE_TYPE_CATEGORIES,
  COUNTRY_OPTIONS,
  CONDITION_OPERATORS,
} from '../../constants/formBuilder';
import { Question, RespondentType, ResponseTypeInfo } from '../../types';
import { colors, spacing, borderRadius, typography, elevation } from '../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SectionMode } from '../../hooks/formBuilder/useQuestionForm';

const SCREEN_HEIGHT = Dimensions.get('window').height;

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

  // Section persistence
  sectionMode: SectionMode;
  setSectionMode: (mode: SectionMode) => void;
  persistedSectionHeader: string;
  setPersistedSectionHeader: (header: string) => void;
  persistedSectionPreamble: string;
  setPersistedSectionPreamble: (preamble: string) => void;

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
 */
const getAutoCategoryFromRespondents = (respondent: RespondentType): string => {
  const categoryMapping: Record<string, string> = {
    'input_suppliers': 'Input Supply',
    'farmers': 'Production',
    'farmers_in': 'Production',
    'farmers_out': 'Production',
    'aggregators_lbcs': 'Distribution',
    'processors': 'Processing',
    'processors_eu': 'Processing',
    'traders': 'Distribution',
    'retailers_food_vendors': 'Distribution',
    'retailers_food_vendors_eu': 'Distribution',
    'local_consumers': 'Consumption',
    'consumers_in': 'Consumption',
    'consumers_out': 'Consumption',
    'consumers_eu_prolific': 'Consumption',
    'client_business_eu_prolific': 'Consumption',
    'government': 'Governance',
    'policymakers': 'Governance',
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
  sectionMode,
  setSectionMode,
  persistedSectionHeader,
  setPersistedSectionHeader,
  persistedSectionPreamble,
  setPersistedSectionPreamble,
  addOption,
  removeOption,
  responseTypes,
  questionBankChoices,
  questions,
}) => {
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // ── Derive unique existing sections from loaded questions ──
  const existingSections = useMemo(() => {
    const sectionMap = new Map<string, string>(); // header → preamble
    questions.forEach((q) => {
      if (q.section_header && !sectionMap.has(q.section_header)) {
        sectionMap.set(q.section_header, q.section_preamble || '');
      }
    });
    return Array.from(sectionMap.entries()).map(([header, preamble]) => ({
      header,
      preamble,
    }));
  }, [questions]);

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

  // ── Section mode handlers ──
  const handleSelectExistingSection = (header: string, preamble: string) => {
    setSectionMode('existing');
    setPersistedSectionHeader(header);
    setPersistedSectionPreamble(preamble);
    setNewQuestion({ ...newQuestion, section_header: header, section_preamble: preamble });
  };

  const handleSetNoSection = () => {
    setSectionMode('none');
    setPersistedSectionHeader('');
    setPersistedSectionPreamble('');
    setNewQuestion({ ...newQuestion, section_header: '', section_preamble: '' });
  };

  const handleSetNewSection = () => {
    setSectionMode('new');
    setPersistedSectionHeader('');
    setPersistedSectionPreamble('');
    setNewQuestion({ ...newQuestion, section_header: '', section_preamble: '' });
  };

  const handleNewSectionHeaderChange = (text: string) => {
    setPersistedSectionHeader(text);
    setNewQuestion({ ...newQuestion, section_header: text });
  };

  const handleNewSectionPreambleChange = (text: string) => {
    setPersistedSectionPreamble(text);
    setNewQuestion({ ...newQuestion, section_preamble: text });
  };

  // ── Reusable chip renderer ──
  const renderChip = (
    label: string,
    selected: boolean,
    onPress: () => void,
    key: string,
  ) => (
    <TouchableOpacity
      key={key}
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {selected && (
        <Icon source="check" size={14} color={colors.primary.main} />
      )}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={styles.modalRoot}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={onDismiss}
        />
        <View style={styles.modalBottom}>
          <View style={[
            styles.bottomSheet,
            {
              paddingBottom: Math.max(insets.bottom, 20),
              height: SCREEN_HEIGHT * 0.92 - keyboardHeight,
            },
          ]}>
            {/* Handle bar */}
            <View style={styles.handleBar} />

            {/* Title row */}
            <View style={styles.titleRow}>
              <View style={styles.titleLeft}>
                <View style={styles.titleAccent} />
                <Text style={styles.titleText}>
                  {isEditing ? 'Edit Question' : 'Add Question to Bank'}
                </Text>
              </View>
              <TouchableOpacity onPress={onDismiss} style={styles.closeBtn}>
                <Icon source="close" size={20} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {/* Scrollable content */}
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              automaticallyAdjustKeyboardInsets
            >
              {/* ══════════════════════════════════════════════════════════════
                  SECTION SELECTOR — appears first
                 ══════════════════════════════════════════════════════════════ */}
              <Text style={styles.sectionLabel}>SECTION GROUPING</Text>
              <Text style={styles.helpText}>
                Assign this question to a section, or leave it ungrouped.
                {sectionMode !== 'none' ? ' Section persists for your next question.' : ''}
              </Text>

              {/* Mode tabs */}
              <View style={styles.sectionModeTabs}>
                <TouchableOpacity
                  style={[styles.sectionModeTab, sectionMode === 'none' && styles.sectionModeTabActive]}
                  onPress={handleSetNoSection}
                  activeOpacity={0.7}
                >
                  <Icon source="minus-circle-outline" size={16} color={sectionMode === 'none' ? colors.primary.main : colors.text.tertiary} />
                  <Text style={[styles.sectionModeTabText, sectionMode === 'none' && styles.sectionModeTabTextActive]}>
                    No Section
                  </Text>
                </TouchableOpacity>

                {existingSections.length > 0 && (
                  <TouchableOpacity
                    style={[styles.sectionModeTab, sectionMode === 'existing' && styles.sectionModeTabActive]}
                    onPress={() => {
                      if (sectionMode !== 'existing') {
                        // Default to first existing section if none picked yet
                        const first = existingSections[0];
                        handleSelectExistingSection(first.header, first.preamble);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Icon source="folder-outline" size={16} color={sectionMode === 'existing' ? colors.primary.main : colors.text.tertiary} />
                    <Text style={[styles.sectionModeTabText, sectionMode === 'existing' && styles.sectionModeTabTextActive]}>
                      Existing
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.sectionModeTab, sectionMode === 'new' && styles.sectionModeTabActive]}
                  onPress={handleSetNewSection}
                  activeOpacity={0.7}
                >
                  <Icon source="plus-circle-outline" size={16} color={sectionMode === 'new' ? colors.primary.main : colors.text.tertiary} />
                  <Text style={[styles.sectionModeTabText, sectionMode === 'new' && styles.sectionModeTabTextActive]}>
                    New Section
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Existing section picker */}
              {sectionMode === 'existing' && existingSections.length > 0 && (
                <View style={styles.existingSectionList}>
                  {existingSections.map((sec) => {
                    const isSelected = persistedSectionHeader === sec.header;
                    return (
                      <TouchableOpacity
                        key={sec.header}
                        style={[styles.existingSectionItem, isSelected && styles.existingSectionItemSelected]}
                        onPress={() => handleSelectExistingSection(sec.header, sec.preamble)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.existingSectionItemLeft}>
                          <View style={[styles.sectionRadio, isSelected && styles.sectionRadioSelected]}>
                            {isSelected && <View style={styles.sectionRadioDot} />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.existingSectionTitle, isSelected && styles.existingSectionTitleSelected]} numberOfLines={1}>
                              {sec.header}
                            </Text>
                            {sec.preamble ? (
                              <Text style={styles.existingSectionPreamble} numberOfLines={1}>
                                {sec.preamble}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        <Text style={styles.existingSectionCount}>
                          {questions.filter((q) => q.section_header === sec.header).length} Qs
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* New section inputs */}
              {sectionMode === 'new' && (
                <View style={styles.newSectionBox}>
                  <TextInput
                    value={persistedSectionHeader}
                    onChangeText={handleNewSectionHeaderChange}
                    mode="outlined"
                    placeholder="Section title, e.g. Solution 1: Knowledge Sharing"
                    style={styles.textInput}
                    outlineStyle={styles.textInputOutline}
                    placeholderTextColor={colors.text.tertiary}
                    theme={{
                      colors: {
                        primary: colors.primary.main,
                        onSurfaceVariant: colors.text.secondary,
                        outline: colors.border.light,
                      },
                    }}
                  />
                  <TextInput
                    value={persistedSectionPreamble}
                    onChangeText={handleNewSectionPreambleChange}
                    mode="outlined"
                    multiline
                    numberOfLines={2}
                    placeholder="Introductory text (optional)"
                    style={styles.textInput}
                    outlineStyle={styles.textInputOutline}
                    placeholderTextColor={colors.text.tertiary}
                    theme={{
                      colors: {
                        primary: colors.primary.main,
                        onSurfaceVariant: colors.text.secondary,
                        outline: colors.border.light,
                      },
                    }}
                  />
                </View>
              )}

              {/* Active section badge */}
              {sectionMode !== 'none' && persistedSectionHeader.trim() !== '' && (
                <View style={styles.activeSectionBadge}>
                  <Icon source="bookmark-outline" size={14} color={colors.primary.main} />
                  <Text style={styles.activeSectionBadgeText} numberOfLines={1}>
                    Adding to: {persistedSectionHeader}
                  </Text>
                </View>
              )}

              {/* ── Divider ── */}
              <View style={styles.divider} />

              {/* ══════════════════════════════════════════════════════════════
                  QUESTION TEXT
                 ══════════════════════════════════════════════════════════════ */}
              <Text style={styles.sectionLabel}>QUESTION TEXT</Text>
              <TextInput
                value={newQuestion.question_text}
                onChangeText={(text) => setNewQuestion({ ...newQuestion, question_text: text })}
                mode="outlined"
                multiline
                numberOfLines={3}
                placeholder="Enter your question..."
                style={styles.textInput}
                outlineStyle={styles.textInputOutline}
                placeholderTextColor={colors.text.tertiary}
                theme={{
                  colors: {
                    primary: colors.primary.main,
                    onSurfaceVariant: colors.text.secondary,
                    outline: colors.border.light,
                  },
                }}
              />

              {/* ── Response Type Category ── */}
              <Text style={styles.sectionLabel}>RESPONSE TYPE</Text>
              <Text style={styles.helpText}>Choose the category, then pick a specific type</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipScroll}
              >
                {RESPONSE_TYPE_CATEGORIES.map((cat) =>
                  renderChip(
                    cat.label,
                    selectedCategory === cat.label,
                    () => {
                      setSelectedCategory(cat.label);
                      setNewQuestion({ ...newQuestion, response_type: cat.types[0] });
                    },
                    `cat-${cat.label}`,
                  )
                )}
              </ScrollView>

              {/* ── Specific Response Type ── */}
              {selectedResponseTypes.length > 0 && (
                <>
                  <Text style={styles.subLabel}>Specific Type</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipScroll}
                  >
                    {selectedResponseTypes.map((type) => {
                      const typeInfo = responseTypes.find((rt) => rt.value === type);
                      return renderChip(
                        typeInfo?.display_name || type,
                        newQuestion.response_type === type,
                        () => setNewQuestion({ ...newQuestion, response_type: type }),
                        `type-${type}`,
                      );
                    })}
                  </ScrollView>
                </>
              )}

              {/* ── Options for Choice Questions ── */}
              {requiresOptions && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>OPTIONS</Text>
                  <View style={styles.optionInputRow}>
                    <View style={styles.optionInputWrap}>
                      <RNTextInput
                        value={optionInput}
                        onChangeText={setOptionInput}
                        placeholder="Add an option..."
                        placeholderTextColor={colors.text.tertiary}
                        style={styles.optionInput}
                      />
                    </View>
                    <TouchableOpacity
                      style={[styles.addOptionBtn, !optionInput.trim() && styles.addOptionBtnDisabled]}
                      onPress={addOption}
                      disabled={!optionInput.trim()}
                      activeOpacity={0.7}
                    >
                      <Icon source="plus" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  {newQuestion.options?.map((option: string, index: number) => (
                    <View key={index} style={styles.optionItem}>
                      <View style={styles.optionBullet} />
                      <Text style={styles.optionText}>{option}</Text>
                      <TouchableOpacity
                        onPress={() => removeOption(index)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Icon source="close-circle" size={18} color={colors.status.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* ── Divider ── */}
              <View style={styles.divider} />

              {/* ── Targeted Respondents ── */}
              <Text style={styles.sectionLabel}>TARGETED RESPONDENTS *</Text>
              <Text style={styles.helpText}>Select at least one respondent type</Text>
              <View style={styles.chipWrap}>
                {questionBankChoices.respondent_types?.map((resp: any) =>
                  renderChip(
                    resp.label,
                    selectedTargetedRespondents.includes(resp.value),
                    () => toggleRespondent(resp.value),
                    `resp-${resp.value}`,
                  )
                )}
              </View>

              {/* ── Targeted Commodities ── */}
              <Text style={styles.sectionLabel}>TARGETED COMMODITIES</Text>
              <Text style={styles.helpText}>Optional — select relevant commodities</Text>
              <View style={styles.chipWrap}>
                {questionBankChoices.commodities?.map((comm: any) =>
                  renderChip(
                    comm.label,
                    selectedCommodities.includes(comm.value),
                    () => toggleCommodity(comm.value),
                    `comm-${comm.value}`,
                  )
                )}
              </View>

              {/* ── Targeted Countries ── */}
              <Text style={styles.sectionLabel}>TARGETED COUNTRIES</Text>
              <Text style={styles.helpText}>Optional — select relevant countries</Text>
              <View style={styles.chipWrap}>
                {COUNTRY_OPTIONS.map((country) =>
                  renderChip(
                    country,
                    selectedCountries.includes(country),
                    () => toggleCountry(country),
                    `country-${country}`,
                  )
                )}
              </View>

              {/* ── Divider ── */}
              <View style={styles.divider} />

              {/* ── Question Category ── */}
              <Text style={styles.sectionLabel}>QUESTION CATEGORY</Text>
              <Text style={styles.helpText}>
                Custom category for organizing questions. Leave blank to auto-assign based on respondent type.
              </Text>
              <TextInput
                value={newQuestion.question_category || ''}
                onChangeText={(text) => setNewQuestion({ ...newQuestion, question_category: text })}
                mode="outlined"
                style={styles.textInput}
                outlineStyle={styles.textInputOutline}
                placeholder={
                  selectedTargetedRespondents.length > 0
                    ? `Auto: ${getAutoCategoryFromRespondents(selectedTargetedRespondents[0])}`
                    : 'e.g., Production, Sustainability...'
                }
                placeholderTextColor={colors.text.tertiary}
                theme={{
                  colors: {
                    primary: colors.primary.main,
                    onSurfaceVariant: colors.text.secondary,
                    outline: colors.border.light,
                  },
                }}
              />

              {/* Quick Select Categories */}
              {!newQuestion.question_category && (
                <>
                  <Text style={styles.subLabel}>Quick Select</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipScroll}
                  >
                    {[
                      'Production', 'Processing', 'Distribution', 'Consumption',
                      'Input Supply', 'Market Access', 'Sustainability', 'Climate Impact',
                      'Social Impact', 'Economic Impact', 'Quality Standards', 'Certification',
                      'Governance', 'Policy', 'Technology', 'Finance', 'Nutrition', 'Food Safety',
                    ].map((cat) =>
                      renderChip(
                        cat,
                        false,
                        () => setNewQuestion({ ...newQuestion, question_category: cat }),
                        `qcat-${cat}`,
                      )
                    )}
                  </ScrollView>
                </>
              )}

              {/* ── Divider ── */}
              <View style={styles.divider} />

              {/* ── Toggle Switches ── */}
              <Text style={styles.sectionLabel}>SETTINGS</Text>
              <View style={styles.switchCard}>
                <View style={styles.switchRow}>
                  <View style={styles.switchLabelWrap}>
                    <Icon source="asterisk" size={16} color={colors.primary.main} />
                    <Text style={styles.switchLabel}>Required</Text>
                  </View>
                  <Switch
                    value={newQuestion.is_required}
                    onValueChange={(value) => setNewQuestion({ ...newQuestion, is_required: value })}
                    color={colors.primary.main}
                  />
                </View>

                <View style={styles.switchDivider} />

                <View style={styles.switchRow}>
                  <View style={styles.switchLabelWrap}>
                    <Icon source="checkbox-multiple-outline" size={16} color={colors.primary.main} />
                    <Text style={styles.switchLabel}>Allow Multiple</Text>
                  </View>
                  <Switch
                    value={newQuestion.allow_multiple}
                    onValueChange={(value) => setNewQuestion({ ...newQuestion, allow_multiple: value })}
                    color={colors.primary.main}
                  />
                </View>

                <View style={styles.switchDivider} />

                <View style={styles.switchRow}>
                  <View style={styles.switchLabelWrap}>
                    <Icon source="check-circle-outline" size={16} color={colors.primary.main} />
                    <Text style={styles.switchLabel}>Active</Text>
                  </View>
                  <Switch
                    value={newQuestion.is_active}
                    onValueChange={(value) => setNewQuestion({ ...newQuestion, is_active: value })}
                    color={colors.primary.main}
                  />
                </View>
              </View>

              {/* ── Divider ── */}
              <View style={styles.divider} />

              {/* ── Conditional Logic ── */}
              <View style={styles.switchCard}>
                <View style={styles.switchRow}>
                  <View style={styles.switchLabelWrap}>
                    <Icon source="source-branch" size={16} color={colors.accent.main} />
                    <Text style={styles.switchLabel}>Follow-up (Conditional Logic)</Text>
                  </View>
                  <Switch
                    value={isFollowUp}
                    onValueChange={setIsFollowUp}
                    color={colors.primary.main}
                  />
                </View>
              </View>

              {isFollowUp && (
                <View style={styles.conditionalBox}>
                  <Text style={styles.subLabel}>Parent Question</Text>
                  <View style={styles.chipWrap}>
                    {questions.slice(0, 10).map((q) =>
                      renderChip(
                        `${q.question_text.substring(0, 30)}...`,
                        parentQuestionId === q.id,
                        () => setParentQuestionId(q.id),
                        `parent-${q.id}`,
                      )
                    )}
                  </View>

                  <Text style={styles.subLabel}>Condition Operator</Text>
                  <View style={styles.chipWrap}>
                    {CONDITION_OPERATORS.map((op) =>
                      renderChip(
                        op.label,
                        conditionOperator === op.value,
                        () => setConditionOperator(op.value),
                        `op-${op.value}`,
                      )
                    )}
                  </View>

                  <TextInput
                    label="Condition Value"
                    value={conditionValue}
                    onChangeText={setConditionValue}
                    mode="outlined"
                    style={styles.textInput}
                    outlineStyle={styles.textInputOutline}
                    placeholder="Enter the value to check against"
                    placeholderTextColor={colors.text.tertiary}
                    theme={{
                      colors: {
                        primary: colors.primary.main,
                        onSurfaceVariant: colors.text.secondary,
                        outline: colors.border.light,
                      },
                    }}
                  />
                </View>
              )}
            </ScrollView>

            {/* ── Action buttons ── */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onDismiss}
                disabled={saving}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
                onPress={onSubmit}
                disabled={saving}
                activeOpacity={0.7}
              >
                {saving ? (
                  <Text style={styles.submitBtnText}>Saving...</Text>
                ) : (
                  <>
                    <Icon source={isEditing ? 'check' : 'plus'} size={18} color="#fff" />
                    <Text style={styles.submitBtnText}>
                      {isEditing ? 'Update Question' : 'Add Question'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // ── Modal shell
  modalRoot: {
    flex: 1,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 61, 43, 0.5)',
  },
  modalBottom: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    ...elevation.lg,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.border.medium,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },

  // ── Title
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  titleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  titleAccent: {
    width: 3,
    height: 22,
    backgroundColor: colors.primary.main,
    borderRadius: 2,
    marginRight: spacing.sm,
  },
  titleText: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.xl,
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.round,
    backgroundColor: colors.background.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },

  // ── Labels
  sectionLabel: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  subLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  helpText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    lineHeight: 16,
    marginBottom: spacing.sm,
  },

  // ── Section mode tabs
  sectionModeTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background.subtle,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  sectionModeTabActive: {
    backgroundColor: colors.primary.surface,
    borderColor: colors.primary.muted,
  },
  sectionModeTabText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  sectionModeTabTextActive: {
    color: colors.primary.main,
  },

  // ── Existing section picker
  existingSectionList: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  existingSectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.subtle,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  existingSectionItemSelected: {
    backgroundColor: colors.primary.surface,
    borderColor: colors.primary.muted,
  },
  existingSectionItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  sectionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionRadioSelected: {
    borderColor: colors.primary.main,
  },
  sectionRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary.main,
  },
  existingSectionTitle: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  existingSectionTitleSelected: {
    color: colors.primary.main,
  },
  existingSectionPreamble: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  existingSectionCount: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginLeft: spacing.sm,
  },

  // ── New section box
  newSectionBox: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },

  // ── Active section badge
  activeSectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary.surface,
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    alignSelf: 'flex-start',
  },
  activeSectionBadgeText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.primary.main,
  },

  // ── Text inputs
  textInput: {
    backgroundColor: colors.background.subtle,
    marginBottom: spacing.sm,
  },
  textInputOutline: {
    borderRadius: borderRadius.md,
    borderColor: colors.border.light,
  },

  // ── Chips
  chipScroll: {
    marginBottom: spacing.sm,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.round,
    backgroundColor: colors.background.subtle,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginRight: spacing.sm,
    marginBottom: spacing.xs,
  },
  chipSelected: {
    backgroundColor: colors.primary.surface,
    borderColor: colors.primary.muted,
  },
  chipText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  chipTextSelected: {
    color: colors.primary.main,
  },

  // ── Options
  section: {
    marginBottom: spacing.sm,
  },
  optionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  optionInputWrap: {
    flex: 1,
    backgroundColor: colors.background.subtle,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
  },
  optionInput: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
  },
  addOptionBtn: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addOptionBtnDisabled: {
    backgroundColor: colors.border.medium,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.subtle,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  optionBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary.main,
  },
  optionText: {
    flex: 1,
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },

  // ── Divider
  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.md,
  },

  // ── Switch card
  switchCard: {
    backgroundColor: colors.background.subtle,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    overflow: 'hidden',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  switchLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  switchLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
  },
  switchDivider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginHorizontal: spacing.md,
  },

  // ── Conditional logic box
  conditionalBox: {
    backgroundColor: colors.accent.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.2)',
  },

  // ── Action row
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
  },
  submitBtn: {
    flex: 1.5,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary.main,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  submitBtnDisabled: {
    backgroundColor: colors.border.medium,
  },
  submitBtnText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: '#fff',
  },
});
