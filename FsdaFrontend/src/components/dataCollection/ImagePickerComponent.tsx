/**
 * ImagePickerComponent
 * Handles image capture and selection
 */

import React, { useState } from 'react';
import { View, Image, StyleSheet, Alert } from 'react-native';
import { Button, IconButton } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { IMAGE_QUALITY, IMAGE_PREVIEW_HEIGHT } from '../../constants/dataCollection';

interface ImagePickerComponentProps {
  value: string | undefined;
  onChange: (uri: string) => void;
}

export const ImagePickerComponent: React.FC<ImagePickerComponentProps> = ({ value, onChange }) => {
  const [loading, setLoading] = useState(false);

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to take photos');
      return false;
    }
    return true;
  };

  const requestGalleryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Gallery permission is required to select photos');
      return false;
    }
    return true;
  };

  const handleTakePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      setLoading(true);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: IMAGE_QUALITY,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        onChange(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPhoto = async () => {
    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) return;

    try {
      setLoading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: IMAGE_QUALITY,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        onChange(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error selecting photo:', error);
      Alert.alert('Error', 'Failed to select photo');
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePhoto = () => {
    onChange('');
  };

  if (value) {
    return (
      <View style={styles.previewContainer}>
        <Image source={{ uri: value }} style={styles.preview} resizeMode="cover" />
        <View style={styles.previewActions}>
          <IconButton
            icon="delete"
            size={24}
            iconColor="#ff6b6b"
            onPress={handleRemovePhoto}
            style={styles.actionButton}
          />
          <IconButton
            icon="camera"
            size={24}
            iconColor="#64c8ff"
            onPress={handleTakePhoto}
            style={styles.actionButton}
          />
          <IconButton
            icon="image"
            size={24}
            iconColor="#64c8ff"
            onPress={handleSelectPhoto}
            style={styles.actionButton}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.buttonContainer}>
      <Button
        mode="contained"
        onPress={handleTakePhoto}
        icon="camera"
        loading={loading}
        disabled={loading}
        style={styles.button}>
        Take Photo
      </Button>
      <Button
        mode="outlined"
        onPress={handleSelectPhoto}
        icon="image"
        loading={loading}
        disabled={loading}
        style={styles.outlineButton}
        textColor="#64c8ff">
        Select from Gallery
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  buttonContainer: {
    gap: 12,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#4b1e85',
  },
  outlineButton: {
    borderColor: '#64c8ff',
  },
  previewContainer: {
    marginBottom: 16,
  },
  preview: {
    width: '100%',
    height: IMAGE_PREVIEW_HEIGHT,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});
