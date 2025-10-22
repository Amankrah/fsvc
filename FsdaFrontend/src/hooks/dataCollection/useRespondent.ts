/**
 * useRespondent Hook
 * Manages respondent ID generation and state
 */

import { useState, useCallback } from 'react';
import { generateRespondentId } from '../../utils/respondentIdGenerator';
import { RespondentType, CommodityType } from '../../types';

export const useRespondent = (projectId: string) => {
  const [respondentId, setRespondentId] = useState('');
  const [useAutoId, setUseAutoId] = useState(true);
  const [selectedRespondentType, setSelectedRespondentType] = useState<RespondentType | ''>('');
  const [selectedCommodities, setSelectedCommodities] = useState<CommodityType[]>([]);
  const [selectedCountry, setSelectedCountry] = useState('');

  const generateNewRespondentId = useCallback(() => {
    const autoId = generateRespondentId(projectId);
    setRespondentId(autoId);
  }, [projectId]);

  const handleToggleAutoId = useCallback((enabled: boolean) => {
    setUseAutoId(enabled);
    if (enabled) {
      generateNewRespondentId();
    } else {
      setRespondentId('');
    }
  }, [generateNewRespondentId]);

  const resetForNextRespondent = useCallback(() => {
    if (useAutoId) {
      generateNewRespondentId();
    } else {
      setRespondentId('');
    }
  }, [useAutoId, generateNewRespondentId]);

  const toggleCommodity = useCallback((commodity: CommodityType) => {
    setSelectedCommodities(prev =>
      prev.includes(commodity)
        ? prev.filter(c => c !== commodity)
        : [...prev, commodity]
    );
  }, []);

  return {
    respondentId,
    setRespondentId,
    useAutoId,
    handleToggleAutoId,
    selectedRespondentType,
    setSelectedRespondentType,
    selectedCommodities,
    setSelectedCommodities,
    toggleCommodity,
    selectedCountry,
    setSelectedCountry,
    generateNewRespondentId,
    resetForNextRespondent,
  };
};
