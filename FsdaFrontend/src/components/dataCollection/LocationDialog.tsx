/**
 * LocationDialog Component
 * Captures GPS coordinates or address
 */

import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Portal, Dialog, Button, TextInput, ActivityIndicator, Text } from 'react-native-paper';
import * as Location from 'expo-location';
import { GPS_VALIDATION } from '../../constants/dataCollection';
import { colors } from '../../constants/theme';

interface LocationDialogProps {
  visible: boolean;
  onDismiss: () => void;
  onConfirm: (location: string) => void;
  isGPS: boolean; // true for GPS coordinates, false for address
}

export const LocationDialog: React.FC<LocationDialogProps> = ({
  visible,
  onDismiss,
  onConfirm,
  isGPS,
}) => {
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [address, setAddress] = useState('');
  const [capturing, setCapturing] = useState(false);

  const captureCurrentLocation = async () => {
    try {
      setCapturing(true);

      // Request permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to capture GPS coordinates');
        return;
      }

      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLatitude(location.coords.latitude.toFixed(6));
      setLongitude(location.coords.longitude.toFixed(6));
    } catch (error) {
      console.error('Error capturing location:', error);
      Alert.alert('Error', 'Failed to capture current location. Please enter manually.');
    } finally {
      setCapturing(false);
    }
  };

  const handleConfirm = () => {
    if (isGPS) {
      const lat = parseFloat(latitude);
      const lon = parseFloat(longitude);

      if (isNaN(lat) || isNaN(lon)) {
        Alert.alert('Invalid Input', 'Please enter valid latitude and longitude');
        return;
      }

      if (
        lat < GPS_VALIDATION.minLatitude ||
        lat > GPS_VALIDATION.maxLatitude ||
        lon < GPS_VALIDATION.minLongitude ||
        lon > GPS_VALIDATION.maxLongitude
      ) {
        Alert.alert(
          'Invalid Coordinates',
          `Latitude must be between ${GPS_VALIDATION.minLatitude} and ${GPS_VALIDATION.maxLatitude}.\nLongitude must be between ${GPS_VALIDATION.minLongitude} and ${GPS_VALIDATION.maxLongitude}.`
        );
        return;
      }

      onConfirm(`${lat}, ${lon}`);
    } else {
      if (!address.trim()) {
        Alert.alert('Invalid Input', 'Please enter an address');
        return;
      }
      onConfirm(address.trim());
    }

    resetInputs();
  };

  const resetInputs = () => {
    setLatitude('');
    setLongitude('');
    setAddress('');
  };

  const handleDismiss = () => {
    resetInputs();
    onDismiss();
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={handleDismiss} style={styles.dialog}>
        <Dialog.Title style={styles.dialogTitle}>
          {isGPS ? 'Capture GPS Location' : 'Enter Address'}
        </Dialog.Title>
        <Dialog.Content>
          {isGPS ? (
            <>
              <Button
                mode="contained"
                onPress={captureCurrentLocation}
                icon="crosshairs-gps"
                loading={capturing}
                disabled={capturing}
                style={styles.captureButton}>
                {capturing ? 'Capturing Location...' : 'Use Current Location'}
              </Button>

              <Text style={styles.orText}>OR enter manually:</Text>

              <TextInput
                label="Latitude"
                value={latitude}
                onChangeText={setLatitude}
                keyboardType="numeric"
                mode="outlined"
                style={styles.input}
                textColor={colors.text.primary}
                placeholder="e.g., 5.603717"
                placeholderTextColor={colors.text.disabled}
                theme={{
                  colors: {
                    primary: colors.primary.main,
                    onSurfaceVariant: colors.text.secondary,
                    outline: colors.border.light,
                  },
                }}
              />

              <TextInput
                label="Longitude"
                value={longitude}
                onChangeText={setLongitude}
                keyboardType="numeric"
                mode="outlined"
                style={styles.input}
                textColor={colors.text.primary}
                placeholder="e.g., -0.186964"
                placeholderTextColor={colors.text.disabled}
                theme={{
                  colors: {
                    primary: colors.primary.main,
                    onSurfaceVariant: colors.text.secondary,
                    outline: colors.border.light,
                  },
                }}
              />
            </>
          ) : (
            <TextInput
              label="Address"
              value={address}
              onChangeText={setAddress}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.input}
              textColor={colors.text.primary}
              placeholder="Enter full address"
              placeholderTextColor={colors.text.disabled}
              theme={{
                colors: {
                  primary: colors.primary.main,
                  onSurfaceVariant: colors.text.secondary,
                  outline: colors.border.light,
                },
              }}
            />
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
  captureButton: {
    backgroundColor: colors.primary.dark,
    marginBottom: 16,
  },
  orText: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginVertical: 12,
    fontSize: 14,
  },
  input: {
    marginBottom: 16,
    backgroundColor: colors.background.paper,
  },
});
