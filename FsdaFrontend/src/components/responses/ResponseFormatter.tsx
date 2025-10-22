/**
 * ResponseFormatter Component
 * Formats response values based on question type
 */

import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Text, Chip } from 'react-native-paper';
import { ResponseDetail } from '../../hooks/responses';
import { IMAGE_HEIGHT } from '../../constants/responses';

interface ResponseFormatterProps {
  response: ResponseDetail;
}

export const ResponseFormatter: React.FC<ResponseFormatterProps> = ({ response }) => {
  const value = response.response_value;
  const questionType = response.question_details?.response_type;

  // Handle empty responses
  if (!value || value === 'null' || value === 'undefined') {
    return <Text style={styles.noResponse}>No response</Text>;
  }

  // Handle images
  if (questionType === 'image') {
    if (value.startsWith('data:image/') || value.startsWith('iVBOR') || value.startsWith('/9j/')) {
      const imageUri = value.startsWith('data:') ? value : `data:image/jpeg;base64,${value}`;
      return (
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          resizeMode="contain"
        />
      );
    }
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return (
        <Image
          source={{ uri: value }}
          style={styles.image}
          resizeMode="contain"
        />
      );
    }
    return <Text style={styles.text}>Image data</Text>;
  }

  // Handle audio
  if (questionType === 'audio') {
    return (
      <View style={styles.mediaContainer}>
        <Text style={styles.mediaIcon}>🎵</Text>
        <Text style={styles.mediaText}>Audio Recording</Text>
        {value.startsWith('http') && (
          <Text style={styles.mediaUrl} numberOfLines={1}>{value}</Text>
        )}
      </View>
    );
  }

  // Handle video
  if (questionType === 'video') {
    return (
      <View style={styles.mediaContainer}>
        <Text style={styles.mediaIcon}>🎬</Text>
        <Text style={styles.mediaText}>Video Recording</Text>
        {value.startsWith('http') && (
          <Text style={styles.mediaUrl} numberOfLines={1}>{value}</Text>
        )}
      </View>
    );
  }

  // Handle file uploads
  if (questionType === 'file') {
    return (
      <View style={styles.mediaContainer}>
        <Text style={styles.mediaIcon}>📎</Text>
        <Text style={styles.mediaText}>File Attachment</Text>
        {value.startsWith('http') && (
          <Text style={styles.mediaUrl} numberOfLines={1}>{value}</Text>
        )}
      </View>
    );
  }

  // Handle signatures
  if (questionType === 'signature') {
    if (value.startsWith('data:image/') || value.startsWith('iVBOR') || value.startsWith('/9j/')) {
      const imageUri = value.startsWith('data:') ? value : `data:image/png;base64,${value}`;
      return (
        <View style={styles.signatureContainer}>
          <Text style={styles.signatureLabel}>✍️ Signature</Text>
          <Image
            source={{ uri: imageUri }}
            style={styles.signatureImage}
            resizeMode="contain"
          />
        </View>
      );
    }
    return (
      <View style={styles.mediaContainer}>
        <Text style={styles.mediaIcon}>✍️</Text>
        <Text style={styles.mediaText}>Digital Signature</Text>
      </View>
    );
  }

  // Handle barcodes
  if (questionType === 'barcode') {
    return (
      <View style={styles.barcodeContainer}>
        <Text style={styles.barcodeIcon}>📱</Text>
        <Text style={styles.barcodeValue}>{value}</Text>
      </View>
    );
  }

  // Handle location data
  if (questionType === 'geopoint' || questionType === 'geoshape') {
    try {
      const locationData = typeof value === 'string' ? JSON.parse(value) : value;
      return (
        <View style={styles.locationContainer}>
          {locationData.address && (
            <Text style={styles.locationText}>📍 {locationData.address}</Text>
          )}
          {locationData.latitude && locationData.longitude && (
            <Text style={styles.locationText}>
              GPS: {locationData.latitude}, {locationData.longitude}
            </Text>
          )}
        </View>
      );
    } catch (e) {
      return <Text style={styles.text}>{value}</Text>;
    }
  }

  // Handle date/datetime
  if (questionType === 'date' || questionType === 'datetime') {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        const formatted = questionType === 'datetime'
          ? date.toLocaleString()
          : date.toLocaleDateString();
        return <Text style={styles.text}>{formatted}</Text>;
      }
    } catch (e) {
      // Fall through to default
    }
  }

  // Handle multiple choice
  if (questionType === 'choice_multiple' || (typeof value === 'string' && value.trim().startsWith('['))) {
    try {
      const choices = typeof value === 'string' ? JSON.parse(value) : value;
      if (Array.isArray(choices)) {
        return (
          <View style={styles.multiChoiceContainer}>
            {choices.map((choice, index) => (
              <Chip
                key={index}
                style={styles.choiceChip}
                textStyle={styles.choiceChipText}
                mode="outlined">
                {choice}
              </Chip>
            ))}
          </View>
        );
      }
    } catch (e) {
      // Fall through to default
    }
  }

  // Handle JSON objects
  if (typeof value === 'string' && (value.trim().startsWith('{') || value.trim().startsWith('['))) {
    try {
      const jsonData = JSON.parse(value);
      return <Text style={styles.text}>{JSON.stringify(jsonData, null, 2)}</Text>;
    } catch (e) {
      // Fall through to default
    }
  }

  // Default: return as text
  return <Text style={styles.text}>{value}</Text>;
};

const styles = StyleSheet.create({
  noResponse: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontStyle: 'italic',
  },
  text: {
    color: '#ffffff',
    fontSize: 16,
  },
  image: {
    width: '100%',
    height: IMAGE_HEIGHT,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.3)',
  },
  locationContainer: {
    marginBottom: 8,
  },
  locationText: {
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 4,
  },
  multiChoiceContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  choiceChip: {
    backgroundColor: 'rgba(100, 200, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.4)',
  },
  choiceChipText: {
    color: '#64c8ff',
    fontSize: 13,
  },
  mediaContainer: {
    flexDirection: 'column',
    padding: 12,
    backgroundColor: 'rgba(100, 200, 255, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.3)',
    marginBottom: 8,
  },
  mediaIcon: {
    fontSize: 32,
    marginBottom: 8,
    textAlign: 'center',
  },
  mediaText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  mediaUrl: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 4,
  },
  signatureContainer: {
    marginBottom: 8,
  },
  signatureLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  signatureImage: {
    width: '100%',
    height: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.3)',
  },
  barcodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(100, 200, 255, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.3)',
    gap: 12,
  },
  barcodeIcon: {
    fontSize: 28,
  },
  barcodeValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
});
