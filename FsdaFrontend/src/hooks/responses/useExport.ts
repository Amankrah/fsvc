/**
 * useExport Hook
 * Handles bundle pivot export with mandatory filter selection
 * CRITICAL: ALL filters (respondent_type, commodity, country) must be selected before export
 */

import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { showAlert } from '../../utils/alert';
import apiService from '../../services/api';

interface BundleFilters {
  respondent_type?: string;
  commodity?: string;
  country?: string;
}

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
      // Validate all filters are selected
      if (!validateFilters(filters)) {
        return;
      }

      try {
        setExporting(true);

        // Call API with all three filter parameters
        const data = await apiService.exportBundlePivot(
          projectId,
          filters.respondent_type!,
          filters.commodity!,
          filters.country!
        );

        // For web, trigger download
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

  return {
    exporting,
    handleExportBundlePivot,
    validateFilters,
  };
};
