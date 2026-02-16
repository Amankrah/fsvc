import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Chip, Divider, List } from 'react-native-paper';
import { analyticsService } from '../../services/analyticsService';
import { AnalysisCard } from './AnalysisCard';
import { StatisticDisplay, StatisticsGrid } from './StatisticDisplay';
import { colors } from '../../constants/theme';

interface QualitativeAnalyticsProps {
  projectId: string;
}

export const QualitativeAnalytics: React.FC<QualitativeAnalyticsProps> = ({ projectId }) => {
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [errors, setErrors] = useState<{ [key: string]: string | null }>({});
  const [results, setResults] = useState<{ [key: string]: any }>({});

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

  const renderTextAnalysis = () => {
    const data = results.text_analysis?.results;
    if (!data) return null;

    return (
      <View>
        {Object.entries(data).map(([field, analysis]: [string, any]) => (
          <View key={field} style={styles.fieldContainer}>
            <Text variant="titleSmall" style={styles.fieldName}>
              {field}
            </Text>
            <StatisticsGrid>
              <StatisticDisplay label="Total Texts" value={analysis.total_texts || 0} variant="highlight" />
              <StatisticDisplay label="Avg Length" value={(analysis.avg_length || 0).toFixed(0)} variant="highlight" />
              <StatisticDisplay label="Total Words" value={analysis.total_words || 0} variant="highlight" />
              <StatisticDisplay
                label="Unique Words"
                value={analysis.unique_words || 0}
                variant="highlight"
                color={colors.status.warning}
              />
            </StatisticsGrid>
            <Divider style={styles.divider} />
            {analysis.readability_score && (
              <StatisticDisplay
                label="Readability Score"
                value={(analysis.readability_score || 0).toFixed(2)}
                variant="chip"
                color={colors.primary.faint}
              />
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderSentimentAnalysis = () => {
    const data = results.sentiment?.results;
    if (!data) return null;

    const getSentimentColor = (sentiment: string) => {
      switch (sentiment?.toLowerCase()) {
        case 'positive':
          return 'rgba(16, 185, 129, 0.15)';
        case 'negative':
          return 'rgba(239, 68, 68, 0.15)';
        case 'neutral':
          return colors.background.subtle;
        default:
          return 'rgba(245, 158, 11, 0.15)';
      }
    };

    return (
      <View>
        {Object.entries(data).map(([field, sentimentData]: [string, any]) => (
          <View key={field} style={styles.fieldContainer}>
            <Text variant="titleSmall" style={styles.fieldName}>
              {field}
            </Text>
            <StatisticsGrid>
              <StatisticDisplay
                label="Avg Sentiment"
                value={(sentimentData.average_sentiment || 0).toFixed(3)}
                variant="highlight"
                color={colors.status.info}
              />
              <StatisticDisplay
                label="Dominant Sentiment"
                value={sentimentData.dominant_sentiment || 'N/A'}
                variant="highlight"
                color={colors.status.success}
              />
            </StatisticsGrid>
            <Divider style={styles.divider} />
            <Text variant="labelMedium" style={styles.sectionLabel}>
              Sentiment Distribution:
            </Text>
            <View style={styles.sentimentDistribution}>
              {sentimentData.sentiment_distribution &&
                Object.entries(sentimentData.sentiment_distribution).map(([sentiment, count]: [string, any]) => (
                  <Chip
                    key={sentiment}
                    mode="flat"
                    style={[styles.sentimentChip, { backgroundColor: getSentimentColor(sentiment) }]}
                  >
                    {sentiment}: {count}
                  </Chip>
                ))}
            </View>
            {sentimentData.sample_texts && (
              <View style={styles.sampleTexts}>
                <Text variant="labelMedium" style={styles.sectionLabel}>
                  Sample Texts:
                </Text>
                {sentimentData.sample_texts.slice(0, 3).map((sample: any, index: number) => (
                  <View key={index} style={styles.sampleItem}>
                    <Chip
                      mode="outlined"
                      compact
                      style={{ backgroundColor: getSentimentColor(sample.sentiment) }}
                    >
                      {sample.sentiment}
                    </Chip>
                    <Text variant="bodySmall" style={styles.sampleText}>
                      {sample.text}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderThemeAnalysis = () => {
    const data = results.themes?.results;
    if (!data) return null;

    return (
      <View>
        {Object.entries(data).map(([field, themeData]: [string, any]) => (
          <View key={field} style={styles.fieldContainer}>
            <Text variant="titleSmall" style={styles.fieldName}>
              {field}
            </Text>
            <StatisticDisplay label="Themes Identified" value={themeData.num_themes || 0} variant="chip" />
            <Divider style={styles.divider} />
            {themeData.themes &&
              themeData.themes.map((theme: any, index: number) => (
                <View key={index} style={styles.themeItem}>
                  <View style={styles.themeHeader}>
                    <Text variant="labelLarge">Theme {index + 1}</Text>
                    {theme.prevalence && (
                      <Chip mode="flat" compact>
                        {(theme.prevalence * 100).toFixed(1)}%
                      </Chip>
                    )}
                  </View>
                  <View style={styles.keywordsContainer}>
                    {theme.keywords &&
                      theme.keywords.slice(0, 8).map((keyword: string, kIndex: number) => (
                        <Chip key={kIndex} mode="outlined" compact style={styles.keywordChip}>
                          {keyword}
                        </Chip>
                      ))}
                  </View>
                  {theme.description && (
                    <Text variant="bodySmall" style={styles.themeDescription}>
                      {theme.description}
                    </Text>
                  )}
                </View>
              ))}
          </View>
        ))}
      </View>
    );
  };

  const renderWordFrequency = () => {
    const data = results.word_frequency?.results;
    if (!data) return null;

    return (
      <View>
        {Object.entries(data).map(([field, freqData]: [string, any]) => (
          <View key={field} style={styles.fieldContainer}>
            <Text variant="titleSmall" style={styles.fieldName}>
              {field}
            </Text>
            <Text variant="labelMedium" style={styles.sectionLabel}>
              Top Words:
            </Text>
            <View style={styles.wordFrequencyList}>
              {freqData.top_words &&
                freqData.top_words.slice(0, 20).map((item: any, index: number) => (
                  <View key={index} style={styles.wordFrequencyItem}>
                    <Text variant="bodySmall" style={styles.wordText}>
                      {index + 1}. {item.word}
                    </Text>
                    <Chip mode="flat" compact>
                      {item.count}
                    </Chip>
                  </View>
                ))}
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderContentAnalysis = () => {
    const data = results.content_analysis?.results;
    if (!data) return null;

    return (
      <View>
        {Object.entries(data).map(([field, contentData]: [string, any]) => (
          <View key={field} style={styles.fieldContainer}>
            <Text variant="titleSmall" style={styles.fieldName}>
              {field}
            </Text>
            <StatisticDisplay label="Framework" value={contentData.framework || 'N/A'} variant="chip" />
            <Divider style={styles.divider} />
            {contentData.categories && (
              <View>
                <Text variant="labelMedium" style={styles.sectionLabel}>
                  Categories Identified:
                </Text>
                {contentData.categories.map((category: any, index: number) => (
                  <View key={index} style={styles.categoryItem}>
                    <Text variant="bodyMedium" style={styles.categoryName}>
                      {category.name}
                    </Text>
                    <View style={styles.categoryMeta}>
                      <Chip mode="flat" compact>
                        {category.count || 0} mentions
                      </Chip>
                      {category.percentage && (
                        <Text variant="bodySmall" style={styles.categoryPercentage}>
                          ({(category.percentage * 100).toFixed(1)}%)
                        </Text>
                      )}
                    </View>
                    {category.examples && (
                      <View style={styles.categoryExamples}>
                        {category.examples.slice(0, 2).map((example: string, eIndex: number) => (
                          <Text key={eIndex} variant="bodySmall" style={styles.exampleText}>
                            • {example}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderQualitativeCoding = () => {
    const data = results.coding?.results;
    if (!data) return null;

    return (
      <View>
        {Object.entries(data).map(([field, codingData]: [string, any]) => (
          <View key={field} style={styles.fieldContainer}>
            <Text variant="titleSmall" style={styles.fieldName}>
              {field}
            </Text>
            <StatisticDisplay label="Coding Method" value={codingData.coding_method || 'N/A'} variant="chip" />
            <StatisticDisplay label="Total Codes" value={codingData.total_codes || 0} variant="chip" />
            <Divider style={styles.divider} />
            {codingData.codes && (
              <View>
                <Text variant="labelMedium" style={styles.sectionLabel}>
                  Identified Codes:
                </Text>
                {codingData.codes.map((code: any, index: number) => (
                  <View key={index} style={styles.codeItem}>
                    <View style={styles.codeHeader}>
                      <Text variant="bodyMedium" style={styles.codeName}>
                        {code.name}
                      </Text>
                      <Chip mode="flat" compact>
                        {code.frequency || 0}
                      </Chip>
                    </View>
                    {code.description && (
                      <Text variant="bodySmall" style={styles.codeDescription}>
                        {code.description}
                      </Text>
                    )}
                    {code.quotes && (
                      <View style={styles.quotesList}>
                        {code.quotes.slice(0, 2).map((quote: string, qIndex: number) => (
                          <Text key={qIndex} variant="bodySmall" style={styles.quoteText}>
                            "{quote}"
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <AnalysisCard
        title="Text Analysis"
        subtitle="Basic text statistics and patterns"
        icon="text"
        loading={loading.text_analysis}
        error={errors.text_analysis}
        onRun={() => runAnalysis('text_analysis', () => analyticsService.runTextAnalysis(projectId))}
        showRunButton={!results.text_analysis}
      >
        {renderTextAnalysis()}
      </AnalysisCard>

      <AnalysisCard
        title="Sentiment Analysis"
        subtitle="Analyze emotional tone of text"
        icon="emoticon-outline"
        loading={loading.sentiment}
        error={errors.sentiment}
        onRun={() => runAnalysis('sentiment', () => analyticsService.runSentimentAnalysis(projectId, undefined, 'vader'))}
        showRunButton={!results.sentiment}
      >
        {renderSentimentAnalysis()}
      </AnalysisCard>

      <AnalysisCard
        title="Theme Analysis"
        subtitle="Identify themes and topics in text"
        icon="lightbulb-outline"
        loading={loading.themes}
        error={errors.themes}
        onRun={() => runAnalysis('themes', () => analyticsService.runThemeAnalysis(projectId, undefined, 5, 'lda'))}
        showRunButton={!results.themes}
      >
        {renderThemeAnalysis()}
      </AnalysisCard>

      <AnalysisCard
        title="Word Frequency"
        subtitle="Most common words and phrases"
        icon="format-list-numbered"
        loading={loading.word_frequency}
        error={errors.word_frequency}
        onRun={() =>
          runAnalysis('word_frequency', () => analyticsService.runWordFrequencyAnalysis(projectId, undefined, 50))
        }
        showRunButton={!results.word_frequency}
      >
        {renderWordFrequency()}
      </AnalysisCard>

      <AnalysisCard
        title="Content Analysis"
        subtitle="Systematic content categorization"
        icon="file-document-outline"
        loading={loading.content_analysis}
        error={errors.content_analysis}
        onRun={() =>
          runAnalysis('content_analysis', () => analyticsService.runContentAnalysis(projectId, undefined, 'inductive'))
        }
        showRunButton={!results.content_analysis}
      >
        {renderContentAnalysis()}
      </AnalysisCard>

      <AnalysisCard
        title="Qualitative Coding"
        subtitle="Systematic coding of qualitative data"
        icon="code-tags"
        loading={loading.coding}
        error={errors.coding}
        onRun={() =>
          runAnalysis('coding', () => analyticsService.runQualitativeCoding(projectId, undefined, 'open', true))
        }
        showRunButton={!results.coding}
      >
        {renderQualitativeCoding()}
      </AnalysisCard>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldName: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  divider: {
    marginVertical: 12,
  },
  sectionLabel: {
    marginTop: 8,
    marginBottom: 8,
    color: colors.text.secondary,
  },
  sentimentDistribution: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sentimentChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  sampleTexts: {
    marginTop: 12,
  },
  sampleItem: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: colors.background.subtle,
    borderRadius: 8,
  },
  sampleText: {
    marginTop: 6,
    color: colors.text.secondary,
  },
  themeItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.background.subtle,
    borderRadius: 8,
  },
  themeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  keywordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  keywordChip: {
    marginRight: 4,
    marginBottom: 4,
  },
  themeDescription: {
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  wordFrequencyList: {
    gap: 8,
  },
  wordFrequencyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  wordText: {
    flex: 1,
  },
  categoryItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.background.subtle,
    borderRadius: 8,
  },
  categoryName: {
    fontWeight: '500',
    marginBottom: 6,
  },
  categoryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  categoryPercentage: {
    color: colors.text.secondary,
  },
  categoryExamples: {
    marginTop: 8,
  },
  exampleText: {
    color: colors.text.secondary,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  codeItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.background.subtle,
    borderRadius: 8,
  },
  codeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  codeName: {
    fontWeight: '500',
    flex: 1,
  },
  codeDescription: {
    color: colors.text.secondary,
    marginBottom: 8,
  },
  quotesList: {
    marginTop: 8,
  },
  quoteText: {
    color: colors.text.secondary,
    fontStyle: 'italic',
    marginBottom: 4,
    paddingLeft: 8,
  },
});
