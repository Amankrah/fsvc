/**
 * useImportExport Hook
 * Handles import/export operations for questions
 */

import { useState, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import apiService from '../../services/api';

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
        Alert.alert('Success', `${format.toUpperCase()} template downloaded successfully`);
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
            Alert.alert('Success', `${format.toUpperCase()} template ready. Choose where to save it.`);
          } else {
            Alert.alert('Success', `Template saved to: ${fileUri}`);
          }
        };
      }
    } catch (error) {
      console.error(`Error downloading ${format} template:`, error);
      Alert.alert('Error', `Failed to download ${format.toUpperCase()} template`);
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
        Alert.alert('Invalid File', 'Please select a CSV or Excel file (.csv, .xlsx, .xls)');
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

        // Show success with details
        Alert.alert(
          'Import Successful! 🎉',
          `✅ Created: ${importResultData.created} questions\n✅ Updated: ${importResultData.updated} questions${
            importResultData.errors && importResultData.errors.length > 0
              ? `\n⚠️  Errors: ${importResultData.errors.length}`
              : ''
          }`,
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

        let errorMessage = 'Failed to import questions to Question Bank';
        const details: string[] = [];

        if (error.details && Array.isArray(error.details)) {
          details.push(...error.details.slice(0, 10));
          if (error.details.length > 10) {
            details.push(`... and ${error.details.length - 10} more errors`);
          }
        } else if (error.error) {
          details.push(error.error);
        }

        setImportResult({
          created: 0,
          updated: 0,
          errors: details,
          error: true,
        });

        Alert.alert('Import Failed', errorMessage + '\n\n' + details.join('\n'));
      } finally {
        setImporting(false);
        setImportProgress(0);
      }
    } catch (error: any) {
      console.error('Error in import handler:', error);
      if (error.message !== 'User cancelled document picker') {
        Alert.alert('Error', 'Failed to select file');
      }
    }
  }, [projectId, onImportSuccess]);

  return {
    showImportExportDialog,
    setShowImportExportDialog,
    importing,
    importProgress,
    importResult,
    handleDownloadTemplate,
    handleImportQuestions,
  };
};
