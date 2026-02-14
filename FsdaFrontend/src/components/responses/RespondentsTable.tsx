/**
 * RespondentsTable Component
 * Displays paginated table of respondents
 */

import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { DataTable, Chip } from 'react-native-paper';
import { Respondent } from '../../hooks/responses';
import { ITEMS_PER_PAGE } from '../../constants/responses';
import { colors } from '../../constants/theme';

interface RespondentsTableProps {
  respondents: Respondent[];
  onRespondentPress: (respondent: Respondent) => void;
}

export const RespondentsTable: React.FC<RespondentsTableProps> = ({
  respondents,
  onRespondentPress,
}) => {
  const [page, setPage] = useState(0);

  const from = page * ITEMS_PER_PAGE;
  const to = Math.min((page + 1) * ITEMS_PER_PAGE, respondents.length);
  const paginatedData = respondents.slice(from, to);

  return (
    <DataTable style={styles.dataTable}>
      <DataTable.Header style={styles.tableHeader}>
        <DataTable.Title textStyle={styles.headerText}>Respondent ID</DataTable.Title>
        <DataTable.Title textStyle={styles.headerText}>Submitted By</DataTable.Title>
        <DataTable.Title textStyle={styles.headerText}>Filters</DataTable.Title>
        <DataTable.Title textStyle={styles.headerText} numeric>
          Responses
        </DataTable.Title>
      </DataTable.Header>

      {paginatedData.map((respondent) => (
        <TouchableOpacity
          key={respondent.id}
          onPress={() => onRespondentPress(respondent)}
          activeOpacity={0.7}>
          <DataTable.Row style={styles.tableRow}>
            <DataTable.Cell textStyle={styles.cellText}>{respondent.respondent_id}</DataTable.Cell>
            <DataTable.Cell textStyle={styles.cellText}>
              {respondent.created_by_details?.first_name
                ? `${respondent.created_by_details.first_name} ${respondent.created_by_details.last_name || ''}`.trim()
                : 'Anonymous'}
            </DataTable.Cell>
            <DataTable.Cell>
              <View style={styles.filtersCell}>
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
            </DataTable.Cell>
            <DataTable.Cell textStyle={styles.cellText} numeric>
              {respondent.response_count}
            </DataTable.Cell>
          </DataTable.Row>
        </TouchableOpacity>
      ))}

      <DataTable.Pagination
        page={page}
        numberOfPages={Math.ceil(respondents.length / ITEMS_PER_PAGE)}
        onPageChange={setPage}
        label={`${from + 1}-${to} of ${respondents.length}`}
        showFastPaginationControls
        numberOfItemsPerPage={ITEMS_PER_PAGE}
        style={styles.pagination}
        theme={{
          colors: {
            onSurface: colors.text.primary,
            onSurfaceVariant: colors.text.secondary,
          },
        }}
      />
    </DataTable>
  );
};

const styles = StyleSheet.create({
  dataTable: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHeader: {
    backgroundColor: colors.background.subtle,
  },
  headerText: {
    color: colors.text.primary,
    fontWeight: 'bold',
    fontSize: 14,
    flexShrink: 1,
  },
  tableRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  cellText: {
    color: colors.text.primary,
    fontSize: 14,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  pagination: {
    backgroundColor: 'white',
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
    height: 24,
  },
  filterChipText: {
    color: colors.text.secondary,
    fontSize: 9,
  },
});
