import React, { useEffect, useRef, createContext, useContext, useState, useCallback } from 'react';
import { StyleSheet, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, borderRadius, elevation } from '../constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastConfig {
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  showToast: (config: ToastConfig) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

// ─── Variant config ───────────────────────────────────────────────────────────

const VARIANT_CONFIG: Record<ToastVariant, { icon: string; bg: string; text: string }> = {
  success: { icon: 'check-circle', bg: colors.status.success, text: '#fff' },
  error:   { icon: 'alert-circle', bg: colors.status.error, text: '#fff' },
  warning: { icon: 'alert', bg: colors.status.warning, text: '#fff' },
  info:    { icon: 'information', bg: colors.status.info, text: '#fff' },
};

// ─── Toast view ───────────────────────────────────────────────────────────────

interface ToastViewProps {
  message: string;
  variant: ToastVariant;
  visible: boolean;
}

const ToastView: React.FC<ToastViewProps> = ({ message, variant, visible }) => {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-80)).current;
  const config = VARIANT_CONFIG[variant];

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: -80,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, translateY]);

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: config.bg, top: insets.top + spacing.sm, transform: [{ translateY }] },
      ]}
      pointerEvents="none"
    >
      <Icon source={config.icon} size={20} color={config.text} />
      <Text style={[styles.message, { color: config.text }]}>{message}</Text>
    </Animated.View>
  );
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(({ message, variant = 'info', duration = 3000 }: ToastConfig) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, variant });
    setVisible(true);
    timerRef.current = setTimeout(() => setVisible(false), duration);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <ToastView message={toast.message} variant={toast.variant} visible={visible} />
      )}
    </ToastContext.Provider>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.lg,
    zIndex: 9999,
    ...elevation.md,
  },
  message: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.sm,
    flex: 1,
    lineHeight: 20,
  },
});
