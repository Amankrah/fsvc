module.exports = {
  expo: {
    name: "Food Systems Analytics",
    slug: "FsdaFrontend",
    owner: "sasel-mcgill",
    version: "1.0.1",
    orientation: "landscape",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    updates: {
      enabled: true,
      checkAutomatically: "ON_LOAD",
      fallbackToCacheTimeout: 0,
      url: "https://u.expo.dev/416102d4-2852-4813-80c5-071bcee68212"
    },
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      requireFullScreen: false,
      bundleIdentifier: "com.fsda.frontend",
      runtimeVersion: {
        policy: "appVersion"
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.fsda.frontend",
      softwareKeyboardLayoutMode: "pan",
      runtimeVersion: "1.0.0"
    },
    web: {
      favicon: "./assets/web-favicon.png",
      bundler: "metro",
      output: "single",
      baseUrl: "/app",
      build: {
        babel: {
          include: ["@react-navigation", "react-native-paper"]
        }
      },
      meta: {
        title: "Food Systems Analytics - Data Collection",
        description: "Professional data collection platform for food systems research",
        keywords: "food systems, data collection, research, analytics"
      }
    },
    platforms: [
      "ios",
      "android",
      "web"
    ],
    primaryColor: "#6200ee",
    sdkVersion: "54.0.0",
    plugins: [
      "expo-secure-store"
    ],
    extra: {
      eas: {
        projectId: "416102d4-2852-4813-80c5-071bcee68212"
      },
      // Environment-specific API URLs
      apiUrl: process.env.EXPO_PUBLIC_API_URL || process.env.API_URL,
      environment: process.env.EXPO_PUBLIC_ENVIRONMENT || process.env.NODE_ENV || 'development'
    }
  }
};
