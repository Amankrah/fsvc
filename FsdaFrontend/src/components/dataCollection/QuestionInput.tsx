/**
 * QuestionInput Component
 * Renders different input types based on question response type
 */

import React, { useState } from 'react';
import { View, StyleSheet, Image, Pressable } from 'react-native';
import { Text, TextInput, RadioButton, Checkbox, Button } from 'react-native-paper';
import { Question } from '../../types';
import { DatePickerDialog } from './DatePickerDialog';
import { LocationDialog } from './LocationDialog';
import { ImagePickerComponent } from './ImagePickerComponent';

interface QuestionInputProps {
  question: Question;
  value: string | string[] | undefined;
  onChange: (questionId: string, value: string | string[]) => void;
}

export const QuestionInput: React.FC<QuestionInputProps> = ({ question, value, onChange }) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [otherText, setOtherText] = useState('');

  const handleValueChange = (newValue: string | string[]) => {
    onChange(question.id, newValue);
  };

  // Helper function to check if an option is "Other"
  const isOtherOption = (option: string): boolean => {
    return option.toLowerCase().includes('other');
  };

  // Helper function to get the stored "Other" value or extract it
  const getOtherValue = (currentValue: string | string[] | undefined): string => {
    if (!currentValue) return '';
    const valueStr = Array.isArray(currentValue) ? currentValue.find(v => v.startsWith('Other:')) : currentValue;
    if (valueStr && valueStr.startsWith('Other:')) {
      return valueStr.substring(6).trim(); // Remove "Other: " prefix
    }
    return '';
  };

  // Text Short
  if (question.response_type === 'text_short') {
    return (
      <TextInput
        label="Your answer"
        value={value as string || ''}
        onChangeText={handleValueChange}
        mode="outlined"
        style={styles.input}
        textColor="#ffffff"
        placeholder="Enter your answer"
        placeholderTextColor="rgba(255, 255, 255, 0.5)"
        theme={{
          colors: {
            primary: '#64c8ff',
            onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
            outline: 'rgba(100, 200, 255, 0.5)',
          },
        }}
      />
    );
  }

  // Text Long
  if (question.response_type === 'text_long') {
    return (
      <TextInput
        label="Your answer"
        value={value as string || ''}
        onChangeText={handleValueChange}
        mode="outlined"
        multiline
        numberOfLines={4}
        style={[styles.input, styles.textArea]}
        textColor="#ffffff"
        placeholder="Enter your detailed answer"
        placeholderTextColor="rgba(255, 255, 255, 0.5)"
        theme={{
          colors: {
            primary: '#64c8ff',
            onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
            outline: 'rgba(100, 200, 255, 0.5)',
          },
        }}
      />
    );
  }

  // Numeric Integer
  if (question.response_type === 'numeric_integer') {
    return (
      <TextInput
        label="Enter a number"
        value={value as string || ''}
        onChangeText={handleValueChange}
        mode="outlined"
        keyboardType="numeric"
        style={styles.input}
        textColor="#ffffff"
        placeholder="0"
        placeholderTextColor="rgba(255, 255, 255, 0.5)"
        theme={{
          colors: {
            primary: '#64c8ff',
            onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
            outline: 'rgba(100, 200, 255, 0.5)',
          },
        }}
      />
    );
  }

  // Numeric Decimal
  if (question.response_type === 'numeric_decimal') {
    return (
      <TextInput
        label="Enter a decimal number"
        value={value as string || ''}
        onChangeText={handleValueChange}
        mode="outlined"
        keyboardType="decimal-pad"
        style={styles.input}
        textColor="#ffffff"
        placeholder="0.00"
        placeholderTextColor="rgba(255, 255, 255, 0.5)"
        theme={{
          colors: {
            primary: '#64c8ff',
            onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
            outline: 'rgba(100, 200, 255, 0.5)',
          },
        }}
      />
    );
  }

  // Scale Rating
  if (question.response_type === 'scale_rating') {
    const validationRules = question.validation_rules as any;
    const min = validationRules?.min || 1;
    const max = validationRules?.max || 10;
    const scaleOptions = Array.from({ length: max - min + 1 }, (_, i) => (i + min).toString());

    return (
      <View style={styles.scaleContainer}>
        <View style={styles.scaleLabels}>
          <Text style={styles.scaleLabel}>{min}</Text>
          <Text style={styles.scaleLabel}>{max}</Text>
        </View>
        <RadioButton.Group value={value as string || ''} onValueChange={handleValueChange}>
          <View style={styles.scaleButtons}>
            {scaleOptions.map((option) => (
              <Pressable
                key={option}
                onPress={() => handleValueChange(option)}
                style={({ pressed }) => [styles.scaleOption, pressed && styles.optionPressed]}
              >
                <RadioButton value={option} color="#64c8ff" />
                <Text style={styles.scaleOptionText}>{option}</Text>
              </Pressable>
            ))}
          </View>
        </RadioButton.Group>
      </View>
    );
  }

  // Choice Single
  if (question.response_type === 'choice_single') {
    const currentValue = value as string || '';
    const selectedOtherOption = question.options?.find(opt => isOtherOption(opt) && currentValue.startsWith(opt));
    const isOtherSelected = selectedOtherOption !== undefined;
    const displayValue = isOtherSelected ? selectedOtherOption : currentValue;

    const handleRadioChange = (selectedOption: string) => {
      if (isOtherOption(selectedOption)) {
        // When "Other" is selected, set it but wait for text input
        handleValueChange(selectedOption);
      } else {
        handleValueChange(selectedOption);
      }
    };

    const handleOtherTextChange = (text: string) => {
      setOtherText(text);
      if (selectedOtherOption) {
        // Store as "Other: user input"
        handleValueChange(`${selectedOtherOption}: ${text}`);
      }
    };

    return (
      <View>
        <RadioButton.Group value={displayValue} onValueChange={handleRadioChange}>
          {question.options?.map((option) => (
            <View key={option}>
              <Pressable
                onPress={() => handleRadioChange(option)}
                style={({ pressed }) => [styles.radioOption, pressed && styles.optionPressed]}
              >
                <RadioButton value={option} color="#64c8ff" />
                <Text style={styles.optionText}>{option}</Text>
              </Pressable>
              {/* Show text input if this "Other" option is selected */}
              {isOtherOption(option) && displayValue === option && (
                <View style={styles.otherInputContainer}>
                  <TextInput
                    label="Please specify"
                    value={otherText || getOtherValue(currentValue)}
                    onChangeText={handleOtherTextChange}
                    mode="outlined"
                    style={styles.otherInput}
                    textColor="#ffffff"
                    placeholder="Enter your answer..."
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
            </View>
          ))}
        </RadioButton.Group>
      </View>
    );
  }

  // Choice Multiple
  if (question.response_type === 'choice_multiple') {
    const selectedValues = Array.isArray(value) ? value : [];

    // Check if any selected value is an "Other" option
    const selectedOtherOption = question.options?.find(opt =>
      isOtherOption(opt) && selectedValues.some(v => v.startsWith(opt))
    );
    const isOtherChecked = selectedOtherOption !== undefined;

    const toggleOption = (option: string) => {
      if (isOtherOption(option)) {
        // When toggling "Other", add/remove it
        if (selectedValues.some(v => v.startsWith(option))) {
          // Remove all "Other" variations
          const newValues = selectedValues.filter(v => !v.startsWith(option));
          handleValueChange(newValues);
          setOtherText('');
        } else {
          // Add the base "Other" option
          handleValueChange([...selectedValues, option]);
        }
      } else {
        const newValues = selectedValues.includes(option)
          ? selectedValues.filter((v) => v !== option)
          : [...selectedValues, option];
        handleValueChange(newValues);
      }
    };

    const handleOtherTextChange = (text: string) => {
      setOtherText(text);
      if (selectedOtherOption) {
        // Replace the base "Other" with "Other: user input"
        const newValues = selectedValues.filter(v => !v.startsWith(selectedOtherOption));
        const otherValue = text.trim() ? `${selectedOtherOption}: ${text}` : selectedOtherOption;
        handleValueChange([...newValues, otherValue]);
      }
    };

    const isOptionChecked = (option: string): boolean => {
      if (isOtherOption(option)) {
        return selectedValues.some(v => v.startsWith(option));
      }
      return selectedValues.includes(option);
    };

    return (
      <View>
        {question.options?.map((option) => (
          <View key={option}>
            <Pressable
              onPress={() => toggleOption(option)}
              style={({ pressed }) => [styles.checkboxOption, pressed && styles.optionPressed]}
            >
              <Checkbox
                status={isOptionChecked(option) ? 'checked' : 'unchecked'}
                onPress={() => toggleOption(option)}
                color="#64c8ff"
              />
              <Text style={styles.optionText}>{option}</Text>
            </Pressable>
            {/* Show text input if this "Other" option is checked */}
            {isOtherOption(option) && isOptionChecked(option) && (
              <View style={styles.otherInputContainer}>
                <TextInput
                  label="Please specify"
                  value={otherText || getOtherValue(selectedValues)}
                  onChangeText={handleOtherTextChange}
                  mode="outlined"
                  style={styles.otherInput}
                  textColor="#ffffff"
                  placeholder="Enter your answer..."
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
          </View>
        ))}
      </View>
    );
  }

  // Date
  if (question.response_type === 'date') {
    return (
      <>
        <Button
          mode="outlined"
          onPress={() => setShowDatePicker(true)}
          icon="calendar"
          style={styles.dateButton}
          textColor="#64c8ff">
          {value ? (value as string) : 'Select Date'}
        </Button>
        <DatePickerDialog
          visible={showDatePicker}
          onDismiss={() => setShowDatePicker(false)}
          onConfirm={(date) => {
            handleValueChange(date);
            setShowDatePicker(false);
          }}
          includeTime={false}
        />
      </>
    );
  }

  // DateTime
  if (question.response_type === 'datetime') {
    return (
      <>
        <Button
          mode="outlined"
          onPress={() => setShowDatePicker(true)}
          icon="calendar-clock"
          style={styles.dateButton}
          textColor="#64c8ff">
          {value ? (value as string) : 'Select Date & Time'}
        </Button>
        <DatePickerDialog
          visible={showDatePicker}
          onDismiss={() => setShowDatePicker(false)}
          onConfirm={(date) => {
            handleValueChange(date);
            setShowDatePicker(false);
          }}
          includeTime={true}
        />
      </>
    );
  }

  // Geopoint (GPS)
  if (question.response_type === 'geopoint') {
    return (
      <>
        <Button
          mode="outlined"
          onPress={() => setShowLocationDialog(true)}
          icon="map-marker"
          style={styles.locationButton}
          textColor="#64c8ff">
          {value ? 'Location Captured' : 'Capture Location'}
        </Button>
        {value && (
          <Text style={styles.locationPreview}>📍 {value as string}</Text>
        )}
        <LocationDialog
          visible={showLocationDialog}
          onDismiss={() => setShowLocationDialog(false)}
          onConfirm={(location) => {
            handleValueChange(location);
            setShowLocationDialog(false);
          }}
          isGPS={true}
        />
      </>
    );
  }

  // Geoshape (Address)
  if (question.response_type === 'geoshape') {
    return (
      <>
        <Button
          mode="outlined"
          onPress={() => setShowLocationDialog(true)}
          icon="home-map-marker"
          style={styles.locationButton}
          textColor="#64c8ff">
          {value ? 'Address Entered' : 'Enter Address'}
        </Button>
        {value && (
          <Text style={styles.locationPreview}>🏠 {value as string}</Text>
        )}
        <LocationDialog
          visible={showLocationDialog}
          onDismiss={() => setShowLocationDialog(false)}
          onConfirm={(location) => {
            handleValueChange(location);
            setShowLocationDialog(false);
          }}
          isGPS={false}
        />
      </>
    );
  }

  // Image
  if (question.response_type === 'image') {
    return (
      <ImagePickerComponent
        value={value as string}
        onChange={handleValueChange}
      />
    );
  }

  // Default fallback
  return (
    <Text style={styles.unsupportedText}>
      Unsupported question type: {question.response_type}
    </Text>
  );
};

const styles = StyleSheet.create({
  input: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  textArea: {
    minHeight: 120,
  },
  scaleContainer: {
    marginBottom: 16,
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  scaleLabel: {
    color: '#64c8ff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  scaleButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scaleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  scaleOptionText: {
    color: '#ffffff',
    fontSize: 14,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  checkboxOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  optionText: {
    color: '#ffffff',
    fontSize: 14,
    flex: 1,
  },
  otherInputContainer: {
    marginLeft: 40,
    marginTop: -8,
    marginBottom: 12,
  },
  otherInput: {
    backgroundColor: 'rgba(100, 200, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.3)',
  },
  dateButton: {
    marginBottom: 16,
    borderColor: '#64c8ff',
  },
  locationButton: {
    marginBottom: 16,
    borderColor: '#64c8ff',
  },
  locationPreview: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: -8,
    marginBottom: 16,
  },
  unsupportedText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontStyle: 'italic',
  },
  optionPressed: {
    opacity: 0.7,
    backgroundColor: 'rgba(100, 200, 255, 0.1)',
  },
});
