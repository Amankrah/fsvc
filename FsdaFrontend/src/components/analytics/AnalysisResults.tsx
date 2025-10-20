import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Text,
  Card,
  Chip,
  DataTable,
  Divider,
  IconButton,
  Surface,
} from 'react-native-paper';

interface AnalysisResultsProps {
  results: any;
  methodName: string;
  timestamp?: string;
  onClose?: () => void;
}

const AnalysisResults: React.FC<AnalysisResultsProps> = ({
  results,
  methodName,
  timestamp,
  onClose,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary']));

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const renderValue = (value: any, decimals: number = 3): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'number') return value.toFixed(decimals);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  };

  const renderObject = (obj: any, depth: number = 0): JSX.Element[] => {
    if (!obj || typeof obj !== 'object') {
      return [
        <Text key="value" variant="bodyMedium" style={styles.valueText}>
          {renderValue(obj)}
        </Text>,
      ];
    }

    return Object.entries(obj).map(([key, value]) => {
      if (Array.isArray(value)) {
        return (
          <View key={key} style={[styles.objectRow, { paddingLeft: depth * 16 }]}>
            <Text variant="labelLarge" style={styles.keyText}>
              {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}:
            </Text>
            <View style={styles.arrayContainer}>
              {value.map((item, index) => (
                <Chip key={index} mode="outlined" style={styles.arrayChip}>
                  {renderValue(item)}
                </Chip>
              ))}
            </View>
          </View>
        );
      }

      if (value && typeof value === 'object') {
        return (
          <View key={key} style={[styles.nestedObject, { paddingLeft: depth * 16 }]}>
            <Text variant="titleSmall" style={styles.nestedTitle}>
              {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </Text>
            {renderObject(value, depth + 1)}
          </View>
        );
      }

      return (
        <View key={key} style={[styles.objectRow, { paddingLeft: depth * 16 }]}>
          <Text variant="labelMedium" style={styles.keyText}>
            {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}:
          </Text>
          <Text variant="bodyMedium" style={styles.valueText}>
            {renderValue(value)}
          </Text>
        </View>
      );
    });
  };

  const renderTable = (data: any, title?: string) => {
    if (!data || typeof data !== 'object') return null;

    // Check if it's a matrix/table structure
    const isMatrix = Array.isArray(data) && Array.isArray(data[0]);

    if (isMatrix) {
      const headers = data[0];
      const rows = data.slice(1);

      return (
        <Surface style={styles.tableSurface} elevation={1}>
          {title && (
            <Text variant="titleSmall" style={styles.tableTitle}>
              {title}
            </Text>
          )}
          <DataTable>
            <DataTable.Header>
              {headers.map((header: string, index: number) => (
                <DataTable.Title key={index}>{header}</DataTable.Title>
              ))}
            </DataTable.Header>

            {rows.map((row: any[], rowIndex: number) => (
              <DataTable.Row key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <DataTable.Cell key={cellIndex}>
                    {renderValue(cell)}
                  </DataTable.Cell>
                ))}
              </DataTable.Row>
            ))}
          </DataTable>
        </Surface>
      );
    }

    // Check if it's a dictionary that could be rendered as a table
    const entries = Object.entries(data);
    if (entries.length > 0 && entries.every(([k, v]) => typeof v === 'object')) {
      // Assume it's a row-based dictionary (e.g., {row1: {col1: val, col2: val}})
      const firstValue = entries[0][1] as any;
      const columns = Object.keys(firstValue);

      return (
        <Surface style={styles.tableSurface} elevation={1}>
          {title && (
            <Text variant="titleSmall" style={styles.tableTitle}>
              {title}
            </Text>
          )}
          <DataTable>
            <DataTable.Header>
              <DataTable.Title>Row</DataTable.Title>
              {columns.map((col) => (
                <DataTable.Title key={col}>
                  {col.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </DataTable.Title>
              ))}
            </DataTable.Header>

            {entries.map(([rowName, rowData]: [string, any]) => (
              <DataTable.Row key={rowName}>
                <DataTable.Cell>{rowName}</DataTable.Cell>
                {columns.map((col) => (
                  <DataTable.Cell key={col}>
                    {renderValue(rowData[col])}
                  </DataTable.Cell>
                ))}
              </DataTable.Row>
            ))}
          </DataTable>
        </Surface>
      );
    }

    return null;
  };

  const renderSummarySection = () => {
    if (!results.summary && !results.statistics) return null;

    const summaryData = results.summary || results.statistics;

    return (
      <Card style={styles.sectionCard}>
        <Card.Title
          title="Summary Statistics"
          left={(props) => <IconButton {...props} icon="chart-box" />}
          right={(props) => (
            <IconButton
              {...props}
              icon={expandedSections.has('summary') ? 'chevron-up' : 'chevron-down'}
              onPress={() => toggleSection('summary')}
            />
          )}
        />
        {expandedSections.has('summary') && (
          <Card.Content>{renderObject(summaryData)}</Card.Content>
        )}
      </Card>
    );
  };

  const renderTestResults = () => {
    if (!results.test_results && !results.hypothesis_test) return null;

    const testData = results.test_results || results.hypothesis_test;

    return (
      <Card style={styles.sectionCard}>
        <Card.Title
          title="Test Results"
          left={(props) => <IconButton {...props} icon="flask" />}
          right={(props) => (
            <IconButton
              {...props}
              icon={expandedSections.has('test') ? 'chevron-up' : 'chevron-down'}
              onPress={() => toggleSection('test')}
            />
          )}
        />
        {expandedSections.has('test') && (
          <Card.Content>
            {renderObject(testData)}
            {testData.p_value !== undefined && (
              <View style={styles.significanceContainer}>
                <Chip
                  mode="flat"
                  style={[
                    styles.significanceChip,
                    testData.p_value < 0.05 ? styles.significantChip : styles.notSignificantChip,
                  ]}
                >
                  {testData.p_value < 0.05 ? 'Statistically Significant' : 'Not Significant'}
                </Chip>
              </View>
            )}
          </Card.Content>
        )}
      </Card>
    );
  };

  const renderMatrixData = () => {
    const matrixKeys = ['correlation_matrix', 'covariance_matrix', 'contingency_table'];
    const matrixData = matrixKeys.find((key) => results[key]);

    if (!matrixData) return null;

    return (
      <Card style={styles.sectionCard}>
        <Card.Title
          title={matrixData.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
          left={(props) => <IconButton {...props} icon="table" />}
          right={(props) => (
            <IconButton
              {...props}
              icon={expandedSections.has('matrix') ? 'chevron-up' : 'chevron-down'}
              onPress={() => toggleSection('matrix')}
            />
          )}
        />
        {expandedSections.has('matrix') && (
          <Card.Content>
            <ScrollView horizontal>
              {renderTable(results[matrixData])}
            </ScrollView>
          </Card.Content>
        )}
      </Card>
    );
  };

  const renderFrequencyData = () => {
    if (!results.frequencies && !results.word_frequencies) return null;

    const freqData = results.frequencies || results.word_frequencies;

    return (
      <Card style={styles.sectionCard}>
        <Card.Title
          title="Frequency Distribution"
          left={(props) => <IconButton {...props} icon="chart-histogram" />}
          right={(props) => (
            <IconButton
              {...props}
              icon={expandedSections.has('frequency') ? 'chevron-up' : 'chevron-down'}
              onPress={() => toggleSection('frequency')}
            />
          )}
        />
        {expandedSections.has('frequency') && (
          <Card.Content>{renderObject(freqData)}</Card.Content>
        )}
      </Card>
    );
  };

  const renderAdditionalSections = () => {
    const renderedKeys = new Set([
      'summary',
      'statistics',
      'test_results',
      'hypothesis_test',
      'correlation_matrix',
      'covariance_matrix',
      'contingency_table',
      'frequencies',
      'word_frequencies',
      'status',
      'message',
    ]);

    const additionalData = Object.entries(results).filter(
      ([key]) => !renderedKeys.has(key)
    );

    if (additionalData.length === 0) return null;

    return additionalData.map(([key, value]) => (
      <Card key={key} style={styles.sectionCard}>
        <Card.Title
          title={key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
          left={(props) => <IconButton {...props} icon="information" />}
          right={(props) => (
            <IconButton
              {...props}
              icon={expandedSections.has(key) ? 'chevron-up' : 'chevron-down'}
              onPress={() => toggleSection(key)}
            />
          )}
        />
        {expandedSections.has(key) && (
          <Card.Content>
            {typeof value === 'object' && value !== null
              ? renderObject(value)
              : <Text variant="bodyMedium">{renderValue(value)}</Text>}
          </Card.Content>
        )}
      </Card>
    ));
  };

  return (
    <View style={styles.container}>
      <Card style={styles.headerCard}>
        <Card.Title
          title={`Analysis Results: ${methodName}`}
          subtitle={timestamp ? `Completed: ${new Date(timestamp).toLocaleString()}` : undefined}
          right={(props) => onClose && <IconButton {...props} icon="close" onPress={onClose} />}
        />
        {results.message && (
          <Card.Content>
            <Text variant="bodyMedium" style={styles.messageText}>
              {results.message}
            </Text>
          </Card.Content>
        )}
      </Card>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderSummarySection()}
        {renderTestResults()}
        {renderMatrixData()}
        {renderFrequencyData()}
        {renderAdditionalSections()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerCard: {
    marginBottom: 16,
    elevation: 2,
  },
  messageText: {
    fontStyle: 'italic',
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  sectionCard: {
    marginBottom: 12,
    elevation: 1,
  },
  objectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    flexWrap: 'wrap',
  },
  keyText: {
    fontWeight: '600',
    flex: 1,
    minWidth: 120,
  },
  valueText: {
    flex: 1,
    textAlign: 'right',
  },
  nestedObject: {
    marginVertical: 8,
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: '#e0e0e0',
  },
  nestedTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  arrayContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    flex: 1,
    justifyContent: 'flex-end',
  },
  arrayChip: {
    marginVertical: 2,
  },
  tableSurface: {
    borderRadius: 8,
    marginVertical: 8,
  },
  tableTitle: {
    padding: 12,
    fontWeight: '600',
  },
  significanceContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  significanceChip: {
    paddingHorizontal: 16,
  },
  significantChip: {
    backgroundColor: '#c8e6c9',
  },
  notSignificantChip: {
    backgroundColor: '#ffccbc',
  },
});

export default AnalysisResults;
