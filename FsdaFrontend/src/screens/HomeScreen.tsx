import React, { useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Text, Surface, Avatar } from 'react-native-paper';
import { ScreenWrapper } from '../components/layout/ScreenWrapper';
import { colors } from '../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import apiService from '../services/api';

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
};

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { user, clearAuth } = useAuthStore();

  const handleLogout = useCallback(async () => {
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await clearAuth();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  }, [clearAuth, navigation]);

  const getInitials = useCallback(() => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    if (user?.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    return 'U';
  }, [user]);

  return (
    <ScreenWrapper style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Surface style={styles.surface} elevation={4}>
          <View style={styles.header}>
            <Avatar.Text
              size={80}
              label={getInitials()}
              style={styles.avatar}
            />
            <Text variant="headlineMedium" style={styles.welcomeText}>
              Welcome Back!
            </Text>
            {(user?.first_name || user?.last_name) && (
              <Text variant="titleLarge" style={styles.nameText}>
                {`${user.first_name || ''} ${user.last_name || ''}`.trim()}
              </Text>
            )}
            {user?.username && (
              <Text variant="bodyMedium" style={styles.emailText}>
                @{user.username}
              </Text>
            )}
            {user?.email && (
              <Text variant="bodySmall" style={styles.emailText}>
                {user.email}
              </Text>
            )}
          </View>

          <View style={styles.infoContainer}>
            <Text variant="titleMedium" style={styles.infoTitle}>
              Dashboard
            </Text>
            <Text variant="bodyMedium" style={styles.infoText}>
              You are successfully authenticated with the backend.
            </Text>
            <Text variant="bodySmall" style={styles.infoSubtext}>
              This is your protected home screen. Only authenticated users can access
              this page.
            </Text>
          </View>

          <Button
            mode="contained"
            onPress={handleLogout}
            style={styles.logoutButton}
            icon="logout"
          >
            Logout
          </Button>
        </Surface>
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  surface: {
    padding: 32,
    borderRadius: 16,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    marginBottom: 16,
  },
  welcomeText: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  nameText: {
    marginBottom: 4,
    color: colors.primary.main,
  },
  emailText: {
    opacity: 0.7,
  },
  infoContainer: {
    marginBottom: 32,
  },
  infoTitle: {
    marginBottom: 12,
    fontWeight: 'bold',
  },
  infoText: {
    marginBottom: 8,
    lineHeight: 24,
  },
  infoSubtext: {
    opacity: 0.6,
    lineHeight: 20,
  },
  logoutButton: {
    paddingVertical: 8,
  },
});

export default React.memo(HomeScreen);