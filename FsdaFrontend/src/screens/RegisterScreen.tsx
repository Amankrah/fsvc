import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { TextInput, Button, Text, HelperText } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '../constants/theme';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import apiService from '../services/api';

const registerSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    username: z.string().min(3, 'Username must be at least 3 characters'),
    firstName: z.string().min(2, 'First name is required'),
    lastName: z.string().min(2, 'Last name is required'),
    institution: z.string().optional(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Main: undefined;
};

type RegisterScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;

// ── Step progress indicator ───────────────────────────────────────────────────

const StepDots: React.FC<{ step: number; total: number }> = ({ step, total }) => (
  <View style={dotStyles.row}>
    {Array.from({ length: total }).map((_, i) => {
      const done = i < step;
      const active = i === step;
      return (
        <View
          key={i}
          style={[
            dotStyles.dot,
            done && dotStyles.doneDot,
            active && dotStyles.activeDot,
          ]}
        />
      );
    })}
  </View>
);

const dotStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border.medium,
  },
  doneDot: {
    backgroundColor: colors.primary.light,
    width: 8,
  },
  activeDot: {
    backgroundColor: colors.primary.main,
    width: 24,
    borderRadius: 4,
  },
});

// ── Field helper ──────────────────────────────────────────────────────────────

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <View style={fieldStyles.wrap}>
    <Text style={fieldStyles.label}>{label}</Text>
    {children}
  </View>
);

const fieldStyles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
});

// ── Main screen ───────────────────────────────────────────────────────────────

