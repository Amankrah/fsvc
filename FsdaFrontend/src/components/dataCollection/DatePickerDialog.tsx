/**
 * DatePickerDialog Component
 * Manual date/datetime input dialog
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Portal, Dialog, Button, TextInput, Text } from 'react-native-paper';
import { colors } from '../../constants/theme';

interface DatePickerDialogProps {
  visible: boolean;
  onDismiss: () => void;
  onConfirm: (dateString: string) => void;
  includeTime: boolean;
}

export const DatePickerDialog: React.FC<DatePickerDialogProps> = ({
  visible,
  onDismiss,
  onConfirm,
  includeTime,
}) => {
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');

  const handleConfirm = () => {
    // Validate inputs
    const y = parseInt(year);
    const m = parseInt(month);
    const d = parseInt(day);

    if (isNaN(y) || isNaN(m) || isNaN(d)) {
      return;
    }

    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) {
      return;
    }

    let dateString = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;

    if (includeTime) {
      const h = parseInt(hour) || 0;
      const min = parseInt(minute) || 0;

      if (h < 0 || h > 23 || min < 0 || min > 59) {
        return;
      }

      dateString += ` ${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
    }

    onConfirm(dateString);
    resetInputs();
  };

  const resetInputs = () => {
    setYear('');
    setMonth('');
    setDay('');
    setHour('');
    setMinute('');
  };

  const handleDismiss = () => {
    resetInputs();
    onDismiss();
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={handleDismiss} style={styles.dialog}>
        <Dialog.Title style={styles.dialogTitle}>
          {includeTime ? 'Select Date & Time' : 'Select Date'}
        </Dialog.Title>
        <Dialog.Content>
          <Text style={styles.label}>Date</Text>
          <View style={styles.dateRow}>
            <TextInput
              label="Year"
              value={year}
              onChangeText={setYear}
              keyboardType="numeric"
              mode="outlined"
              style={[styles.input, styles.yearInput]}
              textColor={colors.text.primary}
              placeholder="YYYY"
              placeholderTextColor={colors.text.disabled}
              maxLength={4}
              theme={{
                colors: {
                  primary: colors.primary.main,
                  onSurfaceVariant: colors.text.secondary,
                  outline: colors.border.light,
                },
              }}
            />
            <TextInput
              label="Month"
              value={month}
              onChangeText={setMonth}
              keyboardType="numeric"
              mode="outlined"
              style={[styles.input, styles.monthInput]}
              textColor={colors.text.primary}
              placeholder="MM"
              placeholderTextColor={colors.text.disabled}
              maxLength={2}
              theme={{
                colors: {
                  primary: colors.primary.main,
                  onSurfaceVariant: colors.text.secondary,
                  outline: colors.border.light,
                },
              }}
            />
            <TextInput
              label="Day"
              value={day}
              onChangeText={setDay}
              keyboardType="numeric"
              mode="outlined"
              style={[styles.input, styles.dayInput]}
              textColor={colors.text.primary}
              placeholder="DD"
              placeholderTextColor={colors.text.disabled}
              maxLength={2}
              theme={{
                colors: {
                  primary: colors.primary.main,
                  onSurfaceVariant: colors.text.secondary,
                  outline: colors.border.light,
                },
              }}
            />
          </View>

          {includeTime && (
            <>
              <Text style={styles.label}>Time</Text>
              <View style={styles.timeRow}>
                <TextInput
                  label="Hour"
                  value={hour}
                  onChangeText={setHour}
                  keyboardType="numeric"
                  mode="outlined"
                  style={[styles.input, styles.timeInput]}
                  textColor={colors.text.primary}
                  placeholder="HH"
                  placeholderTextColor={colors.text.disabled}
                  maxLength={2}
                  theme={{
                    colors: {
                      primary: colors.primary.main,
                      onSurfaceVariant: colors.text.secondary,
                      outline: colors.border.light,
                    },
                  }}
                />
                <Text style={styles.timeSeparator}>:</Text>
                <TextInput
                  label="Minute"
                  value={minute}
                  onChangeText={setMinute}
                  keyboardType="numeric"
                  mode="outlined"
                  style={[styles.input, styles.timeInput]}
                  textColor={colors.text.primary}
                  placeholder="MM"
                  placeholderTextColor={colors.text.disabled}
                  maxLength={2}
                  theme={{
                    colors: {
                      primary: colors.primary.main,
                      onSurfaceVariant: colors.text.secondary,
                      outline: colors.border.light,
                    },
                  }}
                />
              </View>
            </>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={handleDismiss}>Cancel</Button>
          <Button onPress={handleConfirm}>Confirm</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    backgroundColor: colors.background.default,
    borderRadius: 20,
  },
  dialogTitle: {
    color: colors.text.primary,
  },
  label: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  yearInput: {
    flex: 2,
  },
  monthInput: {
    flex: 1,
  },
  dayInput: {
    flex: 1,
  },
  timeInput: {
    flex: 1,
  },
  timeSeparator: {
    color: colors.text.primary,
    fontSize: 24,
    fontWeight: 'bold',
  },
});
