/**
 * useImportExport Hook
 * Handles import/export operations for questions
 */

import { useState, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import apiService from '../../services/api';

// Helper function for showing alerts
const showAlert = (title: string, message: string, buttons?: any[]) => {
  if (Platform.OS === 'web') {
    alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message, buttons);
  }
};

export const useImportExport = (projectId: string, onImportSuccess: () => Promise<void>) => {
  const [showImportExportDialog, setShowImportExportDialog] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<any>(null);

  const handleDownloadTemplate = useCallback(async (format: 'csv' | 'excel') => {
    try {
      const blob =
        format === 'csv'
          ? await apiService.downloadCSVTemplate()
          : await apiService.downloadExcelTemplate();

      const fileName = `question_template_${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`;

      if (Platform.OS === 'web') {
        // Web download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showAlert('Success', `${format.toUpperCase()} template downloaded successfully`);
      } else {
        // Mobile: Save to device using expo-file-system and share
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;

        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const base64 = base64data.split(',')[1];

          // Save file
          await FileSystem.writeAsStringAsync(fileUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });

          // Check if sharing is available
          const isAvailable = await Sharing.isAvailableAsync();
          if (isAvailable) {
            await Sharing.shareAsync(fileUri, {
              mimeType:
                format === 'csv'
                  ? 'text/csv'
                  : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              dialogTitle: 'Save Question Template',
              UTI:
                format === 'csv' ? 'public.comma-separated-values-text' : 'org.openxmlformats.spreadsheetml.sheet',
            });
            showAlert('Success', `${format.toUpperCase()} template ready. Choose where to save it.`);
          } else {
            showAlert('Success', `Template saved to: ${fileUri}`);
          }
        };
      }
    } catch (error) {
      console.error(`Error downloading ${format} template:`, error);
      showAlert('Error', `Failed to download ${format.toUpperCase()} template`);
    } finally {
      setShowImportExportDialog(false);
    }
  }, []);

  const handleImportQuestions = useCallback(async () => {
    try {
      // Use expo-document-picker for cross-platform file selection
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];

      if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
        showAlert('Invalid File', 'Please select a CSV or Excel file (.csv, .xlsx, .xls)');
        return;
      }

      // Start import
      setImporting(true);
      setImportProgress(0.1);
      setImportResult(null);

      try {
        // Create file object for upload
        let fileToUpload: File;

        if (Platform.OS === 'web') {
          // On web, fetch the URI and create File object
          const response = await fetch(file.uri);
          const blob = await response.blob();
          fileToUpload = new File([blob], file.name, { type: file.mimeType || '' });
        } else {
          // On mobile, create FormData compatible object
          fileToUpload = {
            uri: file.uri,
            name: file.name,
            type: file.mimeType || 'application/octet-stream',
          } as any;
        }

        setImportProgress(0.3);

        // Upload and import to QuestionBank (project-specific)
        const importResultData = await apiService.importQuestions(fileToUpload, projectId);

        setImportProgress(1.0);
        setImportResult(importResultData);

        // Reload questions from QuestionBank
        await onImportSuccess();

        // Build detailed message with errors if any
        let detailMessage = `✅ Created: ${importResultData.created} questions\n✅ Updated: ${importResultData.updated} questions`;

        if (importResultData.errors && importResultData.errors.length > 0) {
          detailMessage += `\n\n⚠️ ${importResultData.errors.length} Error(s):\n`;
          // Show first 5 errors in detail
          const errorsToShow = importResultData.errors.slice(0, 5);
          errorsToShow.forEach((err: string, idx: number) => {
            detailMessage += `\n${idx + 1}. ${err}`;
          });
          if (importResultData.errors.length > 5) {
            detailMessage += `\n\n... and ${importResultData.errors.length - 5} more errors.`;
            detailMessage += `\nCheck the console for full error list.`;
            console.log('Full import errors:', importResultData.errors);
          }
        }

        // Show success with details
        showAlert(
          importResultData.errors && importResultData.errors.length > 0
            ? 'Import Completed with Errors'
            : 'Import Successful! 🎉',
          detailMessage,
          [
            {
              text: 'OK',
              onPress: () => {
                setImporting(false);
                setImportResult(null);
                setShowImportExportDialog(false);
              },
            },
          ]
        );
      } catch (error: any) {
        console.error('Error importing questions:', error);
        console.log('Full error details:', JSON.stringify(error, null, 2));

        let errorMessage = 'Failed to import questions to Question Bank';
        const details: string[] = [];

        if (error.details && Array.isArray(error.details)) {
          // Show detailed errors with row numbers
          error.details.forEach((detail: string, idx: number) => {
            if (idx < 10) {
              details.push(detail);
            }
          });
          if (error.details.length > 10) {
            details.push(`\n... and ${error.details.length - 10} more errors`);
          }
        } else if (error.error) {
          details.push(error.error);
        } else if (error.message) {
          details.push(error.message);
        }

        setImportResult({
          created: 0,
          updated: 0,
          errors: error.details || details,
          error: true,
        });

        const alertMessage = details.length > 0
          ? `${errorMessage}\n\n${details.join('\n')}`
          : errorMessage;

        showAlert('Import Failed', alertMessage);
      } finally {
        setImporting(false);
        setImportProgress(0);
      }
    } catch (error: any) {
      console.error('Error in import handler:', error);
      if (error.message !== 'User cancelled document picker') {
        showAlert('Error', 'Failed to select file');
      }
    }
  }, [projectId, onImportSuccess]);

  const handleExportQuestionBank = useCallback(async (format: 'csv' | 'json') => {
    try {
      const blob =
        format === 'csv'
          ? await apiService.exportQuestionBankCSV(projectId)
          : await apiService.exportQuestionBankJSON(projectId);

      const fileName = `question_bank_${projectId}_${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'json'}`;

      if (Platform.OS === 'web') {
        // Web download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showAlert('Success', `Question Bank exported to ${format.toUpperCase()} successfully`);
      } else {
        // Mobile: Save to device using expo-file-system and share
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;

        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const base64 = base64data.split(',')[1];

          // Save file
          await FileSystem.writeAsStringAsync(fileUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });

          // Check if sharing is available
          const isAvailable = await Sharing.isAvailableAsync();
          if (isAvailable) {
            await Sharing.shareAsync(fileUri, {
              mimeType: format === 'csv' ? 'text/csv' : 'application/json',
              dialogTitle: 'Save Question Bank Export',
              UTI: format === 'csv' ? 'public.comma-separated-values-text' : 'public.json',
            });
            showAlert('Success', `Question Bank export ready. Choose where to save it.`);
          } else {
            showAlert('Success', `Export saved to: ${fileUri}`);
          }
        };
      }
    } catch (error: any) {
      console.error(`Error exporting Question Bank to ${format}:`, error);
      showAlert('Error', error.message || `Failed to export Question Bank to ${format.toUpperCase()}`);
    } finally {
      setShowImportExportDialog(false);
    }
  }, [projectId]);

  return {
    showImportExportDialog,
    setShowImportExportDialog,
    importing,
    importProgress,
    importResult,
    handleDownloadTemplate,
    handleImportQuestions,
    handleExportQuestionBank,
  };
};
