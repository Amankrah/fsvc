/**
 * QuestionInput Component
 * Renders different input types based on question response type.
 *
 * Performance notes:
 * - Wrapped in React.memo — only re-renders when question, value, or onChange changes.
 * - Radio/checkbox options use custom TouchableOpacity rows (no Paper ripple) so
 *   selection feedback is instant even on budget Android hardware.
 */

import React, { useState, useCallback, memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, TextInput, Button, Icon } from 'react-native-paper';
import { Question } from '../../types';
import { DatePickerDialog } from './DatePickerDialog';
import { LocationDialog } from './LocationDialog';
import { ImagePickerComponent } from './ImagePickerComponent';
import { colors, borderRadius, typography } from '../../constants/theme';

interface QuestionInputProps {
  question: Question;
  value: string | string[] | undefined;
  onChange: (questionId: string, value: string | string[]) => void;
}

// ---------------------------------------------------------------------------
// Lightweight custom radio indicator — no Paper ripple, no JS-thread animation
// ---------------------------------------------------------------------------
const RadioDot = memo(({ selected }: { selected: boolean }) => (
  <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
    {selected && <View style={styles.radioInner} />}
  </View>
));

// ---------------------------------------------------------------------------
// Lightweight custom checkbox — same rationale as RadioDot
// ---------------------------------------------------------------------------
const CheckBox = memo(({ checked }: { checked: boolean }) => (
  <View style={[styles.checkOuter, checked && styles.checkOuterChecked]}>
    {checked && <Icon source="check" size={13} color="#fff" />}
  </View>
));

