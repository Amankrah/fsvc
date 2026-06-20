/**
 * ResponsesScreen - Refactored Version
 * Modular, production-ready implementation with clean separation of concerns
 */

import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { colors, spacing, borderRadius, typography } from '../constants/theme';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ListRenderItem,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  Text,
  ActivityIndicator,
  Searchbar,
  Icon,
  Portal,
  Dialog,
  Divider,
} from 'react-native-paper';
import { useRoute, RouteProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { ScreenWrapper } from '../components/layout/ScreenWrapper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Custom Hooks
import {
  useRespondents,
  useRespondentDetails,
  useExport,
} from '../hooks/responses';
import { Respondent, RespondentFilters } from '../hooks/responses/useRespondents';
import { useAuthStore } from '../store/authStore';

// Components
import { StatsCards, ResponseCard } from '../components/responses';

// Types
import { RootStackParamList } from '../navigation/RootNavigator';

type ResponsesRouteProp = RouteProp<RootStackParamList, 'Responses'>;

type FilterKey = 'respondent_type' | 'commodity' | 'country';

// ── Helpers ────────────────────────────────────────────────────────────────────

const getAvatarColor = (str: string): string => {
  const palette = [
    colors.primary.main,
    colors.status.info,
    '#0D9488',
    '#4F46E5',
    colors.accent?.main ?? '#D97706',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
};

const getInitials = (respondentId: string): string => {
  const parts = respondentId.replace(/[^a-zA-Z0-9]/g, ' ').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return respondentId.slice(0, 2).toUpperCase();
};

// ── Component ──────────────────────────────────────────────────────────────────

const ResponsesScreen: React.FC = () => {
  const route = useRoute<ResponsesRouteProp>();
  const { projectId, projectName } = route.params;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [selectedFilters, setSelectedFilters] = useState<Partial<Record<FilterKey, string[]>>>({});
  const [filterMode, setFilterMode] = useState<'all' | 'mine'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog visibility
  const [activeFilterMenu, setActiveFilterMenu] = useState<FilterKey | null>(null);
  const [exportDialogVisible, setExportDialogVisible] = useState(false);

  // Hooks
  const respondentsHook = useRespondents(projectId);
  const detailsHook = useRespondentDetails();
  const exportHook = useExport(projectId, projectName);
  const { user } = useAuthStore();

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Filter helpers ────────────────────────────────────────────────────────

  const buildActiveFilters = useCallback(
    (overrideSearch?: string): RespondentFilters => {
      const f: RespondentFilters = {};
      if (selectedFilters.respondent_type?.length) f.respondent_type = selectedFilters.respondent_type;
      if (selectedFilters.commodity?.length) f.commodity = selectedFilters.commodity;
      if (selectedFilters.country?.length) f.country = selectedFilters.country;
      if (filterMode === 'mine' && user?.id) f.created_by = String(user.id);
      const q = overrideSearch !== undefined ? overrideSearch : searchQuery;
      if (q.trim()) f.search = q.trim();
      return f;
    },
    [selectedFilters, filterMode, user?.id, searchQuery]
  );

  useFocusEffect(
    useCallback(() => {
      respondentsHook.loadData();
      respondentsHook.loadFilterOptions();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  useEffect(() => {
    setSelectedFilters({});
    setFilterMode('all');
    setSearchQuery('');
    detailsHook.clearSelection();
    setViewMode('list');
    respondentsHook.loadFilterOptions();
    respondentsHook.setFilters({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    respondentsHook.setFilters(buildActiveFilters());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFilters, filterMode]);

  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        respondentsHook.setFilters(buildActiveFilters(text));
      }, 400);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [buildActiveFilters]
  );

  const handleRespondentPress = async (respondent: Respondent) => {
    await detailsHook.loadRespondentResponses(respondent);
    setViewMode('detail');
  };

  const handleBack = () => {
    detailsHook.clearSelection();
    setViewMode('list');
  };

  const { respondent_types: uniqueRespondentTypes, commodities: uniqueCommodities, countries: uniqueCountries } =
    respondentsHook.filterOptions;

  const toggleFilterValue = (key: FilterKey, value: string) => {
    setSelectedFilters(prev => {
      const current = prev[key] ?? [];
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [key]: next.length > 0 ? next : undefined };
    });
  };

  const clearFilterKey = (key: FilterKey) => {
    setSelectedFilters(prev => ({ ...prev, [key]: undefined }));
  };

  const clearAllFilters = () => setSelectedFilters({});

  const hasActiveFilters = Object.values(selectedFilters).some(v => v?.length);

  // ── Active filter dialog config ───────────────────────────────────────────

  const filterDialogConfig = useMemo(() => {
    if (!activeFilterMenu) return null;
    const map: Record<FilterKey, { title: string; options: string[] }> = {
      respondent_type: { title: 'Filter by Type', options: uniqueRespondentTypes },
      commodity: { title: 'Filter by Commodity', options: uniqueCommodities },
      country: { title: 'Filter by Country', options: uniqueCountries },
    };
    return { key: activeFilterMenu, ...map[activeFilterMenu] };
  }, [activeFilterMenu, uniqueRespondentTypes, uniqueCommodities, uniqueCountries]);

  const activeFilterSelections = activeFilterMenu ? (selectedFilters[activeFilterMenu] ?? []) : [];

  // ── Pagination ────────────────────────────────────────────────────────────

  const totalResponses = useMemo(
    () => respondentsHook.respondents.reduce((sum, r) => sum + r.response_count, 0),
    [respondentsHook.respondents]
  );

  const flatListRef = useRef<FlatList<Respondent>>(null);

  useEffect(() => {
    if (respondentsHook.currentPage > 1) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, [respondentsHook.currentPage]);

  // ── Filter chip label helpers ─────────────────────────────────────────────

  const filterChipLabel = (key: FilterKey, prefix: string): string => {
    const sel = selectedFilters[key];
    if (!sel?.length) return `${prefix}: All`;
    if (sel.length === 1) return `${prefix}: ${sel[0]}`;
    return `${prefix}: ${sel.length} selected`;
  };

  // ── Respondent card ───────────────────────────────────────────────────────

  const renderRespondentCard: ListRenderItem<Respondent> = useCallback(
    ({ item: respondent }) => {
      const initials = getInitials(respondent.respondent_id);
      const avatarColor = getAvatarColor(respondent.respondent_id);
      const isComplete = respondent.completion_rate >= 100;
      const submitter = respondent.created_by_details?.first_name
        ? `${respondent.created_by_details.first_name} ${respondent.created_by_details.last_name || ''}`.trim()
        : null;
      const typeLocation = [respondent.respondent_type, respondent.commodity ?? respondent.country]
        .filter(Boolean)
        .join(' · ');
      const dateStr = respondent.created_at
        ? new Date(respondent.created_at).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', year: 'numeric',
          })
        : null;

      return (
        <TouchableOpacity
          style={styles.respondentCard}
          onPress={() => handleRespondentPress(respondent)}
          activeOpacity={0.75}
        >
          <View style={styles.respTop}>
            <View style={[styles.respAvatar, { backgroundColor: avatarColor + '18', borderColor: avatarColor + '40' }]}>
              <Text style={[styles.respAvatarText, { color: avatarColor }]}>{initials}</Text>
            </View>
            <View style={styles.respInfo}>
              <Text style={styles.respId}>{respondent.respondent_id}</Text>
              {typeLocation ? (
                <Text style={styles.respType}>{typeLocation}</Text>
              ) : submitter ? (
                <Text style={styles.respType}>{submitter}</Text>
              ) : null}
            </View>
            <View style={[styles.respBadge, isComplete ? styles.respBadgeComplete : styles.respBadgePartial]}>
              <Text style={[styles.respBadgeText, isComplete ? styles.respBadgeTextComplete : styles.respBadgeTextPartial]}>
                {isComplete ? 'Complete' : 'Partial'}
              </Text>
            </View>
          </View>

          <View style={styles.respMeta}>
            {dateStr && (
              <View style={styles.respMetaItem}>
                <Icon source="calendar-outline" size={11} color={colors.text.disabled} />
                <Text style={styles.respMetaText}>{dateStr}</Text>
              </View>
            )}
            <View style={styles.respMetaItem}>
              <Icon source="format-list-bulleted" size={11} color={colors.text.disabled} />
              <Text style={styles.respMetaText}>{respondent.response_count} responses</Text>
            </View>
            {submitter && typeLocation ? (
              <View style={styles.respMetaItem}>
                <Icon source="account-outline" size={11} color={colors.text.disabled} />
                <Text style={styles.respMetaText}>{submitter}</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ── List sub-components ───────────────────────────────────────────────────

  const ListHeader = useCallback(
    () => (
      <>
        <StatsCards
          totalRespondents={respondentsHook.respondents.length}
          totalResponses={totalResponses}
          totalCount={respondentsHook.totalCount}
        />
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, filterMode === 'all' && styles.toggleBtnActive]}
            onPress={() => setFilterMode('all')}
            activeOpacity={0.8}
          >
            <Icon source="account-group" size={14} color={filterMode === 'all' ? '#fff' : colors.text.secondary} />
            <Text style={[styles.toggleBtnText, filterMode === 'all' && styles.toggleBtnTextActive]}>
              All Responses
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, filterMode === 'mine' && styles.toggleBtnActive]}
            onPress={() => setFilterMode('mine')}
            activeOpacity={0.8}
          >
            <Icon source="account" size={14} color={filterMode === 'mine' ? '#fff' : colors.text.secondary} />
            <Text style={[styles.toggleBtnText, filterMode === 'mine' && styles.toggleBtnTextActive]}>
              My Responses
            </Text>
          </TouchableOpacity>
        </View>
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [respondentsHook.respondents.length, respondentsHook.totalCount, totalResponses, filterMode]
  );

  const ListFooter = useCallback(
    () => (
      <View style={styles.paginationRow}>
        <TouchableOpacity
          style={[styles.pageBtn, (respondentsHook.currentPage === 1 || respondentsHook.loading) && styles.pageBtnDisabled]}
          onPress={respondentsHook.prevPage}
          disabled={respondentsHook.currentPage === 1 || respondentsHook.loading}
          activeOpacity={0.8}
        >
          <Icon source="chevron-left" size={16} color={respondentsHook.currentPage === 1 ? colors.text.disabled : colors.primary.main} />
          <Text style={[styles.pageBtnText, respondentsHook.currentPage === 1 && styles.pageBtnTextDisabled]}>Prev</Text>
        </TouchableOpacity>
        <Text style={styles.pageInfo}>
          {respondentsHook.currentPage} / {respondentsHook.totalPages}
        </Text>
        <TouchableOpacity
          style={[styles.pageBtn, (respondentsHook.currentPage >= respondentsHook.totalPages || respondentsHook.loading) && styles.pageBtnDisabled]}
          onPress={respondentsHook.nextPage}
          disabled={respondentsHook.currentPage >= respondentsHook.totalPages || respondentsHook.loading}
          activeOpacity={0.8}
        >
          <Text style={[styles.pageBtnText, respondentsHook.currentPage >= respondentsHook.totalPages && styles.pageBtnTextDisabled]}>Next</Text>
          <Icon source="chevron-right" size={16} color={respondentsHook.currentPage >= respondentsHook.totalPages ? colors.text.disabled : colors.primary.main} />
        </TouchableOpacity>
      </View>
    ),
    [respondentsHook.currentPage, respondentsHook.totalPages, respondentsHook.loading, respondentsHook.prevPage, respondentsHook.nextPage]
  );

  const ListEmpty = useCallback(
    () =>
      !respondentsHook.loading ? (
        <View style={styles.emptyContainer}>
          <Icon source="account-search-outline" size={48} color={colors.text.disabled} />
          <Text style={styles.emptyTitle}>No respondents found</Text>
          <Text style={styles.emptyHint}>Try adjusting your filters or search</Text>
        </View>
      ) : null,
    [respondentsHook.loading]
  );

  // ── Loading state ─────────────────────────────────────────────────────────

  if (respondentsHook.loading && respondentsHook.respondents.length === 0) {
    return (
      <ScreenWrapper style={styles.container} edges={{ top: false }}>
        <View style={[styles.hero, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.heroNav}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Icon source="chevron-left" size={24} color="#fff" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.heroTitle}>Responses</Text>
          <Text style={styles.heroSubtitle}>{projectName}</Text>
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading responses...</Text>
        </View>
      </ScreenWrapper>
    );
  }

  // ── Detail view ───────────────────────────────────────────────────────────

  const renderDetailView = () => {
    const r = detailsHook.selectedRespondent;
    if (!r) return null;

    const initials = getInitials(r.respondent_id);
    const avatarColor = getAvatarColor(r.respondent_id);
    const isComplete = r.completion_rate >= 100;
    const typeLocation = [r.respondent_type, r.commodity ?? r.country].filter(Boolean).join(' · ');

    const DetailHero = () => (
      <View style={styles.detailHero}>
        <View style={styles.detailAvatarRow}>
          <View style={[styles.detailAvatar, { backgroundColor: avatarColor + '20', borderColor: avatarColor + '50' }]}>
            <Text style={[styles.detailAvatarText, { color: avatarColor }]}>{initials}</Text>
          </View>
          <View style={styles.detailAvatarInfo}>
            <Text style={styles.detailRespondentId}>{r.respondent_id}</Text>
            {typeLocation ? <Text style={styles.detailRespondentType}>{typeLocation}</Text> : null}
          </View>
          <View style={[styles.respBadge, isComplete ? styles.respBadgeComplete : styles.respBadgePartial]}>
            <Text style={[styles.respBadgeText, isComplete ? styles.respBadgeTextComplete : styles.respBadgeTextPartial]}>
              {isComplete ? 'Complete' : 'Partial'}
            </Text>
          </View>
        </View>
        <View style={styles.detailStatRow}>
          <View style={styles.detailStatPill}>
            <Icon source="format-list-bulleted" size={13} color={colors.primary.main} />
            <Text style={styles.detailStatValue}>{r.response_count}</Text>
            <Text style={styles.detailStatLabel}>Responses</Text>
          </View>
          <View style={styles.detailStatDivider} />
          <View style={styles.detailStatPill}>
            <Icon source="percent" size={13} color={colors.primary.main} />
            <Text style={styles.detailStatValue}>{Math.round(r.completion_rate)}%</Text>
            <Text style={styles.detailStatLabel}>Complete</Text>
          </View>
        </View>
      </View>
    );

    if (detailsHook.loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading responses...</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={detailsHook.respondentResponses}
        keyExtractor={item => item.response_id}
        renderItem={({ item }) => <ResponseCard response={item} />}
        ListHeaderComponent={DetailHero}
        contentContainerStyle={styles.detailContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon source="clipboard-text-off-outline" size={40} color={colors.text.disabled} />
            <Text style={styles.emptyTitle}>No responses recorded</Text>
          </View>
        }
      />
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ScreenWrapper style={styles.container} edges={{ top: false }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <View style={[styles.hero, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.heroNav}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={viewMode === 'list' ? () => navigation.goBack() : handleBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon source="chevron-left" size={24} color="#fff" />
            <Text style={styles.backText}>{viewMode === 'list' ? 'Back' : 'Responses'}</Text>
          </TouchableOpacity>

          {viewMode === 'list' && (
            <TouchableOpacity
              style={styles.heroMenuBtn}
              onPress={() => setExportDialogVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon source="dots-vertical" size={22} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.heroTitle}>
          {viewMode === 'list' ? 'Responses' : (detailsHook.selectedRespondent?.respondent_id ?? 'Respondent')}
        </Text>
        <Text style={styles.heroSubtitle}>
          {viewMode === 'list'
            ? projectName
            : [
                detailsHook.selectedRespondent?.respondent_type,
                detailsHook.selectedRespondent?.commodity ?? detailsHook.selectedRespondent?.country,
              ].filter(Boolean).join(' · ') || projectName}
        </Text>
      </View>

      {/* ── Search & Filter chips (list only) ─────────────────────────────── */}
      {viewMode === 'list' && (
        <>
          <View style={styles.searchContainer}>
            <Searchbar
              placeholder="Search by respondent ID or type..."
              onChangeText={handleSearchChange}
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

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScrollView}
            contentContainerStyle={styles.filterScrollContent}
          >
            {/* Type chip */}
            <TouchableOpacity
              style={[styles.filterChipBtn, selectedFilters.respondent_type?.length && styles.filterChipBtnActive]}
              onPress={() => setActiveFilterMenu('respondent_type')}
              activeOpacity={0.8}
            >
              <Icon
                source="tag-outline"
                size={13}
                color={selectedFilters.respondent_type?.length ? colors.primary.main : colors.text.secondary}
              />
              <Text style={[styles.filterChipBtnText, selectedFilters.respondent_type?.length && styles.filterChipBtnTextActive]}>
                {filterChipLabel('respondent_type', 'Type')}
              </Text>
              <Icon
                source="chevron-down"
                size={13}
                color={selectedFilters.respondent_type?.length ? colors.primary.main : colors.text.secondary}
              />
            </TouchableOpacity>

            {/* Commodity chip */}
            <TouchableOpacity
              style={[styles.filterChipBtn, selectedFilters.commodity?.length && styles.filterChipBtnActive]}
              onPress={() => setActiveFilterMenu('commodity')}
              activeOpacity={0.8}
            >
              <Icon
                source="sprout-outline"
                size={13}
                color={selectedFilters.commodity?.length ? colors.primary.main : colors.text.secondary}
              />
              <Text style={[styles.filterChipBtnText, selectedFilters.commodity?.length && styles.filterChipBtnTextActive]}>
                {filterChipLabel('commodity', 'Commodity')}
              </Text>
              <Icon
                source="chevron-down"
                size={13}
                color={selectedFilters.commodity?.length ? colors.primary.main : colors.text.secondary}
              />
            </TouchableOpacity>

            {/* Country chip */}
            <TouchableOpacity
              style={[styles.filterChipBtn, selectedFilters.country?.length && styles.filterChipBtnActive]}
              onPress={() => setActiveFilterMenu('country')}
              activeOpacity={0.8}
            >
              <Icon
                source="earth"
                size={13}
                color={selectedFilters.country?.length ? colors.primary.main : colors.text.secondary}
              />
              <Text style={[styles.filterChipBtnText, selectedFilters.country?.length && styles.filterChipBtnTextActive]}>
                {filterChipLabel('country', 'Country')}
              </Text>
              <Icon
                source="chevron-down"
                size={13}
                color={selectedFilters.country?.length ? colors.primary.main : colors.text.secondary}
              />
            </TouchableOpacity>

            {/* Clear all */}
            {hasActiveFilters && (
              <TouchableOpacity
                style={styles.clearChipBtn}
                onPress={clearAllFilters}
                activeOpacity={0.8}
              >
                <Icon source="close-circle" size={13} color={colors.status.error} />
                <Text style={styles.clearChipBtnText}>Clear all</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </>
      )}

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <View style={styles.content}>
        {viewMode === 'list' ? (
          <FlatList<Respondent>
            ref={flatListRef}
            data={respondentsHook.respondents}
            keyExtractor={item => item.id}
            renderItem={renderRespondentCard}
            ListHeaderComponent={ListHeader}
            ListFooterComponent={ListFooter}
            ListEmptyComponent={ListEmpty}
            contentContainerStyle={styles.listContent}
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

      {/* ── Export overlay ─────────────────────────────────────────────────── */}
      {exportHook.exporting && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Exporting...</Text>
        </View>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          DIALOGS
      ════════════════════════════════════════════════════════════════════ */}
      <Portal>

        {/* ── Filter dialog ──────────────────────────────────────────────── */}
        <Dialog
          visible={activeFilterMenu !== null}
          onDismiss={() => setActiveFilterMenu(null)}
          style={styles.dialogPaper}
        >
          {/* Title row */}
          <View style={styles.dialogTitleRow}>
            <View style={styles.dialogTitleAccent} />
            <Text style={styles.dialogTitleText}>{filterDialogConfig?.title ?? ''}</Text>
          </View>

          {/* Options */}
          <Dialog.ScrollArea style={styles.filterDialogScrollArea}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* "All" row */}
              <TouchableOpacity
                style={styles.filterOptionRow}
                onPress={() => {
                  if (filterDialogConfig) clearFilterKey(filterDialogConfig.key);
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.filterOptionText,
                  !activeFilterSelections.length && styles.filterOptionTextSelected,
                ]}>
                  All
                </Text>
                <View style={[styles.checkbox, !activeFilterSelections.length && styles.checkboxActive]}>
                  {!activeFilterSelections.length && (
                    <Icon source="check" size={13} color="#fff" />
                  )}
                </View>
              </TouchableOpacity>

              <Divider style={styles.filterOptionDivider} />

              {(filterDialogConfig?.options ?? []).map(option => {
                const isSelected = activeFilterSelections.includes(option);
                return (
                  <TouchableOpacity
                    key={option}
                    style={styles.filterOptionRow}
                    onPress={() => filterDialogConfig && toggleFilterValue(filterDialogConfig.key, option)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filterOptionText, isSelected && styles.filterOptionTextSelected]}>
                      {option}
                    </Text>
                    <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                      {isSelected && <Icon source="check" size={13} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Dialog.ScrollArea>

          {/* Actions */}
          <View style={styles.dialogActionRow}>
            <TouchableOpacity
              style={styles.dialogCancelBtn}
              onPress={() => {
                if (filterDialogConfig) clearFilterKey(filterDialogConfig.key);
              }}
            >
              <Text style={styles.dialogCancelText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dialogPrimaryBtn}
              onPress={() => setActiveFilterMenu(null)}
            >
              <Icon source="check" size={16} color="#fff" />
              <Text style={styles.dialogPrimaryText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </Dialog>

        {/* ── Export dialog ──────────────────────────────────────────────── */}
        <Dialog
          visible={exportDialogVisible}
          onDismiss={() => setExportDialogVisible(false)}
          style={styles.dialogPaper}
        >
          <View style={styles.dialogTitleRow}>
            <View style={[styles.dialogTitleAccent, { backgroundColor: colors.status.info }]} />
            <Text style={styles.dialogTitleText}>Export & Options</Text>
          </View>

          <Dialog.Content style={styles.exportDialogContent}>
            {/* Excel */}
            <TouchableOpacity
              style={styles.exportRow}
              onPress={() => {
                setExportDialogVisible(false);
                exportHook.handleExportExcel(buildActiveFilters());
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.exportIconTile, { backgroundColor: '#16A34A18' }]}>
                <Icon source="file-excel" size={20} color="#16A34A" />
              </View>
              <View style={styles.exportRowBody}>
                <Text style={styles.exportRowTitle}>Export to Excel</Text>
                <Text style={styles.exportRowHint}>Downloads as .xlsx with all filtered data</Text>
              </View>
              <Icon source="chevron-right" size={18} color={colors.text.disabled} />
            </TouchableOpacity>

            <Divider style={styles.exportDivider} />

            {/* CSV */}
            <TouchableOpacity
              style={styles.exportRow}
              onPress={() => {
                setExportDialogVisible(false);
                exportHook.handleExportCSV(buildActiveFilters());
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.exportIconTile, { backgroundColor: '#0284C718' }]}>
                <Icon source="file-delimited" size={20} color="#0284C7" />
              </View>
              <View style={styles.exportRowBody}>
                <Text style={styles.exportRowTitle}>Export to CSV</Text>
                <Text style={styles.exportRowHint}>Comma-separated values for spreadsheets</Text>
              </View>
              <Icon source="chevron-right" size={18} color={colors.text.disabled} />
            </TouchableOpacity>

            <Divider style={styles.exportDivider} />

            {/* JSON */}
            <TouchableOpacity
              style={styles.exportRow}
              onPress={() => {
                setExportDialogVisible(false);
                exportHook.handleExportJSON(buildActiveFilters());
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.exportIconTile, { backgroundColor: '#7C3AED18' }]}>
                <Icon source="code-json" size={20} color="#7C3AED" />
              </View>
              <View style={styles.exportRowBody}>
                <Text style={styles.exportRowTitle}>Export to JSON</Text>
                <Text style={styles.exportRowHint}>Raw structured data for developers</Text>
              </View>
              <Icon source="chevron-right" size={18} color={colors.text.disabled} />
            </TouchableOpacity>

            <Divider style={[styles.exportDivider, { marginVertical: spacing.xs }]} />

            {/* Refresh */}
            <TouchableOpacity
              style={styles.exportRow}
              onPress={() => {
                setExportDialogVisible(false);
                respondentsHook.loadData();
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.exportIconTile, { backgroundColor: colors.primary.surface }]}>
                <Icon source="refresh" size={20} color={colors.primary.main} />
              </View>
              <View style={styles.exportRowBody}>
                <Text style={styles.exportRowTitle}>Refresh</Text>
                <Text style={styles.exportRowHint}>Reload the latest responses from server</Text>
              </View>
              <Icon source="chevron-right" size={18} color={colors.text.disabled} />
            </TouchableOpacity>
          </Dialog.Content>

          {/* Close button */}
          <View style={[styles.dialogActionRow, { justifyContent: 'flex-end' }]}>
            <TouchableOpacity
              style={[styles.dialogCancelBtn, { flex: 0, paddingHorizontal: spacing.xl }]}
              onPress={() => setExportDialogVisible(false)}
            >
              <Text style={styles.dialogCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Dialog>

      </Portal>
    </ScreenWrapper>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },

  // ── Hero
  hero: {
    backgroundColor: colors.primary.dark,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  heroNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.md,
    color: '#fff',
  },
  heroTitle: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.xxl,
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: 'rgba(255,255,255,0.65)',
  },
  heroMenuBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Search
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    backgroundColor: colors.background.default,
  },
  searchBar: {
    backgroundColor: colors.background.paper,
    borderWidth: 1,
    borderColor: colors.border.light,
    elevation: 0,
    borderRadius: borderRadius.lg,
  },
  searchInput: {
    fontFamily: 'DMSans-Regular',
    color: colors.text.primary,
  },

  // ── Filter chip row
  filterScrollView: {
    backgroundColor: colors.background.default,
    maxHeight: 52,
  },
  filterScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: 8,
  },
  filterChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.border.medium,
    backgroundColor: colors.background.paper,
  },
  filterChipBtnActive: {
    borderColor: colors.primary.main,
    borderWidth: 1.5,
    backgroundColor: colors.primary.faint,
  },
  filterChipBtnText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  filterChipBtnTextActive: {
    color: colors.primary.main,
  },
  clearChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.status.error + '55',
    backgroundColor: colors.status.errorSurface,
  },
  clearChipBtnText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.status.error,
  },

  // ── All/Mine toggle
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    overflow: 'hidden',
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary.main,
  },
  toggleBtnText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  toggleBtnTextActive: {
    color: '#fff',
  },

  // ── Respondent card
  respondentCard: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: 14,
    marginBottom: 10,
  },
  respTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  respAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  respAvatarText: {
    fontFamily: 'Fraunces-Bold',
    fontSize: 13,
    lineHeight: 16,
  },
  respInfo: { flex: 1 },
  respId: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    marginBottom: 2,
  },
  respType: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  respBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.round,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  respBadgeComplete: { backgroundColor: colors.status.successSurface },
  respBadgePartial: { backgroundColor: colors.status.warningSurface },
  respBadgeText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  respBadgeTextComplete: { color: colors.status.success },
  respBadgeTextPartial: { color: colors.status.warning },
  respMeta: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  respMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  respMetaText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
    color: colors.text.disabled,
  },

  // ── List layout
  content: { flex: 1 },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 32,
  },

  // ── Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
  },
  emptyHint: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.disabled,
  },

  // ── Pagination
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.lg,
    paddingBottom: 40,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.faint,
    minWidth: 80,
    justifyContent: 'center',
  },
  pageBtnDisabled: {
    borderColor: colors.border.medium,
    backgroundColor: colors.background.paper,
  },
  pageBtnText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.sm,
    color: colors.primary.main,
  },
  pageBtnTextDisabled: { color: colors.text.disabled },
  pageInfo: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    minWidth: 60,
    textAlign: 'center',
  },

  // ── Detail view
  detailContent: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  detailHero: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: spacing.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  detailAvatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: spacing.md,
  },
  detailAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  detailAvatarText: {
    fontFamily: 'Fraunces-Bold',
    fontSize: 18,
    lineHeight: 22,
  },
  detailAvatarInfo: { flex: 1 },
  detailRespondentId: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  detailRespondentType: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  detailStatRow: {
    flexDirection: 'row',
    backgroundColor: colors.background.subtle ?? colors.background.default,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  detailStatPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  detailStatDivider: {
    width: 1,
    backgroundColor: colors.border.light,
  },
  detailStatValue: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  detailStatLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // ── Loading overlay
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DIALOG STYLES (shared pattern — mirrors DataCollectionScreen)
  // ══════════════════════════════════════════════════════════════════════════

  dialogPaper: {
    borderRadius: borderRadius.xl,
    backgroundColor: colors.background.paper,
    overflow: 'hidden',
  },
  dialogTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  dialogTitleAccent: {
    width: 4,
    height: 26,
    backgroundColor: colors.primary.main,
    borderRadius: 2,
  },
  dialogTitleText: {
    fontFamily: 'Fraunces-Bold',
    fontSize: 20,
    color: colors.text.primary,
    letterSpacing: -0.2,
    flex: 1,
    paddingLeft: spacing.md,
  },
  dialogActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.xs,
  },
  dialogCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCancelText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
  },
  dialogPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 13,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogPrimaryText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: '#fff',
  },

  // ── Filter dialog
  filterDialogScrollArea: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.light,
    maxHeight: 320,
    paddingHorizontal: 0,
  },
  filterOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  filterOptionText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    flex: 1,
  },
  filterOptionTextSelected: {
    fontFamily: 'DMSans-Bold',
    color: colors.text.primary,
  },
  filterOptionDivider: {
    backgroundColor: colors.border.light,
    marginHorizontal: spacing.lg,
  },
  // Custom checkbox
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderColor: colors.border.medium,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxActive: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },

  // ── Export dialog
  exportDialogContent: {
    paddingTop: spacing.xs,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  exportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
  },
  exportIconTile: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  exportRowBody: { flex: 1 },
  exportRowTitle: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    marginBottom: 2,
  },
  exportRowHint: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  exportDivider: {
    backgroundColor: colors.border.light,
    marginHorizontal: spacing.lg,
  },
});

export default React.memo(ResponsesScreen);
