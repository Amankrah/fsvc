import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, ActivityIndicator, Snackbar } from 'react-native-paper';
import AnalyticsSelector, { AnalysisMethod } from './AnalyticsSelector';
import AnalysisResults from './AnalysisResults';
import { analyticsService } from '../../services/analyticsService';

interface CustomAnalyticsTabProps {
  projectId: string;
}

// Define available analysis methods
const AVAILABLE_METHODS: AnalysisMethod[] = [
  // Descriptive Analytics
  {
    id: 'basic_statistics',
    name: 'Basic Statistics',
    description: 'Calculate mean, median, mode, std dev, and quartiles for numeric variables',
    category: 'descriptive',
    requiresVariables: true,
  },
  {
    id: 'distributions',
    name: 'Distribution Analysis',
    description: 'Analyze distribution shape, normality, and fit probability distributions',
    category: 'descriptive',
    requiresVariables: true,
  },
  {
    id: 'categorical',
    name: 'Categorical Analysis',
    description: 'Frequency counts, percentages, and chi-square tests for categorical data',
    category: 'descriptive',
    requiresVariables: true,
  },
  {
    id: 'outliers',
    name: 'Outlier Detection',
    description: 'Identify outliers using IQR, Z-score, and isolation forest methods',
    category: 'descriptive',
    requiresVariables: true,
    parameters: [
      {
        name: 'methods',
        label: 'Detection Methods',
        type: 'multiselect',
        defaultValue: ['iqr', 'zscore'],
        options: [
          { label: 'IQR Method', value: 'iqr' },
          { label: 'Z-Score', value: 'zscore' },
          { label: 'Isolation Forest', value: 'isolation_forest' },
        ],
      },
    ],
  },
  {
    id: 'missing_data',
    name: 'Missing Data Analysis',
    description: 'Analyze patterns and extent of missing data',
    category: 'descriptive',
    requiresVariables: false,
  },
  {
    id: 'data_quality',
    name: 'Data Quality Assessment',
    description: 'Comprehensive data quality checks and validation',
    category: 'descriptive',
    requiresVariables: false,
  },

  // Inferential Analytics
  {
    id: 'correlation',
    name: 'Correlation Analysis',
    description: 'Calculate correlation coefficients between numeric variables',
    category: 'inferential',
    requiresVariables: true,
    parameters: [
      {
        name: 'correlation_method',
        label: 'Correlation Method',
        type: 'select',
        defaultValue: 'pearson',
        options: [
          { label: 'Pearson', value: 'pearson' },
          { label: 'Spearman', value: 'spearman' },
          { label: 'Kendall', value: 'kendall' },
        ],
      },
      {
        name: 'significance_level',
        label: 'Significance Level',
        type: 'number',
        defaultValue: 0.05,
        min: 0.01,
        max: 0.1,
      },
    ],
  },
  {
    id: 't_test',
    name: 'T-Test',
    description: 'Compare means between groups or against a population value',
    category: 'inferential',
    requiresVariables: true,
    parameters: [
      {
        name: 'test_type',
        label: 'Test Type',
        type: 'select',
        defaultValue: 'two_sample',
        options: [
          { label: 'One Sample', value: 'one_sample' },
          { label: 'Two Sample', value: 'two_sample' },
          { label: 'Paired', value: 'paired' },
        ],
      },
      {
        name: 'alternative',
        label: 'Alternative Hypothesis',
        type: 'select',
        defaultValue: 'two_sided',
        options: [
          { label: 'Two-Sided', value: 'two_sided' },
          { label: 'Greater', value: 'greater' },
          { label: 'Less', value: 'less' },
        ],
      },
      {
        name: 'confidence_level',
        label: 'Confidence Level',
        type: 'number',
        defaultValue: 0.95,
        min: 0.8,
        max: 0.99,
      },
    ],
  },
  {
    id: 'anova',
    name: 'ANOVA',
    description: 'Compare means across multiple groups',
    category: 'inferential',
    requiresVariables: true,
    parameters: [
      {
        name: 'anova_type',
        label: 'ANOVA Type',
        type: 'select',
        defaultValue: 'one_way',
        options: [
          { label: 'One-Way', value: 'one_way' },
          { label: 'Two-Way', value: 'two_way' },
        ],
      },
      {
        name: 'post_hoc',
        label: 'Run Post-Hoc Tests',
        type: 'boolean',
        defaultValue: true,
      },
      {
        name: 'post_hoc_method',
        label: 'Post-Hoc Method',
        type: 'select',
        defaultValue: 'tukey',
        options: [
          { label: 'Tukey HSD', value: 'tukey' },
          { label: 'Bonferroni', value: 'bonferroni' },
          { label: 'Scheffe', value: 'scheffe' },
        ],
      },
    ],
  },
  {
    id: 'regression',
    name: 'Regression Analysis',
    description: 'Model relationships between dependent and independent variables',
    category: 'inferential',
    requiresVariables: true,
    parameters: [
      {
        name: 'regression_type',
        label: 'Regression Type',
        type: 'select',
        defaultValue: 'linear',
        options: [
          { label: 'Linear', value: 'linear' },
          { label: 'Logistic', value: 'logistic' },
          { label: 'Polynomial', value: 'polynomial' },
        ],
      },
      {
        name: 'include_diagnostics',
        label: 'Include Diagnostics',
        type: 'boolean',
        defaultValue: true,
      },
      {
        name: 'confidence_level',
        label: 'Confidence Level',
        type: 'number',
        defaultValue: 0.95,
        min: 0.8,
        max: 0.99,
      },
    ],
  },
  {
    id: 'chi_square',
    name: 'Chi-Square Test',
    description: 'Test independence between categorical variables',
    category: 'inferential',
    requiresVariables: true,
    parameters: [
      {
        name: 'test_type',
        label: 'Test Type',
        type: 'select',
        defaultValue: 'independence',
        options: [
          { label: 'Independence', value: 'independence' },
          { label: 'Goodness of Fit', value: 'goodness_of_fit' },
        ],
      },
    ],
  },
  {
    id: 'nonparametric',
    name: 'Non-Parametric Tests',
    description: 'Distribution-free statistical tests (Mann-Whitney, Wilcoxon, etc.)',
    category: 'inferential',
    requiresVariables: true,
    parameters: [
      {
        name: 'test_type',
        label: 'Test Type',
        type: 'select',
        defaultValue: 'mann_whitney',
        options: [
          { label: 'Mann-Whitney U', value: 'mann_whitney' },
          { label: 'Wilcoxon Signed-Rank', value: 'wilcoxon' },
          { label: 'Kruskal-Wallis', value: 'kruskal_wallis' },
          { label: 'Friedman', value: 'friedman' },
        ],
      },
      {
        name: 'alternative',
        label: 'Alternative Hypothesis',
        type: 'select',
        defaultValue: 'two_sided',
        options: [
          { label: 'Two-Sided', value: 'two_sided' },
          { label: 'Greater', value: 'greater' },
          { label: 'Less', value: 'less' },
        ],
      },
    ],
  },

  // Qualitative Analytics
  {
    id: 'text_analysis',
    name: 'Text Analysis',
    description: 'Comprehensive analysis of text responses',
    category: 'qualitative',
    requiresVariables: true,
    parameters: [
      {
        name: 'analysis_type',
        label: 'Analysis Type',
        type: 'select',
        defaultValue: 'comprehensive',
        options: [
          { label: 'Comprehensive', value: 'comprehensive' },
          { label: 'Basic', value: 'basic' },
        ],
      },
    ],
  },
  {
    id: 'sentiment',
    name: 'Sentiment Analysis',
    description: 'Analyze emotional tone and sentiment in text responses',
    category: 'qualitative',
    requiresVariables: true,
    parameters: [
      {
        name: 'sentiment_method',
        label: 'Sentiment Method',
        type: 'select',
        defaultValue: 'vader',
        options: [
          { label: 'VADER', value: 'vader' },
          { label: 'TextBlob', value: 'textblob' },
        ],
      },
    ],
  },
  {
    id: 'themes',
    name: 'Theme Analysis',
    description: 'Identify and extract themes from text responses',
    category: 'qualitative',
    requiresVariables: true,
    parameters: [
      {
        name: 'num_themes',
        label: 'Number of Themes',
        type: 'number',
        defaultValue: 5,
        min: 2,
        max: 15,
      },
      {
        name: 'theme_method',
        label: 'Theme Method',
        type: 'select',
        defaultValue: 'lda',
        options: [
          { label: 'LDA (Topic Modeling)', value: 'lda' },
          { label: 'Clustering', value: 'clustering' },
        ],
      },
    ],
  },
  {
    id: 'word_frequency',
    name: 'Word Frequency',
    description: 'Analyze most common words and phrases in text responses',
    category: 'qualitative',
    requiresVariables: true,
    parameters: [
      {
        name: 'top_n',
        label: 'Top N Words',
        type: 'number',
        defaultValue: 50,
        min: 10,
        max: 200,
      },
      {
        name: 'min_word_length',
        label: 'Minimum Word Length',
        type: 'number',
        defaultValue: 3,
        min: 2,
        max: 10,
      },
      {
        name: 'remove_stopwords',
        label: 'Remove Stopwords',
        type: 'boolean',
        defaultValue: true,
      },
    ],
  },
  {
    id: 'content_analysis',
    name: 'Content Analysis',
    description: 'Systematic coding and categorization of content',
    category: 'qualitative',
    requiresVariables: true,
    parameters: [
      {
        name: 'analysis_framework',
        label: 'Analysis Framework',
        type: 'select',
        defaultValue: 'inductive',
        options: [
          { label: 'Inductive', value: 'inductive' },
          { label: 'Deductive', value: 'deductive' },
        ],
      },
    ],
  },
  {
    id: 'qualitative_coding',
    name: 'Qualitative Coding',
    description: 'Code and categorize qualitative data systematically',
    category: 'qualitative',
    requiresVariables: true,
    parameters: [
      {
        name: 'coding_method',
        label: 'Coding Method',
        type: 'select',
        defaultValue: 'open',
        options: [
          { label: 'Open Coding', value: 'open' },
          { label: 'Axial Coding', value: 'axial' },
          { label: 'Selective Coding', value: 'selective' },
        ],
      },
      {
        name: 'auto_code',
        label: 'Auto-Code',
        type: 'boolean',
        defaultValue: true,
      },
    ],
  },
];

