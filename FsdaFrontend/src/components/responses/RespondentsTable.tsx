/**
 * RespondentsTable Component
 * Displays paginated table of respondents
 */

import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { DataTable } from 'react-native-paper';
import { Respondent } from '../../hooks/responses';
import { ITEMS_PER_PAGE } from '../../constants/responses';

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
        <DataTable.Title textStyle={styles.headerText}>Name</DataTable.Title>
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
              {respondent.name || 'Anonymous'}
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
            onSurface: '#ffffff',
            onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
          },
        }}
      />
    </DataTable>
  );
};

const styles = StyleSheet.create({
  dataTable: {
    backgroundColor: 'rgba(75, 30, 133, 0.1)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHeader: {
    backgroundColor: 'rgba(75, 30, 133, 0.3)',
  },
  headerText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  tableRow: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(75, 30, 133, 0.2)',
  },
  cellText: {
    color: '#ffffff',
    fontSize: 14,
  },
  pagination: {
    backgroundColor: 'rgba(75, 30, 133, 0.15)',
  },
});
