import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Text,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
import { colors, typography, borderRadius, spacing } from '../../constants/theme';

export interface AnalysisMethod {
  id: string;
  name: string;
  description: string;
  category: 'descriptive' | 'inferential' | 'qualitative';
  requiresVariables: boolean;
  parameters?: AnalysisParameter[];
}

export interface AnalysisParameter {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean' | 'multiselect';
  required?: boolean;
  defaultValue?: any;
  options?: { label: string; value: string | number }[];
  min?: number;
  max?: number;
}

interface AnalyticsSelectorProps {
  availableMethods: AnalysisMethod[];
  availableVariables: string[];
  onRunAnalysis: (methodId: string, selectedVariables: string[], parameters: any) => void;
  loading?: boolean;
  getCompatibleVariables?: (methodCategory: string) => string[];
}

const CATEGORY_ICONS: Record<string, string> = {
  descriptive: '📊',
  inferential: '📈',
  qualitative: '📝',
};

const CATEGORY_COLOR: Record<string, string> = {
  descriptive: colors.primary.surface,
  inferential: colors.status.infoSurface,
  qualitative: colors.accent.surface,
};

const CATEGORY_TEXT: Record<string, string> = {
  descriptive: colors.primary.main,
  inferential: colors.status.info,
  qualitative: colors.accent.dark,
};

// ── Reusable sub-components ────────────────────────────────────────────────

const RadioCircle = ({ selected }: { selected: boolean }) => (
  <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
    {selected && <View style={styles.radioInner} />}
  </View>
);

const CheckSquare = ({ checked }: { checked: boolean }) => (
  <View style={[styles.checkOuter, checked && styles.checkOuterChecked]}>
    {checked && <Text style={styles.checkMark}>✓</Text>}
  </View>
);

// ── Main component ──────────────────────────────────────────────────────────

