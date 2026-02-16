import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Button, ActivityIndicator, IconButton } from 'react-native-paper';
import { colors } from '../../constants/theme';

interface AnalysisCardProps {
  title: string;
  subtitle?: string;
  icon?: string;
  loading?: boolean;
  error?: string | null;
  onRun?: () => void;
  onRefresh?: () => void;
  children?: React.ReactNode;
  runButtonLabel?: string;
  showRunButton?: boolean;
}

export const AnalysisCard: React.FC<AnalysisCardProps> = ({
  title,
  subtitle,
  icon,
  loading = false,
  error = null,
  onRun,
  onRefresh,
  children,
  runButtonLabel = 'Run Analysis',
  showRunButton = true,
}) => {
  return (
    <Card style={styles.card}>
      <Card.Title
        title={title}
        subtitle={subtitle}
        titleVariant="titleMedium"
        left={icon ? (props) => <IconButton {...props} icon={icon} /> : undefined}
        right={
          onRefresh
            ? (props) => <IconButton {...props} icon="refresh" onPress={onRefresh} disabled={loading} />
            : undefined
        }
      />
      <Card.Content>
        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" />
            <Text variant="bodyMedium" style={styles.loadingText}>
              Running analysis...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text variant="bodyMedium" style={styles.errorText}>
              {error}
            </Text>
            {onRun && (
              <Button mode="outlined" onPress={onRun} style={styles.retryButton}>
                Retry
              </Button>
            )}
          </View>
        ) : (
          children
        )}
      </Card.Content>
      {showRunButton && onRun && !loading && !children && (
        <Card.Actions>
          <Button mode="contained" onPress={onRun}>
            {runButtonLabel}
          </Button>
        </Card.Actions>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  centerContent: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  loadingText: {
    marginTop: 12,
    color: colors.text.secondary,
  },
  errorContainer: {
    paddingVertical: 16,
  },
  errorText: {
    color: colors.status.error,
    marginBottom: 12,
  },
  retryButton: {
    alignSelf: 'flex-start',
  },
});