// ---------------------------------------------------------------------------
// Shared TextInput theme — defined once to avoid per-render object allocation
// ---------------------------------------------------------------------------
const INPUT_THEME = {
  colors: {
    primary: colors.primary.main,
    onSurfaceVariant: colors.text.secondary,
    outline: colors.border.light,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const isOtherOption = (option: string): boolean =>
  option.toLowerCase().includes('other');

const getOtherValue = (currentValue: string | string[] | undefined): string => {
  if (!currentValue) return '';
  const valueStr = Array.isArray(currentValue)
    ? currentValue.find(v => v.startsWith('Other:'))
    : currentValue;
  if (valueStr && valueStr.startsWith('Other:')) {
    return valueStr.substring(6).trim();
  }
  return '';
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const QuestionInputInner: React.FC<QuestionInputProps> = ({ question, value, onChange }) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [otherText, setOtherText] = useState('');

  const handleValueChange = useCallback(
    (newValue: string | string[]) => {
      onChange(question.id, newValue);
    },
    [onChange, question.id],
  );

  // ------------------------------------------------------------------
  // Text Short
  // ------------------------------------------------------------------
  if (question.response_type === 'text_short') {
    return (
      <TextInput
        label="Your answer"
        value={(value as string) || ''}
        onChangeText={handleValueChange}
        mode="outlined"
        style={styles.input}
        textColor={colors.text.primary}
        placeholder="Enter your answer"
        placeholderTextColor={colors.text.disabled}
        theme={INPUT_THEME}
      />
    );
  }

  // ------------------------------------------------------------------
  // Text Long
  // ------------------------------------------------------------------
  if (question.response_type === 'text_long') {
    return (
      <TextInput
        label="Your answer"
        value={(value as string) || ''}
        onChangeText={handleValueChange}
        mode="outlined"
        multiline
        numberOfLines={4}
        style={[styles.input, styles.textArea]}
        textColor={colors.text.primary}
        placeholder="Enter your detailed answer"
        placeholderTextColor={colors.text.disabled}
        theme={INPUT_THEME}
      />
    );
  }

  // ------------------------------------------------------------------
  // Numeric Integer
  // ------------------------------------------------------------------
  if (question.response_type === 'numeric_integer') {
    return (
      <TextInput
        label="Enter a number"
        value={(value as string) || ''}
        onChangeText={handleValueChange}
        mode="outlined"
        keyboardType="numeric"
        style={styles.input}
        textColor={colors.text.primary}
        placeholder="0"
        placeholderTextColor={colors.text.disabled}
        theme={INPUT_THEME}
      />
    );
  }

  // ------------------------------------------------------------------
  // Numeric Decimal
  // ------------------------------------------------------------------
  if (question.response_type === 'numeric_decimal') {
    return (
      <TextInput
        label="Enter a decimal number"
        value={(value as string) || ''}
        onChangeText={handleValueChange}
        mode="outlined"
        keyboardType="decimal-pad"
        style={styles.input}
        textColor={colors.text.primary}
        placeholder="0.00"
        placeholderTextColor={colors.text.disabled}
        theme={INPUT_THEME}
      />
    );
  }

  // ------------------------------------------------------------------
  // Scale Rating
  // ------------------------------------------------------------------
  if (question.response_type === 'scale_rating') {
    const validationRules = question.validation_rules as any;
    const min = validationRules?.min || 1;
    const max = validationRules?.max || 10;
    const scaleOptions = Array.from({ length: max - min + 1 }, (_, i) =>
      (i + min).toString(),
    );
    const currentVal = (value as string) || '';

    return (
      <View style={styles.scaleContainer}>
        <View style={styles.scaleLabels}>
          <Text style={styles.scaleLabel}>{min}</Text>
          <Text style={styles.scaleLabel}>{max}</Text>
        </View>
        <View style={styles.scaleButtons}>
          {scaleOptions.map(option => {
            const selected = currentVal === option;
            return (
              <TouchableOpacity
                key={option}
                activeOpacity={0.7}
                onPress={() => handleValueChange(option)}
                style={[styles.scaleOption, selected && styles.scaleOptionSelected]}
              >
                <Text style={[styles.scaleOptionText, selected && styles.scaleOptionTextSelected]}>
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  // ------------------------------------------------------------------
  // Choice Single
  // ------------------------------------------------------------------
  if (question.response_type === 'choice_single') {
    const currentValue = (value as string) || '';
    const selectedOtherOption = question.options?.find(
      opt => isOtherOption(opt) && currentValue.startsWith(opt),
    );
    const displayValue = selectedOtherOption ?? currentValue;

    const handleRadioPress = (option: string) => {
      handleValueChange(option);
    };

    const handleOtherTextChange = (text: string) => {
      setOtherText(text);
      if (selectedOtherOption) {
        handleValueChange(`${selectedOtherOption}: ${text}`);
      }
    };

    return (
      <View>
        {question.options?.map(option => {
          const selected = displayValue === option;
          return (
            <View key={option}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleRadioPress(option)}
                style={[styles.optionRow, selected && styles.optionRowSelected]}
              >
                <RadioDot selected={selected} />
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {option}
                </Text>
              </TouchableOpacity>
              {isOtherOption(option) && displayValue === option && (
                <View style={styles.otherInputContainer}>
                  <TextInput
                    label="Please specify"
                    value={otherText || getOtherValue(currentValue)}
                    onChangeText={handleOtherTextChange}
                    mode="outlined"
                    style={styles.otherInput}
                    textColor={colors.text.primary}
                    placeholder="Enter your answer..."
                    placeholderTextColor={colors.text.disabled}
                    theme={INPUT_THEME}
                  />
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  }

  // ------------------------------------------------------------------
  // Choice Multiple
  // ------------------------------------------------------------------
  if (question.response_type === 'choice_multiple') {
    const selectedValues = Array.isArray(value) ? value : [];
    const selectedOtherOption = question.options?.find(opt =>
      isOtherOption(opt) && selectedValues.some(v => v.startsWith(opt)),
    );

    const toggleOption = (option: string) => {
      if (isOtherOption(option)) {
        if (selectedValues.some(v => v.startsWith(option))) {
          handleValueChange(selectedValues.filter(v => !v.startsWith(option)));
          setOtherText('');
        } else {
          handleValueChange([...selectedValues, option]);
        }
      } else {
        const newValues = selectedValues.includes(option)
          ? selectedValues.filter(v => v !== option)
          : [...selectedValues, option];
        handleValueChange(newValues);
      }
    };

    const handleOtherTextChange = (text: string) => {
      setOtherText(text);
      if (selectedOtherOption) {
        const base = selectedValues.filter(v => !v.startsWith(selectedOtherOption));
        const otherVal = text.trim() ? `${selectedOtherOption}: ${text}` : selectedOtherOption;
        handleValueChange([...base, otherVal]);
      }
    };

    const isOptionChecked = (option: string): boolean => {
      if (isOtherOption(option)) return selectedValues.some(v => v.startsWith(option));
      return selectedValues.includes(option);
    };

    return (
      <View>
        {question.options?.map(option => {
          const checked = isOptionChecked(option);
          return (
            <View key={option}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => toggleOption(option)}
                style={[styles.optionRow, checked && styles.optionRowSelected]}
              >
                <CheckBox checked={checked} />
                <Text style={[styles.optionText, checked && styles.optionTextSelected]}>
                  {option}
                </Text>
              </TouchableOpacity>
              {isOtherOption(option) && isOptionChecked(option) && (
                <View style={styles.otherInputContainer}>
                  <TextInput
                    label="Please specify"
                    value={otherText || getOtherValue(selectedValues)}
                    onChangeText={handleOtherTextChange}
                    mode="outlined"
                    style={styles.otherInput}
                    textColor={colors.text.primary}
                    placeholder="Enter your answer..."
                    placeholderTextColor={colors.text.disabled}
                    theme={INPUT_THEME}
                  />
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  }

  // ------------------------------------------------------------------
  // Date
  // ------------------------------------------------------------------
  if (question.response_type === 'date') {
    return (
      <>
        <Button
          mode="outlined"
          onPress={() => setShowDatePicker(true)}
          icon="calendar"
          style={styles.dateButton}
          textColor={colors.primary.light}
        >
          {value ? (value as string) : 'Select Date'}
        </Button>
        <DatePickerDialog
          visible={showDatePicker}
          onDismiss={() => setShowDatePicker(false)}
          onConfirm={date => {
            handleValueChange(date);
            setShowDatePicker(false);
          }}
          includeTime={false}
        />
      </>
    );
  }

  // ------------------------------------------------------------------
  // DateTime
  // ------------------------------------------------------------------
  if (question.response_type === 'datetime') {
    return (
      <>
        <Button
          mode="outlined"
          onPress={() => setShowDatePicker(true)}
          icon="calendar-clock"
          style={styles.dateButton}
          textColor={colors.primary.light}
        >
          {value ? (value as string) : 'Select Date & Time'}
        </Button>
        <DatePickerDialog
          visible={showDatePicker}
          onDismiss={() => setShowDatePicker(false)}
          onConfirm={date => {
            handleValueChange(date);
            setShowDatePicker(false);
          }}
          includeTime={true}
        />
      </>
    );
  }

  // ------------------------------------------------------------------
  // Geopoint (GPS)
  // ------------------------------------------------------------------
  if (question.response_type === 'geopoint') {
    return (
      <>
        <Button
          mode="outlined"
          onPress={() => setShowLocationDialog(true)}
          icon="map-marker"
          style={styles.locationButton}
          textColor={colors.primary.light}
        >
          {value ? 'Location Captured' : 'Capture Location'}
        </Button>
        {value && <Text style={styles.locationPreview}>📍 {value as string}</Text>}
        <LocationDialog
          visible={showLocationDialog}
          onDismiss={() => setShowLocationDialog(false)}
          onConfirm={location => {
            handleValueChange(location);
            setShowLocationDialog(false);
          }}
          isGPS={true}
        />
      </>
    );
  }

  // ------------------------------------------------------------------
  // Geoshape (Address)
  // ------------------------------------------------------------------
  if (question.response_type === 'geoshape') {
    return (
      <>
        <Button
          mode="outlined"
          onPress={() => setShowLocationDialog(true)}
          icon="home-map-marker"
          style={styles.locationButton}
          textColor={colors.primary.light}
        >
          {value ? 'Address Entered' : 'Enter Address'}
        </Button>
        {value && <Text style={styles.locationPreview}>🏠 {value as string}</Text>}
        <LocationDialog
          visible={showLocationDialog}
          onDismiss={() => setShowLocationDialog(false)}
          onConfirm={location => {
            handleValueChange(location);
            setShowLocationDialog(false);
          }}
          isGPS={false}
        />
      </>
    );
  }

  // ------------------------------------------------------------------
  // Image
  // ------------------------------------------------------------------
  if (question.response_type === 'image') {
    return (
      <ImagePickerComponent value={value as string} onChange={handleValueChange} />
    );
  }

  // Default fallback
  return (
    <Text style={styles.unsupportedText}>
      Unsupported question type: {question.response_type}
    </Text>
  );
};

export const QuestionInput = memo(QuestionInputInner);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const RADIO_SIZE = 22;
const CHECK_SIZE = 22;

const styles = StyleSheet.create({
  input: {
    marginBottom: 16,
    backgroundColor: colors.primary.faint,
  },
  textArea: {
    minHeight: 120,
  },

  // Scale rating
  scaleContainer: {
    marginBottom: 16,
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  scaleLabel: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  scaleButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scaleOption: {
    minWidth: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: colors.border.light,
  },
  scaleOptionSelected: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  scaleOptionText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontFamily: 'DMSans-Medium',
  },
  scaleOptionTextSelected: {
    color: '#fff',
  },

  // Shared option row (radio + checkbox)
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    backgroundColor: colors.background.subtle,
    borderRadius: borderRadius.md,
    padding: 12,
    borderWidth: 1.5,
    borderColor: colors.border.light,
  },
  optionRowSelected: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.faint,
  },
  optionText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontFamily: 'DMSans-Regular',
    flex: 1,
  },
  optionTextSelected: {
    color: colors.primary.dark,
    fontFamily: 'DMSans-Medium',
  },

  // Custom radio indicator
  radioOuter: {
    width: RADIO_SIZE,
    height: RADIO_SIZE,
    borderRadius: RADIO_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.primary.main,
  },
  radioInner: {
    width: RADIO_SIZE / 2,
    height: RADIO_SIZE / 2,
    borderRadius: RADIO_SIZE / 4,
    backgroundColor: colors.primary.main,
  },

  // Custom checkbox indicator
  checkOuter: {
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOuterChecked: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.main,
  },

  // Other text input
  otherInputContainer: {
    marginLeft: 46,
    marginTop: -4,
    marginBottom: 10,
  },
  otherInput: {
    backgroundColor: colors.background.paper,
  },

  // Date / Location / Image
  dateButton: {
    marginBottom: 16,
    borderColor: colors.primary.main,
  },
  locationButton: {
    marginBottom: 16,
    borderColor: colors.primary.main,
  },
  locationPreview: {
    color: colors.text.disabled,
    fontSize: 14,
    marginTop: -8,
    marginBottom: 16,
  },

  unsupportedText: {
    color: colors.text.disabled,
    fontStyle: 'italic',
  },
});
