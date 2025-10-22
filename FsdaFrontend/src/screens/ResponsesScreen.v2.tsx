/**
 * ResponsesScreen - Refactored Version
 * Modular, production-ready implementation with clean separation of concerns
 *
 * Architecture:
 * - Custom hooks handle business logic
 * - Reusable components handle UI
 * - Constants centralize configuration
 * - Full Django backend compatibility
 */

import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, Platform, RefreshControl } from 'react-native';
import {
  Text,
  ActivityIndicator,
  Searchbar,
  Menu,
  IconButton,
  Chip,
} from 'react-native-paper';
import { useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';

// Custom Hooks
import {
  useRespondents,
  useRespondentDetails,
  useSearch,
  useExport,
} from '../hooks/responses';

// Components
import {
  StatsCards,
  RespondentsTable,
  ResponseCard,
} from '../components/responses';

// Types
import { RootStackParamList } from '../navigation/RootNavigator';
type ResponsesRouteProp = RouteProp<RootStackParamList, 'Responses'>;

const ResponsesScreen: React.FC = () => {
  const route = useRoute<ResponsesRouteProp>();
  const { projectId, projectName } = route.params;

  const [menuVisible, setMenuVisible] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

  // Hooks
  const respondentsHook = useRespondents(projectId);
  const searchHook = useSearch(respondentsHook.respondents);
  const detailsHook = useRespondentDetails();
  const exportHook = useExport(projectId, projectName);

  // Load data on focus
  useFocusEffect(
    useCallback(() => {
      respondentsHook.loadData();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // Handle respondent press
  const handleRespondentPress = async (respondent: any) => {
    await detailsHook.loadRespondentResponses(respondent);
    setViewMode('detail');
  };

  // Handle back to list
  const handleBack = () => {
    detailsHook.clearSelection();
    setViewMode('list');
  };

  // Calculate stats
  const totalResponses = respondentsHook.respondents.reduce(
    (sum, r) => sum + r.response_count,
    0
  );

  // Loading state
  if (respondentsHook.loading && respondentsHook.respondents.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text variant="bodyLarge" style={styles.loadingText}>
          Loading responses...
        </Text>
      </View>
    );
  }

  // Render List View
  const renderListView = () => (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={respondentsHook.refreshing}
          onRefresh={respondentsHook.handleRefresh}
          tintColor="#4b1e85"
          colors={['#4b1e85']}
        />
      }>
      <StatsCards
        totalRespondents={respondentsHook.respondents.length}
        totalResponses={totalResponses}
      />
      <RespondentsTable
        respondents={searchHook.filteredRespondents}
        onRespondentPress={handleRespondentPress}
      />
    </ScrollView>
  );

  // Render Detail View
  const renderDetailView = () => {
    if (!detailsHook.selectedRespondent) return null;

    return (
      <>
        <View style={styles.detailHeader}>
          <IconButton
            icon="arrow-left"
            size={24}
            iconColor="#ffffff"
            onPress={handleBack}
          />
          <View style={styles.detailHeaderInfo}>
            <Text variant="titleLarge" style={styles.detailTitle}>
              {detailsHook.selectedRespondent.name || 'Anonymous'}
            </Text>
            <Text variant="bodyMedium" style={styles.detailSubtitle}>
              ID: {detailsHook.selectedRespondent.respondent_id}
            </Text>
          </View>
        </View>

        <View style={styles.detailStats}>
          <Chip style={styles.detailChip} textStyle={styles.chipText}>
            📊 {detailsHook.selectedRespondent.response_count} Responses
          </Chip>
          <Chip style={styles.detailChip} textStyle={styles.chipText}>
            🆔 {detailsHook.selectedRespondent.respondent_id}
          </Chip>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={respondentsHook.refreshing}
              onRefresh={respondentsHook.handleRefresh}
              tintColor="#4b1e85"
              colors={['#4b1e85']}
            />
          }>
          {detailsHook.respondentResponses.map((response) => (
            <ResponseCard key={response.response_id} response={response} />
          ))}
        </ScrollView>
      </>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text variant="headlineSmall" style={styles.title}>
            {viewMode === 'list' ? 'Responses' : 'Response Details'}
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            {projectName}
          </Text>
        </View>

        {viewMode === 'list' && (
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <IconButton
                icon="dots-vertical"
                size={24}
                iconColor="#ffffff"
                onPress={() => setMenuVisible(true)}
              />
            }
            contentStyle={styles.menuContent}>
            <Menu.Item
              onPress={() => {
                setMenuVisible(false);
                exportHook.handleExportCSV();
              }}
              title="Export to CSV"
              leadingIcon="file-delimited"
              titleStyle={styles.menuItemText}
            />
            <Menu.Item
              onPress={() => {
                setMenuVisible(false);
                exportHook.handleExportJSON();
              }}
              title="Export to JSON"
              leadingIcon="code-json"
              titleStyle={styles.menuItemText}
            />
            <Menu.Item
              onPress={() => {
                setMenuVisible(false);
                respondentsHook.loadData();
              }}
              title="Refresh"
              leadingIcon="refresh"
              titleStyle={styles.menuItemText}
            />
          </Menu>
        )}
      </View>

      {/* Search Bar (List view only) */}
      {viewMode === 'list' && (
        <View style={styles.searchContainer}>
          <Searchbar
            placeholder="Search respondents..."
            onChangeText={searchHook.handleSearch}
            value={searchHook.searchQuery}
            style={styles.searchBar}
            inputStyle={styles.searchInput}
            iconColor="#64c8ff"
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
            theme={{
              colors: {
                onSurface: '#ffffff',
                onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                elevation: {
                  level3: 'rgba(75, 30, 133, 0.3)',
                },
              },
            }}
          />
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        {viewMode === 'list' ? renderListView() : renderDetailView()}
      </View>

      {/* Export Loading Overlay */}
      {exportHook.exporting && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text variant="bodyLarge" style={styles.loadingText}>
            Exporting...
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f23',
  },
  loadingText: {
    marginTop: 16,
    color: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a3a',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 3,
    borderBottomColor: '#4b1e85',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontWeight: 'bold',
    color: '#ffffff',
    fontSize: 28,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
    fontSize: 16,
  },
  menuContent: {
    backgroundColor: '#1a1a3a',
  },
  menuItemText: {
    color: '#ffffff',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#0f0f23',
  },
  searchBar: {
    backgroundColor: 'rgba(75, 30, 133, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(75, 30, 133, 0.3)',
  },
  searchInput: {
    color: '#ffffff',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 20,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  detailHeaderInfo: {
    flex: 1,
    marginLeft: 8,
  },
  detailTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  detailSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  detailStats: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  detailChip: {
    backgroundColor: 'rgba(100, 200, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.3)',
  },
  chipText: {
    color: '#64c8ff',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
});

export default React.memo(ResponsesScreen);
