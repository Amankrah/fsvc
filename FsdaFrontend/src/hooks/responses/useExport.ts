/**
 * useExport Hook
 * Handles CSV and JSON export operations
 */

import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { showAlert } from '../../utils/alert';
import apiService from '../../services/api';

type ExportFormat = 'csv' | 'json';

export const useExport = (projectId: string, projectName: string) => {
  const [exporting, setExporting] = useState(false);

  const exportData = useCallback(
    async (format: ExportFormat, filters?: any) => {
      try {
        setExporting(true);

        const data = await apiService.exportResponses(projectId, format, filters);

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
          showAlert('Success', `Responses exported to ${format.toUpperCase()} successfully`);
        } else {
          // For mobile, show message
          showAlert('Export', `${format.toUpperCase()} export feature is available on web platform`);
        }
      } catch (error: any) {
        console.error('Error exporting responses:', error);
        showAlert('Error', error.response?.data?.error || 'Failed to export responses');
      } finally {
        setExporting(false);
      }
    },
    [projectId, projectName]
  );

  const handleExportCSV = useCallback((filters?: any) => exportData('csv', filters), [exportData]);
  const handleExportJSON = useCallback((filters?: any) => exportData('json', filters), [exportData]);

  return {
    exporting,
    handleExportCSV,
    handleExportJSON,
  };
};
