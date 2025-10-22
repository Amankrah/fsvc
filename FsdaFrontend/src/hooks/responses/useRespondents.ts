/**
 * useRespondents Hook
 * Manages respondent data fetching and state
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import apiService from '../../services/api';

export interface Respondent {
  id: string;
  respondent_id: string;
  name?: string;
  email?: string;
  created_at: string;
  last_response_at?: string;
  response_count: number;
  completion_rate: number;
}

export const useRespondents = (projectId: string) => {
  const [respondents, setRespondents] = useState<Respondent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRespondents = useCallback(async () => {
    try {
      const data = await apiService.getRespondents(projectId);
      const respondentList: Respondent[] = Array.isArray(data) ? data : data.results || [];
      setRespondents(respondentList);
      return respondentList;
    } catch (error) {
      console.error('Error loading respondents:', error);
      throw error;
    }
  }, [projectId]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      await loadRespondents();
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load responses');
    } finally {
      setLoading(false);
    }
  }, [loadRespondents]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadRespondents();
    } catch (error) {
      // Error already logged
    } finally {
      setRefreshing(false);
    }
  }, [loadRespondents]);

  return {
    respondents,
    loading,
    refreshing,
    loadData,
    handleRefresh,
  };
};
