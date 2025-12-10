/**
 * Custom Alert utility for React Native Web compatibility
 * Provides a unified alert interface that works on both mobile and web
 */

import { Alert, Platform } from 'react-native';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

/**
 * Custom alert that works on both mobile and web
 * On mobile: Uses native Alert.alert
 * On web: Uses window.confirm/alert with proper callbacks
 */
export const showAlert = (
  title: string,
  message?: string,
  buttons?: AlertButton[]
): void => {
  if (Platform.OS === 'web') {
    // Web implementation using window.confirm/alert
    if (buttons && buttons.length > 1) {
      // Confirmation dialog
      const fullMessage = message ? `${title}\n\n${message}` : title;
      const confirmed = window.confirm(fullMessage);

      if (confirmed) {
        // Find the non-cancel button (usually the destructive or default button)
        const confirmButton = buttons.find(btn => btn.style !== 'cancel');
        if (confirmButton?.onPress) {
          confirmButton.onPress();
        }
      } else {
        // Find the cancel button
        const cancelButton = buttons.find(btn => btn.style === 'cancel');
        if (cancelButton?.onPress) {
          cancelButton.onPress();
        }
      }
    } else {
      // Simple alert
      const fullMessage = message ? `${title}\n\n${message}` : title;
      window.alert(fullMessage);
      if (buttons?.[0]?.onPress) {
        buttons[0].onPress();
      }
    }
  } else {
    // Mobile implementation using React Native Alert
    Alert.alert(title, message, buttons);
  }
};

/**
 * Promisified confirmation dialog
 * Returns true if user confirms, false if they cancel
 */
export const showConfirm = (
  title: string,
  message?: string,
  confirmText: string = 'OK',
  cancelText: string = 'Cancel'
): Promise<boolean> => {
  return new Promise((resolve) => {
    if (Platform.OS === 'web') {
      const fullMessage = message ? `${title}\n\n${message}` : title;
      const confirmed = window.confirm(fullMessage);
      resolve(confirmed);
    } else {
      Alert.alert(
        title,
        message,
        [
          {
            text: cancelText,
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: confirmText,
            onPress: () => resolve(true),
          },
        ]
      );
    }
  });
};

/**
 * Simple info alert
 */
export const showInfo = (title: string, message?: string): void => {
  showAlert(title, message, [{ text: 'OK' }]);
};

/**
 * Error alert
 */
export const showError = (message: string, title: string = 'Error'): void => {
  showAlert(title, message, [{ text: 'OK' }]);
};

/**
 * Success alert
 */
export const showSuccess = (message: string, title: string = 'Success'): void => {
  showAlert(title, message, [{ text: 'OK' }]);
};
