import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
import { IconButton } from 'react-native-paper';
import { useAuthStore } from '../store/authStore';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ProjectDetailsScreen from '../screens/ProjectDetailsScreen';
import FormsScreen from '../screens/FormsScreen';
import FormBuilderScreen from '../screens/FormBuilderScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import MembersScreen from '../screens/MembersScreen';
import SyncScreen from '../screens/SyncScreen';
import DataCollectionScreen from '../screens/DataCollectionScreen';
import ResponsesScreen from '../screens/ResponsesScreen';
import ResponseLinksScreen from '../screens/ResponseLinksScreen';
import AcceptInvitationScreen from '../screens/AcceptInvitationScreen';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  Dashboard: undefined;
  ProjectDetails: { projectId: string };
  AcceptInvitation: { projectId: string; notificationId: string };
  Forms: undefined;
  FormBuilder: { projectId: string; projectName: string };
  DataCollection: { projectId: string; projectName: string };
  Responses: { projectId: string; projectName: string };
  ResponseLinks: { projectId: string; projectName: string };
  Analytics: { projectId: string };
  Members: { projectId: string };
  Sync: { projectId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, loadStoredAuth } = useAuthStore();

  useEffect(() => {
    loadStoredAuth();
  }, [loadStoredAuth]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
          animation: 'slide_from_right',
          headerStyle: {
            backgroundColor: '#6200ee',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        {!isAuthenticated ? (
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          <>
            <Stack.Screen
              name="Dashboard"
              component={DashboardScreen}
              options={({ navigation }) => ({
                title: 'My Projects',
                headerRight: () => {
                  const { user, clearAuth } = useAuthStore();
                  return (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                      <Text style={{ color: '#fff', marginRight: 8, fontSize: 14 }}>
                        {user?.username || 'User'}
                      </Text>
                      <IconButton
                        icon="logout"
                        iconColor="#fff"
                        size={20}
                        onPress={async () => {
                          await clearAuth();
                          navigation.reset({
                            index: 0,
                            routes: [{ name: 'Login' }],
                          });
                        }}
                      />
                    </View>
                  );
                },
              })}
            />
            <Stack.Screen
              name="ProjectDetails"
              component={ProjectDetailsScreen}
              options={{ title: 'Project Details' }}
            />
            <Stack.Screen
              name="Forms"
              component={FormsScreen}
              options={{ title: 'Forms & Questionnaires' }}
            />
            <Stack.Screen
              name="FormBuilder"
              component={FormBuilderScreen}
              options={{ title: 'Form Builder' }}
            />
            <Stack.Screen
              name="DataCollection"
              component={DataCollectionScreen}
              options={{ title: 'Data Collection' }}
            />
            <Stack.Screen
              name="Responses"
              component={ResponsesScreen}
              options={{ title: 'Responses' }}
            />
            <Stack.Screen
              name="ResponseLinks"
              component={ResponseLinksScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Analytics"
              component={AnalyticsScreen}
              options={{ title: 'Analytics' }}
            />
            <Stack.Screen
              name="Members"
              component={MembersScreen}
              options={{ title: 'Project Members' }}
            />
            <Stack.Screen
              name="Sync"
              component={SyncScreen}
              options={{ title: 'Sync & Backup' }}
            />
            <Stack.Screen
              name="AcceptInvitation"
              component={AcceptInvitationScreen}
              options={{ title: 'Project Invitation' }}
            />
            <Stack.Screen name="Home" component={HomeScreen} />
          </>
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
    backgroundColor: '#f5f5f5',
  },
});

export default RootNavigator;