import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Portal, Modal, Button, Chip, Divider, TextInput, List } from 'react-native-paper';
import { analyticsService } from '../../services/analyticsService';
import { AnalysisCard } from './AnalysisCard';
import { StatisticDisplay, StatisticsGrid } from './StatisticDisplay';

interface InferentialAnalyticsProps {
  projectId: string;
}

export const InferentialAnalytics: React.FC<InferentialAnalyticsProps> = ({ projectId }) => {
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [errors, setErrors] = useState<{ [key: string]: string | null }>({});
  const [results, setResults] = useState<{ [key: string]: any }>({});
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<string | null>(null);

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

  const renderCorrelationResults = () => {
    const data = results.correlation?.results;
    if (!data) return null;

    return (
      <View>
        <Text variant="titleSmall" style={styles.sectionTitle}>
          Correlation Matrix
        </Text>
        {data.correlation_matrix && (
          <ScrollView horizontal>
            <View style={styles.matrixContainer}>
              {Object.entries(data.correlation_matrix).map(([var1, correlations]: [string, any]) => (
                <View key={var1} style={styles.matrixRow}>
                  <Text variant="bodySmall" style={styles.matrixLabel}>
                    {var1}
                  </Text>
                  {Object.entries(correlations).map(([var2, corr]: [string, any]) => (
                    <View
                      key={`${var1}-${var2}`}
                      style={[
                        styles.matrixCell,
                        {
                          backgroundColor:
                            Math.abs(corr) > 0.7
                              ? '#e3f2fd'
                              : Math.abs(corr) > 0.4
                              ? '#f3e5f5'
                              : '#f5f5f5',
                        },
                      ]}
                    >
                      <Text variant="bodySmall">{(corr || 0).toFixed(2)}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        )}
        {data.significant_correlations && (
          <View style={styles.significantCorr}>
            <Text variant="labelMedium">Significant Correlations (p {'<'} 0.05):</Text>
            {data.significant_correlations.map((item: any, index: number) => (
              <Chip key={index} mode="outlined" style={styles.corrChip}>
                {item.var1} ↔ {item.var2}: {item.correlation.toFixed(3)}
              </Chip>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderTTestResults = () => {
    const data = results.t_test?.results;
    if (!data) return null;

    return (
      <View>
        <StatisticsGrid>
          <StatisticDisplay label="t-statistic" value={(data.t_statistic || 0).toFixed(4)} variant="highlight" />
          <StatisticDisplay label="p-value" value={(data.p_value || 0).toFixed(4)} variant="highlight" />
        </StatisticsGrid>
        <Divider style={styles.divider} />
        <StatisticDisplay
          label="Result"
          value={data.significant ? 'Statistically Significant' : 'Not Significant'}
          variant="chip"
          color={data.significant ? '#e8f5e9' : '#ffebee'}
        />
        {data.confidence_interval && (
          <View style={styles.ciContainer}>
            <Text variant="labelMedium">95% Confidence Interval:</Text>
            <Text variant="bodyMedium">
              [{(data.confidence_interval.lower || 0).toFixed(3)}, {(data.confidence_interval.upper || 0).toFixed(3)}]
            </Text>
          </View>
        )}
        {data.effect_size && (
          <StatisticDisplay label="Cohen's d (Effect Size)" value={(data.effect_size || 0).toFixed(3)} />
        )}
      </View>
    );
  };

  const renderANOVAResults = () => {
    const data = results.anova?.results;
    if (!data) return null;

    return (
      <View>
        <StatisticsGrid>
          <StatisticDisplay label="F-statistic" value={(data.f_statistic || 0).toFixed(4)} variant="highlight" />
          <StatisticDisplay label="p-value" value={(data.p_value || 0).toFixed(4)} variant="highlight" />
        </StatisticsGrid>
        <Divider style={styles.divider} />
        <StatisticDisplay
          label="Result"
          value={data.significant ? 'Statistically Significant' : 'Not Significant'}
          variant="chip"
          color={data.significant ? '#e8f5e9' : '#ffebee'}
        />
        {data.eta_squared && <StatisticDisplay label="Eta Squared (η²)" value={(data.eta_squared || 0).toFixed(3)} />}
        {data.post_hoc_results && (
          <View style={styles.postHocContainer}>
            <Text variant="labelMedium" style={styles.postHocTitle}>
              Post-Hoc Comparisons:
            </Text>
            {data.post_hoc_results.map((comparison: any, index: number) => (
              <View key={index} style={styles.postHocItem}>
                <Text variant="bodySmall">
                  {comparison.group1} vs {comparison.group2}
                </Text>
                <Chip mode="flat" style={comparison.significant ? styles.sigChip : styles.notSigChip}>
                  p = {(comparison.p_value || 0).toFixed(4)}
                </Chip>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderRegressionResults = () => {
    const data = results.regression?.results;
    if (!data) return null;

    return (
      <View>
        <StatisticsGrid>
          <StatisticDisplay label="R²" value={(data.r_squared || 0).toFixed(4)} variant="highlight" color="#2196f3" />
          <StatisticDisplay
            label="Adjusted R²"
            value={(data.adjusted_r_squared || 0).toFixed(4)}
            variant="highlight"
            color="#4caf50"
          />
        </StatisticsGrid>
        <Divider style={styles.divider} />
        <Text variant="labelMedium" style={styles.coefficientsTitle}>
          Coefficients:
        </Text>
        {data.coefficients &&
          Object.entries(data.coefficients).map(([variable, coef]: [string, any]) => (
            <View key={variable} style={styles.coefficientRow}>
              <Text variant="bodySmall" style={styles.coefficientVar}>
                {variable}
              </Text>
              <View style={styles.coefficientStats}>
                <Text variant="bodySmall">β = {(coef.coefficient || 0).toFixed(4)}</Text>
                <Chip
                  mode="flat"
                  style={coef.p_value < 0.05 ? styles.sigChip : styles.notSigChip}
                  textStyle={{ fontSize: 11 }}
                >
                  p = {(coef.p_value || 0).toFixed(4)}
                </Chip>
              </View>
            </View>
          ))}
        {data.f_statistic && (
          <View style={styles.modelFit}>
            <Divider style={styles.divider} />
            <Text variant="labelMedium">Model Fit:</Text>
            <StatisticDisplay label="F-statistic" value={(data.f_statistic || 0).toFixed(3)} />
            <StatisticDisplay label="p-value" value={(data.f_p_value || 0).toFixed(4)} />
          </View>
        )}
      </View>
    );
  };

  const renderChiSquareResults = () => {
    const data = results.chi_square?.results;
    if (!data) return null;

    return (
      <View>
        <StatisticsGrid>
          <StatisticDisplay label="χ² statistic" value={(data.chi2_statistic || 0).toFixed(4)} variant="highlight" />
          <StatisticDisplay label="p-value" value={(data.p_value || 0).toFixed(4)} variant="highlight" />
          <StatisticDisplay label="Degrees of Freedom" value={data.degrees_of_freedom || 0} variant="highlight" />
        </StatisticsGrid>
        <Divider style={styles.divider} />
        <StatisticDisplay
          label="Result"
          value={data.significant ? 'Statistically Significant' : 'Not Significant'}
          variant="chip"
          color={data.significant ? '#e8f5e9' : '#ffebee'}
        />
        {data.cramers_v && (
          <StatisticDisplay label="Cramér's V (Effect Size)" value={(data.cramers_v || 0).toFixed(3)} />
        )}
        {data.contingency_table && (
          <View style={styles.contingencyContainer}>
            <Text variant="labelMedium" style={styles.tableTitle}>
              Contingency Table:
            </Text>
            <Text variant="bodySmall" style={styles.tableNote}>
              (Observed frequencies)
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderNonParametricResults = () => {
    const data = results.nonparametric?.results;
    if (!data) return null;

    return (
      <View>
        <StatisticsGrid>
          <StatisticDisplay label="Test Statistic" value={(data.test_statistic || 0).toFixed(4)} variant="highlight" />
          <StatisticDisplay label="p-value" value={(data.p_value || 0).toFixed(4)} variant="highlight" />
        </StatisticsGrid>
        <Divider style={styles.divider} />
        <StatisticDisplay
          label="Result"
          value={data.significant ? 'Statistically Significant' : 'Not Significant'}
          variant="chip"
          color={data.significant ? '#e8f5e9' : '#ffebee'}
        />
        <StatisticDisplay label="Test Type" value={data.test_type || 'N/A'} variant="chip" />
        {data.interpretation && (
          <View style={styles.interpretation}>
            <Text variant="labelMedium">Interpretation:</Text>
            <Text variant="bodySmall" style={styles.interpretationText}>
              {data.interpretation}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <AnalysisCard
        title="Correlation Analysis"
        subtitle="Analyze relationships between variables"
        icon="chart-line"
        loading={loading.correlation}
        error={errors.correlation}
        onRun={() =>
          runAnalysis('correlation', () => analyticsService.runCorrelationAnalysis(projectId, undefined, 'pearson'))
        }
        showRunButton={!results.correlation}
      >
        {renderCorrelationResults()}
      </AnalysisCard>

      <AnalysisCard
        title="T-Test"
        subtitle="Compare means between groups"
        icon="chart-box"
        loading={loading.t_test}
        error={errors.t_test}
        runButtonLabel="Configure & Run"
        showRunButton={!results.t_test}
      >
        {results.t_test ? (
          renderTTestResults()
        ) : (
          <Text variant="bodySmall" style={styles.configNote}>
            Configure variables to run t-test analysis
          </Text>
        )}
      </AnalysisCard>

      <AnalysisCard
        title="ANOVA"
        subtitle="Analysis of variance for multiple groups"
        icon="chart-box-outline"
        loading={loading.anova}
        error={errors.anova}
        runButtonLabel="Configure & Run"
        showRunButton={!results.anova}
      >
        {results.anova ? (
          renderANOVAResults()
        ) : (
          <Text variant="bodySmall" style={styles.configNote}>
            Configure variables to run ANOVA analysis
          </Text>
        )}
      </AnalysisCard>

      <AnalysisCard
        title="Regression Analysis"
        subtitle="Linear and multiple regression"
        icon="trending-up"
        loading={loading.regression}
        error={errors.regression}
        runButtonLabel="Configure & Run"
        showRunButton={!results.regression}
      >
        {results.regression ? (
          renderRegressionResults()
        ) : (
          <Text variant="bodySmall" style={styles.configNote}>
            Configure variables to run regression analysis
          </Text>
        )}
      </AnalysisCard>

      <AnalysisCard
        title="Chi-Square Test"
        subtitle="Test independence in categorical data"
        icon="table"
        loading={loading.chi_square}
        error={errors.chi_square}
        runButtonLabel="Configure & Run"
        showRunButton={!results.chi_square}
      >
        {results.chi_square ? (
          renderChiSquareResults()
        ) : (
          <Text variant="bodySmall" style={styles.configNote}>
            Configure variables to run chi-square test
          </Text>
        )}
      </AnalysisCard>

      <AnalysisCard
        title="Non-Parametric Tests"
        subtitle="Mann-Whitney, Wilcoxon, Kruskal-Wallis"
        icon="chart-timeline"
        loading={loading.nonparametric}
        error={errors.nonparametric}
        runButtonLabel="Configure & Run"
        showRunButton={!results.nonparametric}
      >
        {results.nonparametric ? (
          renderNonParametricResults()
        ) : (
          <Text variant="bodySmall" style={styles.configNote}>
            Configure test type and variables to run non-parametric tests
          </Text>
        )}
      </AnalysisCard>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  matrixContainer: {
    padding: 8,
  },
  matrixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  matrixLabel: {
    width: 80,
    fontWeight: '500',
  },
  matrixCell: {
    padding: 8,
    marginHorizontal: 2,
    borderRadius: 4,
    minWidth: 50,
    alignItems: 'center',
  },
  significantCorr: {
    marginTop: 16,
  },
  corrChip: {
    marginTop: 8,
  },
  divider: {
    marginVertical: 12,
  },
  ciContainer: {
    marginTop: 12,
  },
  postHocContainer: {
    marginTop: 16,
  },
  postHocTitle: {
    marginBottom: 8,
  },
  postHocItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sigChip: {
    backgroundColor: '#e8f5e9',
  },
  notSigChip: {
    backgroundColor: '#ffebee',
  },
  coefficientsTitle: {
    marginBottom: 8,
  },
  coefficientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  coefficientVar: {
    fontWeight: '500',
    flex: 1,
  },
  coefficientStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modelFit: {
    marginTop: 8,
  },
  contingencyContainer: {
    marginTop: 12,
  },
  tableTitle: {
    marginBottom: 4,
  },
  tableNote: {
    color: '#666',
    fontStyle: 'italic',
  },
  interpretation: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  interpretationText: {
    marginTop: 4,
    color: '#666',
  },
  configNote: {
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
});
