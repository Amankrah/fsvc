import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
import { IconButton } from 'react-native-paper';
import { useAuthStore } from '../store/authStore';
import { colors } from '../constants/theme';
import ProjectSelector from '../components/ProjectSelector';
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
import BundleCompletionScreen from '../screens/BundleCompletionScreen';

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
  BundleCompletion: { projectId: string; projectName: string };
  Analytics: { projectId: string; projectName?: string };
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
        <ActivityIndicator size="large" color={colors.primary.main} />
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
            backgroundColor: colors.primary.main,
          },
          headerTintColor: colors.primary.contrast,
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
              options={({ navigation }) => ({
                title: 'Project Details',
                headerLeft: () => (
                  <IconButton
                    icon="home"
                    iconColor="#fff"
                    size={24}
                    onPress={() => navigation.navigate('Dashboard')}
                  />
                ),
              })}
            />
            <Stack.Screen
              name="Forms"
              component={FormsScreen}
              options={({ navigation }) => ({
                title: 'Forms & Questionnaires',
                headerRight: () => (
                  <IconButton
                    icon="home"
                    iconColor="#fff"
                    size={20}
                    onPress={() => navigation.navigate('Dashboard')}
                  />
                ),
              })}
            />
            <Stack.Screen
              name="FormBuilder"
              component={FormBuilderScreen}
              options={({ navigation }) => ({
                title: 'Form Builder',
                headerRight: () => (
                  <IconButton
                    icon="home"
                    iconColor="#fff"
                    size={20}
                    onPress={() => navigation.navigate('Dashboard')}
                  />
                ),
              })}
            />
            <Stack.Screen
              name="DataCollection"
              component={DataCollectionScreen}
              options={({ navigation, route }) => ({
                title: 'Data Collection',
                headerRight: () => (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ProjectSelector
                      currentProjectId={route.params.projectId}
                      currentProjectName={route.params.projectName}
                      onProjectChange={(projectId, projectName) => {
                        navigation.setParams({ projectId, projectName });
                      }}
                    />
                    <IconButton
                      icon="home"
                      iconColor="#fff"
                      size={20}
                      onPress={() => navigation.navigate('Dashboard')}
                    />
                  </View>
                ),
              })}
            />
            <Stack.Screen
              name="Responses"
              component={ResponsesScreen}
              options={({ navigation, route }) => ({
                title: 'Responses',
                headerRight: () => (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ProjectSelector
                      currentProjectId={route.params.projectId}
                      currentProjectName={route.params.projectName}
                      onProjectChange={(projectId, projectName) => {
                        navigation.setParams({ projectId, projectName });
                      }}
                    />
                    <IconButton
                      icon="home"
                      iconColor="#fff"
                      size={20}
                      onPress={() => navigation.navigate('Dashboard')}
                    />
                  </View>
                ),
              })}
            />
            <Stack.Screen
              name="ResponseLinks"
              component={ResponseLinksScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="BundleCompletion"
              component={BundleCompletionScreen}
              options={({ navigation, route }) => ({
                title: 'Bundle Completion',
                headerRight: () => (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ProjectSelector
                      currentProjectId={route.params.projectId}
                      currentProjectName={route.params.projectName}
                      onProjectChange={(projectId, projectName) => {
                        navigation.setParams({ projectId, projectName });
                      }}
                    />
                    <IconButton
                      icon="home"
                      iconColor="#fff"
                      size={20}
                      onPress={() => navigation.navigate('Dashboard')}
                    />
                  </View>
                ),
              })}
            />
            <Stack.Screen
              name="Analytics"
              component={AnalyticsScreen}
              options={({ navigation, route }) => ({
                title: 'Analytics',
                headerRight: () => (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ProjectSelector
                      currentProjectId={route.params.projectId}
                      currentProjectName={route.params.projectName || ''}
                      onProjectChange={(projectId) => {
                        navigation.setParams({ projectId });
                      }}
                    />
                    <IconButton
                      icon="home"
                      iconColor="#fff"
                      size={20}
                      onPress={() => navigation.navigate('Dashboard')}
                    />
                  </View>
                ),
              })}
            />
            <Stack.Screen
              name="Members"
              component={MembersScreen}
              options={({ navigation }) => ({
                title: 'Project Members',
                headerRight: () => (
                  <IconButton
                    icon="home"
                    iconColor="#fff"
                    size={20}
                    onPress={() => navigation.navigate('Dashboard')}
                  />
                ),
              })}
            />
            <Stack.Screen
              name="Sync"
              component={SyncScreen}
              options={({ navigation }) => ({
                title: 'Sync & Backup',
                headerRight: () => (
                  <IconButton
                    icon="home"
                    iconColor="#fff"
                    size={20}
                    onPress={() => navigation.navigate('Dashboard')}
                  />
                ),
              })}
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
    backgroundColor: colors.background.default,
  },
});

export default RootNavigator;