/**
 * BundleCompletionScreen
 * Shows completion statistics for question bundles (generation sets)
 * Tracks how many respondents completed all questions for each combination of
 * respondent_type + commodity + country
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, ActivityIndicator, IconButton, Chip, SegmentedButtons } from 'react-native-paper';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import apiService from '../services/api';
import { showAlert } from '../utils/alert';
import { colors } from '../constants/theme';
import { ScreenWrapper } from '../components/layout/ScreenWrapper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type RootStackParamList = {
  BundleCompletion: { projectId: string; projectName: string; mode?: 'project' | 'user' };
};

type BundleCompletionRouteProp = RouteProp<RootStackParamList, 'BundleCompletion'>;

interface BundleStats {
  respondent_type: string;
  commodity: string;
  country: string;
  total_questions: number;
  total_respondents: number;
  completed_respondents_count: number;
  completed_respondent_ids: string[];
}

const BundleCompletionScreen: React.FC = () => {
  const route = useRoute<BundleCompletionRouteProp>();
  const navigation = useNavigation();
  const { projectId, projectName, mode: initialMode = 'project' } = route.params;
  const insets = useSafeAreaInsets();

  const [viewMode, setViewMode] = useState<'project' | 'user'>(initialMode);
  const [bundles, setBundles] = useState<BundleStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBundleStats = async () => {
    try {
      setLoading(true); // Ensure loading state is shown when switching modes
      const data = viewMode === 'user'
        ? await apiService.getMyCollectionStats(projectId)
        : await apiService.getBundleCompletionStats(projectId);

      setBundles(data.bundles || []);
      console.log(`✓ Loaded completion stats for ${data.total_bundles} bundles`);
    } catch (error) {
      console.error('Error loading bundle stats:', error);
      showAlert('Error', 'Failed to load completion statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadBundleStats();
    setRefreshing(false);
  };

  useEffect(() => {
    loadBundleStats();
  }, [projectId, viewMode]);

  const renderBundleCard = ({ item }: { item: BundleStats }) => {
    const completionPercentage = item.total_respondents > 0
      ? Math.round((item.completed_respondents_count / item.total_respondents) * 100)
      : 0;

    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.bundleInfo}>
              <Text variant="titleMedium" style={styles.respondentType}>
                {item.respondent_type}
              </Text>
              <View style={styles.tagsRow}>
                {item.commodity && (
                  <Chip icon="leaf" style={styles.commodityChip} textStyle={styles.chipText}>
                    {item.commodity}
                  </Chip>
                )}
                {item.country && (
                  <Chip icon="map-marker" style={styles.countryChip} textStyle={styles.chipText}>
                    {item.country}
                  </Chip>
                )}
              </View>
            </View>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{item.total_questions}</Text>
              <Text style={styles.statLabel}>Questions</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, styles.completedValue]}>
                {item.completed_respondents_count}
              </Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{completionPercentage}%</Text>
              <Text style={styles.statLabel}>Completion</Text>
            </View>
          </View>

          {item.completed_respondents_count > 0 && (
            <View style={styles.completionBar}>
              <View
                style={[
                  styles.completionFill,
                  { width: `${completionPercentage}%` }
                ]}
              />
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return (
      <ScreenWrapper style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text style={styles.loadingText}>Loading completion stats...</Text>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper style={styles.container} edges={{ top: false }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <IconButton
          icon="arrow-left"
          iconColor={colors.text.primary}
          size={24}
          onPress={() => navigation.goBack()}
        />
        <View style={styles.headerContent}>
          <Text variant="headlineSmall" style={styles.title}>
            {viewMode === 'user' ? 'My Collection Stats' : 'Bundle Completion Stats'}
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            {projectName}
          </Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <SegmentedButtons
          value={viewMode}
          onValueChange={value => setViewMode(value as 'project' | 'user')}
          buttons={[
            {
              value: 'project',
              label: 'Project Stats',
              icon: 'chart-bar',
            },
            {
              value: 'user',
              label: 'My Stats',
              icon: 'account',
            },
          ]}
        />
      </View>

      {/* Summary Card */}
      <Card style={styles.summaryCard}>
        <Card.Content>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{bundles.length}</Text>
              <Text style={styles.summaryLabel}>Total Bundles</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {bundles.reduce((sum, b) => sum + b.total_questions, 0)}
              </Text>
              <Text style={styles.summaryLabel}>Total Questions</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, styles.completedValue]}>
                {bundles.reduce((sum, b) => sum + b.completed_respondents_count, 0)}
              </Text>
              <Text style={styles.summaryLabel}>Completions</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Bundles List */}
      {bundles.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {viewMode === 'user' ? 'No collections found' : 'No question bundles found'}
          </Text>
          <Text style={styles.emptySubtext}>
            {viewMode === 'user'
              ? 'You haven\'t collected any data yet.'
              : 'Generate questions with respondent type, commodity, and country to see completion stats'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={bundles}
          renderItem={renderBundleCard}
          keyExtractor={(item, index) => `${item.respondent_type}-${item.commodity}-${item.country}-${index}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary.main]} />
          }
        />
      )}
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.default,
  },
  loadingText: {
    marginTop: 16,
    color: colors.text.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.paper,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: 14,
  },
  summaryCard: {
    margin: 16,
    backgroundColor: colors.background.paper,
    borderRadius: 16,
    elevation: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 4,
  },
  completedValue: {
    color: colors.status.success,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  card: {
    marginBottom: 16,
    backgroundColor: colors.background.paper,
    borderRadius: 16,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  bundleInfo: {
    flex: 1,
  },
  respondentType: {
    color: colors.text.primary,
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  commodityChip: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  countryChip: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  chipText: {
    color: colors.text.primary,
    fontSize: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.light,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 4,
  },
  completionBar: {
    height: 8,
    backgroundColor: colors.border.light,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 8,
  },
  completionFill: {
    height: '100%',
    backgroundColor: colors.status.success,
    borderRadius: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    color: colors.text.primary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});

export default BundleCompletionScreen;
