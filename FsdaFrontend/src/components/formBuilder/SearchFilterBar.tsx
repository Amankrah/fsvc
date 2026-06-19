/**
 * SearchFilterBar Component
 * Collapsible search and filter interface.
 * Savanna Intelligence design: theme tokens, no legacy purple colors.
 */

import React from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Text, TextInput, IconButton, Chip } from 'react-native-paper';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';

interface SearchFilterBarProps {
  isExpanded: boolean;
  onToggleExpanded: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategoryFilters: string[];
  selectedRespondentFilters: string[];
  onToggleCategoryFilter: (category: string) => void;
  onToggleRespondentFilter: (respondent: string) => void;
  onClearAllFilters: () => void;
  hasActiveFilters: boolean;
  activeFiltersCount: number;
  filteredCount: number;
  totalCount: number;
  categories: Array<{ value: string; label: string }>;
  respondentTypes: Array<{ value: string; label: string }>;
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  isExpanded,
  onToggleExpanded,
  searchQuery,
  onSearchChange,
  selectedCategoryFilters,
  selectedRespondentFilters,
  onToggleCategoryFilter,
  onToggleRespondentFilter,
  onClearAllFilters,
  hasActiveFilters,
  activeFiltersCount,
  filteredCount,
  totalCount,
  categories,
  respondentTypes,
}) => {
  return (
    <View style={styles.container}>
      {/* ── Toggle bar ── */}
      <TouchableOpacity
        style={styles.filterToggle}
        onPress={onToggleExpanded}
        activeOpacity={0.7}
      >
        <View style={styles.filterToggleLeft}>
          <IconButton
            icon={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            iconColor={colors.primary.main}
          />
          <Text style={styles.filterToggleText}>
            {isExpanded ? 'Hide Filters' : 'Show Filters & Search'}
          </Text>
        </View>
        {hasActiveFilters && (
          <View style={styles.activeFilterBadge}>
            <Text style={styles.activeFilterBadgeText}>{activeFiltersCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* ── Expanded filter panel ── */}
      {isExpanded && (
        <View style={styles.filterContent}>
          <TextInput
            placeholder="Search questions..."
            value={searchQuery}
            onChangeText={onSearchChange}
            mode="outlined"
            left={<TextInput.Icon icon="magnify" />}
            right={
              searchQuery ? (
                <TextInput.Icon icon="close" onPress={() => onSearchChange('')} />
              ) : undefined
            }
            style={styles.searchBar}
            outlineStyle={styles.searchBarOutline}
            textColor={colors.text.primary}
            placeholderTextColor={colors.text.tertiary}
            theme={{
              colors: {
                primary: colors.primary.main,
                onSurfaceVariant: colors.text.secondary,
                outline: colors.border.medium,
              },
            }}
          />

          {/* Category filters */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>
              Categories{selectedCategoryFilters.length > 0 ? ` (${selectedCategoryFilters.length})` : ''}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterChipsScroll}
            >
              {categories.map((cat) => {
                const selected = selectedCategoryFilters.includes(cat.value);
                return (
                  <Chip
                    key={cat.value}
                    selected={selected}
                    onPress={() => onToggleCategoryFilter(cat.value)}
                    style={[styles.filterChip, selected && styles.selectedFilterChip]}
                    textStyle={[styles.filterChipText, selected && styles.selectedFilterChipText]}
                    selectedColor={colors.primary.main}
                  >
                    {cat.label}
                  </Chip>
                );
              })}
            </ScrollView>
          </View>

          {/* Respondent type filters */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>
              Respondent Types{selectedRespondentFilters.length > 0 ? ` (${selectedRespondentFilters.length})` : ''}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterChipsScroll}
            >
              {respondentTypes.map((resp) => {
                const selected = selectedRespondentFilters.includes(resp.value);
                return (
                  <Chip
                    key={resp.value}
                    selected={selected}
                    onPress={() => onToggleRespondentFilter(resp.value)}
                    style={[styles.filterChip, selected && styles.selectedFilterChip]}
                    textStyle={[styles.filterChipText, selected && styles.selectedFilterChipText]}
                    selectedColor={colors.primary.main}
                  >
                    {resp.label}
                  </Chip>
                );
              })}
            </ScrollView>
          </View>

          {/* Active filters summary + clear */}
          {hasActiveFilters && (
            <View style={styles.activeFiltersRow}>
              <Text style={styles.activeFiltersText}>
                Showing {filteredCount} of {totalCount} questions
              </Text>
              <TouchableOpacity onPress={onClearAllFilters}>
                <Text style={styles.clearFiltersText}>Clear All</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ── Compact active-filter chips when collapsed ── */}
      {!isExpanded && hasActiveFilters && (
        <View style={styles.compactFiltersDisplay}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            {searchQuery && (
              <Chip
                style={styles.compactFilterChip}
                textStyle={styles.compactFilterText}
                onClose={() => onSearchChange('')}
              >
                🔍 "{searchQuery.substring(0, 20)}{searchQuery.length > 20 ? '…' : ''}"
              </Chip>
            )}
            {selectedCategoryFilters.map((cat) => (
              <Chip
                key={cat}
                style={styles.compactFilterChip}
                textStyle={styles.compactFilterText}
                onClose={() => onToggleCategoryFilter(cat)}
              >
                {categories.find((c) => c.value === cat)?.label || cat}
              </Chip>
            ))}
            {selectedRespondentFilters.map((resp) => (
              <Chip
                key={resp}
                style={styles.compactFilterChip}
                textStyle={styles.compactFilterText}
                onClose={() => onToggleRespondentFilter(resp)}
              >
                {respondentTypes.find((r) => r.value === resp)?.label || resp}
              </Chip>
            ))}
          </ScrollView>
          <Text style={styles.compactResultsText}>
            {filteredCount}/{totalCount}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  // ── Toggle bar
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterToggleText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  activeFilterBadge: {
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    minWidth: 24,
    alignItems: 'center',
  },
  activeFilterBadgeText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.xs,
    color: '#fff',
  },

  // ── Expanded panel
  filterContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    paddingTop: 0,
  },
  searchBar: {
    backgroundColor: colors.background.subtle,
    marginBottom: spacing.md,
  },
  searchBarOutline: {
    borderRadius: borderRadius.lg,
    borderColor: colors.border.light,
  },
  filterSection: {
    marginBottom: spacing.md,
  },
  filterSectionTitle: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  filterChipsScroll: {
    flexDirection: 'row',
  },
  filterChip: {
    marginRight: spacing.sm,
    backgroundColor: colors.background.subtle,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  selectedFilterChip: {
    backgroundColor: colors.primary.surface,
    borderColor: colors.primary.muted,
  },
  filterChipText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  selectedFilterChipText: {
    fontFamily: 'DMSans-Medium',
    color: colors.primary.main,
  },
  activeFiltersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    marginTop: spacing.xs,
  },
  activeFiltersText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  clearFiltersText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.sm,
    color: colors.primary.main,
  },

  // ── Compact chips (collapsed state with active filters)
  compactFiltersDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  compactFilterChip: {
    marginRight: spacing.sm,
    backgroundColor: colors.primary.surface,
    borderWidth: 1,
    borderColor: colors.primary.muted,
  },
  compactFilterText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.primary.main,
  },
  compactResultsText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
});
