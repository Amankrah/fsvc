# FSDA Frontend - React Native Tablet Application

A modern, production-ready React Native application built with TypeScript and Expo, optimized for tablet devices with secure authentication.

## Features

- ✅ **TypeScript** - Full type safety throughout the application
- ✅ **Authentication** - Login and registration with JWT token management
- ✅ **Secure Storage** - Encrypted token storage using react-native-encrypted-storage
- ✅ **State Management** - Zustand for efficient, lightweight state management
- ✅ **Form Validation** - React Hook Form with Zod schema validation
- ✅ **UI Components** - React Native Paper (Material Design 3)
- ✅ **Navigation** - React Navigation with protected routes
- ✅ **API Client** - Axios with interceptors for automatic token refresh
- ✅ **Performance Optimized** - React.memo, useCallback, useMemo throughout
- ✅ **Tablet Optimized** - Landscape orientation and tablet-friendly layouts
- ✅ **Code Quality** - ESLint, Prettier, and strict TypeScript configuration

## Tech Stack

- **Framework**: React Native (Expo)
- **Language**: TypeScript
- **UI Library**: React Native Paper
- **Navigation**: React Navigation (Native Stack)
- **State Management**: Zustand
- **Form Handling**: React Hook Form + Zod
- **HTTP Client**: Axios
- **Storage**: React Native Encrypted Storage
- **Validation**: Zod

## Prerequisites

- Node.js 18+ and npm
- Expo CLI: `npm install -g expo-cli`
- Android Studio (for Android) or Xcode (for iOS)
- A running backend API with authentication endpoints

## Installation

1. **Clone the repository**
   ```bash
   cd FsdaFrontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Backend API**

   Update the API base URL in `src/services/api.ts`:
   ```typescript
   const API_BASE_URL = 'http://YOUR_BACKEND_URL/api';
   ```

## Backend Integration

Your backend should implement these authentication endpoints:

### Required Endpoints

1. **POST** `/auth/login`
   - Request: `{ email: string, password: string }`
   - Response: `{ access_token: string, refresh_token: string, user: { id: string, email: string, name?: string } }`

2. **POST** `/auth/register`
   - Request: `{ email: string, password: string, name?: string }`
   - Response: `{ access_token: string, refresh_token: string, user: { id: string, email: string, name?: string } }`

3. **POST** `/auth/refresh`
   - Request: `{ refresh_token: string }`
   - Response: `{ access_token: string, refresh_token: string }`

4. **POST** `/auth/logout`
   - Headers: `Authorization: Bearer {access_token}`
   - Response: `{ message: string }`

5. **GET** `/auth/me`
   - Headers: `Authorization: Bearer {access_token}`
   - Response: `{ id: string, email: string, name?: string }`

### Token Handling

The app automatically:
- Attaches access tokens to all authenticated requests
- Refreshes expired tokens using the refresh token
- Logs out users when refresh tokens expire
- Stores tokens securely using encrypted storage

## Running the App

### Development Server

```bash
npm start
```

This opens Expo Dev Tools. From there:
- Press `a` for Android emulator
- Press `i` for iOS simulator
- Scan QR code with Expo Go app (mobile)

### Platform-Specific Commands

```bash
# Android
npm run android

# iOS (macOS only)
npm run ios

# Web
npm run web
```

## Project Structure

```
FsdaFrontend/
├── src/
│   ├── navigation/
│   │   └── RootNavigator.tsx    # Navigation with protected routes
│   ├── screens/
│   │   ├── LoginScreen.tsx      # Login form with validation
│   │   ├── RegisterScreen.tsx   # Registration form
│   │   └── HomeScreen.tsx       # Protected home screen
│   ├── services/
│   │   └── api.ts               # Axios client with interceptors
│   └── store/
│       └── authStore.ts         # Zustand auth state management
├── App.tsx                       # Root component
├── app.json                      # Expo configuration (tablet optimized)
├── tsconfig.json                 # TypeScript configuration (strict mode)
├── .eslintrc.js                  # ESLint rules
├── .prettierrc.js                # Prettier configuration
└── package.json
```

## Key Components

### Authentication Store (`src/store/authStore.ts`)
Manages authentication state with Zustand:
- User information
- Token management
- Persistent storage
- Loading states

### API Service (`src/services/api.ts`)
Axios instance with:
- Automatic token attachment
- Token refresh on 401 errors
- Request/response interceptors
- Error handling

### Navigation (`src/navigation/RootNavigator.tsx`)
Protected routes:
- Public routes (Login, Register) when not authenticated
- Private routes (Home) when authenticated
- Auto-redirect based on auth state

## Configuration

### TypeScript
Strict mode enabled with additional checks:
- `strictNullChecks`
- `noImplicitAny`
- `noUnusedLocals`
- `noUnusedParameters`

### ESLint
Configured with:
- TypeScript rules
- React hooks rules
- Prettier integration
- React Native best practices

### Tablet Optimization
- Landscape orientation by default
- Responsive layouts (max-width: 600px for forms)
- Larger touch targets
- Optimized spacing for tablet screens

## Environment Variables

For production, consider using `expo-constants` and `app.config.js`:

```javascript
// app.config.js
export default {
  expo: {
    extra: {
      apiUrl: process.env.API_URL || 'http://localhost:3000/api',
    },
  },
};
```

Access in code:
```typescript
import Constants from 'expo-constants';
const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl;
```

## Building for Production

### Android

```bash
# Build APK
eas build --platform android --profile preview

# Build AAB for Play Store
eas build --platform android --profile production
```

### iOS

```bash
# Build for TestFlight
eas build --platform ios --profile production
```

## Security Best Practices

✅ Tokens stored in encrypted storage
✅ TypeScript prevents common errors
✅ Input validation with Zod schemas
✅ HTTPS required for production
✅ No sensitive data in logs
✅ Auto-logout on token expiration

## Performance Optimizations

- React.memo on all screen components
- useCallback for event handlers
- useMemo for computed values
- Minimal re-renders with Zustand
- Lazy loading and code splitting ready

## Troubleshooting

### Network Request Failed

If you get network errors in the Android emulator:
```bash
# Use 10.0.2.2 for Android emulator localhost
const API_BASE_URL = 'http://10.0.2.2:3000/api';
```

### Encrypted Storage Issues

Make sure to run:
```bash
npx expo prebuild
```

### TypeScript Errors

Ensure you're using compatible versions:
```bash
npm install --save-dev typescript@latest
```

## Scripts

```bash
npm start          # Start Expo dev server
npm run android    # Run on Android
npm run ios        # Run on iOS
npm run web        # Run on web browser
npm run lint       # Run ESLint
npm run format     # Format with Prettier
```

## Contributing

This is a production-ready template. Feel free to:
- Add more screens
- Implement additional features
- Customize the theme
- Add more validation rules

## License

MIT

## Support

For issues related to:
- **Expo**: https://docs.expo.dev/
- **React Native Paper**: https://callstack.github.io/react-native-paper/
- **React Navigation**: https://reactnavigation.org/

---

Built with ❤️ using modern React Native best practices