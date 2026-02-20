/**
 * ResponsesScreen - Refactored Version
 * Modular, production-ready implementation with clean separation of concerns
 *
 * Architecture:
 * - Custom hooks handle business logic
 * - Reusable components handle UI
 * - Constants centralize configuration
 * - Full Django backend compatibility
 * - Server-side pagination via infinite scroll (FlatList + onEndReached)
 */

import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { colors } from '../constants/theme';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ListRenderItem,
  TouchableOpacity,
} from 'react-native';
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
  useExport,
} from '../hooks/responses';
import { Respondent } from '../hooks/responses/useRespondents';
import { useAuthStore } from '../store/authStore';

// Components
import { StatsCards, ResponseCard } from '../components/responses';

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
  const [searchQuery, setSearchQuery] = useState('');

  // Hooks
  const respondentsHook = useRespondents(projectId);
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
    setSearchQuery('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Handle respondent press
  const handleRespondentPress = async (respondent: Respondent) => {
    await detailsHook.loadRespondentResponses(respondent);
    setViewMode('detail');
  };

  // Handle back to list
  const handleBack = () => {
    detailsHook.clearSelection();
    setViewMode('list');
  };

  // ----------- Filtering & search applied to loaded respondents -----------

  const filteredRespondents = useMemo(() => {
    let data = respondentsHook.respondents;

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        r =>
          r.respondent_id?.toLowerCase().includes(q) ||
          r.created_by_details?.first_name?.toLowerCase().includes(q) ||
          r.created_by_details?.last_name?.toLowerCase().includes(q) ||
          r.respondent_type?.toLowerCase().includes(q) ||
          r.commodity?.toLowerCase().includes(q) ||
          r.country?.toLowerCase().includes(q)
      );
    }

    if (selectedFilters.respondent_type) {
      data = data.filter(r => r.respondent_type === selectedFilters.respondent_type);
    }
    if (selectedFilters.commodity) {
      data = data.filter(r => r.commodity === selectedFilters.commodity);
    }
    if (selectedFilters.country) {
      data = data.filter(r => r.country === selectedFilters.country);
    }
    if (filterMode === 'mine' && user?.id) {
      data = data.filter(r => String(r.created_by) === String(user.id));
    }

    return data;
  }, [respondentsHook.respondents, searchQuery, selectedFilters, filterMode, user?.id]);

  // Unique filter values — derived from ALL loaded pages so far
  const uniqueRespondentTypes = useMemo(() => {
    const s = new Set<string>();
    respondentsHook.respondents.forEach(r => { if (r.respondent_type) s.add(r.respondent_type); });
    return Array.from(s).sort();
  }, [respondentsHook.respondents]);

  const uniqueCommodities = useMemo(() => {
    const s = new Set<string>();
    respondentsHook.respondents.forEach(r => { if (r.commodity) s.add(r.commodity); });
    return Array.from(s).sort();
  }, [respondentsHook.respondents]);

  const uniqueCountries = useMemo(() => {
    const s = new Set<string>();
    respondentsHook.respondents.forEach(r => { if (r.country) s.add(r.country); });
    return Array.from(s).sort();
  }, [respondentsHook.respondents]);

  const toggleFilter = (filterType: 'respondent_type' | 'commodity' | 'country', value: string) => {
    setSelectedFilters(prev => ({
      ...prev,
      [filterType]: prev[filterType] === value ? undefined : value,
    }));
    setFilterMenusVisible(prev => ({ ...prev, [filterType]: false }));
  };

  const clearFilters = () => setSelectedFilters({});

  const toggleFilterMenu = (filterType: 'respondent_type' | 'commodity' | 'country') => {
    setFilterMenusVisible(prev => ({ ...prev, [filterType]: !prev[filterType] }));
  };

  const closeFilterMenu = (filterType: 'respondent_type' | 'commodity' | 'country') => {
    setFilterMenusVisible(prev => ({ ...prev, [filterType]: false }));
  };

  // Total responses across loaded pages (local approximation)
  const totalResponses = useMemo(
    () => respondentsHook.respondents.reduce((sum, r) => sum + r.response_count, 0),
    [respondentsHook.respondents]
  );

  // ----------- Infinite scroll handlers -----------

  // ----------- Pagination handlers -----------

  const flatListRef = useRef<FlatList<Respondent>>(null);

  // Scroll to top when page changes
  useEffect(() => {
    if (respondentsHook.currentPage > 1) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, [respondentsHook.currentPage]);

  // ----------- FlatList renderers -----------

  const renderTableRow: ListRenderItem<Respondent> = useCallback(
    ({ item: respondent }) => (
      <TouchableOpacity
        onPress={() => handleRespondentPress(respondent)}
        activeOpacity={0.7}>
        <View style={styles.tableRow}>
          {/* Respondent ID */}
          <View style={styles.colId}>
            <Text style={styles.cellText} numberOfLines={2}>
              {respondent.respondent_id}
            </Text>
          </View>
          {/* Submitted By + time */}
          <View style={[styles.colSubmittedBy, styles.submittedByCell]}>
            <Text style={styles.cellText} numberOfLines={1}>
              {respondent.created_by_details?.first_name
                ? `${respondent.created_by_details.first_name} ${respondent.created_by_details.last_name || ''}`.trim()
                : 'Anonymous'}
            </Text>
            {respondent.created_at ? (
              <Text style={styles.cellTimestamp} numberOfLines={1}>
                {new Date(respondent.created_at).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            ) : null}
          </View>
          {/* Filters */}
          <View style={[styles.filtersCell, styles.colFilters]}>
            {respondent.respondent_type && (
              <Chip style={styles.filterChip} textStyle={styles.filterChipText} compact>
                {respondent.respondent_type}
              </Chip>
            )}
            {respondent.commodity && (
              <Chip style={styles.filterChip} textStyle={styles.filterChipText} compact>
                {respondent.commodity}
              </Chip>
            )}
            {respondent.country && (
              <Chip style={styles.filterChip} textStyle={styles.filterChipText} compact>
                {respondent.country}
              </Chip>
            )}
          </View>
          {/* Response count */}
          <View style={styles.colResponses}>
            <Text style={[styles.cellText, styles.cellCountText]}>
              {respondent.response_count}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const ListHeader = useCallback(
    () => (
      <>
        <StatsCards
          totalRespondents={respondentsHook.respondents.length}
          totalResponses={totalResponses}
          totalCount={respondentsHook.totalCount}
        />

        <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
          <SegmentedButtons
            value={filterMode}
            onValueChange={value => setFilterMode(value as 'all' | 'mine')}
            buttons={[
              { value: 'all', label: 'All Responses', icon: 'account-group' },
              { value: 'mine', label: 'My Responses', icon: 'account' },
            ]}
            style={{ marginBottom: 8 }}
          />
        </View>

        {/* Table header row */}
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.headerText, styles.colId]}>Respondent ID</Text>
          <Text style={[styles.headerText, styles.colSubmittedBy]}>Submitted By</Text>
          <Text style={[styles.headerText, styles.colFilters]}>Filters</Text>
          <Text style={[styles.headerText, styles.colResponses]}>Responses</Text>
        </View>
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [respondentsHook.respondents.length, respondentsHook.totalCount, totalResponses, filterMode]
  );

  const ListFooter = useCallback(
    () => (
      <View style={styles.paginationContainer}>
        <Button
          mode="outlined"
          disabled={respondentsHook.currentPage === 1 || respondentsHook.loading}
          onPress={respondentsHook.prevPage}
          style={styles.pageButton}
          icon="chevron-left"
        >
          Prev
        </Button>
        <Text variant="bodyMedium" style={styles.pageInfo}>
          Page {respondentsHook.currentPage} of {respondentsHook.totalPages}
        </Text>
        <Button
          mode="outlined"
          disabled={respondentsHook.currentPage >= respondentsHook.totalPages || respondentsHook.loading}
          onPress={respondentsHook.nextPage}
          style={styles.pageButton}
          contentStyle={{ flexDirection: 'row-reverse' }}
          icon="chevron-right"
        >
          Next
        </Button>
      </View>
    ),
    [respondentsHook.currentPage, respondentsHook.totalPages, respondentsHook.loading, respondentsHook.prevPage, respondentsHook.nextPage]
  );

  const ListEmpty = useCallback(
    () =>
      !respondentsHook.loading ? (
        <View style={styles.emptyContainer}>
          <Text variant="bodyLarge" style={styles.emptyText}>
            No respondents found
          </Text>
        </View>
      ) : null,
    [respondentsHook.loading]
  );

  // ----------- Loading state -----------

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

  // ----------- Detail view -----------

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

        <FlatList
          data={detailsHook.respondentResponses}
          keyExtractor={item => item.response_id}
          renderItem={({ item }) => <ResponseCard response={item} />}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={respondentsHook.refreshing}
              onRefresh={respondentsHook.handleRefresh}
              tintColor={colors.primary.main}
              colors={[colors.primary.main]}
            />
          }
        />
      </>
    );
  };

  // ----------- Main render -----------

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
              onPress={() => { setMenuVisible(false); exportHook.handleExportCSV(selectedFilters); }}
              title="Export to CSV"
              leadingIcon="file-delimited"
              titleStyle={styles.menuItemText}
            />
            <Menu.Item
              onPress={() => { setMenuVisible(false); exportHook.handleExportJSON(selectedFilters); }}
              title="Export to JSON"
              leadingIcon="code-json"
              titleStyle={styles.menuItemText}
            />
            <Menu.Item
              onPress={() => { setMenuVisible(false); respondentsHook.loadData(); }}
              title="Refresh"
              leadingIcon="refresh"
              titleStyle={styles.menuItemText}
            />
          </Menu>
        )}
      </View>

      {/* Search & Filters (list view only) */}
      {viewMode === 'list' && (
        <>
          <View style={styles.searchContainer}>
            <Searchbar
              placeholder="Search respondents..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchBar}
              inputStyle={styles.searchInput}
              iconColor={colors.primary.light}
              placeholderTextColor={colors.text.hint}
              theme={{
                colors: {
                  onSurface: colors.text.primary,
                  onSurfaceVariant: colors.text.secondary,
                  elevation: { level3: 'white' },
                },
              }}
            />
          </View>

          <View style={styles.filterContainer}>
            {/* Respondent Type Filter */}
            <Menu
              visible={filterMenusVisible.respondent_type}
              onDismiss={() => closeFilterMenu('respondent_type')}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => toggleFilterMenu('respondent_type')}
                  style={[styles.filterButton, selectedFilters.respondent_type && styles.filterButtonActive]}
                  labelStyle={styles.filterButtonLabel}
                  icon="chevron-down">
                  Type: {selectedFilters.respondent_type || 'All'}
                </Button>
              }
              contentStyle={styles.menuContent}>
              <Menu.Item onPress={() => toggleFilter('respondent_type', '')} title="All" titleStyle={styles.menuItemText} />
              {uniqueRespondentTypes.map(type => (
                <Menu.Item
                  key={type}
                  onPress={() => toggleFilter('respondent_type', type)}
                  title={type}
                  titleStyle={[styles.menuItemText, selectedFilters.respondent_type === type && styles.menuItemTextSelected]}
                  leadingIcon={selectedFilters.respondent_type === type ? 'check' : undefined}
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
                  style={[styles.filterButton, selectedFilters.commodity && styles.filterButtonActive]}
                  labelStyle={styles.filterButtonLabel}
                  icon="chevron-down">
                  Commodity: {selectedFilters.commodity || 'All'}
                </Button>
              }
              contentStyle={styles.menuContent}>
              <Menu.Item onPress={() => toggleFilter('commodity', '')} title="All" titleStyle={styles.menuItemText} />
              {uniqueCommodities.map(c => (
                <Menu.Item
                  key={c}
                  onPress={() => toggleFilter('commodity', c)}
                  title={c}
                  titleStyle={[styles.menuItemText, selectedFilters.commodity === c && styles.menuItemTextSelected]}
                  leadingIcon={selectedFilters.commodity === c ? 'check' : undefined}
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
                  style={[styles.filterButton, selectedFilters.country && styles.filterButtonActive]}
                  labelStyle={styles.filterButtonLabel}
                  icon="chevron-down">
                  Country: {selectedFilters.country || 'All'}
                </Button>
              }
              contentStyle={styles.menuContent}>
              <Menu.Item onPress={() => toggleFilter('country', '')} title="All" titleStyle={styles.menuItemText} />
              {uniqueCountries.map(c => (
                <Menu.Item
                  key={c}
                  onPress={() => toggleFilter('country', c)}
                  title={c}
                  titleStyle={[styles.menuItemText, selectedFilters.country === c && styles.menuItemTextSelected]}
                  leadingIcon={selectedFilters.country === c ? 'check' : undefined}
                />
              ))}
            </Menu>

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
        {viewMode === 'list' ? (
          <FlatList<Respondent>
            ref={flatListRef}
            data={filteredRespondents}
            keyExtractor={item => item.id}
            renderItem={renderTableRow}
            ListHeaderComponent={ListHeader}
            ListFooterComponent={ListFooter}
            ListEmptyComponent={ListEmpty}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={respondentsHook.refreshing}
                onRefresh={respondentsHook.handleRefresh}
                tintColor={colors.primary.main}
                colors={[colors.primary.main]}
              />
            }
          />
        ) : (
          renderDetailView()
        )}
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
  menuItemTextSelected: {
    color: colors.primary.main,
    fontWeight: '600',
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
  // Table styles (inline — no longer in a separate component)
  dataTable: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 0,
  },
  tableHeader: {
    backgroundColor: colors.background.subtle,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  headerText: {
    color: colors.text.primary,
    fontWeight: 'bold',
    fontSize: 14,
    flexShrink: 1,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 52,
  },
  cellText: {
    color: colors.text.primary,
    fontSize: 14,
  },
  cellCountText: {
    textAlign: 'right',
  },
  filtersCell: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    paddingVertical: 4,
  },
  filterChip: {
    backgroundColor: 'rgba(67, 56, 202, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(67, 56, 202, 0.2)',
    paddingVertical: 2,
  },
  filterChipText: {
    color: colors.text.secondary,
    fontSize: 10,
  },
  // Load more footer
  loadMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadMoreText: {
    color: colors.text.secondary,
  },
  endOfListText: {
    textAlign: 'center',
    color: colors.text.hint,
    paddingVertical: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: colors.text.secondary,
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
  clearButton: {
    marginLeft: 'auto',
  },
  clearButtonLabel: {
    color: colors.status.error,
    fontSize: 12,
  },
  // Detail view styles
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
  // Table column flex widths — must match header and row
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.subtle,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    marginTop: 8,
  },
  colId: { flex: 2.5, paddingRight: 4 },
  colSubmittedBy: { flex: 1.5, paddingRight: 4 },
  colFilters: { flex: 2, paddingRight: 4 },
  colResponses: { flex: 0.8, alignItems: 'flex-end' },
  submittedByCell: {
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 2,
  },
  cellTimestamp: {
    fontSize: 11,
    color: colors.text.hint,
    marginTop: 2,
  },
  // Pagination
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    gap: 16,
    paddingBottom: 40,
  },
  pageButton: {
    minWidth: 100,
    borderColor: colors.border.medium,
  },
  pageInfo: {
    color: colors.text.secondary,
    fontWeight: '500',
  },
});

export default React.memo(ResponsesScreen);