const AnalyticsSelector: React.FC<AnalyticsSelectorProps> = ({
  availableMethods,
  availableVariables,
  onRunAnalysis,
  loading = false,
  getCompatibleVariables,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<AnalysisMethod | null>(null);
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  const [parameters, setParameters] = useState<{ [key: string]: any }>({});
  const [showMethodModal, setShowMethodModal] = useState(false);
  const [showVariableModal, setShowVariableModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Get filtered variables based on selected method
  const displayVariables =
    selectedMethod && getCompatibleVariables
      ? getCompatibleVariables(selectedMethod.category)
      : availableVariables;

  // Reset selections when method changes
  useEffect(() => {
    if (selectedMethod) {
      setSelectedVariables([]);
      const initialParams: { [key: string]: any } = {};
      selectedMethod.parameters?.forEach((param) => {
        initialParams[param.name] = param.defaultValue;
      });
      setParameters(initialParams);
    }
  }, [selectedMethod]);

  const filteredMethods = categoryFilter
    ? availableMethods.filter((m) => m.category === categoryFilter)
    : availableMethods;

  const handleVariableToggle = (variable: string) => {
    setSelectedVariables((prev) =>
      prev.includes(variable) ? prev.filter((v) => v !== variable) : [...prev, variable]
    );
  };

  const handleParameterChange = (paramName: string, value: any) => {
    setParameters((prev) => ({ ...prev, [paramName]: value }));
  };

  const handleRunAnalysis = () => {
    if (!selectedMethod) return;
    onRunAnalysis(selectedMethod.id, selectedVariables, parameters);
  };

  const isReadyToRun = () => {
    if (!selectedMethod) return false;
    if (selectedMethod.requiresVariables && selectedVariables.length === 0) return false;
    const missingRequired = selectedMethod.parameters?.some(
      (param) => param.required && !parameters[param.name]
    );
    return !missingRequired;
  };

  // ── Parameter renderers ──────────────────────────────────────────────────

  const renderParameterInput = (param: AnalysisParameter) => {
    switch (param.type) {
      case 'text':
        return (
          <View key={param.name} style={styles.paramGroup}>
            <Text style={styles.paramLabel}>{param.label}</Text>
            <TextInput
              style={styles.nativeInput}
              value={parameters[param.name] || ''}
              onChangeText={(value) => handleParameterChange(param.name, value)}
              placeholder={param.label}
              placeholderTextColor={colors.text.tertiary}
            />
          </View>
        );

      case 'number':
        return (
          <View key={param.name} style={styles.paramGroup}>
            <Text style={styles.paramLabel}>{param.label}</Text>
            <TextInput
              style={styles.nativeInput}
              value={parameters[param.name]?.toString() || ''}
              onChangeText={(value) =>
                handleParameterChange(param.name, parseFloat(value) || 0)
              }
              keyboardType="numeric"
              placeholder={param.defaultValue?.toString()}
              placeholderTextColor={colors.text.tertiary}
            />
          </View>
        );

      case 'boolean':
        return (
          <TouchableOpacity
            key={param.name}
            style={styles.boolRow}
            onPress={() => handleParameterChange(param.name, !parameters[param.name])}
            activeOpacity={0.7}
          >
            <CheckSquare checked={!!parameters[param.name]} />
            <Text style={styles.boolLabel}>{param.label}</Text>
          </TouchableOpacity>
        );

      case 'select':
        return (
          <View key={param.name} style={styles.paramGroup}>
            <Text style={styles.paramLabel}>{param.label}</Text>
            <View style={styles.chipRow}>
              {param.options?.map((option) => {
                const isSelected =
                  (parameters[param.name] ?? param.defaultValue) === option.value.toString();
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                    onPress={() =>
                      handleParameterChange(param.name, option.value.toString())
                    }
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isSelected && styles.filterChipTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );

      case 'multiselect':
        return (
          <View key={param.name} style={styles.paramGroup}>
            <Text style={styles.paramLabel}>{param.label}</Text>
            {param.options?.map((option) => {
              const currentValue: any[] = parameters[param.name] || [];
              const isChecked = currentValue.includes(option.value);
              return (
                <TouchableOpacity
                  key={option.value}
                  style={styles.checkRow}
                  onPress={() => {
                    const newValue = isChecked
                      ? currentValue.filter((v: any) => v !== option.value)
                      : [...currentValue, option.value];
                    handleParameterChange(param.name, newValue);
                  }}
                  activeOpacity={0.7}
                >
                  <CheckSquare checked={isChecked} />
                  <Text style={styles.checkRowLabel}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );

      default:
        return null;
    }
  };

  // ── Method selection modal ───────────────────────────────────────────────

  const renderMethodModal = () => {
    // Group methods by category for section headers
    const categories: Array<'descriptive' | 'inferential' | 'qualitative'> = [
      'descriptive',
      'inferential',
      'qualitative',
    ];

    return (
      <Modal
        visible={showMethodModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMethodModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            {/* Handle bar */}
            <View style={styles.handleBar} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Analysis Method</Text>
                <Text style={styles.modalSubtitle}>Choose a statistical approach</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setShowMethodModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Category filter chips */}
            <View style={styles.modalFilterRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[null, 'descriptive', 'inferential', 'qualitative'].map((cat) => {
                  const isActive = categoryFilter === cat;
                  return (
                    <TouchableOpacity
                      key={cat ?? 'all'}
                      style={[styles.filterChip, isActive && styles.filterChipSelected]}
                      onPress={() => setCategoryFilter(cat)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          isActive && styles.filterChipTextSelected,
                        ]}
                      >
                        {cat
                          ? cat.charAt(0).toUpperCase() + cat.slice(1)
                          : 'All'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Method list */}
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {(categoryFilter
                ? [categoryFilter as typeof categories[0]]
                : categories
              ).map((cat) => {
                const methodsInCat = filteredMethods.filter((m) => m.category === cat);
                if (methodsInCat.length === 0) return null;
                return (
                  <View key={cat}>
                    <Text style={styles.groupLabel}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </Text>
                    {methodsInCat.map((method) => {
                      const isSelected = selectedMethod?.id === method.id;
                      return (
                        <TouchableOpacity
                          key={method.id}
                          style={[
                            styles.methodRow,
                            isSelected && styles.methodRowSelected,
                          ]}
                          onPress={() => {
                            setSelectedMethod(method);
                            setShowMethodModal(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              styles.methodIcon,
                              { backgroundColor: CATEGORY_COLOR[method.category] },
                            ]}
                          >
                            <Text style={styles.methodIconText}>
                              {CATEGORY_ICONS[method.category]}
                            </Text>
                          </View>
                          <View style={styles.methodInfo}>
                            <Text
                              style={[
                                styles.methodName,
                                isSelected && styles.methodNameSelected,
                              ]}
                            >
                              {method.name}
                            </Text>
                            <Text style={styles.methodDesc} numberOfLines={1}>
                              {method.description}
                            </Text>
                          </View>
                          <RadioCircle selected={isSelected} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // ── Variable selection modal ─────────────────────────────────────────────

  const renderVariableModal = () => (
    <Modal
      visible={showVariableModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowVariableModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.bottomSheet}>
          <View style={styles.handleBar} />

          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Select Variables</Text>
              <Text style={styles.modalSubtitle}>
                {selectedVariables.length} selected
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setShowVariableModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {displayVariables.length === 0 ? (
              <Text style={styles.emptyText}>
                No compatible questions found for this analysis type.
              </Text>
            ) : (
              displayVariables.map((variable) => {
                const isChecked = selectedVariables.includes(variable);
                return (
                  <TouchableOpacity
                    key={variable}
                    style={[styles.varRow, isChecked && styles.varRowSelected]}
                    onPress={() => handleVariableToggle(variable)}
                    activeOpacity={0.7}
                  >
                    <CheckSquare checked={isChecked} />
                    <Text
                      style={[styles.varRowLabel, isChecked && styles.varRowLabelSelected]}
                    >
                      {variable}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={() => setShowVariableModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ── Main render ──────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* ── Step 1: Method ── */}
      <View style={styles.card}>
        <Text style={styles.stepLabel}>1. Analysis Method</Text>

        {selectedMethod ? (
          <View style={styles.selectedMethodCard}>
            <View style={styles.selectedMethodInfo}>
              <Text style={styles.selectedMethodName}>{selectedMethod.name}</Text>
              <Text style={styles.selectedMethodDesc}>{selectedMethod.description}</Text>
              <View
                style={[
                  styles.categoryBadge,
                  { backgroundColor: CATEGORY_COLOR[selectedMethod.category] },
                ]}
              >
                <Text
                  style={[
                    styles.categoryBadgeText,
                    { color: CATEGORY_TEXT[selectedMethod.category] },
                  ]}
                >
                  {CATEGORY_ICONS[selectedMethod.category]}{' '}
                  {selectedMethod.category.charAt(0).toUpperCase() +
                    selectedMethod.category.slice(1)}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => setShowMethodModal(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.editBtnText}>✏️</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.chooseBtn}
            onPress={() => setShowMethodModal(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.chooseBtnText}>+ Choose Analysis Method</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Step 2: Variables ── */}
      {selectedMethod && selectedMethod.requiresVariables && (
        <View style={[styles.card, { marginTop: 12 }]}>
          <Text style={styles.stepLabel}>2. Variables</Text>

          {selectedVariables.length > 0 ? (
            <View>
              <View style={styles.chipRow}>
                {selectedVariables.map((variable) => (
                  <TouchableOpacity
                    key={variable}
                    style={styles.varChip}
                    onPress={() => handleVariableToggle(variable)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.varChipText}>{variable}</Text>
                    <Text style={styles.varChipClose}> ✕</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={styles.addMoreBtn}
                onPress={() => setShowVariableModal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.addMoreBtnText}>+ Add More</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.chooseBtn}
              onPress={() => setShowVariableModal(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.chooseBtnText}>+ Select Variables</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Step 3: Parameters ── */}
      {selectedMethod &&
        selectedMethod.parameters &&
        selectedMethod.parameters.length > 0 && (
          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.stepLabel}>
              {selectedMethod.requiresVariables ? '3' : '2'}. Parameters
            </Text>
            {selectedMethod.parameters.map(renderParameterInput)}
          </View>
        )}

      {/* ── Run button ── */}
      {selectedMethod && (
        <TouchableOpacity
          style={[
            styles.runBtn,
            { marginTop: 16 },
            (!isReadyToRun() || loading) && styles.runBtnDisabled,
          ]}
          onPress={handleRunAnalysis}
          disabled={!isReadyToRun() || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.runBtnText}>▶  Run Analysis</Text>
          )}
        </TouchableOpacity>
      )}

      {renderMethodModal()}
      {renderVariableModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ── Cards ──────────────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: spacing.lg,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  stepLabel: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wider,
    marginBottom: spacing.md,
  },

  // ── Method selection ───────────────────────────────────────────────────
  chooseBtn: {
    borderWidth: 1.5,
    borderColor: colors.primary.main,
    borderRadius: borderRadius.md,
    borderStyle: 'dashed',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  chooseBtnText: {
    fontFamily: 'DMSans-SemiBold',
    fontSize: typography.fontSize.sm,
    color: colors.primary.main,
  },

  selectedMethodCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.background.subtle,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  selectedMethodInfo: {
    flex: 1,
  },
  selectedMethodName: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    marginBottom: 3,
  },
  selectedMethodDesc: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.round,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  categoryBadgeText: {
    fontFamily: 'DMSans-SemiBold',
    fontSize: 11,
  },

  editBtn: {
    width: 30,
    height: 30,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  editBtnText: {
    fontSize: 13,
  },

  // ── Variable chips ─────────────────────────────────────────────────────
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  varChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.surface,
    borderWidth: 1,
    borderColor: colors.primary.muted,
    borderRadius: borderRadius.round,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 4,
  },
  varChipText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 11,
    color: colors.primary.main,
  },
  varChipClose: {
    fontSize: 11,
    color: colors.primary.main,
    fontWeight: '700',
  },
  addMoreBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  addMoreBtnText: {
    fontFamily: 'DMSans-SemiBold',
    fontSize: typography.fontSize.sm,
    color: colors.primary.main,
  },

  // ── Parameter inputs ───────────────────────────────────────────────────
  paramGroup: {
    marginBottom: spacing.md,
  },
  paramLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  nativeInput: {
    borderWidth: 1.5,
    borderColor: colors.border.medium,
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    backgroundColor: colors.background.paper,
  },
  boolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
    marginBottom: 4,
  },
  boolLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
  },
  filterChip: {
    backgroundColor: colors.background.subtle,
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: borderRadius.round,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 6,
    marginBottom: 4,
  },
  filterChipSelected: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  filterChipText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 12,
    color: colors.text.secondary,
  },
  filterChipTextSelected: {
    color: '#fff',
    fontFamily: 'DMSans-SemiBold',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    gap: 10,
  },
  checkRowLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
  },

  // ── Run button ─────────────────────────────────────────────────────────
  runBtn: {
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  runBtnDisabled: {
    opacity: 0.5,
  },
  runBtnText: {
    fontFamily: 'DMSans-SemiBold',
    fontSize: typography.fontSize.md,
    color: '#fff',
  },

  // ── Modal ──────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 61, 43, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: SCREEN_HEIGHT * 0.82,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.medium,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    fontFamily: 'Fraunces-Bold',
    fontSize: 16,
    color: colors.primary.dark,
  },
  modalSubtitle: {
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 1,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 13,
    color: colors.text.secondary,
  },

  modalFilterRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalScroll: {
    // Explicit pixel height so Android doesn't collapse it to 0
    // 82% screen - handle(18) - header(~70) - filterRow(~52) - footer(~65) - safeArea
    maxHeight: SCREEN_HEIGHT * 0.82 - 230,
    flexGrow: 0,
  },

  // ── Method rows ────────────────────────────────────────────────────────
  groupLabel: {
    fontFamily: 'DMSans-Bold',
    fontSize: 10,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 4,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.background.subtle,
    gap: 12,
  },
  methodRowSelected: {
    backgroundColor: colors.primary.surface,
  },
  methodIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodIconText: {
    fontSize: 15,
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    fontFamily: 'DMSans-SemiBold',
    fontSize: 13,
    color: colors.text.primary,
  },
  methodNameSelected: {
    color: colors.primary.main,
  },
  methodDesc: {
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 1,
  },

  // ── Variable modal rows ────────────────────────────────────────────────
  varRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.background.subtle,
    gap: 12,
  },
  varRowSelected: {
    backgroundColor: colors.primary.surface,
  },
  varRowLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: colors.text.primary,
    flex: 1,
  },
  varRowLabelSelected: {
    color: colors.primary.main,
    fontFamily: 'DMSans-SemiBold',
  },

  emptyText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    padding: spacing.xl,
    fontStyle: 'italic',
  },

  modalFooter: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  confirmBtn: {
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontFamily: 'DMSans-SemiBold',
    fontSize: typography.fontSize.md,
    color: '#fff',
  },

  // ── Radio + Checkbox ───────────────────────────────────────────────────
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.main,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  checkOuter: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOuterChecked: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.main,
  },
  checkMark: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
    lineHeight: 14,
  },
});

export default AnalyticsSelector;
