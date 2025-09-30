/**
 * Secure Storage Abstraction
 *
 * Uses Expo SecureStore for native platforms (iOS/Android)
 * Falls back to AsyncStorage for web
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

class SecureStorage {
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      // Use AsyncStorage for web (localStorage wrapper)
      await AsyncStorage.setItem(key, value);
    } else {
      // Use Expo SecureStore for native platforms
      await SecureStore.setItemAsync(key, value);
    }
  }

  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return await AsyncStorage.getItem(key);
    } else {
      return await SecureStore.getItemAsync(key);
    }
  }

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  }

  async clear(): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.clear();
    } else {
      // SecureStore doesn't have a clear method, but we could implement it if needed
      // For now, individual keys need to be removed manually
      throw new Error('Clear operation not supported on native platforms with SecureStore');
    }
  }
}

export const secureStorage = new SecureStorage();
export default secureStorage;