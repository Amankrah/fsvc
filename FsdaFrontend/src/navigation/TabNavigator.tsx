import React from 'react';
import { TouchableOpacity, View, StyleSheet, Platform, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigatorScreenParams } from '@react-navigation/native';
import { Icon } from 'react-native-paper';

// Screens
import DashboardScreen from '../screens/DashboardScreen';
import ProjectDetailsScreen from '../screens/ProjectDetailsScreen';
import MembersScreen from '../screens/MembersScreen';
import ResponsesScreen from '../screens/ResponsesScreen.v2';
import ResponseLinksScreen from '../screens/ResponseLinksScreen';
import AcceptInvitationScreen from '../screens/AcceptInvitationScreen';
import FormsScreen from '../screens/FormsScreen';
import FormBuilderScreen from '../screens/FormBuilderScreen';
import CollectScreen from '../screens/CollectScreen';
import DataCollectionScreen from '../screens/DataCollectionScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import BundleCompletionScreen from '../screens/BundleCompletionScreen';
import SyncScreen from '../screens/SyncScreen';
import ProfileScreen from '../screens/ProfileScreen';

import { colors, typography, spacing, elevation } from '../constants/theme';

// ─── Dashboard stack ──────────────────────────────────────────────────────────
// Contains ALL authenticated feature screens so existing navigation.navigate()
// calls from ProjectDetails work without modification. Phase 4 will refactor
// individual screens to use cross-tab navigation as needed.

export type DashboardStackParamList = {
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
};

// ─── Forms stack ──────────────────────────────────────────────────────────────

export type FormsStackParamList = {
  Forms: undefined;
  FormBuilder: { projectId: string; projectName: string };
};

// ─── Collect stack ────────────────────────────────────────────────────────────

export type CollectStackParamList = {
  Collect: undefined;
  DataCollection: { projectId: string; projectName: string };
  BundleCompletion: { projectId: string; projectName: string; isOwner?: boolean };
};

// ─── Profile stack ────────────────────────────────────────────────────────────

export type ProfileStackParamList = {
  Sync: { projectId: string };
};

// ─── Tab param list ───────────────────────────────────────────────────────────

export type TabParamList = {
  DashboardTab: NavigatorScreenParams<DashboardStackParamList> | undefined;
  FormsTab: NavigatorScreenParams<FormsStackParamList> | undefined;
  CollectTab: NavigatorScreenParams<CollectStackParamList> | undefined;
  AnalyticsTab: undefined;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

// ─── Shared header options ────────────────────────────────────────────────────

const sharedHeaderStyle = {
  headerStyle: { backgroundColor: colors.primary.main },
  headerTintColor: colors.primary.contrast,
  headerTitleStyle: { fontFamily: 'DMSans-Bold', fontSize: 16 } as any,
  animation: 'slide_from_right' as const,
};

// ─── DashboardStack ───────────────────────────────────────────────────────────

const DashboardStack = createNativeStackNavigator<DashboardStackParamList>();

function DashboardStackNavigator() {
  return (
    <DashboardStack.Navigator screenOptions={sharedHeaderStyle}>
      <DashboardStack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ headerShown: false }}
      />
      <DashboardStack.Screen
        name="ProjectDetails"
        component={ProjectDetailsScreen}
        options={{ headerShown: false }}
      />
      <DashboardStack.Screen
        name="Members"
        component={MembersScreen}
        options={{ headerShown: false }}
      />
      <DashboardStack.Screen
        name="Responses"
        component={ResponsesScreen}
        options={{ headerShown: false }}
      />
      <DashboardStack.Screen
        name="ResponseLinks"
        component={ResponseLinksScreen}
        options={{ headerShown: false }}
      />
      <DashboardStack.Screen
        name="AcceptInvitation"
        component={AcceptInvitationScreen}
        options={{ headerShown: false }}
      />
      <DashboardStack.Screen
        name="Forms"
        component={FormsScreen}
        options={{ headerShown: false }}
      />
      <DashboardStack.Screen
        name="FormBuilder"
        component={FormBuilderScreen}
        options={{ headerShown: false }}
      />
      <DashboardStack.Screen
        name="DataCollection"
        component={DataCollectionScreen}
        options={{ headerShown: false }}
      />
      <DashboardStack.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{ headerShown: false }}
      />
      <DashboardStack.Screen
        name="BundleCompletion"
        component={BundleCompletionScreen}
        options={{ headerShown: false }}
      />
      <DashboardStack.Screen
        name="Sync"
        component={SyncScreen}
        options={{ headerShown: false }}
      />
    </DashboardStack.Navigator>
  );
}

