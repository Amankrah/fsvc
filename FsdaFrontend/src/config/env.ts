/**
 * Environment Configuration
 *
 * Configure your Django backend URL here
 */

// Django backend typically runs on port 8000
const DEV_API_URL = 'http://localhost:8000/api';
const PROD_API_URL = 'https://your-production-api.com/api';

export const API_BASE_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;

// Common configurations for different scenarios:
// 1. Same machine (desktop): 'http://localhost:8000/api'
// 2. Android emulator: 'http://10.0.2.2:8000/api'
// 3. Physical device (use your computer's IP): 'http://192.168.1.X:8000/api'
//    Find your IP: Windows (ipconfig), Mac/Linux (ifconfig)
// 4. Production: 'https://api.yourapp.com/api'