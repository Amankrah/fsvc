/**
 * useExport Hook
 * Bundle pivot export (requires all filters) plus CSV, JSON, and Excel export.
 */

import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { showAlert } from '../../utils/alert';
import apiService from '../../services/api';

export interface BundleFilters {
  respondent_type?: string;
  commodity?: string;
  country?: string;
}

type ExportFormat = 'csv' | 'json' | 'xlsx';

export const useExport = (projectId: string, projectName: string) => {
  const [exporting, setExporting] = useState(false);

  const validateFilters = (filters: BundleFilters): boolean => {
    if (!filters.respondent_type || !filters.commodity || !filters.country) {
      showAlert(
        'Filter Selection Required',
        'Please select ALL filters (Type, Commodity, and Country) before exporting. This prevents system timeouts with large datasets.'
      );
      return false;
    }
    return true;
  };

  const handleExportBundlePivot = useCallback(
    async (filters: BundleFilters) => {
      if (!validateFilters(filters)) {
        return;
      }

      try {
        setExporting(true);

        const data = await apiService.exportBundlePivot(
          projectId,
          filters.respondent_type!,
          filters.commodity!,
          filters.country!
        );

        if (Platform.OS === 'web') {
          const blob = new Blob([data], { type: 'text/csv' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const filterLabel = `${filters.respondent_type}_${filters.commodity}_${filters.country}`;
          link.download = `${projectName}_${filterLabel}_${new Date().toISOString().split('T')[0]}.csv`;
          link.click();
          window.URL.revokeObjectURL(url);
          showAlert('Success', `Bundle exported successfully`);
        } else {
          showAlert('Export', 'Export feature is available on web platform');
        }
      } catch (error: any) {
        console.error('Error exporting bundle:', error);
        showAlert('Error', error.response?.data?.error || 'Failed to export bundle');
      } finally {
        setExporting(false);
      }
    },
    [projectId, projectName]
  );

  const exportData = useCallback(
    async (format: ExportFormat, filters?: any) => {
      try {
        setExporting(true);

        const data = await apiService.exportResponses(projectId, format, filters);

        if (Platform.OS === 'web') {
          if (format === 'xlsx') {
            const blob = data instanceof Blob
              ? data
              : new Blob([data], {
                  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${projectName}_responses_${new Date().toISOString().split('T')[0]}.xlsx`;
            link.click();
            window.URL.revokeObjectURL(url);
          } else {
            const mimeType = format === 'csv' ? 'text/csv' : 'application/json';
            const blob = new Blob([data], { type: mimeType });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${projectName}_responses_${new Date().toISOString().split('T')[0]}.${format}`;
            link.click();
            window.URL.revokeObjectURL(url);
          }
          showAlert('Success', `Responses exported to ${format.toUpperCase()} successfully`);
        } else {
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
  const handleExportExcel = useCallback((filters?: any) => exportData('xlsx', filters), [exportData]);

  return {
    exporting,
    validateFilters,
    handleExportBundlePivot,
    handleExportCSV,
    handleExportJSON,
    handleExportExcel,
  };
};