const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0); // 0=Identity, 1=Account, 2=Confirm
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { setAuth } = useAuthStore();

  const {
    control,
    handleSubmit,
    trigger,
    getValues,
    setError,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      username: '',
      firstName: '',
      lastName: '',
      institution: '',
      password: '',
      confirmPassword: '',
    },
    mode: 'onBlur',
  });

  const stepFields: Array<Array<keyof RegisterFormData>> = [
    ['firstName', 'lastName', 'email', 'institution'],
    ['username', 'password', 'confirmPassword'],
    [],
  ];

  const handleNext = useCallback(async () => {
    const valid = await trigger(stepFields[step]);
    if (valid) setStep((s) => s + 1);
  }, [step, trigger]);

  const handleBack = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const onSubmit = useCallback(
    async (data: RegisterFormData) => {
      setIsLoading(true);
      try {
        const response = await apiService.register(
          data.email,
          data.username,
          data.password,
          data.confirmPassword,
          data.firstName,
          data.lastName,
          'researcher',
          data.institution
        );

        if (response.token && response.user) {
          await setAuth(response.token, response.user);
          navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
        } else {
          Alert.alert('Error', 'Invalid response from server');
        }
      } catch (error: any) {
        console.error('Registration Error:', error);
        let errorMessage = 'An error occurred during registration';

        if (error.response?.data) {
          const data = error.response.data;
          let handled = false;

          if (data.email) { setError('email', { type: 'server', message: data.email[0] }); handled = true; }
          if (data.username) { setError('username', { type: 'server', message: data.username[0] }); handled = true; }
          if (data.password) { setError('password', { type: 'server', message: data.password[0] }); handled = true; }
          if (data.first_name) { setError('firstName', { type: 'server', message: data.first_name[0] }); handled = true; }
          if (data.last_name) { setError('lastName', { type: 'server', message: data.last_name[0] }); handled = true; }
          if (data.institution) { setError('institution', { type: 'server', message: data.institution[0] }); handled = true; }

          if (handled) {
            Alert.alert('Registration Failed', 'Please fix the highlighted errors.');
            // Navigate back to the relevant step
            setStep(0);
            return;
          }

          errorMessage = data.message || data.detail || data.non_field_errors?.[0] || errorMessage;
        } else if (error.message) {
          errorMessage = `Network Error: ${error.message}`;
        }

        Alert.alert('Registration Failed', errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [navigation, setAuth, setError]
  );

  const values = getValues();
  const STEP_LABELS = ['Identity', 'Account', 'Confirm'];

  return (
    <View style={styles.root}>
      {/* ── Hero band ───────────────────────────────────────────────────── */}
      <View style={[styles.hero, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.logoMark}>
          <Text style={styles.logoLetter}>F</Text>
        </View>
        <Text style={styles.appName}>FSDA</Text>
        <Text style={styles.heroHeadline}>Create your account</Text>
        <Text style={styles.heroSub}>Step {step + 1} of 3 — {STEP_LABELS[step]}</Text>
      </View>

      {/* ── Card panel ──────────────────────────────────────────────────── */}
      <KeyboardAvoidingView
        style={styles.cardShell}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.cardScroll}
          contentContainerStyle={[styles.cardContent, { paddingBottom: insets.bottom + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <StepDots step={step} total={3} />

          {/* ── Step 0: Identity ────────────────────────────────────────── */}
          {step === 0 && (
            <View>
              <View style={styles.nameRow}>
                <View style={styles.nameHalf}>
                  <Field label="FIRST NAME">
                    <Controller
                      control={control}
                      name="firstName"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <>
                          <TextInput
                            mode="outlined" value={value} onChangeText={onChange} onBlur={onBlur}
                            error={!!errors.firstName} autoCapitalize="words" disabled={isLoading}
                            style={styles.input} outlineStyle={styles.inputOutline} placeholder="Jane"
                          />
                          {errors.firstName && <HelperText type="error" visible>{errors.firstName.message}</HelperText>}
                        </>
                      )}
                    />
                  </Field>
                </View>
                <View style={styles.nameGap} />
                <View style={styles.nameHalf}>
                  <Field label="LAST NAME">
                    <Controller
                      control={control}
                      name="lastName"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <>
                          <TextInput
                            mode="outlined" value={value} onChangeText={onChange} onBlur={onBlur}
                            error={!!errors.lastName} autoCapitalize="words" disabled={isLoading}
                            style={styles.input} outlineStyle={styles.inputOutline} placeholder="Doe"
                          />
                          {errors.lastName && <HelperText type="error" visible>{errors.lastName.message}</HelperText>}
                        </>
                      )}
                    />
                  </Field>
                </View>
              </View>

              <Field label="EMAIL">
                <Controller
                  control={control}
                  name="email"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <>
                      <TextInput
                        mode="outlined" value={value} onChangeText={onChange} onBlur={onBlur}
                        error={!!errors.email} keyboardType="email-address" autoCapitalize="none"
                        disabled={isLoading} style={styles.input} outlineStyle={styles.inputOutline}
                        placeholder="you@example.com"
                      />
                      {errors.email && <HelperText type="error" visible>{errors.email.message}</HelperText>}
                    </>
                  )}
                />
              </Field>

              <Field label="INSTITUTION (OPTIONAL)">
                <Controller
                  control={control}
                  name="institution"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      mode="outlined" value={value} onChangeText={onChange} onBlur={onBlur}
                      autoCapitalize="words" disabled={isLoading}
                      style={styles.input} outlineStyle={styles.inputOutline}
                      placeholder="University / Organisation"
                    />
                  )}
                />
              </Field>
            </View>
          )}

          {/* ── Step 1: Account ─────────────────────────────────────────── */}
          {step === 1 && (
            <View>
              <Field label="USERNAME">
                <Controller
                  control={control}
                  name="username"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <>
                      <TextInput
                        mode="outlined" value={value} onChangeText={onChange} onBlur={onBlur}
                        error={!!errors.username} autoCapitalize="none" disabled={isLoading}
                        style={styles.input} outlineStyle={styles.inputOutline}
                        placeholder="janedoe"
                      />
                      {errors.username && <HelperText type="error" visible>{errors.username.message}</HelperText>}
                    </>
                  )}
                />
              </Field>

              <Field label="PASSWORD">
                <Controller
                  control={control}
                  name="password"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <>
                      <TextInput
                        mode="outlined" value={value} onChangeText={onChange} onBlur={onBlur}
                        error={!!errors.password} secureTextEntry={!showPassword}
                        autoCapitalize="none" disabled={isLoading}
                        style={styles.input} outlineStyle={styles.inputOutline}
                        right={<TextInput.Icon icon={showPassword ? 'eye-off' : 'eye'} onPress={() => setShowPassword(p => !p)} color={colors.text.tertiary} />}
                      />
                      {errors.password && <HelperText type="error" visible>{errors.password.message}</HelperText>}
                    </>
                  )}
                />
              </Field>

              <Field label="CONFIRM PASSWORD">
                <Controller
                  control={control}
                  name="confirmPassword"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <>
                      <TextInput
                        mode="outlined" value={value} onChangeText={onChange} onBlur={onBlur}
                        error={!!errors.confirmPassword} secureTextEntry={!showConfirmPassword}
                        autoCapitalize="none" disabled={isLoading}
                        style={styles.input} outlineStyle={styles.inputOutline}
                        right={<TextInput.Icon icon={showConfirmPassword ? 'eye-off' : 'eye'} onPress={() => setShowConfirmPassword(p => !p)} color={colors.text.tertiary} />}
                      />
                      {errors.confirmPassword && <HelperText type="error" visible>{errors.confirmPassword.message}</HelperText>}
                    </>
                  )}
                />
              </Field>
            </View>
          )}

          {/* ── Step 2: Confirm ─────────────────────────────────────────── */}
          {step === 2 && (
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Ready to create your account</Text>
              <Text style={styles.confirmSub}>Please review your details below.</Text>

              {[
                { label: 'Name', val: `${values.firstName} ${values.lastName}` },
                { label: 'Email', val: values.email },
                { label: 'Username', val: `@${values.username}` },
                ...(values.institution ? [{ label: 'Institution', val: values.institution }] : []),
              ].map(({ label, val }) => (
                <View key={label} style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>{label}</Text>
                  <Text style={styles.confirmVal}>{val}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Navigation buttons ───────────────────────────────────────── */}
          <View style={styles.navRow}>
            {step > 0 && (
              <Button
                mode="outlined"
                onPress={handleBack}
                disabled={isLoading}
                style={[styles.navBtn, styles.navBtnBack]}
                textColor={colors.text.secondary}
                icon="chevron-left"
              >
                Back
              </Button>
            )}

            {step < 2 ? (
              <Button
                mode="contained"
                onPress={handleNext}
                disabled={isLoading}
                style={[styles.navBtn, styles.navBtnNext]}
                contentStyle={styles.navBtnContent}
                labelStyle={styles.navBtnLabel}
                icon="chevron-right"
              >
                Continue
              </Button>
            ) : (
              <Button
                mode="contained"
                onPress={handleSubmit(onSubmit)}
                loading={isLoading}
                disabled={isLoading}
                style={[styles.navBtn, styles.navBtnNext]}
                contentStyle={styles.navBtnContent}
                labelStyle={styles.navBtnLabel}
              >
                Create Account
              </Button>
            )}
          </View>

          {/* ── Sign in link ─────────────────────────────────────────────── */}
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={isLoading}>
              <Text style={styles.loginLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primary.dark,
  },

  // ── Hero
  hero: {
    flex: 0.3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  logoLetter: {
    fontFamily: 'Fraunces-Bold',
    fontSize: 22,
    color: '#fff',
  },
  appName: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.lg,
    color: '#fff',
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  heroHeadline: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.xl,
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  heroSub: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },

  // ── Card panel
  cardShell: {
    flex: 0.7,
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: borderRadius.xxxl,
    borderTopRightRadius: borderRadius.xxxl,
    overflow: 'hidden',
  },
  cardScroll: { flex: 1 },
  cardContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },

  // ── Form
  nameRow: {
    flexDirection: 'row',
  },
  nameHalf: { flex: 1 },
  nameGap: { width: spacing.sm },
  input: {
    backgroundColor: colors.background.subtle,
  },
  inputOutline: {
    borderRadius: borderRadius.md,
    borderColor: colors.border.light,
  },

  // ── Confirm summary
  confirmCard: {
    backgroundColor: colors.background.subtle,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  confirmTitle: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  confirmSub: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  confirmLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  confirmVal: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    maxWidth: '60%',
    textAlign: 'right',
  },

  // ── Nav buttons
  navRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  navBtn: {
    flex: 1,
    borderRadius: borderRadius.lg,
  },
  navBtnBack: {
    borderColor: colors.border.medium,
    flex: 0.4,
  },
  navBtnNext: {
    backgroundColor: colors.primary.main,
    flex: 1,
  },
  navBtnContent: { height: 48 },
  navBtnLabel: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    letterSpacing: 0.2,
  },

  // ── Sign in
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  loginLink: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.sm,
    color: colors.primary.main,
  },
});

export default React.memo(RegisterScreen);
