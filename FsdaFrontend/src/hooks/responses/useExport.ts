/**
 * useExport Hook
 * Handles CSV and JSON export operations
 */

import { useState, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import apiService from '../../services/api';

type ExportFormat = 'csv' | 'json';

export const useExport = (projectId: string, projectName: string) => {
  const [exporting, setExporting] = useState(false);

  const exportData = useCallback(
    async (format: ExportFormat) => {
      try {
        setExporting(true);

        const data = await apiService.exportResponses(projectId, format);

        // For web, trigger download
        if (Platform.OS === 'web') {
          const mimeType = format === 'csv' ? 'text/csv' : 'application/json';
          const blob = new Blob([data], { type: mimeType });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${projectName}_responses_${new Date().toISOString().split('T')[0]}.${format}`;
          link.click();
          window.URL.revokeObjectURL(url);
          Alert.alert('Success', `Responses exported to ${format.toUpperCase()} successfully`);
        } else {
          // For mobile, show message
          Alert.alert('Export', `${format.toUpperCase()} export feature is available on web platform`);
        }
      } catch (error: any) {
        console.error('Error exporting responses:', error);
        Alert.alert('Error', error.response?.data?.error || 'Failed to export responses');
      } finally {
        setExporting(false);
      }
    },
    [projectId, projectName]
  );

  const handleExportCSV = useCallback(() => exportData('csv'), [exportData]);
  const handleExportJSON = useCallback(() => exportData('json'), [exportData]);

  return {
    exporting,
    handleExportCSV,
    handleExportJSON,
  };
};