// ─── FormsStack ───────────────────────────────────────────────────────────────

const FormsStack = createNativeStackNavigator<FormsStackParamList>();

function FormsStackNavigator() {
  return (
    <FormsStack.Navigator screenOptions={sharedHeaderStyle}>
      <FormsStack.Screen
        name="Forms"
        component={FormsScreen}
        options={{ headerShown: false }}
      />
      <FormsStack.Screen
        name="FormBuilder"
        component={FormBuilderScreen}
        options={{ headerShown: false }}
      />
    </FormsStack.Navigator>
  );
}

// ─── CollectStack ─────────────────────────────────────────────────────────────
// Picker → DataCollection → BundleCompletion. The picker is the entry screen;
// DataCollection navigates to BundleCompletion on completion.

const CollectStack = createNativeStackNavigator<CollectStackParamList>();

function CollectStackNavigator() {
  return (
    <CollectStack.Navigator screenOptions={sharedHeaderStyle}>
      <CollectStack.Screen
        name="Collect"
        component={CollectScreen}
        options={{ headerShown: false }}
      />
      <CollectStack.Screen
        name="DataCollection"
        component={DataCollectionScreen}
        options={{ headerShown: false }}
      />
      <CollectStack.Screen
        name="BundleCompletion"
        component={BundleCompletionScreen}
        options={{ headerShown: false }}
      />
    </CollectStack.Navigator>
  );
}

// ─── Analytics placeholder ────────────────────────────────────────────────────
// Phase 4 will replace this with a project-picker → Analytics flow.

function AnalyticsPlaceholder() {
  return (
    <View style={placeholderStyles.container}>
      <Icon source="chart-box-outline" size={48} color={colors.text.tertiary} />
      <Text style={placeholderStyles.title}>Analytics</Text>
      <Text style={placeholderStyles.body}>
        Open a project from the Home tab and tap "Analytics" to explore your data.
      </Text>
    </View>
  );
}

// ─── ProfileStack ─────────────────────────────────────────────────────────────

const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={sharedHeaderStyle}>
      <ProfileStack.Screen
        name="Sync"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
    </ProfileStack.Navigator>
  );
}

// ─── Collect tab custom button ────────────────────────────────────────────────

function CollectTabButton({ onPress, accessibilityState }: any) {
  const focused = accessibilityState?.selected;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.collectButton}
      accessibilityRole="button"
      accessibilityLabel="Collect data"
    >
      <View style={[styles.collectInner, focused && styles.collectFocused]}>
        <Icon source="plus" size={26} color="#fff" />
      </View>
    </TouchableOpacity>
  );
}

// ─── Tab Navigator ────────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<TabParamList>();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary.main,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardStackNavigator}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Icon source={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="FormsTab"
        component={FormsStackNavigator}
        options={{
          tabBarLabel: 'Forms',
          tabBarIcon: ({ color, focused }) => (
            <Icon
              source={focused ? 'clipboard-text' : 'clipboard-text-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="CollectTab"
        component={CollectStackNavigator}
        options={{
          tabBarLabel: '',
          tabBarButton: (props) => <CollectTabButton {...props} />,
        }}
      />
      <Tab.Screen
        name="AnalyticsTab"
        component={AnalyticsPlaceholder}
        options={{
          tabBarLabel: 'Analytics',
          tabBarIcon: ({ color, focused }) => (
            <Icon
              source={focused ? 'chart-box' : 'chart-box-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Icon
              source={focused ? 'account' : 'account-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.background.paper,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    height: Platform.OS === 'ios' ? 84 : 64,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    ...elevation.sm,
  },
  tabLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 11,
    marginTop: 2,
  },
  collectButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent.main,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent.main,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    marginTop: -20,
  },
  collectFocused: {
    backgroundColor: colors.accent.darkOrange,
    shadowOpacity: 0.5,
  },
});

const placeholderStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.xl,
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
