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
import { colors } from '../constants/theme';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import {
  Text,
  ActivityIndicator,
  Searchbar,
  Menu,
  IconButton,
  Chip,
  Button,
  SegmentedButtons,
} from 'react-native-paper';
import { useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { ScreenWrapper } from '../components/layout/ScreenWrapper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Custom Hooks
import {
  useRespondents,
  useRespondentDetails,
  useSearch,
  useExport,
} from '../hooks/responses';
import { useAuthStore } from '../store/authStore';

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
  const insets = useSafeAreaInsets();

  const [menuVisible, setMenuVisible] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [selectedFilters, setSelectedFilters] = useState<{
    respondent_type?: string;
    commodity?: string;
    country?: string;
  }>({});
  const [filterMode, setFilterMode] = useState<'all' | 'mine'>('all');
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
  const { user } = useAuthStore();

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

    if (filterMode === 'mine' && user?.id) {
      // The user.id from auth store is a string or number, created_by is a number. 
      // Safely compare them.
      filtered = filtered.filter(r => String(r.created_by) === String(user.id));
    }

    return filtered;
  }, [searchHook.filteredRespondents, selectedFilters, filterMode, user?.id]);

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
      <ScreenWrapper style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text variant="bodyLarge" style={styles.loadingText}>
          Loading responses...
        </Text>
      </ScreenWrapper>
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
          tintColor={colors.primary.main}
          colors={[colors.primary.main]}
        />
      }>
      <StatsCards
        totalRespondents={respondentsHook.respondents.length}
        totalResponses={totalResponses}
      />

      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <SegmentedButtons
          value={filterMode}
          onValueChange={value => setFilterMode(value as 'all' | 'mine')}
          buttons={[
            {
              value: 'all',
              label: 'All Responses',
              icon: 'account-group',
            },
            {
              value: 'mine',
              label: 'My Responses',
              icon: 'account',
            },
          ]}
          style={{ marginBottom: 8 }}
        />
      </View>

      <RespondentsTable
        respondents={filteredRespondents}
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
            iconColor={colors.text.primary}
            onPress={handleBack}
          />
          <View style={styles.detailHeaderInfo}>
            <Text variant="titleLarge" style={styles.detailTitle}>
              {detailsHook.selectedRespondent.created_by_details?.first_name
                ? `${detailsHook.selectedRespondent.created_by_details.first_name} ${detailsHook.selectedRespondent.created_by_details.last_name || ''}`.trim()
                : 'Anonymous'}
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
              tintColor={colors.primary.main}
              colors={[colors.primary.main]}
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
    <ScreenWrapper style={styles.container} edges={{ top: false }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
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
                iconColor={colors.text.primary}
                onPress={() => setMenuVisible(true)}
              />
            }
            contentStyle={styles.menuContent}>
            <Menu.Item
              onPress={() => {
                setMenuVisible(false);
                exportHook.handleExportCSV(selectedFilters);
              }}
              title="Export to CSV"
              leadingIcon="file-delimited"
              titleStyle={styles.menuItemText}
            />
            <Menu.Item
              onPress={() => {
                setMenuVisible(false);
                exportHook.handleExportJSON(selectedFilters);
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
        <>
          <View style={styles.searchContainer}>
            <Searchbar
              placeholder="Search respondents..."
              onChangeText={searchHook.handleSearch}
              value={searchHook.searchQuery}
              style={styles.searchBar}
              inputStyle={styles.searchInput}
              iconColor={colors.primary.light}
              placeholderTextColor={colors.text.hint}
              theme={{
                colors: {
                  onSurface: colors.text.primary,
                  onSurfaceVariant: colors.text.secondary,
                  elevation: {
                    level3: 'white',
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
              contentStyle={styles.menuContent}>
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
              contentStyle={styles.menuContent}>
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
              contentStyle={styles.menuContent}>
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
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text variant="bodyLarge" style={styles.loadingText}>
            Exporting...
          </Text>
        </View>
      )}
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  centerContainer: {
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
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontWeight: 'bold',
    color: colors.text.primary,
    fontSize: 28,
  },
  subtitle: {
    color: colors.text.secondary,
    marginTop: 4,
    fontSize: 16,
  },
  menuContent: {
    backgroundColor: colors.background.paper,
  },
  menuItemText: {
    color: colors.text.primary,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: colors.background.default,
  },
  searchBar: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: colors.border.light,
    elevation: 0,
  },
  searchInput: {
    color: colors.text.primary,
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
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  detailSubtitle: {
    color: colors.text.secondary,
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
    backgroundColor: 'rgba(67, 56, 202, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(67, 56, 202, 0.2)',
  },
  chipText: {
    color: colors.text.primary,
  },
  filterChipSmall: {
    backgroundColor: 'rgba(67, 56, 202, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(67, 56, 202, 0.2)',
    height: 28,
  },
  filterChipTextSmall: {
    color: colors.text.secondary,
    fontSize: 11,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
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
    backgroundColor: colors.background.default,
    flexWrap: 'wrap',
  },
  filterButton: {
    borderColor: colors.border.medium,
    borderWidth: 1,
    backgroundColor: 'white',
    minWidth: 140,
    flexShrink: 1,
  },
  filterButtonActive: {
    borderColor: colors.primary.main,
    borderWidth: 2,
    backgroundColor: colors.primary.faint,
  },
  filterButtonLabel: {
    color: colors.text.primary,
    fontSize: 13,
    flexShrink: 1,
  },
  menuItemTextSelected: {
    color: colors.primary.main,
    fontWeight: '600',
  },
  clearButton: {
    marginLeft: 'auto',
  },
  clearButtonLabel: {
    color: colors.status.error,
    fontSize: 12,
  },
});

export default React.memo(ResponsesScreen);
