import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, View, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { syncManager } from '../services/syncManager';
import { colors } from '../constants/theme';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import TabNavigator from './TabNavigator';

/**
 * RootStackParamList — exported for backward compatibility with existing screens
 * that import route param types from this file. New screens should import from
 * TabNavigator's individual stack param lists instead.
 */
export type RootStackParamList = {
  // Auth routes
  Login: undefined;
  Register: undefined;
  Main: undefined;
  // Dashboard stack routes (accessed via DashboardStackParamList in TabNavigator)
  Dashboard: { editProjectId?: string } | undefined;
  ProjectDetails: { projectId: string };
  Members: { projectId: string };
  Responses: { projectId: string; projectName: string };
  ResponseLinks: { projectId: string; projectName: string };
  AcceptInvitation: { projectId: string; notificationId: string };
  Forms: undefined;
  FormBuilder: { projectId: string; projectName: string };
  DataCollection: { projectId: string; projectName: string };
  Analytics: { projectId: string; projectName?: string };
  BundleCompletion: { projectId: string; projectName: string; isOwner?: boolean };
  Sync: { projectId: string };
  // Legacy (removed in Phase 2)
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, loadStoredAuth, clearAuth } = useAuthStore();
  const authAlertShown = useRef(false);

  useEffect(() => {
    loadStoredAuth();
  }, [loadStoredAuth]);

  // Listen for sync auth errors and redirect to login
  useEffect(() => {
    const unsub = syncManager.addEventListener((event, data) => {
      if (event === 'auth_error' && !authAlertShown.current) {
        authAlertShown.current = true;
        Alert.alert(
          'Session Expired',
          'Your session has expired. Offline data is safe and will sync after you log in again.',
          [
            {
              text: 'Log In',
              onPress: async () => {
                authAlertShown.current = false;
                await clearAuth();
              },
            },
          ]
        );
      }
    });
    return unsub;
  }, [clearAuth]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          <Stack.Screen name="Main" component={TabNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.default,
  },
});

export default RootNavigator;
