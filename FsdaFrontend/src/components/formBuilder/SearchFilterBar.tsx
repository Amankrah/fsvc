/**
 * SearchFilterBar Component
 * Collapsible search and filter interface
 */

import React from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Text, TextInput, IconButton, Chip } from 'react-native-paper';

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
      {/* Filter Toggle Bar */}
      <TouchableOpacity
        style={styles.filterToggle}
        onPress={onToggleExpanded}
        activeOpacity={0.7}>
        <View style={styles.filterToggleLeft}>
          <IconButton
            icon={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            iconColor="#64c8ff"
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

      {/* Collapsible Filter Content */}
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
            textColor="#ffffff"
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
            theme={{
              colors: {
                primary: '#64c8ff',
                onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                outline: 'rgba(100, 200, 255, 0.5)',
              },
            }}
          />

          {/* Category Filters - Multi-Select */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>
              Categories {selectedCategoryFilters.length > 0 && `(${selectedCategoryFilters.length})`}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChipsContainer}>
              {categories.map((cat) => (
                <Chip
                  key={cat.value}
                  selected={selectedCategoryFilters.includes(cat.value)}
                  onPress={() => onToggleCategoryFilter(cat.value)}
                  style={[
                    styles.filterChip,
                    selectedCategoryFilters.includes(cat.value) && styles.selectedFilterChip,
                  ]}
                  textStyle={styles.filterChipText}>
                  {cat.label}
                </Chip>
              ))}
            </ScrollView>
          </View>

          {/* Respondent Filters - Multi-Select */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>
              Respondent Types {selectedRespondentFilters.length > 0 && `(${selectedRespondentFilters.length})`}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChipsContainer}>
              {respondentTypes.map((resp) => (
                <Chip
                  key={resp.value}
                  selected={selectedRespondentFilters.includes(resp.value)}
                  onPress={() => onToggleRespondentFilter(resp.value)}
                  style={[
                    styles.filterChip,
                    selectedRespondentFilters.includes(resp.value) && styles.selectedFilterChip,
                  ]}
                  textStyle={styles.filterChipText}>
                  {resp.label}
                </Chip>
              ))}
            </ScrollView>
          </View>

          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <View style={styles.activeFiltersContainer}>
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

      {/* Compact Active Filters Display when collapsed */}
      {!isExpanded && hasActiveFilters && (
        <View style={styles.compactFiltersDisplay}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            {searchQuery && (
              <Chip
                style={styles.compactFilterChip}
                textStyle={styles.compactFilterText}
                onClose={() => onSearchChange('')}>
                🔍 "{searchQuery.substring(0, 20)}{searchQuery.length > 20 ? '...' : ''}"
              </Chip>
            )}
            {selectedCategoryFilters.map((cat) => (
              <Chip
                key={cat}
                style={styles.compactFilterChip}
                textStyle={styles.compactFilterText}
                onClose={() => onToggleCategoryFilter(cat)}>
                {categories.find((c) => c.value === cat)?.label || cat}
              </Chip>
            ))}
            {selectedRespondentFilters.map((resp) => (
              <Chip
                key={resp}
                style={styles.compactFilterChip}
                textStyle={styles.compactFilterText}
                onClose={() => onToggleRespondentFilter(resp)}>
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
    backgroundColor: 'rgba(75, 30, 133, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(75, 30, 133, 0.3)',
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterToggleText: {
    color: '#64c8ff',
    fontSize: 14,
    fontWeight: '600',
  },
  activeFilterBadge: {
    backgroundColor: '#64c8ff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  activeFilterBadgeText: {
    color: '#0f0f23',
    fontSize: 12,
    fontWeight: 'bold',
  },
  filterContent: {
    padding: 16,
    paddingTop: 8,
  },
  searchBar: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  filterSection: {
    marginBottom: 16,
  },
  filterSectionTitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  filterChipsContainer: {
    flexDirection: 'row',
  },
  filterChip: {
    marginRight: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  selectedFilterChip: {
    backgroundColor: 'rgba(100, 200, 255, 0.3)',
    borderColor: '#64c8ff',
  },
  filterChipText: {
    color: '#ffffff',
    fontSize: 12,
  },
  activeFiltersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeFiltersText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
  },
  clearFiltersText: {
    color: '#64c8ff',
    fontSize: 13,
    fontWeight: '600',
  },
  compactFiltersDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  compactFilterChip: {
    marginRight: 8,
    backgroundColor: 'rgba(100, 200, 255, 0.2)',
    borderWidth: 1,
    borderColor: '#64c8ff',
  },
  compactFilterText: {
    color: '#64c8ff',
    fontSize: 11,
  },
  compactResultsText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
});
