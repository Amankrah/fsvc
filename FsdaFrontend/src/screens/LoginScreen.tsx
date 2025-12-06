import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { TextInput, Button, Text, Surface, HelperText, Portal, Dialog, Divider } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import apiService from '../services/api';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  Dashboard: undefined;
  AcceptInvitation: { token: string };
};

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

const LoginScreen: React.FC = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const { setAuth } = useAuthStore();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = useCallback(
    async (data: LoginFormData) => {
      setIsLoading(true);
      try {
        const response = await apiService.login(data.email, data.password);

        if (response.token) {
          // Django returns user_data in login response
          const user = response.user_data || {
            id: '',
            email: data.email,
            username: data.email.split('@')[0],
          };

          await setAuth(response.token, user);

          navigation.reset({
            index: 0,
            routes: [{ name: 'Dashboard' }],
          });
        } else {
          Alert.alert('Error', 'Invalid response from server');
        }
      } catch (error: any) {
        // Log full error for debugging
        console.error('🚨 Login Error:', error);
        console.error('🚨 Error response:', error.response);
        console.error('🚨 Error message:', error.message);
        console.error('🚨 Error code:', error.code);

        const errorMessage = error.response?.data?.error ||
                            error.response?.data?.message ||
                            error.message ||
                            'Invalid email or password';
        Alert.alert('Login Failed', errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [navigation, setAuth]
  );

  const handleRegisterPress = useCallback(() => {
    navigation.navigate('Register');
  }, [navigation]);

  const toggleShowPassword = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const handleInviteCodeSubmit = useCallback(() => {
    if (!inviteToken.trim()) {
      Alert.alert('Error', 'Please enter an invitation code');
      return;
    }

    setShowInviteDialog(false);
    navigation.navigate('AcceptInvitation', { token: inviteToken.trim() });
    setInviteToken('');
  }, [inviteToken, navigation]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Surface style={styles.surface} elevation={4}>
          <Text variant="headlineLarge" style={styles.title}>
            Welcome Back
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            Sign in to continue
          </Text>

          <View style={styles.form}>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.inputContainer}>
                  <TextInput
                    label="Email"
                    mode="outlined"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={!!errors.email}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    style={styles.input}
                    disabled={isLoading}
                  />
                  {errors.email && (
                    <HelperText type="error" visible={!!errors.email}>
                      {errors.email.message}
                    </HelperText>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.inputContainer}>
                  <TextInput
                    label="Password"
                    mode="outlined"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={!!errors.password}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="password"
                    style={styles.input}
                    disabled={isLoading}
                    right={
                      <TextInput.Icon
                        icon={showPassword ? 'eye-off' : 'eye'}
                        onPress={toggleShowPassword}
                      />
                    }
                  />
                  {errors.password && (
                    <HelperText type="error" visible={!!errors.password}>
                      {errors.password.message}
                    </HelperText>
                  )}
                </View>
              )}
            />

            <Button
              mode="contained"
              onPress={handleSubmit(onSubmit)}
              loading={isLoading}
              disabled={isLoading}
              style={styles.button}
            >
              Sign In
            </Button>

            <View style={styles.registerContainer}>
              <Text variant="bodyMedium">Don't have an account? </Text>
              <Button
                mode="text"
                onPress={handleRegisterPress}
                disabled={isLoading}
                compact
              >
                Register
              </Button>
            </View>

            <Divider style={styles.divider} />

            <Button
              mode="outlined"
              onPress={() => setShowInviteDialog(true)}
              disabled={isLoading}
              icon="email-outline"
              style={styles.inviteButton}
            >
              Have an invitation code?
            </Button>
          </View>
        </Surface>
      </ScrollView>

      <Portal>
        <Dialog visible={showInviteDialog} onDismiss={() => setShowInviteDialog(false)}>
          <Dialog.Title>Enter Invitation Code</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.inviteDialogText}>
              If you received an invitation email, paste the invitation code below:
            </Text>
            <TextInput
              label="Invitation Code"
              value={inviteToken}
              onChangeText={setInviteToken}
              mode="outlined"
              autoCapitalize="none"
              style={styles.inviteInput}
              placeholder="e.g., _WyLKRfwJkC8dxkSCgyW0E1..."
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowInviteDialog(false)}>Cancel</Button>
            <Button onPress={handleInviteCodeSubmit} disabled={!inviteToken.trim()}>
              Continue
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
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
  title: {
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.7,
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
  },
  button: {
    marginTop: 8,
    paddingVertical: 8,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  divider: {
    marginVertical: 16,
  },
  inviteButton: {
    marginTop: 8,
  },
  inviteDialogText: {
    marginBottom: 16,
    color: '#666',
  },
  inviteInput: {
    backgroundColor: 'white',
  },
});

export default React.memo(LoginScreen);