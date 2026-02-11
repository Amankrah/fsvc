/**
 * BundleCompletionScreen
 * Shows completion statistics for question bundles (generation sets)
 * Tracks how many respondents completed all questions for each combination of
 * respondent_type + commodity + country
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, ActivityIndicator, IconButton, Chip } from 'react-native-paper';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import apiService from '../services/api';
import { showAlert } from '../utils/alert';

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
  const { projectId, projectName, mode = 'project' } = route.params;

  const [bundles, setBundles] = useState<BundleStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBundleStats = async () => {
    try {
      const data = mode === 'user'
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
  }, [projectId]);

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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4b1e85" />
        <Text style={styles.loadingText}>Loading completion stats...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          iconColor="#ffffff"
          size={24}
          onPress={() => navigation.goBack()}
        />
        <View style={styles.headerContent}>
          <Text variant="headlineSmall" style={styles.title}>
            {mode === 'user' ? 'My Collection Stats' : 'Bundle Completion Stats'}
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            {projectName}
          </Text>
        </View>
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
            {mode === 'user' ? 'No collections found' : 'No question bundles found'}
          </Text>
          <Text style={styles.emptySubtext}>
            {mode === 'user'
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
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#4b1e85']} />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a1a',
  },
  loadingText: {
    marginTop: 16,
    color: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a3a',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(75, 30, 133, 0.3)',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  summaryCard: {
    margin: 16,
    backgroundColor: '#1a1a3a',
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
    color: '#ffffff',
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
  },
  completedValue: {
    color: '#4CAF50',
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  card: {
    marginBottom: 16,
    backgroundColor: '#1a1a3a',
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
    color: '#ffffff',
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
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.4)',
  },
  countryChip: {
    backgroundColor: 'rgba(33, 150, 243, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.4)',
  },
  chipText: {
    color: '#ffffff',
    fontSize: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
  },
  completionBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 8,
  },
  completionFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
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
    color: '#ffffff',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
});

export default BundleCompletionScreen;
