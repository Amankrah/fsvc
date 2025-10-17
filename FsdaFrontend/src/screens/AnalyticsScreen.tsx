import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  ActivityIndicator,
  Chip,
  SegmentedButtons,
  IconButton,
  Menu,
  Divider,
  Portal,
  Modal,
  List,
} from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { analyticsService } from '../services/analyticsService';

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

interface BasicStatistics {
  [key: string]: {
    count: number;
    mean: number;
    std: number;
    min: number;
    max: number;
    percentiles: {
      '25%': number;
      '50%': number;
      '75%': number;
    };
  };
}

const AnalyticsScreen: React.FC = () => {
  const navigation = useNavigation<AnalyticsScreenNavigationProp>();
  const route = useRoute<AnalyticsScreenRouteProp>();
  const { projectId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analysisSummary, setAnalysisSummary] = useState<AnalysisSummary | null>(null);
  const [basicStats, setBasicStats] = useState<BasicStatistics | null>(null);
  const [analysisView, setAnalysisView] = useState<string>('overview');
  const [menuVisible, setMenuVisible] = useState(false);
  const [analysisModalVisible, setAnalysisModalVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalyticsSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load data summary
      const summary = await analyticsService.getDataSummary(projectId);
      setAnalysisSummary(summary.data);

    } catch (err: any) {
      console.error('Error loading analytics summary:', err);
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadBasicStatistics = useCallback(async () => {
    try {
      const stats = await analyticsService.getBasicStatistics(projectId);
      if (stats.status === 'success' && stats.data?.results) {
        setBasicStats(stats.data.results);
      }
    } catch (err: any) {
      console.error('Error loading basic statistics:', err);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      loadAnalyticsSummary();
    }
  }, [projectId, loadAnalyticsSummary]);

  useEffect(() => {
    if (projectId && analysisView === 'statistics') {
      loadBasicStatistics();
    }
  }, [projectId, analysisView, loadBasicStatistics]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAnalyticsSummary();
    if (analysisView === 'statistics') {
      await loadBasicStatistics();
    }
    setRefreshing(false);
  }, [loadAnalyticsSummary, loadBasicStatistics, analysisView]);

  const runAnalysis = async (analysisType: string) => {
    try {
      setLoading(true);
      setAnalysisModalVisible(false);

      let result;
      switch (analysisType) {
        case 'basic':
          result = await analyticsService.getBasicStatistics(projectId);
          if (result.status === 'success') {
            setBasicStats(result.data.results);
            setAnalysisView('statistics');
          }
          break;
        case 'distributions':
          await analyticsService.getDistributions(projectId);
          break;
        case 'categorical':
          await analyticsService.getCategoricalAnalysis(projectId);
          break;
        case 'outliers':
          await analyticsService.getOutliers(projectId);
          break;
        case 'missing':
          await analyticsService.getMissingData(projectId);
          break;
        case 'quality':
          await analyticsService.getDataQuality(projectId);
          break;
        default:
          break;
      }
    } catch (err: any) {
      console.error(`Error running ${analysisType} analysis:`, err);
      setError(`Failed to run ${analysisType} analysis`);
    } finally {
      setLoading(false);
    }
  };

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
        {/* Summary Statistics */}
        <Card style={styles.card}>
          <Card.Title
            title="Data Overview"
            titleVariant="titleLarge"
            right={(props) => (
              <IconButton
                {...props}
                icon="refresh"
                onPress={onRefresh}
              />
            )}
          />
          <Card.Content>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={styles.statValue}>
                  {(summary?.total_responses || 0).toLocaleString()}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Total Responses
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={styles.statValue}>
                  {(summary?.unique_respondents || 0).toLocaleString()}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Respondents
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={styles.statValue}>
                  {(summary?.unique_questions || 0).toLocaleString()}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Questions
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={styles.statValue}>
                  {formatNumber(summary?.avg_quality_score, 1)}%
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Avg Quality
                </Text>
              </View>
            </View>

            <Divider style={styles.divider} />

            {/* Additional Metrics */}
            <View style={styles.metricsContainer}>
              <View style={styles.metricRow}>
                <Text variant="bodyMedium">Validation Rate:</Text>
                <Chip mode="flat" style={styles.metricChip}>
                  {formatNumber(summary?.validation_rate, 1)}%
                </Chip>
              </View>

              <View style={styles.metricRow}>
                <Text variant="bodyMedium">Location Coverage:</Text>
                <Chip mode="flat" style={styles.metricChip}>
                  {formatNumber(summary?.location_coverage, 1)}%
                </Chip>
              </View>

              {summary?.earliest_response && (
                <View style={styles.metricRow}>
                  <Text variant="bodyMedium">Collection Period:</Text>
                  <Text variant="bodySmall" style={styles.dateText}>
                    {new Date(summary.earliest_response).toLocaleDateString()} -{' '}
                    {summary.latest_response
                      ? new Date(summary.latest_response).toLocaleDateString()
                      : 'Present'}
                  </Text>
                </View>
              )}
            </View>
          </Card.Content>
        </Card>

        {/* Response Types Breakdown */}
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
      </>
    );
  };

  const renderStatistics = () => {
    if (!basicStats) {
      return (
        <Card style={styles.card}>
          <Card.Content>
            <ActivityIndicator size="small" />
            <Text variant="bodyMedium" style={styles.loadingText}>
              Loading statistics...
            </Text>
          </Card.Content>
        </Card>
      );
    }

    if (Object.keys(basicStats).length === 0) {
      return (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="bodyMedium" style={styles.loadingText}>
              No numeric variables found for statistical analysis.
            </Text>
          </Card.Content>
        </Card>
      );
    }

    return (
      <>
        {Object.entries(basicStats).map(([variable, stats]) => {
          if (!stats) return null;

          return (
            <Card key={variable} style={styles.card}>
              <Card.Title
                title={variable}
                titleVariant="titleMedium"
                subtitle={`${stats.count || 0} values`}
              />
              <Card.Content>
                <View style={styles.statsGrid}>
                  <View style={styles.statItem}>
                    <Text variant="titleMedium">{formatNumber(stats.mean)}</Text>
                    <Text variant="bodySmall" style={styles.statLabel}>
                      Mean
                    </Text>
                  </View>

                  <View style={styles.statItem}>
                    <Text variant="titleMedium">{formatNumber(stats.std)}</Text>
                    <Text variant="bodySmall" style={styles.statLabel}>
                      Std Dev
                    </Text>
                  </View>

                  <View style={styles.statItem}>
                    <Text variant="titleMedium">{formatNumber(stats.min)}</Text>
                    <Text variant="bodySmall" style={styles.statLabel}>
                      Min
                    </Text>
                  </View>

                  <View style={styles.statItem}>
                    <Text variant="titleMedium">{formatNumber(stats.max)}</Text>
                    <Text variant="bodySmall" style={styles.statLabel}>
                      Max
                    </Text>
                  </View>
                </View>

                <Divider style={styles.divider} />

                <Text variant="titleSmall" style={styles.percentileTitle}>
                  Percentiles
                </Text>
                <View style={styles.percentilesContainer}>
                  <View style={styles.percentileItem}>
                    <Text variant="bodySmall">25th</Text>
                    <Text variant="bodyMedium">
                      {formatNumber(stats.percentiles?.['25%'])}
                    </Text>
                  </View>
                  <View style={styles.percentileItem}>
                    <Text variant="bodySmall">50th (Median)</Text>
                    <Text variant="bodyMedium">
                      {formatNumber(stats.percentiles?.['50%'])}
                    </Text>
                  </View>
                  <View style={styles.percentileItem}>
                    <Text variant="bodySmall">75th</Text>
                    <Text variant="bodyMedium">
                      {formatNumber(stats.percentiles?.['75%'])}
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          );
        })}
      </>
    );
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
            Descriptive Statistics & Insights
          </Text>
        </View>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <IconButton
              icon="dots-vertical"
              onPress={() => setMenuVisible(true)}
            />
          }
        >
          <Menu.Item
            onPress={() => {
              setMenuVisible(false);
              setAnalysisModalVisible(true);
            }}
            title="Run Analysis"
            leadingIcon="chart-line"
          />
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
        value={analysisView}
        onValueChange={setAnalysisView}
        buttons={[
          {
            value: 'overview',
            label: 'Overview',
            icon: 'view-dashboard',
          },
          {
            value: 'statistics',
            label: 'Statistics',
            icon: 'chart-box',
          },
        ]}
        style={styles.segmentedButtons}
      />

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {analysisView === 'overview' ? renderOverview() : renderStatistics()}
      </ScrollView>

      {/* Analysis Modal */}
      <Portal>
        <Modal
          visible={analysisModalVisible}
          onDismiss={() => setAnalysisModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>
            Run Analysis
          </Text>
          <List.Section>
            <List.Item
              title="Basic Statistics"
              description="Mean, median, std deviation, percentiles"
              left={(props) => <List.Icon {...props} icon="chart-bar" />}
              onPress={() => runAnalysis('basic')}
            />
            <List.Item
              title="Distributions"
              description="Normality tests, skewness, kurtosis"
              left={(props) => <List.Icon {...props} icon="chart-bell-curve" />}
              onPress={() => runAnalysis('distributions')}
            />
            <List.Item
              title="Categorical Analysis"
              description="Frequency tables, chi-square tests"
              left={(props) => <List.Icon {...props} icon="chart-pie" />}
              onPress={() => runAnalysis('categorical')}
            />
            <List.Item
              title="Outlier Detection"
              description="IQR, Z-score, isolation forest methods"
              left={(props) => <List.Icon {...props} icon="chart-scatter-plot" />}
              onPress={() => runAnalysis('outliers')}
            />
            <List.Item
              title="Missing Data"
              description="Patterns and correlations"
              left={(props) => <List.Icon {...props} icon="help-circle" />}
              onPress={() => runAnalysis('missing')}
            />
            <List.Item
              title="Data Quality"
              description="Completeness, consistency, validity"
              left={(props) => <List.Icon {...props} icon="shield-check" />}
              onPress={() => runAnalysis('quality')}
            />
          </List.Section>
          <Button
            mode="outlined"
            onPress={() => setAnalysisModalVisible(false)}
            style={styles.modalCloseButton}
          >
            Close
          </Button>
        </Modal>
      </Portal>
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statItem: {
    width: '48%',
    marginBottom: 16,
    alignItems: 'center',
  },
  statValue: {
    fontWeight: 'bold',
    color: '#6200ee',
  },
  statLabel: {
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
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
    marginBottom: 8,
  },
  metricChip: {
    backgroundColor: '#e3f2fd',
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
  percentileTitle: {
    marginBottom: 8,
  },
  percentilesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  percentileItem: {
    alignItems: 'center',
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
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
    maxHeight: '80%',
  },
  modalTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    marginTop: 16,
  },
});

export default React.memo(AnalyticsScreen);
