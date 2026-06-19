import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  HelperText,
  Portal,
  Dialog,
  Divider,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography, elevation } from '../constants/theme';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/Toast';
import apiService from '../services/api';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Main: undefined;
  AcceptInvitation: { token: string };
};

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

const LoginScreen: React.FC = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const { setAuth } = useAuthStore();
  const { showToast } = useToast();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = useCallback(
    async (data: LoginFormData) => {
      setIsLoading(true);
      try {
        const response = await apiService.login(data.email, data.password);

        if (response.token) {
          const user = response.user_data || {
            id: '',
            email: data.email,
            username: data.email.split('@')[0],
          };
          await setAuth(response.token, user);
          // Navigator auto-switches to MainTabs when isAuthenticated becomes true
          navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
        } else {
          showToast({ message: 'Invalid response from server', variant: 'error' });
        }
      } catch (error: any) {
        console.error('Login Error:', error);
        const errorMessage =
          error.response?.data?.error ||
          error.response?.data?.message ||
          error.message ||
          'Invalid email or password';
        showToast({ message: errorMessage, variant: 'error' });
      } finally {
        setIsLoading(false);
      }
    },
    [navigation, setAuth]
  );

  const handleInviteCodeSubmit = useCallback(() => {
    if (!inviteToken.trim()) {
      showToast({ message: 'Please enter an invitation code', variant: 'warning' });
      return;
    }
    setShowInviteDialog(false);
    navigation.navigate('AcceptInvitation', { token: inviteToken.trim() });
    setInviteToken('');
  }, [inviteToken, navigation]);

  return (
    // KAV wraps the full screen so iOS padding calculation includes the hero.
    // On Android we pass no behavior — the OS adjustPan handles it natively
    // without the grey-bar flicker that behavior="height" causes.
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Hero band ─────────────────────────────────────────────────────── */}
      <View style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}>
        {/* Logo mark */}
        <View style={styles.logoMark}>
          <Text style={styles.logoLetter}>F</Text>
        </View>

        <Text style={styles.appName}>FSDA</Text>
        <Text style={styles.appTagline}>Field Survey & Data Analysis</Text>

        <View style={styles.heroTextBlock}>
          <Text style={styles.heroHeadline}>Welcome back to{'\n'}your research.</Text>
          <Text style={styles.heroSubline}>Sign in to access your projects.</Text>
        </View>
      </View>

      {/* ── White card panel ──────────────────────────────────────────────── */}
      <View style={styles.cardShell}>
        <ScrollView
          style={styles.cardScroll}
          contentContainerStyle={[styles.cardContent, { paddingBottom: insets.bottom + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Text style={styles.cardTitle}>Sign in</Text>
          <Text style={styles.cardSubtitle}>Enter your credentials to continue</Text>

          {/* Email */}
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>EMAIL</Text>
                <TextInput
                  mode="outlined"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={!!errors.email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  disabled={isLoading}
                  style={styles.input}
                  outlineStyle={styles.inputOutline}
                  placeholder="you@example.com"
                />
                {errors.email && (
                  <HelperText type="error" visible>{errors.email.message}</HelperText>
                )}
              </View>
            )}
          />

          {/* Password */}
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>PASSWORD</Text>
                <TextInput
                  mode="outlined"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={!!errors.password}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  disabled={isLoading}
                  style={styles.input}
                  outlineStyle={styles.inputOutline}
                  right={
                    <TextInput.Icon
                      icon={showPassword ? 'eye-off' : 'eye'}
                      onPress={() => setShowPassword((p) => !p)}
                      color={colors.text.tertiary}
                    />
                  }
                />
                {errors.password && (
                  <HelperText type="error" visible>{errors.password.message}</HelperText>
                )}
              </View>
            )}
          />

          {/* Sign In button */}
          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            disabled={isLoading}
            style={styles.signInBtn}
            contentStyle={styles.signInBtnContent}
            labelStyle={styles.signInBtnLabel}
          >
            Sign In
          </Button>

          {/* Register link */}
          <View style={styles.registerRow}>
            <Text style={styles.registerText}>New to FSDA? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              disabled={isLoading}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Text style={styles.registerLink}>Create account</Text>
            </TouchableOpacity>
          </View>

          {/* Invite code */}
          <Divider style={styles.divider} />
          <Button
            mode="outlined"
            onPress={() => setShowInviteDialog(true)}
            disabled={isLoading}
            icon="email-outline"
            style={styles.inviteBtn}
            textColor={colors.text.secondary}
          >
            I have an invitation code
          </Button>
        </ScrollView>
      </View>

      {/* ── Invite code dialog ────────────────────────────────────────────── */}
      <Portal>
        <Dialog visible={showInviteDialog} onDismiss={() => setShowInviteDialog(false)}
          style={styles.dialog}>
          <Dialog.Title>Invitation Code</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogBody}>
              Paste the invitation code from your email below:
            </Text>
            <TextInput
              label="Invitation Code"
              value={inviteToken}
              onChangeText={setInviteToken}
              mode="outlined"
              autoCapitalize="none"
              placeholder="e.g., _WyLKRfwJkC8dx..."
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
  root: {
    flex: 1,
    backgroundColor: colors.primary.dark,
  },

  // ── Hero
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  logoLetter: {
    fontFamily: 'Fraunces-Bold',
    fontSize: 28,
    color: '#fff',
    lineHeight: 32,
  },
  appName: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.xxl,
    color: '#fff',
    letterSpacing: 2,
    marginBottom: 2,
  },
  appTagline: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.xl,
  },
  heroTextBlock: {
    alignItems: 'center',
  },
  heroHeadline: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.xxl,
    color: '#fff',
    textAlign: 'center',
    lineHeight: typography.fontSize.xxl * 1.25,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  heroSubline: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.md,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
  },

  // ── Card panel
  cardShell: {
    flex: 1,
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: borderRadius.xxxl,
    borderTopRightRadius: borderRadius.xxxl,
    // overflow: 'hidden' removed — it caused the Android grey-bar flicker
    // by clipping the KAV height animation. Border radius still clips via
    // the ScrollView's own rounded content area.
    ...elevation.lg,
  },
  cardScroll: {
    flex: 1,
  },
  cardContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  cardTitle: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.xxl,
    color: colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },

  // ── Fields
  fieldWrap: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background.subtle,
  },
  inputOutline: {
    borderRadius: borderRadius.md,
    borderColor: colors.border.light,
  },

  // ── Buttons
  signInBtn: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary.main,
  },
  signInBtnContent: {
    height: 52,
  },
  signInBtnLabel: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    letterSpacing: 0.3,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  registerText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  registerLink: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.sm,
    color: colors.primary.main,
  },
  divider: {
    marginVertical: spacing.lg,
    backgroundColor: colors.border.light,
  },
  inviteBtn: {
    borderColor: colors.border.medium,
    borderRadius: borderRadius.lg,
  },

  // ── Dialog
  dialog: {
    borderRadius: borderRadius.xxl,
  },
  dialogBody: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
});

export default React.memo(LoginScreen);
