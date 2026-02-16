/**
 * Environment Configuration
 *
 * Configuration is now managed through environment variables:
 * - Development: .env.local
 * - Production: .env.production
 *
 * Set EXPO_PUBLIC_API_URL in your .env files to configure the backend URL
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Fallback URLs if environment variables are not set
const DEFAULT_DEV_API_URL = 'http://10.122.115.54:8000/api';
const DEFAULT_PROD_API_URL = 'https://foodsystemsanalytics.com/api';

// Get API URL from environment variables (Expo Config)
const ENV_API_URL = Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL;
const ENV_ENVIRONMENT = Constants.expoConfig?.extra?.environment || process.env.EXPO_PUBLIC_ENVIRONMENT;

// Debug logging
if (__DEV__) {
  console.log('🔍 Debug - Environment Variables:');
  console.log(`   Constants.expoConfig?.extra?.apiUrl: ${Constants.expoConfig?.extra?.apiUrl}`);
  console.log(`   process.env.EXPO_PUBLIC_API_URL: ${process.env.EXPO_PUBLIC_API_URL}`);
  console.log(`   ENV_API_URL (resolved): ${ENV_API_URL}`);
}

// Determine API URL based on environment
const getApiUrl = (): string => {
  // If explicitly set via environment variable AND we are not on web (where localhost is preferred in dev), use it
  // Or if it's production, always use the env var
  if (ENV_API_URL && (Platform.OS !== 'web' || !__DEV__)) {
    return ENV_API_URL;
  }

  // Otherwise, use platform and development mode to determine URL
  const isDevelopment = __DEV__ || ENV_ENVIRONMENT === 'development';

  if (Platform.OS === 'web') {
    // Web: Use localhost in development for better reliability vs firewall
    return isDevelopment
      ? 'http://localhost:8000/api'
      : DEFAULT_PROD_API_URL;
  } else {
    // Mobile: Use __DEV__ flag to determine environment
    // Use the explicitly provided IP if available, otherwise default to a known working IP or localhost (which won't work for Android)
    return isDevelopment ? (ENV_API_URL || DEFAULT_DEV_API_URL) : DEFAULT_PROD_API_URL;
  }
};

export const API_BASE_URL = getApiUrl();
export const IS_DEVELOPMENT = __DEV__ || ENV_ENVIRONMENT === 'development';
export const IS_PRODUCTION = !IS_DEVELOPMENT;

// Log current configuration in development mode
if (__DEV__) {
  console.log('🔧 Environment Configuration:');
  console.log(`   Platform: ${Platform.OS}`);
  console.log(`   Environment: ${IS_DEVELOPMENT ? 'Development' : 'Production'}`);
  console.log(`   API Base URL: ${API_BASE_URL}`);
}