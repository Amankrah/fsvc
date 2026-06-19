import React from 'react';
import { Alert } from 'react-native';
import { IconButton } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../constants/theme';

type Props = {
  iconColor?: string;
};

/**
 * LogoutButton
 *
 * Self-contained logout trigger — safe to place anywhere in the tree
 * because it calls useAuthStore() inside a real component (not a callback).
 */
const LogoutButton: React.FC<Props> = ({ iconColor = colors.primary.contrast }) => {
  const { clearAuth } = useAuthStore();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await clearAuth();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  return (
    <IconButton
      icon="logout"
      iconColor={iconColor}
      size={20}
      onPress={handleLogout}
    />
  );
};

export default LogoutButton;
