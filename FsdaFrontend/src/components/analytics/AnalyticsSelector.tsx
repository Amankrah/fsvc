import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Text,
  Card,
  Button,
  Chip,
  List,
  Checkbox,
  RadioButton,
  TextInput,
  Divider,
  ActivityIndicator,
  Portal,
  Modal,
  IconButton,
} from 'react-native-paper';

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
}

const AnalyticsSelector: React.FC<AnalyticsSelectorProps> = ({
  availableMethods,
  availableVariables,
  onRunAnalysis,
  loading = false,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<AnalysisMethod | null>(null);
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  const [parameters, setParameters] = useState<{ [key: string]: any }>({});
  const [showMethodModal, setShowMethodModal] = useState(false);
  const [showVariableModal, setShowVariableModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

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

  const filteredMethods =
    categoryFilter
      ? availableMethods.filter((m) => m.category === categoryFilter)
      : availableMethods;

  const handleVariableToggle = (variable: string) => {
    setSelectedVariables((prev) =>
      prev.includes(variable)
        ? prev.filter((v) => v !== variable)
        : [...prev, variable]
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

    // Check required parameters
    const missingRequired = selectedMethod.parameters?.some(
      (param) => param.required && !parameters[param.name]
    );

    return !missingRequired;
  };

  const renderParameterInput = (param: AnalysisParameter) => {
    switch (param.type) {
      case 'text':
        return (
          <TextInput
            key={param.name}
            label={param.label}
            value={parameters[param.name] || ''}
            onChangeText={(value) => handleParameterChange(param.name, value)}
            mode="outlined"
            style={styles.paramInput}
          />
        );

      case 'number':
        return (
          <TextInput
            key={param.name}
            label={param.label}
            value={parameters[param.name]?.toString() || ''}
            onChangeText={(value) => handleParameterChange(param.name, parseFloat(value) || 0)}
            keyboardType="numeric"
            mode="outlined"
            style={styles.paramInput}
          />
        );

      case 'boolean':
        return (
          <View key={param.name} style={styles.checkboxContainer}>
            <Checkbox.Item
              label={param.label}
              status={parameters[param.name] ? 'checked' : 'unchecked'}
              onPress={() => handleParameterChange(param.name, !parameters[param.name])}
            />
          </View>
        );

      case 'select':
        return (
          <View key={param.name} style={styles.radioGroupContainer}>
            <Text variant="labelLarge" style={styles.paramLabel}>
              {param.label}
            </Text>
            <RadioButton.Group
              onValueChange={(value) => handleParameterChange(param.name, value)}
              value={parameters[param.name] || param.defaultValue || ''}
            >
              {param.options?.map((option) => (
                <RadioButton.Item
                  key={option.value}
                  label={option.label}
                  value={option.value.toString()}
                />
              ))}
            </RadioButton.Group>
          </View>
        );

      case 'multiselect':
        return (
          <View key={param.name} style={styles.multiselectContainer}>
            <Text variant="labelLarge" style={styles.paramLabel}>
              {param.label}
            </Text>
            {param.options?.map((option) => {
              const currentValue = parameters[param.name] || [];
              const isSelected = currentValue.includes(option.value);
              return (
                <Checkbox.Item
                  key={option.value}
                  label={option.label}
                  status={isSelected ? 'checked' : 'unchecked'}
                  onPress={() => {
                    const newValue = isSelected
                      ? currentValue.filter((v: any) => v !== option.value)
                      : [...currentValue, option.value];
                    handleParameterChange(param.name, newValue);
                  }}
                />
              );
            })}
          </View>
        );

      default:
        return null;
    }
  };

  const renderMethodModal = () => (
    <Portal>
      <Modal
        visible={showMethodModal}
        onDismiss={() => setShowMethodModal(false)}
        contentContainerStyle={styles.modalContainer}
      >
        <View style={styles.modalHeader}>
          <Text variant="headlineSmall">Select Analysis Method</Text>
          <IconButton icon="close" onPress={() => setShowMethodModal(false)} />
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Category Filters */}
          <View style={styles.categoryFilters}>
            <Chip
              selected={!categoryFilter}
              onPress={() => setCategoryFilter(null)}
              style={styles.categoryChip}
            >
              All
            </Chip>
            <Chip
              selected={categoryFilter === 'descriptive'}
              onPress={() => setCategoryFilter('descriptive')}
              style={styles.categoryChip}
            >
              Descriptive
            </Chip>
            <Chip
              selected={categoryFilter === 'inferential'}
              onPress={() => setCategoryFilter('inferential')}
              style={styles.categoryChip}
            >
              Inferential
            </Chip>
            <Chip
              selected={categoryFilter === 'qualitative'}
              onPress={() => setCategoryFilter('qualitative')}
              style={styles.categoryChip}
            >
              Qualitative
            </Chip>
          </View>

          <Divider style={styles.divider} />

          {/* Method List */}
          {filteredMethods.map((method) => (
            <List.Item
              key={method.id}
              title={method.name}
              description={method.description}
              left={(props) => (
                <List.Icon
                  {...props}
                  icon={
                    method.category === 'descriptive'
                      ? 'chart-bar'
                      : method.category === 'inferential'
                      ? 'chart-line'
                      : 'text'
                  }
                />
              )}
              right={(props) => (
                <RadioButton
                  {...props}
                  value={method.id}
                  status={selectedMethod?.id === method.id ? 'checked' : 'unchecked'}
                  onPress={() => {
                    setSelectedMethod(method);
                    setShowMethodModal(false);
                  }}
                />
              )}
              onPress={() => {
                setSelectedMethod(method);
                setShowMethodModal(false);
              }}
              style={styles.methodItem}
            />
          ))}
        </ScrollView>
      </Modal>
    </Portal>
  );

  const renderVariableModal = () => (
    <Portal>
      <Modal
        visible={showVariableModal}
        onDismiss={() => setShowVariableModal(false)}
        contentContainerStyle={styles.modalContainer}
      >
        <View style={styles.modalHeader}>
          <Text variant="headlineSmall">Select Variables</Text>
          <IconButton icon="close" onPress={() => setShowVariableModal(false)} />
        </View>

        <ScrollView style={styles.modalContent}>
          {availableVariables.map((variable) => (
            <Checkbox.Item
              key={variable}
              label={variable}
              status={selectedVariables.includes(variable) ? 'checked' : 'unchecked'}
              onPress={() => handleVariableToggle(variable)}
            />
          ))}
        </ScrollView>

        <View style={styles.modalFooter}>
          <Button
            mode="contained"
            onPress={() => setShowVariableModal(false)}
            style={styles.modalButton}
          >
            Done
          </Button>
        </View>
      </Modal>
    </Portal>
  );

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Title title="Custom Analytics" titleVariant="titleLarge" />
        <Card.Content>
          {/* Method Selection */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              1. Select Analysis Method
            </Text>
            {selectedMethod ? (
              <View style={styles.selectedMethodContainer}>
                <View style={styles.selectedMethodInfo}>
                  <Text variant="bodyLarge" style={styles.selectedMethodName}>
                    {selectedMethod.name}
                  </Text>
                  <Text variant="bodySmall" style={styles.selectedMethodDesc}>
                    {selectedMethod.description}
                  </Text>
                  <Chip
                    mode="outlined"
                    style={styles.categoryChipSmall}
                    icon={
                      selectedMethod.category === 'descriptive'
                        ? 'chart-bar'
                        : selectedMethod.category === 'inferential'
                        ? 'chart-line'
                        : 'text'
                    }
                  >
                    {selectedMethod.category}
                  </Chip>
                </View>
                <IconButton icon="pencil" onPress={() => setShowMethodModal(true)} />
              </View>
            ) : (
              <Button
                mode="outlined"
                icon="plus"
                onPress={() => setShowMethodModal(true)}
                style={styles.selectButton}
              >
                Choose Analysis Method
              </Button>
            )}
          </View>

          {/* Variable Selection */}
          {selectedMethod && selectedMethod.requiresVariables && (
            <>
              <Divider style={styles.divider} />
              <View style={styles.section}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  2. Select Variables
                </Text>
                {selectedVariables.length > 0 ? (
                  <View style={styles.selectedVariablesContainer}>
                    <View style={styles.chipContainer}>
                      {selectedVariables.map((variable) => (
                        <Chip
                          key={variable}
                          mode="outlined"
                          onClose={() => handleVariableToggle(variable)}
                          style={styles.variableChip}
                        >
                          {variable}
                        </Chip>
                      ))}
                    </View>
                    <Button
                      mode="text"
                      icon="plus"
                      onPress={() => setShowVariableModal(true)}
                      compact
                    >
                      Add More
                    </Button>
                  </View>
                ) : (
                  <Button
                    mode="outlined"
                    icon="plus"
                    onPress={() => setShowVariableModal(true)}
                    style={styles.selectButton}
                  >
                    Select Variables
                  </Button>
                )}
              </View>
            </>
          )}

          {/* Parameters */}
          {selectedMethod && selectedMethod.parameters && selectedMethod.parameters.length > 0 && (
            <>
              <Divider style={styles.divider} />
              <View style={styles.section}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  {selectedMethod.requiresVariables ? '3' : '2'}. Configure Parameters
                </Text>
                {selectedMethod.parameters.map(renderParameterInput)}
              </View>
            </>
          )}

          {/* Run Button */}
          {selectedMethod && (
            <>
              <Divider style={styles.divider} />
              <Button
                mode="contained"
                icon="play"
                onPress={handleRunAnalysis}
                disabled={!isReadyToRun() || loading}
                loading={loading}
                style={styles.runButton}
              >
                {loading ? 'Running Analysis...' : 'Run Analysis'}
              </Button>
            </>
          )}
        </Card.Content>
      </Card>

      {renderMethodModal()}
      {renderVariableModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: '600',
  },
  selectButton: {
    marginTop: 8,
  },
  selectedMethodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginTop: 8,
  },
  selectedMethodInfo: {
    flex: 1,
  },
  selectedMethodName: {
    fontWeight: '600',
    marginBottom: 4,
  },
  selectedMethodDesc: {
    color: '#666',
    marginBottom: 8,
  },
  categoryChipSmall: {
    alignSelf: 'flex-start',
  },
  selectedVariablesContainer: {
    marginTop: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  variableChip: {
    marginRight: 4,
    marginBottom: 4,
  },
  divider: {
    marginVertical: 16,
  },
  paramInput: {
    marginBottom: 12,
  },
  paramLabel: {
    marginBottom: 8,
  },
  checkboxContainer: {
    marginBottom: 8,
  },
  radioGroupContainer: {
    marginBottom: 16,
  },
  multiselectContainer: {
    marginBottom: 16,
  },
  runButton: {
    marginTop: 8,
  },
  modalContainer: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 8,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalContent: {
    maxHeight: '70%',
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalButton: {
    minWidth: 100,
  },
  categoryFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 16,
  },
  categoryChip: {
    marginRight: 4,
  },
  methodItem: {
    paddingVertical: 8,
  },
});

export default AnalyticsSelector;
