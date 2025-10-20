import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, List, Portal, Modal, Button, Chip, Divider } from 'react-native-paper';
import { analyticsService } from '../../services/analyticsService';
import { AnalysisCard } from './AnalysisCard';
import { StatisticDisplay, StatisticsGrid } from './StatisticDisplay';

interface DescriptiveAnalyticsProps {
  projectId: string;
}

export const DescriptiveAnalytics: React.FC<DescriptiveAnalyticsProps> = ({ projectId }) => {
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [errors, setErrors] = useState<{ [key: string]: string | null }>({});
  const [results, setResults] = useState<{ [key: string]: any }>({});
  const [modalVisible, setModalVisible] = useState(false);

  const runAnalysis = useCallback(
    async (analysisType: string, analysisFn: () => Promise<any>) => {
      try {
        setLoading((prev) => ({ ...prev, [analysisType]: true }));
        setErrors((prev) => ({ ...prev, [analysisType]: null }));

        const response = await analysisFn();

        if (response.status === 'success') {
          setResults((prev) => ({ ...prev, [analysisType]: response.data }));
        } else {
          setErrors((prev) => ({ ...prev, [analysisType]: response.message || 'Analysis failed' }));
        }
      } catch (error: any) {
        setErrors((prev) => ({ ...prev, [analysisType]: error.message || 'An error occurred' }));
      } finally {
        setLoading((prev) => ({ ...prev, [analysisType]: false }));
      }
    },
    []
  );

  const renderBasicStatistics = () => {
    const data = results.basic_statistics?.results;
    if (!data) return null;

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {Object.entries(data).map(([variable, stats]: [string, any]) => (
          <View key={variable} style={styles.statsCard}>
            <Text variant="titleSmall" style={styles.variableName}>
              {variable}
            </Text>
            <Divider style={styles.divider} />
            <StatisticDisplay label="Count" value={stats.count || 0} />
            <StatisticDisplay label="Mean" value={(stats.mean || 0).toFixed(2)} />
            <StatisticDisplay label="Std Dev" value={(stats.std || 0).toFixed(2)} />
            <StatisticDisplay label="Min" value={(stats.min || 0).toFixed(2)} />
            <StatisticDisplay label="Max" value={(stats.max || 0).toFixed(2)} />
            <Text variant="labelSmall" style={styles.percentileLabel}>
              Percentiles
            </Text>
            <StatisticDisplay label="25%" value={(stats.percentiles?.['25%'] || 0).toFixed(2)} />
            <StatisticDisplay label="50%" value={(stats.percentiles?.['50%'] || 0).toFixed(2)} />
            <StatisticDisplay label="75%" value={(stats.percentiles?.['75%'] || 0).toFixed(2)} />
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderDistributions = () => {
    const data = results.distributions?.results;
    if (!data) return null;

    return (
      <View>
        {Object.entries(data).map(([variable, dist]: [string, any]) => (
          <View key={variable} style={styles.distributionItem}>
            <Text variant="titleSmall">{variable}</Text>
            <StatisticDisplay label="Skewness" value={(dist.skewness || 0).toFixed(3)} />
            <StatisticDisplay label="Kurtosis" value={(dist.kurtosis || 0).toFixed(3)} />
            {dist.normality_test && (
              <View style={styles.normalityTest}>
                <Chip
                  mode="outlined"
                  style={dist.normality_test.is_normal ? styles.normalChip : styles.notNormalChip}
                >
                  {dist.normality_test.is_normal ? 'Normal Distribution' : 'Non-Normal Distribution'}
                </Chip>
                <StatisticDisplay label="p-value" value={(dist.normality_test.p_value || 0).toFixed(4)} />
              </View>
            )}
            <Divider style={styles.divider} />
          </View>
        ))}
      </View>
    );
  };

  const renderCategorical = () => {
    const data = results.categorical?.results;
    if (!data) return null;

    return (
      <View>
        {Object.entries(data).map(([variable, catData]: [string, any]) => (
          <View key={variable} style={styles.categoricalItem}>
            <Text variant="titleSmall" style={styles.variableName}>
              {variable}
            </Text>
            <StatisticDisplay label="Unique Values" value={catData.unique_count || 0} variant="chip" />
            <StatisticDisplay label="Most Common" value={catData.most_common || 'N/A'} variant="chip" />
            {catData.frequency && (
              <View style={styles.frequencyList}>
                <Text variant="labelSmall" style={styles.frequencyLabel}>
                  Frequency Distribution:
                </Text>
                {Object.entries(catData.frequency)
                  .slice(0, 5)
                  .map(([value, count]: [string, any]) => (
                    <View key={value} style={styles.frequencyRow}>
                      <Text variant="bodySmall">{value}</Text>
                      <Chip mode="flat">{count}</Chip>
                    </View>
                  ))}
              </View>
            )}
            <Divider style={styles.divider} />
          </View>
        ))}
      </View>
    );
  };

  const renderOutliers = () => {
    const data = results.outliers?.results;
    if (!data) return null;

    return (
      <View>
        {Object.entries(data).map(([variable, outlierData]: [string, any]) => (
          <View key={variable} style={styles.outlierItem}>
            <Text variant="titleSmall" style={styles.variableName}>
              {variable}
            </Text>
            {Object.entries(outlierData.methods || {}).map(([method, methodData]: [string, any]) => (
              <View key={method} style={styles.outlierMethod}>
                <Text variant="labelMedium">{method.toUpperCase()}</Text>
                <StatisticDisplay
                  label="Outliers Detected"
                  value={methodData.outlier_count || 0}
                  variant="chip"
                  color={methodData.outlier_count > 0 ? '#ffebee' : '#e8f5e9'}
                />
                <StatisticDisplay label="Outlier %" value={`${(methodData.outlier_percentage || 0).toFixed(1)}%`} />
              </View>
            ))}
            <Divider style={styles.divider} />
          </View>
        ))}
      </View>
    );
  };

  const renderMissingData = () => {
    const data = results.missing_data?.results;
    if (!data) return null;

    return (
      <View>
        <StatisticsGrid>
          <StatisticDisplay
            label="Total Missing"
            value={data.total_missing || 0}
            variant="highlight"
            color="#ff6b6b"
          />
          <StatisticDisplay
            label="Missing %"
            value={`${(data.missing_percentage || 0).toFixed(1)}%`}
            variant="highlight"
            color="#ff6b6b"
          />
        </StatisticsGrid>
        <Divider style={styles.divider} />
        {data.missing_by_column && (
          <View>
            <Text variant="labelMedium" style={styles.sectionLabel}>
              Missing Values by Column:
            </Text>
            {Object.entries(data.missing_by_column)
              .filter(([_, count]: [string, any]) => count > 0)
              .map(([column, count]: [string, any]) => (
                <View key={column} style={styles.missingRow}>
                  <Text variant="bodySmall">{column}</Text>
                  <Chip mode="flat" style={styles.missingChip}>
                    {count}
                  </Chip>
                </View>
              ))}
          </View>
        )}
      </View>
    );
  };

  const renderDataQuality = () => {
    const data = results.data_quality?.results;
    if (!data) return null;

    return (
      <View>
        <StatisticsGrid>
          <StatisticDisplay
            label="Completeness"
            value={`${(data.completeness_score || 0).toFixed(1)}%`}
            variant="highlight"
            color="#4caf50"
          />
          <StatisticDisplay
            label="Validity"
            value={`${(data.validity_score || 0).toFixed(1)}%`}
            variant="highlight"
            color="#2196f3"
          />
          <StatisticDisplay
            label="Consistency"
            value={`${(data.consistency_score || 0).toFixed(1)}%`}
            variant="highlight"
            color="#ff9800"
          />
          <StatisticDisplay
            label="Overall Score"
            value={`${(data.overall_score || 0).toFixed(1)}%`}
            variant="highlight"
            color="#6200ee"
          />
        </StatisticsGrid>
        {data.issues && data.issues.length > 0 && (
          <View>
            <Divider style={styles.divider} />
            <Text variant="labelMedium" style={styles.sectionLabel}>
              Quality Issues:
            </Text>
            {data.issues.map((issue: string, index: number) => (
              <Text key={index} variant="bodySmall" style={styles.issueText}>
                • {issue}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <AnalysisCard
        title="Basic Statistics"
        subtitle="Descriptive statistics for numeric variables"
        icon="chart-bar"
        loading={loading.basic_statistics}
        error={errors.basic_statistics}
        onRun={() => runAnalysis('basic_statistics', () => analyticsService.getBasicStatistics(projectId))}
        showRunButton={!results.basic_statistics}
      >
        {renderBasicStatistics()}
      </AnalysisCard>

      <AnalysisCard
        title="Distributions"
        subtitle="Distribution analysis and normality tests"
        icon="chart-bell-curve"
        loading={loading.distributions}
        error={errors.distributions}
        onRun={() => runAnalysis('distributions', () => analyticsService.getDistributions(projectId))}
        showRunButton={!results.distributions}
      >
        {renderDistributions()}
      </AnalysisCard>

      <AnalysisCard
        title="Categorical Analysis"
        subtitle="Frequency analysis for categorical variables"
        icon="chart-pie"
        loading={loading.categorical}
        error={errors.categorical}
        onRun={() => runAnalysis('categorical', () => analyticsService.getCategoricalAnalysis(projectId))}
        showRunButton={!results.categorical}
      >
        {renderCategorical()}
      </AnalysisCard>

      <AnalysisCard
        title="Outlier Detection"
        subtitle="Detect outliers using multiple methods"
        icon="chart-scatter-plot"
        loading={loading.outliers}
        error={errors.outliers}
        onRun={() => runAnalysis('outliers', () => analyticsService.getOutliers(projectId))}
        showRunButton={!results.outliers}
      >
        {renderOutliers()}
      </AnalysisCard>

      <AnalysisCard
        title="Missing Data Analysis"
        subtitle="Analyze patterns in missing data"
        icon="help-circle"
        loading={loading.missing_data}
        error={errors.missing_data}
        onRun={() => runAnalysis('missing_data', () => analyticsService.getMissingData(projectId))}
        showRunButton={!results.missing_data}
      >
        {renderMissingData()}
      </AnalysisCard>

      <AnalysisCard
        title="Data Quality"
        subtitle="Assess data quality metrics"
        icon="shield-check"
        loading={loading.data_quality}
        error={errors.data_quality}
        onRun={() => runAnalysis('data_quality', () => analyticsService.getDataQuality(projectId))}
        showRunButton={!results.data_quality}
      >
        {renderDataQuality()}
      </AnalysisCard>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsCard: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginRight: 12,
    minWidth: 200,
  },
  variableName: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  divider: {
    marginVertical: 12,
  },
  percentileLabel: {
    marginTop: 8,
    marginBottom: 4,
    color: '#666',
  },
  distributionItem: {
    marginBottom: 16,
  },
  normalityTest: {
    marginTop: 8,
  },
  normalChip: {
    backgroundColor: '#e8f5e9',
    marginBottom: 8,
  },
  notNormalChip: {
    backgroundColor: '#ffebee',
    marginBottom: 8,
  },
  categoricalItem: {
    marginBottom: 16,
  },
  frequencyList: {
    marginTop: 8,
  },
  frequencyLabel: {
    marginBottom: 4,
    color: '#666',
  },
  frequencyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  outlierItem: {
    marginBottom: 16,
  },
  outlierMethod: {
    marginTop: 8,
    paddingLeft: 8,
  },
  missingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  missingChip: {
    backgroundColor: '#ffebee',
  },
  sectionLabel: {
    marginTop: 8,
    marginBottom: 8,
    color: '#666',
  },
  issueText: {
    marginLeft: 8,
    marginBottom: 4,
    color: '#666',
  },
});
