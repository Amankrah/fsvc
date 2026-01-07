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

import React, { useCallback, useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Platform, RefreshControl } from 'react-native';
import {
  Text,
  ActivityIndicator,
  Searchbar,
  Menu,
  IconButton,
  Chip,
  Button,
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
  const [selectedFilters, setSelectedFilters] = useState<{
    respondent_type?: string;
    commodity?: string;
    country?: string;
  }>({});
  const [filterMenusVisible, setFilterMenusVisible] = useState({
    respondent_type: false,
    commodity: false,
    country: false,
  });

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

  // Reload data when projectId changes
  useEffect(() => {
    respondentsHook.loadData();
    detailsHook.clearSelection();
    setViewMode('list');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

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

  // Extract unique filter values
  const uniqueRespondentTypes = React.useMemo(() => {
    const types = new Set<string>();
    respondentsHook.respondents.forEach(r => {
      if (r.respondent_type) types.add(r.respondent_type);
    });
    return Array.from(types).sort();
  }, [respondentsHook.respondents]);

  const uniqueCommodities = React.useMemo(() => {
    const commodities = new Set<string>();
    respondentsHook.respondents.forEach(r => {
      if (r.commodity) commodities.add(r.commodity);
    });
    return Array.from(commodities).sort();
  }, [respondentsHook.respondents]);

  const uniqueCountries = React.useMemo(() => {
    const countries = new Set<string>();
    respondentsHook.respondents.forEach(r => {
      if (r.country) countries.add(r.country);
    });
    return Array.from(countries).sort();
  }, [respondentsHook.respondents]);

  // Apply filters to respondents
  const filteredRespondents = React.useMemo(() => {
    let filtered = searchHook.filteredRespondents;

    if (selectedFilters.respondent_type) {
      filtered = filtered.filter(r => r.respondent_type === selectedFilters.respondent_type);
    }
    if (selectedFilters.commodity) {
      filtered = filtered.filter(r => r.commodity === selectedFilters.commodity);
    }
    if (selectedFilters.country) {
      filtered = filtered.filter(r => r.country === selectedFilters.country);
    }

    return filtered;
  }, [searchHook.filteredRespondents, selectedFilters]);

  // Toggle filter selection
  const toggleFilter = (filterType: 'respondent_type' | 'commodity' | 'country', value: string) => {
    setSelectedFilters(prev => ({
      ...prev,
      [filterType]: prev[filterType] === value ? undefined : value,
    }));
    // Close the menu after selection
    setFilterMenusVisible(prev => ({
      ...prev,
      [filterType]: false,
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedFilters({});
  };

  // Toggle menu visibility
  const toggleFilterMenu = (filterType: 'respondent_type' | 'commodity' | 'country') => {
    setFilterMenusVisible(prev => ({
      ...prev,
      [filterType]: !prev[filterType],
    }));
  };

  // Close menu
  const closeFilterMenu = (filterType: 'respondent_type' | 'commodity' | 'country') => {
    setFilterMenusVisible(prev => ({
      ...prev,
      [filterType]: false,
    }));
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
        totalRespondents={respondentsHook.totalCount}
        totalResponses={totalResponses}
      />
      <RespondentsTable
        respondents={filteredRespondents}
        onRespondentPress={handleRespondentPress}
      />

      {/* Pagination Controls */}
      {respondentsHook.totalPages > 1 && (
        <View style={styles.paginationContainer}>
          <Button
            mode="outlined"
            onPress={respondentsHook.previousPage}
            disabled={!respondentsHook.hasPreviousPage}
            style={styles.paginationButton}
            labelStyle={styles.paginationButtonLabel}>
            Previous
          </Button>
          <Text style={styles.paginationText}>
            Page {respondentsHook.page} of {respondentsHook.totalPages} ({respondentsHook.totalCount} total)
          </Text>
          <Button
            mode="outlined"
            onPress={respondentsHook.nextPage}
            disabled={!respondentsHook.hasNextPage}
            style={styles.paginationButton}
            labelStyle={styles.paginationButtonLabel}>
            Next
          </Button>
        </View>
      )}
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
          {detailsHook.selectedRespondent.respondent_type && (
            <Chip style={styles.filterChipSmall} textStyle={styles.filterChipTextSmall}>
              {detailsHook.selectedRespondent.respondent_type}
            </Chip>
          )}
          {detailsHook.selectedRespondent.commodity && (
            <Chip style={styles.filterChipSmall} textStyle={styles.filterChipTextSmall}>
              {detailsHook.selectedRespondent.commodity}
            </Chip>
          )}
          {detailsHook.selectedRespondent.country && (
            <Chip style={styles.filterChipSmall} textStyle={styles.filterChipTextSmall}>
              {detailsHook.selectedRespondent.country}
            </Chip>
          )}
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

          {/* Pagination Info and Load More Button */}
          {detailsHook.totalCount > 0 && (
            <View style={styles.responsePaginationContainer}>
              <Text style={styles.responsePaginationText}>
                Showing {detailsHook.respondentResponses.length} of {detailsHook.totalCount} responses
              </Text>
              {detailsHook.hasMore && (
                <Button
                  mode="contained"
                  onPress={detailsHook.loadMore}
                  loading={detailsHook.loading}
                  disabled={detailsHook.loading}
                  style={styles.loadMoreButton}
                  labelStyle={styles.loadMoreButtonLabel}>
                  Load More Responses
                </Button>
              )}
            </View>
          )}
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
        <>
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

          {/* Filter Dropdowns */}
          <View style={styles.filterContainer}>
            {/* Respondent Type Filter */}
            <Menu
              visible={filterMenusVisible.respondent_type}
              onDismiss={() => closeFilterMenu('respondent_type')}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => toggleFilterMenu('respondent_type')}
                  style={[
                    styles.filterButton,
                    selectedFilters.respondent_type && styles.filterButtonActive
                  ]}
                  labelStyle={styles.filterButtonLabel}
                  icon="chevron-down">
                  Type: {selectedFilters.respondent_type || 'All'}
                </Button>
              }
              contentStyle={[styles.menuContent, styles.scrollableMenu]}>
              <ScrollView style={styles.menuScrollView} nestedScrollEnabled>
                <Menu.Item
                  onPress={() => toggleFilter('respondent_type', '')}
                  title="All"
                  titleStyle={styles.menuItemText}
                />
                {uniqueRespondentTypes.map(type => (
                  <Menu.Item
                    key={type}
                    onPress={() => toggleFilter('respondent_type', type)}
                    title={type}
                    titleStyle={[
                      styles.menuItemText,
                      selectedFilters.respondent_type === type && styles.menuItemTextSelected
                    ]}
                    leadingIcon={selectedFilters.respondent_type === type ? "check" : undefined}
                  />
                ))}
              </ScrollView>
            </Menu>

            {/* Commodity Filter */}
            <Menu
              visible={filterMenusVisible.commodity}
              onDismiss={() => closeFilterMenu('commodity')}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => toggleFilterMenu('commodity')}
                  style={[
                    styles.filterButton,
                    selectedFilters.commodity && styles.filterButtonActive
                  ]}
                  labelStyle={styles.filterButtonLabel}
                  icon="chevron-down">
                  Commodity: {selectedFilters.commodity || 'All'}
                </Button>
              }
              contentStyle={[styles.menuContent, styles.scrollableMenu]}>
              <ScrollView style={styles.menuScrollView} nestedScrollEnabled>
                <Menu.Item
                  onPress={() => toggleFilter('commodity', '')}
                  title="All"
                  titleStyle={styles.menuItemText}
                />
                {uniqueCommodities.map(commodity => (
                  <Menu.Item
                    key={commodity}
                    onPress={() => toggleFilter('commodity', commodity)}
                    title={commodity}
                    titleStyle={[
                      styles.menuItemText,
                      selectedFilters.commodity === commodity && styles.menuItemTextSelected
                    ]}
                    leadingIcon={selectedFilters.commodity === commodity ? "check" : undefined}
                  />
                ))}
              </ScrollView>
            </Menu>

            {/* Country Filter */}
            <Menu
              visible={filterMenusVisible.country}
              onDismiss={() => closeFilterMenu('country')}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => toggleFilterMenu('country')}
                  style={[
                    styles.filterButton,
                    selectedFilters.country && styles.filterButtonActive
                  ]}
                  labelStyle={styles.filterButtonLabel}
                  icon="chevron-down">
                  Country: {selectedFilters.country || 'All'}
                </Button>
              }
              contentStyle={[styles.menuContent, styles.scrollableMenu]}>
              <ScrollView style={styles.menuScrollView} nestedScrollEnabled>
                <Menu.Item
                  onPress={() => toggleFilter('country', '')}
                  title="All"
                  titleStyle={styles.menuItemText}
                />
                {uniqueCountries.map(country => (
                  <Menu.Item
                    key={country}
                    onPress={() => toggleFilter('country', country)}
                    title={country}
                    titleStyle={[
                      styles.menuItemText,
                      selectedFilters.country === country && styles.menuItemTextSelected
                    ]}
                    leadingIcon={selectedFilters.country === country ? "check" : undefined}
                  />
                ))}
              </ScrollView>
            </Menu>

            {/* Clear Filters Button */}
            {Object.values(selectedFilters).some(v => v) && (
              <Button
                mode="text"
                onPress={clearFilters}
                style={styles.clearButton}
                labelStyle={styles.clearButtonLabel}
                icon="close">
                Clear
              </Button>
            )}

            {/* Export Bundle Button - Only enabled when ALL filters selected */}
            <Button
              mode="contained"
              onPress={() => exportHook.handleExportBundlePivot(selectedFilters)}
              disabled={!selectedFilters.respondent_type || !selectedFilters.commodity || !selectedFilters.country || exportHook.exporting}
              loading={exportHook.exporting}
              style={[
                styles.exportButton,
                (!selectedFilters.respondent_type || !selectedFilters.commodity || !selectedFilters.country) && styles.exportButtonDisabled
              ]}
              labelStyle={styles.exportButtonLabel}
              icon="download">
              Export Bundle
            </Button>
          </View>
        </>
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
    flexWrap: 'wrap',
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
  filterChipSmall: {
    backgroundColor: 'rgba(100, 200, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.25)',
    height: 28,
  },
  filterChipTextSmall: {
    color: '#64c8ff',
    fontSize: 11,
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
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: '#0f0f23',
    flexWrap: 'wrap',
  },
  filterButton: {
    borderColor: 'rgba(100, 200, 255, 0.3)',
    borderWidth: 1,
    backgroundColor: 'rgba(100, 200, 255, 0.1)',
    minWidth: 140,
  },
  filterButtonActive: {
    borderColor: '#64c8ff',
    borderWidth: 2,
    backgroundColor: 'rgba(100, 200, 255, 0.25)',
  },
  filterButtonLabel: {
    color: '#64c8ff',
    fontSize: 13,
  },
  menuItemTextSelected: {
    color: '#64c8ff',
    fontWeight: '600',
  },
  clearButton: {
    marginLeft: 'auto',
  },
  clearButtonLabel: {
    color: '#f44336',
    fontSize: 12,
  },
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(75, 30, 133, 0.1)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(75, 30, 133, 0.3)',
    marginTop: 16,
  },
  paginationButton: {
    borderColor: '#64c8ff',
    borderWidth: 1,
    minWidth: 100,
  },
  paginationButtonLabel: {
    color: '#64c8ff',
  },
  paginationText: {
    color: '#ffffff',
    fontSize: 14,
  },
  scrollableMenu: {
    maxHeight: 300,
  },
  menuScrollView: {
    maxHeight: 300,
  },
  responsePaginationContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(75, 30, 133, 0.1)',
    borderRadius: 8,
    marginTop: 16,
  },
  responsePaginationText: {
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 12,
  },
  loadMoreButton: {
    backgroundColor: '#4b1e85',
    minWidth: 200,
  },
  loadMoreButtonLabel: {
    color: '#ffffff',
    fontSize: 14,
  },
  exportButton: {
    backgroundColor: '#4b1e85',
    marginLeft: 'auto',
    minWidth: 150,
  },
  exportButtonDisabled: {
    backgroundColor: 'rgba(75, 30, 133, 0.3)',
  },
  exportButtonLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default React.memo(ResponsesScreen);
