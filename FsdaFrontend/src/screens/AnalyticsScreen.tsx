import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import {
  Text,
  Card,
  ActivityIndicator,
  Chip,
  SegmentedButtons,
  IconButton,
  Menu,
  Divider,
  Button,
} from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { analyticsService } from '../services/analyticsService';
import {
  StatisticDisplay,
  StatisticsGrid,
} from '../components/analytics';
import CustomAnalyticsTab from '../components/analytics/CustomAnalyticsTab';

type AnalyticsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Analytics'>;
type AnalyticsScreenRouteProp = RouteProp<RootStackParamList, 'Analytics'>;

interface AnalyticsStats {
  total_responses: number;
  unique_respondents: number;
  unique_questions: number;
  response_types_count: number;
  earliest_response: string | null;
  latest_response: string | null;
  avg_quality_score: number;
  validated_responses: number;
  responses_with_location: number;
  validation_rate: number;
  location_coverage: number;
}

interface ResponseTypeBreakdown {
  display_name: string;
  data_type: string;
  count: number;
}

interface AnalysisSummary {
  summary: AnalyticsStats;
  response_types: ResponseTypeBreakdown[];
}

type AnalyticsView = 'overview' | 'custom';

const AnalyticsScreen: React.FC = () => {
  const navigation = useNavigation<AnalyticsScreenNavigationProp>();
  const route = useRoute<AnalyticsScreenRouteProp>();
  const { projectId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analysisSummary, setAnalysisSummary] = useState<AnalysisSummary | null>(null);
  const [analyticsView, setAnalyticsView] = useState<AnalyticsView>('overview');
  const [menuVisible, setMenuVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalyticsSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const summary = await analyticsService.getDataSummary(projectId);

      if (summary.status === 'success') {
        setAnalysisSummary(summary.data);
      } else {
        setError(summary.message || 'Failed to load analytics data');
      }
    } catch (err: any) {
      console.error('Error loading analytics summary:', err);
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      loadAnalyticsSummary();
    }
  }, [projectId, loadAnalyticsSummary]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAnalyticsSummary();
    setRefreshing(false);
  }, [loadAnalyticsSummary]);

  const formatNumber = (value: any, decimals: number = 2): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return 'N/A';
    }
    return typeof value === 'number' ? value.toFixed(decimals) : String(value);
  };

  const renderOverview = () => {
    if (!analysisSummary) {
      return (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="bodyMedium">No analytics data available</Text>
          </Card.Content>
        </Card>
      );
    }

    const { summary, response_types } = analysisSummary;

    return (
      <>
        <Card style={styles.card}>
          <Card.Title
            title="Data Overview"
            titleVariant="titleLarge"
            right={(props) => <IconButton {...props} icon="refresh" onPress={onRefresh} />}
          />
          <Card.Content>
            <StatisticsGrid>
              <StatisticDisplay
                label="Total Responses"
                value={(summary?.total_responses || 0).toLocaleString()}
                variant="highlight"
                color="#6200ee"
              />
              <StatisticDisplay
                label="Respondents"
                value={(summary?.unique_respondents || 0).toLocaleString()}
                variant="highlight"
                color="#2196f3"
              />
              <StatisticDisplay
                label="Questions"
                value={(summary?.unique_questions || 0).toLocaleString()}
                variant="highlight"
                color="#4caf50"
              />
              <StatisticDisplay
                label="Avg Quality"
                value={`${formatNumber(summary?.avg_quality_score, 1)}%`}
                variant="highlight"
                color="#ff9800"
              />
            </StatisticsGrid>

            <Divider style={styles.divider} />

            <View style={styles.metricsContainer}>
              <StatisticDisplay
                label="Validation Rate"
                value={`${formatNumber(summary?.validation_rate, 1)}%`}
                variant="chip"
                color="#e3f2fd"
              />
              <StatisticDisplay
                label="Location Coverage"
                value={`${formatNumber(summary?.location_coverage, 1)}%`}
                variant="chip"
                color="#e3f2fd"
              />
            </View>

            {summary?.earliest_response && (
              <View style={styles.metricRow}>
                <Text variant="bodyMedium">Collection Period:</Text>
                <Text variant="bodySmall" style={styles.dateText}>
                  {new Date(summary.earliest_response).toLocaleDateString()} -{' '}
                  {summary.latest_response ? new Date(summary.latest_response).toLocaleDateString() : 'Present'}
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {response_types && response_types.length > 0 && (
          <Card style={styles.card}>
            <Card.Title title="Response Types" titleVariant="titleMedium" />
            <Card.Content>
              {response_types.map((type, index) => (
                <View key={index} style={styles.responseTypeRow}>
                  <View style={styles.responseTypeInfo}>
                    <Text variant="bodyMedium">{type.display_name || 'Unknown'}</Text>
                    <Text variant="bodySmall" style={styles.dataTypeText}>
                      {type.data_type || 'unknown'}
                    </Text>
                  </View>
                  <Chip mode="outlined">{type.count || 0}</Chip>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        <Card style={styles.card}>
          <Card.Title title="Get Started" titleVariant="titleMedium" />
          <Card.Content>
            <Text variant="bodyMedium" style={styles.instructionText}>
              Ready to analyze your data? Use the Custom Analytics tab to run comprehensive statistical,
              inferential, and qualitative analyses with full control over methods and parameters.
            </Text>
            <Button
              mode="contained"
              icon="tune"
              onPress={() => setAnalyticsView('custom')}
              style={styles.actionButton}
            >
              Run Custom Analytics
            </Button>
          </Card.Content>
        </Card>
      </>
    );
  };

  const renderAnalyticsContent = () => {
    switch (analyticsView) {
      case 'custom':
        return <CustomAnalyticsTab projectId={projectId} />;
      case 'overview':
      default:
        return renderOverview();
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text variant="bodyLarge" style={styles.loadingText}>
          Loading Analytics...
        </Text>
      </View>
    );
  }

  if (error && !analysisSummary) {
    return (
      <View style={styles.centerContainer}>
        <Text variant="headlineSmall" style={styles.errorText}>
          Error Loading Analytics
        </Text>
        <Text variant="bodyMedium" style={styles.errorMessage}>
          {error}
        </Text>
        <Button mode="contained" onPress={loadAnalyticsSummary} style={styles.retryButton}>
          Retry
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text variant="headlineMedium" style={styles.title}>
            Analytics Dashboard
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Comprehensive Data Analysis
          </Text>
        </View>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={<IconButton icon="dots-vertical" onPress={() => setMenuVisible(true)} />}
        >
          <Menu.Item
            onPress={() => {
              setMenuVisible(false);
              onRefresh();
            }}
            title="Refresh Data"
            leadingIcon="refresh"
          />
          <Divider />
          <Menu.Item
            onPress={() => {
              setMenuVisible(false);
              navigation.goBack();
            }}
            title="Back"
            leadingIcon="arrow-left"
          />
        </Menu>
      </View>

      {/* View Selector */}
      <SegmentedButtons
        value={analyticsView}
        onValueChange={(value) => setAnalyticsView(value as AnalyticsView)}
        buttons={[
          {
            value: 'overview',
            label: 'Overview',
            icon: 'view-dashboard',
          },
          {
            value: 'custom',
            label: 'Analytics',
            icon: 'chart-box-outline',
          },
        ]}
        style={styles.segmentedButtons}
      />

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {renderAnalyticsContent()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    elevation: 2,
  },
  title: {
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#666',
    marginTop: 4,
  },
  segmentedButtons: {
    margin: 16,
  },
  instructionText: {
    marginBottom: 16,
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  divider: {
    marginVertical: 16,
  },
  metricsContainer: {
    gap: 12,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  dateText: {
    color: '#666',
    flex: 1,
    textAlign: 'right',
  },
  responseTypeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  responseTypeInfo: {
    flex: 1,
  },
  dataTypeText: {
    color: '#666',
    marginTop: 2,
  },
  actionButton: {
    marginTop: 8,
  },
  loadingText: {
    marginTop: 16,
    textAlign: 'center',
  },
  errorText: {
    color: '#d32f2f',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: {
    minWidth: 200,
  },
});

export default React.memo(AnalyticsScreen);
