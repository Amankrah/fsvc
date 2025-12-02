/**
 * Environment Configuration
 *
 * Configure your Django backend URL here
 */

import { Platform } from 'react-native';

// Django backend typically runs on port 8000
// For physical devices, use your computer's network IP address
// Available IPs (uncomment the one that matches your current network):
const DEV_API_URL = 'http://10.122.115.54:8000/api';  // Current active IP
// const DEV_API_URL = 'http://10.0.0.42:8000/api';   // Alternative IP
const PROD_API_URL = 'https://foodsystemsanalytics.com/api';

// Web always uses production API, mobile respects __DEV__
export const API_BASE_URL = Platform.OS === 'web'
  ? PROD_API_URL
  : (__DEV__ ? DEV_API_URL : PROD_API_URL);

// Common configurations for different scenarios:
// 1. Same machine (desktop): 'http://localhost:8000/api'
// 2. Android emulator: 'http://10.0.2.2:8000/api'
// 3. Physical device (use your computer's IP): 'http://192.168.1.X:8000/api'
//    Find your IP: Windows (ipconfig), Mac/Linux (ifconfig)
// 4. Production: 'https://api.yourapp.com/api'