const CustomAnalyticsTab: React.FC<CustomAnalyticsTabProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(false);
  const [availableVariables, setAvailableVariables] = useState<string[]>([]);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [selectedMethodName, setSelectedMethodName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  useEffect(() => {
    loadAvailableVariables();
  }, [projectId]);

  const loadAvailableVariables = async () => {
    try {
      // Fetch data summary to get available variables
      const summary = await analyticsService.getDataSummary(projectId);
      if (summary.status === 'success' && summary.data.response_types) {
        const variables = summary.data.response_types.map(
          (rt: any) => rt.display_name || rt.question_text || 'Unknown'
        );
        setAvailableVariables(variables);
      }
    } catch (err: any) {
      console.error('Error loading variables:', err);
      setError('Failed to load available variables');
    }
  };

  const handleRunAnalysis = async (
    methodId: string,
    selectedVariables: string[],
    parameters: any
  ) => {
    try {
      setLoading(true);
      setError(null);

      const method = AVAILABLE_METHODS.find((m) => m.id === methodId);
      if (!method) throw new Error('Invalid method');

      setSelectedMethodName(method.name);

      let result;

      // Call appropriate service method based on analysis type
      switch (methodId) {
        case 'basic_statistics':
          result = await analyticsService.getBasicStatistics(projectId, selectedVariables);
          break;
        case 'distributions':
          result = await analyticsService.getDistributions(projectId, selectedVariables);
          break;
        case 'categorical':
          result = await analyticsService.getCategoricalAnalysis(projectId, selectedVariables);
          break;
        case 'outliers':
          result = await analyticsService.getOutliers(
            projectId,
            selectedVariables,
            parameters.methods
          );
          break;
        case 'missing_data':
          result = await analyticsService.getMissingData(projectId);
          break;
        case 'data_quality':
          result = await analyticsService.getDataQuality(projectId);
          break;
        case 'correlation':
          result = await analyticsService.runCorrelationAnalysis(
            projectId,
            selectedVariables,
            parameters.correlation_method,
            parameters.significance_level
          );
          break;
        case 't_test':
          result = await analyticsService.runTTest(
            projectId,
            selectedVariables[0],
            selectedVariables[1],
            parameters.test_type,
            parameters.alternative,
            parameters.confidence_level
          );
          break;
        case 'anova':
          result = await analyticsService.runANOVA(
            projectId,
            selectedVariables[0],
            selectedVariables.slice(1),
            parameters.anova_type,
            parameters.post_hoc,
            parameters.post_hoc_method
          );
          break;
        case 'regression':
          result = await analyticsService.runRegression(
            projectId,
            selectedVariables[0],
            selectedVariables.slice(1),
            parameters.regression_type,
            parameters.include_diagnostics,
            parameters.confidence_level
          );
          break;
        case 'chi_square':
          result = await analyticsService.runChiSquare(
            projectId,
            selectedVariables[0],
            selectedVariables[1],
            parameters.test_type
          );
          break;
        case 'nonparametric':
          result = await analyticsService.runNonParametricTest(
            projectId,
            parameters.test_type,
            selectedVariables,
            undefined,
            parameters.alternative
          );
          break;
        case 'text_analysis':
          result = await analyticsService.runTextAnalysis(
            projectId,
            selectedVariables,
            parameters.analysis_type
          );
          break;
        case 'sentiment':
          result = await analyticsService.runSentimentAnalysis(
            projectId,
            selectedVariables,
            parameters.sentiment_method
          );
          break;
        case 'themes':
          result = await analyticsService.runThemeAnalysis(
            projectId,
            selectedVariables,
            parameters.num_themes,
            parameters.theme_method
          );
          break;
        case 'word_frequency':
          result = await analyticsService.runWordFrequencyAnalysis(
            projectId,
            selectedVariables,
            parameters.top_n,
            parameters.min_word_length,
            parameters.remove_stopwords
          );
          break;
        case 'content_analysis':
          result = await analyticsService.runContentAnalysis(
            projectId,
            selectedVariables,
            parameters.analysis_framework
          );
          break;
        case 'qualitative_coding':
          result = await analyticsService.runQualitativeCoding(
            projectId,
            selectedVariables,
            parameters.coding_method,
            parameters.auto_code
          );
          break;
        default:
          throw new Error('Unknown analysis method');
      }

      if (result.status === 'success') {
        setAnalysisResults(result.data);
        setSnackbarVisible(true);
      } else {
        setError(result.message || 'Analysis failed');
      }
    } catch (err: any) {
      console.error('Error running analysis:', err);
      setError(err.message || 'Failed to run analysis');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseResults = () => {
    setAnalysisResults(null);
    setSelectedMethodName('');
  };

  if (analysisResults) {
    return (
      <View style={styles.container}>
        <AnalysisResults
          results={analysisResults}
          methodName={selectedMethodName}
          timestamp={new Date().toISOString()}
          onClose={handleCloseResults}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text variant="titleLarge" style={styles.headerTitle}>
            Custom Analytics
          </Text>
          <Text variant="bodyMedium" style={styles.headerSubtitle}>
            Select an analysis method and configure parameters to run custom analytics
          </Text>
        </View>

        <AnalyticsSelector
          availableMethods={AVAILABLE_METHODS}
          availableVariables={availableVariables}
          onRunAnalysis={handleRunAnalysis}
          loading={loading}
        />

        {error && (
          <Text variant="bodyMedium" style={styles.errorText}>
            {error}
          </Text>
        )}
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: 'Close',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        Analysis completed successfully!
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  headerSubtitle: {
    color: '#666',
  },
  errorText: {
    color: '#d32f2f',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#ffebee',
    borderRadius: 4,
  },
});

export default CustomAnalyticsTab;
